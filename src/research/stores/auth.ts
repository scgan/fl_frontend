/** 从 Foreign 恢复当前收集者信息；研究模块不维护独立登录。 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import axios from 'axios'
import { getAccessToken, canAccessResearch, expireSession } from '../api/session'
export const useAuthStore = defineStore('research-auth', () => {
  const user = ref<{ username: string; name?: string } | null>(null)
  let restoredToken: string | null = null
  const isAuthenticated = computed(() => Boolean(user.value))
  const displayName = computed(() => user.value?.name || user.value?.username || '数据收集者')
  /** 每次身份改变重新读取本人资料，权限错误与网络故障不注销有效身份。 */
  async function restore(): Promise<void> {
    const token = getAccessToken()
    if (token === restoredToken && user.value) return
    user.value = null
    if (!canAccessResearch()) throw new Error('智能研究仅对数据收集者开放')
    try {
      const response = await axios.get('/api/user/self', { headers: { Authorization: `Bearer ${token}` } })
      if (response.data.code !== 200) throw new Error('无法读取当前用户')
      if (token !== getAccessToken()) throw new Error('登录身份已变更')
      user.value = response.data.data
      restoredToken = token
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) expireSession(token)
      throw error
    }
  }
  return { user, isAuthenticated, displayName, restore }
})
