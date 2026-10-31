/** 智能研究复用 Foreign 当前角色会话；不保存第二份令牌。 */

/** 返回 Foreign 登录后选择角色得到的令牌。 */
export function getAccessToken(): string | null {
  return localStorage.getItem('token')
}

/** 只允许当前选中数据收集者角色的会话进入研究工作区。 */
export function canAccessResearch(): boolean {
  return Boolean(getAccessToken()) && localStorage.getItem('userRole') === '2'
}

/** 清除当前会话并返回登录页，旧请求不得注销已切换的新身份。 */
export function expireSession(expectedToken: string | null): void {
  if (getAccessToken() !== expectedToken) return
  localStorage.removeItem('token')
  localStorage.removeItem('userRole')
  window.location.assign('/login')
}
