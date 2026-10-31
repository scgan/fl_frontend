/** 读取 Foreign 知识库供研究范围选择；管理功能由 Foreign 原页面承担。 */
import { fetchResearchResources, type ResearchSource } from '@/research/api/research-source'
import type { KnowledgeBaseListResult, KnowledgeBaseVisibility } from '@/research/types/knowledge-bases'

/** 知识库列表查询参数。 */
export interface KnowledgeBaseFilters {
  query?: string
  visibility?: KnowledgeBaseVisibility | ''
  page: number
  page_size: number
}

/** 分页读取当前用户可见知识库。 */
export async function fetchKnowledgeBases(
  filters: KnowledgeBaseFilters,
  source: ResearchSource = 'RESEARCH',
  databaseId?: number,
): Promise<KnowledgeBaseListResult> {
  const foreign = await fetchResearchResources(filters.page, filters.page_size, source)
  return {
    items: foreign.items.filter((base) => databaseId === undefined || base.id === `db:${databaseId}`).map((base) => ({
      id: base.id, name: base.name, description: base.description, kind: base.kind,
      owner_id: '', owner_name: '', visibility: 'PRIVATE',
      // Foreign 没有知识库版本字段；0 只供旧组件占位，不参与运行范围校验。
      current_version: 0, status: 'READY', document_count: base.corpus_count,
      can_edit: false, can_manage_documents: false, documents: [],
      created_at: '', updated_at: '',
    })),
    total: foreign.total, page: filters.page, page_size: filters.page_size,
  }
}

