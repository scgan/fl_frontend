/**
 * 生成浏览器端临时 UUID，供上传队列和 Agent 请求标识使用。
 * 非安全 HTTP 页面无法调用 randomUUID，改用仍可用的 Web Crypto 随机字节。
 */

/**
 * 生成符合 UUID v4 格式的客户端标识。
 *
 * @returns 使用浏览器密码学随机源生成的 UUID。
 */
export function createClientUuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()

  // getRandomValues 在普通 HTTP 页面仍可使用；版本位和变体位保持 UUID v4 约束。
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
