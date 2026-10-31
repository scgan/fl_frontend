/** 验证写作操作的自然消息覆盖全部阶段、沿产物恢复章节，并且不改变实际生成参数。 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const api = import('../src/research/utils/writing-question.js')

/** 构造带固定阶段请求和可选结果的 AI 运行快照。 */
function run(id, stage, extra = {}, result) {
  return {
    id,
    query: '人工智能教育',
    request_payload: { writing: { stage, knowledge_base_id: 9, ...extra } },
    result_payload: result ? { payload: { writing_result: result } } : null,
  }
}

test('确认选题、提纲与理论框架后显示完整请求，原始主题及请求参数不变', async () => {
  const { writingQuestion } = await api
  for (const [stage, expected] of [
    ['RQ', '推荐论文选题，并提出具体的研究问题'],
    ['PLAN', '拟一份论文提纲'],
    ['THEORY', '理论框架和研究依据'],
  ]) {
    const turn = run('current', stage, { writing_requirements: '重点讨论教师支持机制' })
    const before = structuredClone(turn)
    const question = writingQuestion(turn)
    assert.ok(question.includes('人工智能教育') && question.includes(expected))
    assert.ok(question.endsWith('补充要求：重点讨论教师支持机制'))
    assert.deepEqual(turn, before)
  }
})

test('从研究问题继续提纲及按指定章节起草，文案包含真实前序内容', async () => {
  const { writingQuestion } = await api
  const rq = run('rq', 'RQ', {}, { stage: 'RQ', artifact_id: 'rq-artifact' })
  const plan = run(
    'plan',
    'PLAN',
    { artifact_id: 'rq-artifact' },
    {
      stage: 'PLAN',
      artifact_id: 'plan-artifact',
      sections: [{ section_id: '2.1', title: '教师支持机制' }],
    },
  )
  const draft = run('draft', 'DRAFT', { artifact_id: 'plan-artifact', section_ref: '2.1' })
  assert.match(writingQuestion(plan, [rq]), /已有研究问题/)
  assert.equal(
    writingQuestion(draft, [rq, plan]),
    '按这份提纲，帮我起草“教师支持机制”这一节的正文。',
  )
  assert.equal(writingQuestion(draft), '按这份提纲，帮我起草第 2.1 节的正文。')
})

test('章节修改可沿多版稿件找到原提纲，粘贴原文与已有产物分别表达', async () => {
  const { writingQuestion } = await api
  const plan = run(
    'plan',
    'PLAN',
    {},
    {
      stage: 'PLAN',
      artifact_id: 'plan-artifact',
      sections: [{ section_id: '2', title: '教师支持机制' }],
    },
  )
  const draft = run(
    'draft',
    'DRAFT',
    { artifact_id: 'plan-artifact', section_ref: '2' },
    { stage: 'DRAFT', artifact_id: 'draft-artifact', section_ref: '2' },
  )
  const revised = run(
    'revision',
    'REVISE',
    { artifact_id: 'draft-artifact' },
    { stage: 'REVISE', artifact_id: 'revised-artifact' },
  )
  const task = run('next', 'REVISE', {
    artifact_id: 'revised-artifact',
    revise_instruction: '补充文献支持，调整论证结构。',
  })
  assert.equal(
    writingQuestion(task, [plan, draft, revised]),
    '请按以下要求修改“教师支持机制”这一节：补充文献支持，调整论证结构。',
  )
  task.request_payload.writing.source_text = '用户提供的待改原文'
  assert.match(writingQuestion(task, [plan, draft, revised]), /修改我提供的原文：补充文献支持/)
  assert.ok(!writingQuestion(task).includes('。。'))
})

test('旧产物链缺失或存在循环仍可展示，不编造章节名', async () => {
  const { writingQuestion } = await api
  const task = run('next', 'REVISE', { artifact_id: 'loop', revise_instruction: '调整结构' })
  const source = run(
    'old',
    'DRAFT',
    { artifact_id: 'loop' },
    { artifact_id: 'loop', section_ref: '3' },
  )
  assert.equal(writingQuestion(task, [source]), '请按以下要求修改第 3 节：调整结构。')
  assert.equal(writingQuestion(task), '请按以下要求修改上一版稿件：调整结构。')
})

test('普通输入、待澄清消息和不认识的写作阶段保留原文', async () => {
  const { writingQuestion } = await api
  const original = {
    query: '我想写个人工智能教育方面的论文',
    result_payload: { payload: { writing_result: { status: 'NEEDS_INPUT', stage: null } } },
  }
  assert.equal(writingQuestion(original), original.query)
  assert.equal(writingQuestion({ query: '解释这个研究问题？' }), '解释这个研究问题？')
  assert.equal(writingQuestion(run('future', 'FUTURE')), '人工智能教育')
})
