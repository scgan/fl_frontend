/** 研究 API 与流式请求复用 Foreign 角色令牌；统一处理身份失效。 */
import axios from 'axios'
import { getAccessToken, expireSession } from './session'
export { getAccessToken } from './session'
export const apiBaseURL = '/research-api'
export const http = axios.create({ baseURL: apiBaseURL, timeout: 15000 })
/** 流式请求携带最新令牌，401 时只注销发送请求时的身份。 */
export async function authorizedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getAccessToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${apiBaseURL}${path}`, { ...init, headers })
  if (response.status === 401) expireSession(token)
  return response
}
http.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
http.interceptors.response.use((response) => response, (error) => {
  if (error.response?.status === 401) {
    const header = String(error.config?.headers?.Authorization ?? '')
    expireSession(header.startsWith('Bearer ') ? header.slice(7) : null)
  }
  return Promise.reject(error)
})
