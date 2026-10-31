/** 按真实来源运行保存勾选和分析状态；仅缓存 ID、页码与状态，不保存文献正文。 */

const PREFIX = 'ai.reading-card.v1:'
const LOCKED = new Set(['SUBMITTING', 'PENDING', 'RUNNING', 'SUCCESS'])

/** 规范文献 ID 并保留勾选顺序，拒绝字符串、负数和重复项。 */
function documentIds(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .filter((id) => Number.isSafeInteger(id) && id > 0))]
}

/** 相同篇目即使勾选顺序不同也属于同组；空选择和超过二十篇不能发起分析。 */
export function readingGroupKey(values) {
  const ids = documentIds(values)
  return ids.length && ids.length <= 20 ? ids.sort((a, b) => a - b).join(',') : ''
}

/** 分析已成功或执行中时锁定，失败及取消允许重新发起。 */
export function readingAnalysisLocked(action) {
  return LOCKED.has(action?.status)
}

/** 提取服务端已确认的阅读范围，执行中使用步骤快照，不猜测普通问题的任务类型。 */
function readingScope(turn) {
  return turn.result_payload?.payload?.reading_result
    || [...(turn.steps || [])].reverse().find((step) => step.output_summary?.reading_scope)
      ?.output_summary.reading_scope
}

/** 创建隔离的卡片状态仓库，存储不可用时在当前应用生命周期内继续工作。 */
export function createReadingCardState(getStorage = () => globalThis.sessionStorage) {
  const memory = new Map()

  /** 读取单个来源，损坏或被浏览器禁用的缓存不阻止正常问答。 */
  function read(sourceId) {
    try {
      const text = getStorage()?.getItem(PREFIX + sourceId)
      if (text) {
        const value = JSON.parse(text)
        if (value && typeof value === 'object' && !Array.isArray(value)) return value
      }
    } catch { /* 当前页仍可使用内存状态。 */ }
    return memory.get(sourceId) || {}
  }

  /** 写入单个来源；只接收有限长度的真实运行 ID。 */
  function write(sourceId, value) {
    if (typeof sourceId !== 'string' || !sourceId || sourceId.length > 128) return
    memory.set(sourceId, value)
    try { getStorage()?.setItem(PREFIX + sourceId, JSON.stringify(value)) } catch { /* 允许无存储浏览。 */ }
  }

  /** 立即保存当前勾选和页码；显式取消全部勾选也需要保留。 */
  function select(sourceId, rows, page = 1) {
    write(sourceId, {
      ...read(sourceId), selectedIds: documentIds(rows.map((row) => row.corpus_id)),
      page: Number.isInteger(page) && page >= 1 && page <= 50 ? page : 1,
      selectionUpdatedAt: Date.now(),
    })
  }

  /** 记录独立阅读页已接受的真实运行；追问不能覆盖原分析状态。 */
  function record(sourceId, ids, run) {
    const key = readingGroupKey(ids)
    if (!key || !run?.id || !['PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED'].includes(run.status)) return
    const value = read(sourceId)
    const actions = (Array.isArray(value.actions) ? value.actions : [])
      .filter((action) => action?.key !== key).slice(-19)
    actions.push({ key, runId: run.id, status: run.status })
    write(sourceId, { ...value, actions })
  }

  /** 读取独立阅读的引用，返回会话时可按运行 ID 向服务端核对终态。 */
  function cachedAction(sourceId, ids) {
    const key = readingGroupKey(ids)
    const actions = read(sourceId).actions
    return key && Array.isArray(actions) ? actions.find((action) => action?.key === key) : undefined
  }

  /** 已删除的独立阅读不继续锁定来源按钮，其他组的状态不受影响。 */
  function forgetAction(sourceId, ids) {
    const key = readingGroupKey(ids)
    const value = read(sourceId)
    const actions = Array.isArray(value.actions) ? value.actions : []
    write(sourceId, { ...value, actions: actions.filter((action) => action?.key !== key) })
  }

  /** 汇合当前会话的真实分析和独立阅读记录，成功结果不被较晚的失败覆盖。 */
  function action(turns, sourceId, ids, cached = cachedAction(sourceId, ids)) {
    const key = readingGroupKey(ids)
    if (!key) return undefined
    let found = cached?.key === key ? cached : cachedAction(sourceId, ids)
    const rank = { SUCCESS: 5, RUNNING: 4, PENDING: 3, SUBMITTING: 2, FAILED: 1, CANCELLED: 1 }
    for (const turn of turns) {
      const scope = readingScope(turn)
      if (scope?.task !== 'ANALYZE' || scope.source_run_id !== sourceId
          || readingGroupKey(scope.corpus_ids) !== key) continue
      if ((rank[turn.status] || 0) >= (rank[found?.status] || 0))
        found = { key, runId: turn.id, status: turn.status }
    }
    return found
  }

  /** 恢复提交过的勾选，再覆盖当前标签页较新的草稿；跨页只保存 ID，不伪造题录内容。 */
  function restore(turns) {
    // 1. 从已授权的会话快照收集题录，其他页面的 ID 只用作勾选身份。
    const sources = new Map(turns.map((turn) => [turn.id, turn]))
    const documents = new Map()
    for (const turn of turns) {
      const payload = turn.result_payload?.payload || {}
      for (const row of [...(turn.documents || []), ...(payload.documents || []),
        ...(readingScope(turn)?.source_documents || [])]) documents.set(row.corpus_id, row)
    }
    let activeId = null
    let latest = -1
    /** 只恢复属于当前已授权会话的来源卡。 */
    function apply(sourceId, ids, page) {
      const source = sources.get(sourceId)
      if (!source) return
      source.selected = documentIds(ids).map((id) => documents.get(id) || { corpus_id: id })
      source.restoreDocumentPage = Number.isInteger(page) && page >= 1 && page <= 50 ? page : 1
      activeId = sourceId
    }
    // 2. 重放历次提交的选文，使没有本地草稿的旧会话也能恢复。
    for (const turn of turns) {
      const context = turn.request_payload?.reading_context
      const scope = readingScope(turn)
      if (context && Array.isArray(context.selected_ids))
        apply(context.source_run_id, context.selected_ids, context.page)
      else if (scope?.source_kind === 'SELECTED')
        apply(scope.source_run_id, scope.corpus_ids, 1)
    }
    const submittedActiveId = activeId
    let cachedActiveId = null
    // 3. 当前标签页的选择包含尚未提交的改选或清空，优先于历史提交。
    for (const source of turns) {
      const value = read(source.id)
      if (!Array.isArray(value.selectedIds)) continue
      apply(source.id, value.selectedIds, value.page)
      if ((value.selectionUpdatedAt || 0) > latest) {
        latest = value.selectionUpdatedAt || 0
        cachedActiveId = source.id
      }
    }
    return cachedActiveId || submittedActiveId || null
  }

  /** 删除当前会话时清除对应浏览器草稿，不影响其他会话。 */
  function forget(sourceId) {
    memory.delete(sourceId)
    try { getStorage()?.removeItem(PREFIX + sourceId) } catch { /* 浏览器存储可能被禁用。 */ }
  }

  return { select, record, cachedAction, forgetAction, action, restore, forget }
}

// 两个页面共用同一来源状态，前往独立文献问答再返回时仍能恢复。
export const readingCardState = createReadingCardState()
