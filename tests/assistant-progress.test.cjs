/** 验证 AI 进度跟随真实步骤，正确处理嵌套、并行检索、旧快照和断线，不按时间编造进度。 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const api = import('../src/research/utils/assistant-progress.js')

test('嵌套图优先显示执行中的子节点，不被一直运行的写作父节点覆盖', async () => {
  const { assistantProgressLabel } = await api
  const steps = [
    { sequence: 1, node_name: 'WritingTask', status: 'RUNNING' },
    { sequence: 3, node_name: 'PlanSynthesis', status: 'RUNNING' },
    { sequence: 2, node_name: 'LiteratureRetrieval', status: 'SUCCESS' },
  ]
  assert.equal(assistantProgressLabel({ status: 'RUNNING', steps }), '正在生成论文提纲…')
  steps[1].status = 'SUCCESS'
  assert.equal(assistantProgressLabel({ status: 'RUNNING', steps }), '正在衔接下一步处理…')
})

test('并行检索中最新步骤完成后，仍显示另一个实际运行中的检索', async () => {
  const { assistantProgressLabel } = await api
  const steps = [
    { sequence: 1, node_name: 'QimingQA', status: 'RUNNING' },
    { sequence: 2, node_name: 'RetrieveObjectA', status: 'RUNNING' },
    { sequence: 3, node_name: 'RetrieveObjectB', status: 'SUCCESS' },
  ]
  assert.equal(assistantProgressLabel({ status: 'RUNNING', steps }), '正在检索第一组文献…')
})

test('检索、问答和各写作阶段由实际节点决定，未知节点不泄漏内部名称', async () => {
  const { assistantProgressLabel } = await api
  for (const [node, label] of [
    ['IntentClassifier', '正在理解你的问题…'],
    ['DiscoverLiterature', '正在查找相关文献…'],
    ['GenerateAnswer', '正在根据文献生成回答…'],
    ['RQSynthesis', '正在生成选题与研究问题…'],
    ['DraftSynthesis', '正在起草章节正文…'],
    ['ReviseSynthesis', '正在按要求修改稿件…'],
    ['CitationValidator', '正在核对引用与来源…'],
    ['NewInternalNode', '正在处理你的问题…'],
  ]) {
    assert.equal(
      assistantProgressLabel({
        status: 'RUNNING',
        steps: [{ node_name: node, status: 'RUNNING' }],
      }),
      label,
    )
  }
  const run = {
    status: 'RUNNING',
    request_payload: { writing: { stage: 'PLAN' } },
    steps: [{ node_name: 'WritingTask', status: 'RUNNING' }],
  }
  assert.equal(assistantProgressLabel(run), '正在准备论文提纲…')
  run.steps[0].node_name = 'LiteratureRetrieval'
  assert.equal(assistantProgressLabel(run), '正在检索知识库文献…')
})

test('等待、没有步骤的旧快照及连接中断都有确定状态，时间变化不能推进阶段', async () => {
  const { assistantProgressLabel, latestAssistantStep } = await api
  assert.equal(latestAssistantStep(null), undefined)
  assert.equal(assistantProgressLabel({ status: 'PENDING' }), '请求已提交，等待开始…')
  const run = { status: 'RUNNING', steps: null }
  assert.equal(assistantProgressLabel(run), '正在启动本次任务…')
  assert.equal(assistantProgressLabel({ ...run, elapsed: 999 }), assistantProgressLabel(run))
  assert.match(assistantProgressLabel({ ...run, progressDisconnected: true }), /进度暂时无法更新/)
})

test('所有终态停止显示加载，最终整理完成后只提示保存，不提前声称成功', async () => {
  const { assistantProgressLabel } = await api
  for (const status of ['SUCCESS', 'FAILED', 'CANCELLED'])
    assert.equal(
      assistantProgressLabel({
        status,
        steps: [{ node_name: 'PlanSynthesis', status: 'RUNNING' }],
      }),
      '',
    )
  assert.equal(
    assistantProgressLabel({
      status: 'RUNNING',
      steps: [{ node_name: 'Synthesizer', status: 'SUCCESS' }],
    }),
    '正在保存本次结果…',
  )
})
