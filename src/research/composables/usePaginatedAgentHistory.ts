/**
 * 专业 Agent 历史分页状态：统一智鉴、溯知和融通的首屏刷新、滚动追加与并发保护。
 */
import { computed, ref } from 'vue'

import { fetchAgentRunHistory } from '@/research/api/agents'
import { useResearchSource } from '@/research/composables/useResearchSource'
import type { AgentRunHistoryItem } from '@/research/types/agents'

// 与启明历史保持一致：首屏和后续滚动每次最多读取 20 条。
const HISTORY_PAGE_SIZE = 20

/**
 * 创建一个按实际执行模块隔离的历史分页状态。
 *
 * @param executorAgentCode 智鉴、溯知或融通的稳定执行模块编码。
 * @returns 历史记录、分页状态以及刷新和追加操作。
 */
export function usePaginatedAgentHistory(executorAgentCode: string) {
  const { source, databaseId } = useResearchSource()
  const items = ref<AgentRunHistoryItem[]>([])
  const page = ref(0)
  const total = ref(0)
  const loading = ref(false)
  let loadPromise: Promise<void> | null = null

  const hasMore = computed(() => page.value * HISTORY_PAGE_SIZE < total.value)

  /**
   * 读取指定页，并按刷新或滚动追加语义更新列表。
   *
   * @param targetPage 从 1 开始的目标页码。
   * @param replace 是否用目标页替换当前列表。
   */
  async function loadPage(targetPage: number, replace: boolean): Promise<void> {
    loading.value = true
    try {
      const result = await fetchAgentRunHistory(
        executorAgentCode,
        targetPage,
        HISTORY_PAGE_SIZE,
        source,
        databaseId,
      )
      const merged = new Map<string, AgentRunHistoryItem>(
        (replace ? [] : items.value).map((item) => [item.id, item]),
      )
      result.items.forEach((item) => merged.set(item.id, item))
      items.value = [...merged.values()]
      page.value = result.page
      total.value = result.total
    } finally {
      loading.value = false
    }
  }

  /**
   * 独占执行一次分页请求，避免连续滚动重复读取同一页。
   *
   * @param targetPage 从 1 开始的目标页码。
   * @param replace 是否替换现有历史。
   */
  async function runLoad(targetPage: number, replace: boolean): Promise<void> {
    const request = loadPage(targetPage, replace)
    loadPromise = request
    try {
      await request
    } finally {
      if (loadPromise === request) loadPromise = null
    }
  }

  /** 刷新最近一页；若滚动请求正在结束，则先等待它释放独占状态。 */
  async function refresh(): Promise<void> {
    if (loadPromise) {
      try {
        await loadPromise
      } catch {
        // 第一页刷新会重新建立可信状态，不沿用上一条追加请求的失败。
      }
    }
    await runLoad(1, true)
  }

  /** 在仍有下一页且当前空闲时追加历史。 */
  async function loadMore(): Promise<void> {
    if (loadPromise || !hasMore.value) return
    await runLoad(page.value + 1, false)
  }

  return { items, total, loading, hasMore, refresh, loadMore }
}
