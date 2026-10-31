/** 从服务端运行快照恢复写作卡片的逐项操作状态，兼容早期没有来源字段的历史。 */

/** 成功和执行中的操作锁定；失败、取消和未发起操作允许重试。 */
export function writingActionLocked(action) {
  return ['SUBMITTING', 'PENDING', 'RUNNING', 'SUCCESS'].includes(action?.status)
}

/** 将真实运行状态转换为卡片上的短状态文字。 */
export function writingActionLabel(action) {
  return (
    {
      SUBMITTING: '提交中',
      PENDING: '生成中',
      RUNNING: '生成中',
      SUCCESS: '已完成',
      FAILED: '失败，可重试',
      CANCELLED: '已取消，可重试',
    }[action?.status] || ''
  )
}

/** 读取新请求参数或结果中的来源，旧产物则使用明确的前序产物引用。 */
function writingOptions(turn) {
  if (turn.request_payload?.writing) return turn.request_payload.writing
  const result = turn.result_payload?.payload?.writing_result
  if (result?.status === 'NEEDS_INPUT') return null
  return result ? { ...result, artifact_id: result.based_on_artifact_id } : null
}

/** 精确匹配旧版按钮目标；不能因为起草了一个章节就锁住其他章节。 */
function legacySource(turn, previous) {
  const writing = writingOptions(turn)
  if (!writing) return null
  for (const source of [...previous].reverse()) {
    const result = source.result_payload?.payload?.writing_result
    if (!result) continue
    if (writing.artifact_id && result.artifact_id === writing.artifact_id) {
      if (writing.stage === 'DRAFT' && result.stage === 'PLAN')
        return [source.id, `draft:${writing.section_ref}`]
      if (writing.stage === 'REVISE' && ['DRAFT', 'REVISE'].includes(result.stage))
        return [source.id, 'revise']
      if (writing.stage === 'PLAN' && result.stage === 'RQ') {
        const index = (result.research_questions || []).findIndex(
          (item) => item.question === turn.query,
        )
        if (index >= 0) return [source.id, `plan:${index}`]
      }
    }
    if (
      !writing.artifact_id &&
      result.status === 'NEEDS_INPUT' &&
      result.stage === writing.stage &&
      [result.research_topic, source.query].includes(turn.query)
    )
      return [source.id, 'confirm']
  }
  return null
}

/** 汇合历史与当前提交状态，以来源卡和操作为键；成功记录不会被较晚失败覆盖。 */
export function collectWritingActions(turns, submitting = {}) {
  const actions = {}
  for (let index = 0; index < turns.length; index++) {
    const turn = turns[index]
    const writing = writingOptions(turn)
    if (!writing) continue
    const source = writing.source_run_id
      ? [writing.source_run_id, writing.source_action]
      : legacySource(turn, turns.slice(0, index))
    if (!source?.[1]) continue
    const [id, key] = source
    const card = (actions[id] ||= {})
    if (card[key]?.status === 'SUCCESS') continue
    card[key] = {
      status: turn.status,
      runId: turn.id,
      query: turn.query,
      writing,
      error: turn.error_message || '',
    }
  }
  for (const [id, card] of Object.entries(submitting)) {
    for (const [key, action] of Object.entries(card)) {
      const current = (actions[id] ||= {})
      if (action && !writingActionLocked(current[key])) current[key] = action
    }
  }
  return actions
}
