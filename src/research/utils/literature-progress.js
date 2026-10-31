/** 将单次文献阅读 Run 的持久化步骤和有序事件转换为顶部进度，不复用其他会话的状态。 */
import { latestAssistantStep } from './assistant-progress.js'

const labels = {
  ReadMaterials: '正在读取所选文献',
  AnalyzeDocuments: '正在分析文献',
  SynthesizeReading: '正在整理综合分析与文献推荐',
  RecommendLiterature: '正在检索库内推荐文献',
  AnswerFollowup: '正在查阅原文并回答',
  FinalizeReading: '正在整理阅读结果',
}

/** 按当前 Run 的实际步骤显示进度；历史恢复和实时推送使用同一规则。 */
export function literatureProgressLabel(run) {
  if (!run) return '正在准备文献'
  if (!['PENDING', 'RUNNING'].includes(run.status)) return ''
  const step = latestAssistantStep(run.steps)
  if (!step) {
    if (run.id && run.status === 'PENDING') return '请求已提交，等待开始'
    return run.request_payload?.task === 'ASK' ? '正在查阅相关原文' : '正在准备分析'
  }
  if (step.status === 'SUCCESS')
    return step.node_name === 'FinalizeReading' ? '正在保存阅读结果' : '正在衔接下一步处理'
  if (['FAILED', 'CANCELLED'].includes(step.status)) return '正在结束本次任务'
  if (step.node_name.startsWith('AnalyzeDocument:')) return '正在分析文献'
  return labels[step.node_name] || '正在处理文献'
}

/**
 * 仅向相同 Run 合并有序步骤；已完成步骤不被重放的 started 回退。
 * @param {object|null} current 当前页面绑定的 Run 快照。
 * @param {string} runId 此订阅所属的真实 Run ID。
 * @param {object} event 已解析的 SSE 或只读快照事件。
 * @returns {object|null} 合并后的当前快照；无效或过期事件保持原对象。
 */
export function mergeLiteratureProgress(current, runId, event) {
  if (!current || current.id !== runId || !['PENDING', 'RUNNING'].includes(current.status))
    return current
  const status = { 'node.started': 'RUNNING', 'node.completed': 'SUCCESS', 'node.failed': 'FAILED' }[event.event]
  const sequence = Number(event.data?.sequence)
  const name = event.data?.node
  if (!status || !Number.isSafeInteger(sequence) || sequence < 1 || typeof name !== 'string' || !name)
    return current
  const steps = Array.isArray(current.steps) ? current.steps : []
  const previous = steps.find(step => step.sequence === sequence)
  if (previous && ['SUCCESS', 'FAILED', 'CANCELLED'].includes(previous.status)) return current
  // 部分历史重放可能落后于已加载的完整快照，不重新插入旧的未知运行节点。
  if (!previous && status === 'RUNNING' && steps.some(step => step.sequence > sequence)) return current
  return { ...current, status: 'RUNNING', steps: [
    ...steps.filter(step => step.sequence !== sequence),
    { ...previous, sequence, node_name: name, status },
  ] }
}
