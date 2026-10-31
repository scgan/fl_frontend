/** 只读获取 Foreign 管理的知识库与已审核文献，供共库接线验证。 */
import axios from 'axios'

import { getAccessToken, expireSession } from './session'

const foreign = axios.create({ baseURL: '/api', timeout: 15000 })
foreign.interceptors.response.use((response) => response, (error) => {
  if (error.response?.status === 401) {
    const authorization = String(error.config?.headers?.Authorization ?? '')
    if (authorization.startsWith('Bearer ')) expireSession(authorization.slice(7))
  }
  return Promise.reject(error)
})


// 启明使用的 100 条知识库摘要短时间内可复用；资源页的显式刷新始终直连 Foreign。
// 切换角色令牌时立即丢弃旧缓存。
const knowledgeBaseCache = new Map<string, { expiresAt: number; request: Promise<{ items: ForeignKnowledgeBase[]; total: number }> }>()
let cachedKnowledgeBaseToken: string | null = null
const KNOWLEDGE_BASE_CACHE_MS = 5000

export interface ForeignKnowledgeBase { id: number; name: string; description: string | null; corpus_count: number }
export interface ForeignCorpus { corpus_id: number; title_cn: string | null; title_en: string | null; author: string | null; language: string | null }
export interface ForeignCorpusDetail { id: number; title_cn: string | null; title_en: string | null; author: string | null; language: string | null; publish_time: string | number | null; attachment: string[] | null }
interface ForeignPage { page_num: number; page_size: number; total: number }

/** 用当前 Foreign 角色令牌读取本人知识库。 */
export async function fetchForeignKnowledgeBases(page = 1, pageSize = 50): Promise<{ items: ForeignKnowledgeBase[]; total: number }> {
  const token = getAccessToken()
  if (token !== cachedKnowledgeBaseToken) {
    knowledgeBaseCache.clear()
    cachedKnowledgeBaseToken = token
  }
  const key = `${page}:${pageSize}`
  const cached = pageSize === 100 ? knowledgeBaseCache.get(key) : undefined
  if (cached && cached.expiresAt > Date.now()) return cached.request
  const request = foreign.get<{ code: number; data: ForeignKnowledgeBase[]; pagination: ForeignPage }>('/knowledge-bases', {
    params: { page_num: page, page_size: pageSize },
    headers: { Authorization: `Bearer ${token ?? ''}` },
  }).then((response) => {
    if (response.data.code !== 200) throw new Error('Foreign 知识库读取失败')
    return { items: response.data.data, total: response.data.pagination.total }
  })
  if (pageSize === 100) {
    knowledgeBaseCache.set(key, { expiresAt: Date.now() + KNOWLEDGE_BASE_CACHE_MS, request })
  }
  try {
    return await request
  } catch (error) {
    if (knowledgeBaseCache.get(key)?.request === request) knowledgeBaseCache.delete(key)
    throw error
  }
}

/** 读取 Foreign 已审核的公开文献题录。 */
export async function fetchForeignCorpus(page = 1): Promise<{ items: ForeignCorpus[]; total: number }> {
  const response = await foreign.get<{ code: number; data: { data: ForeignCorpus[]; total: number } }>('/public/search', {
    params: { page_num: page, page_size: 20 },
  })
  if (response.data.code !== 200) throw new Error('Foreign 文献读取失败')
  return { items: response.data.data.data, total: response.data.data.total }
}

/** 读取 Foreign 已审核文献的真实题录；被撤回的文献返回空。 */
export async function fetchForeignCorpusDetail(id: number): Promise<ForeignCorpusDetail | null> {
  try {
    const response = await foreign.get<{ code: number; data: ForeignCorpusDetail }>('/public/corpus_detail', { params: { corpus_id: id } })
    return response.data.code === 200 ? response.data.data : null
  } catch {
    return null
  }
}
