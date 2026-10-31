/** 验证写作卡片按操作恢复状态、兼容旧历史，并允许失败重试而不解锁成功操作。 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const api = import('../src/research/utils/writing-actions.js')

/** 构造与服务端一致的运行快照，结果和提交参数分开保存。 */
function run(id, result, writing, status = 'SUCCESS', query = '研究主题') {
  return { id, status, query, request_payload: writing ? { writing } : {},
    result_payload: { payload: { writing_result: result } } }
}

test('确认任务刷新后仍锁定，提交快照恢复实际知识库和修改后的主题', async () => {
  const { collectWritingActions, writingActionLocked } = await api
  const source = run('source', { status: 'NEEDS_INPUT', stage: 'PLAN' })
  const writing = { source_run_id: 'source', source_action: 'confirm', stage: 'PLAN', knowledge_base_id: 9 }
  for (const status of ['PENDING', 'RUNNING', 'SUCCESS']) {
    const actions = collectWritingActions([source, run('child', {}, writing, status, '修改后的主题')])
    assert.equal(writingActionLocked(actions.source.confirm), true)
    assert.equal(actions.source.confirm.query, '修改后的主题')
    assert.equal(actions.source.confirm.writing.knowledge_base_id, 9)
  }
})

test('失败和取消可重试，正在重试的状态覆盖旧失败，成功不被旧提交状态覆盖', async () => {
  const { collectWritingActions, writingActionLocked } = await api
  const source = run('source', { status: 'NEEDS_INPUT' })
  const writing = { source_run_id: 'source', source_action: 'confirm', stage: 'PLAN' }
  for (const status of ['FAILED', 'CANCELLED']) {
    const turns = [source, run('failed', {}, writing, status)]
    assert.equal(writingActionLocked(collectWritingActions(turns).source.confirm), false)
    assert.equal(collectWritingActions(turns, { source: { confirm: { status: 'SUBMITTING' } } }).source.confirm.status, 'SUBMITTING')
  }
  const turns = [source, run('done', {}, writing), run('late-failure', {}, writing, 'FAILED')]
  assert.equal(collectWritingActions(turns, { source: { confirm: { status: 'FAILED' } } }).source.confirm.status, 'SUCCESS')
})

test('选题、章节和稿件修改分别锁定，新版本仍可修改', async () => {
  const { collectWritingActions, writingActionLocked } = await api
  const turns = [run('rq', { stage: 'RQ', artifact_id: 'rq-artifact' }),
    run('plan', { stage: 'PLAN', artifact_id: 'plan-artifact' }, { source_run_id: 'rq', source_action: 'plan:0' }),
    run('draft', { stage: 'DRAFT', artifact_id: 'draft-artifact' }, { source_run_id: 'plan', source_action: 'draft:2' }),
    run('revision', { stage: 'REVISE', artifact_id: 'revision-artifact' }, { source_run_id: 'draft', source_action: 'revise' })]
  const actions = collectWritingActions(turns)
  assert.equal(writingActionLocked(actions.rq['plan:0']), true)
  assert.equal(actions.rq['plan:1'], undefined)
  assert.equal(writingActionLocked(actions.plan['draft:2']), true)
  assert.equal(actions.plan['draft:1'], undefined)
  assert.equal(writingActionLocked(actions.draft.revise), true)
  assert.equal(actions.revision, undefined)
})

test('旧卡片按精确主题或前序产物恢复，不能锁住其他章节和不相干确认卡', async () => {
  const { collectWritingActions } = await api
  const turns = [run('unrelated', { status: 'NEEDS_INPUT', stage: 'PLAN', research_topic: '其他主题' }),
    run('source', { status: 'NEEDS_INPUT', stage: 'PLAN', research_topic: '研究主题' }),
    run('plan', { stage: 'PLAN', artifact_id: 'plan-artifact' }, { stage: 'PLAN', knowledge_base_id: 9 }),
    run('draft', {}, { stage: 'DRAFT', artifact_id: 'plan-artifact', section_ref: '2' })]
  const actions = collectWritingActions(turns)
  assert.equal(actions.source.confirm.status, 'SUCCESS')
  assert.equal(actions.unrelated, undefined)
  assert.equal(actions.plan['draft:2'].status, 'SUCCESS')
  assert.equal(actions.plan['draft:1'], undefined)
})
