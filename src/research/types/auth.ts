/** 前端会话所需的当前用户身份与账号管理标记。 */
export interface SessionUser {
  id: string
  username: string
  display_name: string | null
  email: string | null
  organization: string | null
  status: string
  is_admin: boolean
}

/** 登录或刷新成功后的认证数据；不包含 Refresh Token 明文。 */
export interface AuthResult {
  access_token: string
  token_type: string
  expires_in: number
  refresh_expires_at: string
  user: SessionUser
}
