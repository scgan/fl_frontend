/** 定义知识库、文档集合和版本历史前端类型。 */

export type KnowledgeBaseVisibility = 'PRIVATE' | 'PUBLIC'
export type DocumentCandidateSearchMode = 'mixed' | 'title' | 'author'
export type DocumentCandidateMatchField = 'title' | 'author' | 'doi' | 'content'

/** 知识库详情中的当前文档成员。 */
export interface KnowledgeBaseDocument {
  id: string
  title: string
  language_code: string
  authors: Array<{ name: string; affiliation?: string }>
  owner_name: string
  status: string
  publication_year: number | null
  doi: string | null
  added_by_name: string
  added_at: string
}

/** 尚未加入目标知识库的轻量文档候选。 */
export interface KnowledgeBaseDocumentCandidate {
  id: string
  title: string
  language_code: string
  authors: Array<{ name: string; affiliation?: string }>
  publication_year: number | null
  doi: string | null
  owner_name: string
  status: string
  match_fields: DocumentCandidateMatchField[]
  match_snippet: string | null
}

/** 知识库当前文档集合分页响应。 */
export interface KnowledgeBaseDocumentListResult {
  items: KnowledgeBaseDocument[]
  total: number
  page: number
  page_size: number
}

/** 可加入知识库的文档候选分页响应。 */
export interface KnowledgeBaseDocumentCandidateListResult {
  items: KnowledgeBaseDocumentCandidate[]
  total: number
  page: number
  page_size: number
}

/** 安全跨页全选使用的完整候选主键响应。 */
export interface KnowledgeBaseDocumentCandidateIdsResult {
  total: number
  document_ids: string[]
  over_limit: boolean
}

/** 文档集合的一次不可变版本记录。 */
export interface KnowledgeBaseVersion {
  id: string
  version: number
  change_type: string
  changed_by_name: string
  change_summary: Record<string, unknown>
  created_at: string
}

/** 知识库列表与详情共享投影。 */
export interface KnowledgeBaseRecord {
  /** 研究选择器中的范围类型；知识库管理页面可省略。 */
  kind?: 'GLOBAL' | 'DATABASE' | 'KNOWLEDGE_BASE'
  id: string
  name: string
  description: string | null
  owner_id: string
  owner_name: string
  visibility: KnowledgeBaseVisibility
  current_version: number
  status: string
  document_count: number
  can_edit: boolean
  can_manage_documents: boolean
  documents: KnowledgeBaseDocument[]
  created_at: string
  updated_at: string
}

/** 知识库分页响应。 */
export interface KnowledgeBaseListResult {
  items: KnowledgeBaseRecord[]
  total: number
  page: number
  page_size: number
}

/** 创建或更新知识库的基础字段。 */
export interface KnowledgeBasePayload {
  name: string
  description?: string | null
  visibility: KnowledgeBaseVisibility
}

/** 文档集合变更后的版本结果。 */
export interface KnowledgeBaseDocumentMutation {
  knowledge_base_id: string
  document_id: string
  current_version: number
  changed: boolean
}

/** 批量加入文档后的单版本变更结果。 */
export interface KnowledgeBaseDocumentBatchMutation {
  knowledge_base_id: string
  requested_count: number
  added_count: number
  skipped_existing_count: number
  added_document_ids: string[]
  current_version: number
  changed: boolean
}
