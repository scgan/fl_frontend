/** 后端所有成功响应共享的传输信封。 */
export interface ApiEnvelope<T> {
  /** 稳定机器码，成功时为 OK。 */
  code: string
  /** 面向用户或开发者的结果说明。 */
  message: string
  /** 泛型业务载荷。 */
  data: T
  /** 可关联响应头和审计日志的请求追踪标识。 */
  request_id: string
}

/** Axios 错误分支使用的标准后端错误信封。 */
export interface ApiErrorPayload {
  code: string
  message: string
  data: unknown
  request_id: string
}
