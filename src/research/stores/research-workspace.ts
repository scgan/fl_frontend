/** 管理智能研究工作台之间共享的面板可见性偏好。 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

const HISTORY_VISIBILITY_KEY = 'eduresearch_research_history_visible'

/** 从本地存储恢复历史栏偏好；首次访问和存储异常时默认显示。 */
function initialHistoryVisibility(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem(HISTORY_VISIBILITY_KEY) !== 'false'
  } catch {
    return true
  }
}

/** 为启明、智鉴、溯知和融通提供一致且可跨路由保留的历史栏状态。 */
export const useResearchWorkspaceStore = defineStore('research-workspace', () => {
  /** 四个智能研究模块共同使用的左侧历史栏可见状态。 */
  const historyVisible = ref(initialHistoryVisibility())

  /** 切换历史栏并持久化，保证进入其他智能研究模块后状态保持一致。 */
  function toggleHistory(): void {
    historyVisible.value = !historyVisible.value
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(HISTORY_VISIBILITY_KEY, String(historyVisible.value))
    } catch {
      // 存储不可用时仍保留当前 SPA 会话中的响应式状态。
    }
  }

  return { historyVisible, toggleHistory }
})
