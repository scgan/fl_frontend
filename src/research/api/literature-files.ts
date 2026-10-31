/** 个人 PDF 上传、材料选择与授权原文接口；复用 Foreign 令牌，不通过公开下载入口读取私有文件。 */
import axios from 'axios'
import { expireSession, getAccessToken } from './session'

export interface ReadingMaterial {
  /** corpus 主键；公共文献和个人文件共用一组 ID。 */
  id: number
  title_cn: string | null
  title_en: string | null
  author: string | null
  publish_time: string | number | null
  attachment: string[] | null
  status: number
  owner_id: number | null
  origin: 'PERSONAL' | 'LIBRARY'
  /** 双路任务及版本复核结果，只有 SUCCESS 可开始完整阅读。 */
  index: { status: string; description: string; can_rebuild: boolean; retry_pending: boolean }
}

export interface MaterialPage {
  items: ReadingMaterial[]
  total: number
  page: number
  page_size: number
}

const client = axios.create({ baseURL: '/api/literature', timeout: 300_000 })
client.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
client.interceptors.response.use((response) => response, (error) => {
  if (error.response?.status === 401) {
    const header = String(error.config?.headers?.Authorization ?? '')
    expireSession(header.startsWith('Bearer ') ? header.slice(7) : null)
  }
  return Promise.reject(error)
})

/** 分页搜索公共库或本人文件，来源由服务端接口固定。 */
export async function fetchMaterials(origin: 'PERSONAL' | 'LIBRARY', q = '', page = 1): Promise<MaterialPage> {
  return (await client.get(origin === 'PERSONAL' ? '/files' : '/library', {
    params: { q, page, page_size: 20 },
  })).data.data
}

/** 每次上传一个 PDF，返回排队中的个人文献；用户状态和所有者不由前端提交。 */
export async function uploadReadingPdf(file: File): Promise<ReadingMaterial> {
  const form = new FormData()
  form.append('file', file)
  return (await client.post('/files', form)).data.data
}

/** 按当前身份读取公共审核文献或本人的个人文件。 */
export async function fetchReadingMaterial(id: number): Promise<ReadingMaterial> {
  return (await client.get(`/documents/${id}`)).data.data
}

/** 下载经过文献归属和附件清单校验的原文，供 PDF 预览及导出复用。 */
export function fetchReadingFile(params: { corpus_id: number; attachment_path: string }) {
  return client.get(`/documents/${params.corpus_id}/file`, {
    params: { attachment_path: params.attachment_path }, responseType: 'blob',
  })
}

/** 为本人失败或失效文件重新排队，服务端复用正在执行的任务。 */
export async function retryReadingPdf(id: number): Promise<ReadingMaterial> {
  return (await client.post(`/files/${id}/retry`)).data.data
}

/** 删除本人文件并撤销索引资格；远程清理未完成时返回明确标记。 */
export async function deleteReadingPdf(id: number): Promise<{ id: number; cleanup_pending: boolean }> {
  return (await client.delete(`/files/${id}`)).data.data
}
