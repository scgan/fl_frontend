/** 按本轮实际回答目标展示材料，兼容历史记录仍将整个阅读集合保存在来源字段中。 */

/** 返回本轮篇目并保留来源列表顺序，ASK子集不再显示为整个阅读集合。 */
export function readingDocuments(reading = {}) {
  const documents = reading.source_documents || []
  const targets = reading.task === 'ASK' && reading.target_corpus_ids?.length
    ? new Set(reading.target_corpus_ids)
    : null
  return targets ? documents.filter((item) => targets.has(item.corpus_id)) : documents
}

/** 新结果与历史恢复使用同一份材料投影，表格、计数及后续序号保持一致。 */
export function assistantDocuments(payload = {}) {
  if (payload.reading_result) return readingDocuments(payload.reading_result)
  return payload.search_plan ? (payload.documents || []).slice(0, 10) : payload.documents || []
}

/** 最近操作的材料卡优先；新会话或卡片失效时才退回最新有效列表，不混入推荐文献选择。 */
export function activeReadingContext(turns, activeSourceId) {
  const usable = (turn) => turn.status === 'SUCCESS' && turn.documents?.length
  const source = turns.find((turn) => turn.id === activeSourceId && usable(turn))
    || [...turns].reverse().find(usable)
  return source ? {
    source_run_id: source.id,
    page: source.documentPage || 1,
    selected_ids: (source.selected || []).map((item) => item.corpus_id),
  } : null
}
