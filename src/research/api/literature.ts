/** 所选文献的 Research 阅读接口，不调用旧 corpus_qa。 */
import { http } from '@/research/api/http'
import type { ApiEnvelope } from '@/research/types/api'
import type { AgentStep } from '@/research/types/agents'
import type { WebRecommendationDetails } from '@/research/utils/literature-recommendations'

export interface ReadingClaim {
  text: string
}
/** 综合结果包含主题标题和充分展开的正文，旧记录仍可只有正文。 */
export interface ReadingSynthesisClaim extends ReadingClaim {
  /** 编号主题的小标题；历史记录可缺失。 */
  title?: string
}
/** 创新方向内按内容选择的展开角度，标签和顺序由具体研究设想决定。 */
export interface ReadingInnovationPoint {
  /** 简短分项名称，不使用固定栏目枚举。 */
  label: string
  /** 完整说明，可包含少量 Markdown 强调。 */
  text: string
}
export interface ReadingInnovation extends Omit<ReadingSynthesisClaim, 'text'> {
  /** 旧正文格式的历史内容；新分项格式可不返回。 */
  text?: string
  /** 旧历史可能只有正文，新生成的创新方向包含独立小标题。 */
  title?: string
  /** 新结果的三至五个展开角度，旧记录可缺失。 */
  points?: ReadingInnovationPoint[]
  /** 仅兼容旧格式；新结果将检验步骤融入分项。 */
  validation_path?: string
}
export interface ReadingSection {
  key: string
  claims: ReadingClaim[]
  missing_reason: string
}
export interface DocumentReading {
  document_type: string
  summary: ReadingClaim[]
  sections: ReadingSection[]
  recommended_questions: string[]
}
export interface ReadingDocument {
  corpus_id: number
  title: string
  author: string
  status: string
  reason: string
  chunk_count: number
  analysis?: DocumentReading | null
  batch_count?: number
}
/** 四个综合分析维度，独立于逐篇分析和快捷追问。 */
export interface ReadingOverview {
  overview: ReadingSynthesisClaim[]
  common_themes: ReadingSynthesisClaim[]
  differences: ReadingSynthesisClaim[]
  potential_innovations?: ReadingInnovation[]
}
export interface ReadingResult {
  task: 'ANALYZE' | 'ASK'
  documents: ReadingDocument[]
  recommended_questions: string[]
  recommended_documents?: {
    corpus_id: number | null
    title: string
    author: string
    year: number | null
    source: string
    attachment_paths: string[]
    origin?: 'LIBRARY' | 'WEB'
    external_url?: string
    doi?: string
  }[]
  recommendation_status?: 'SUCCESS' | 'PARTIAL' | 'FAILED'
  library_recommendation_status?: 'SUCCESS' | 'PARTIAL' | 'FAILED'
  web_recommendation_status?: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'SKIPPED'
  web_recommendation_details?: WebRecommendationDetails | null
  overview?: ReadingOverview | null
}
export interface ReadingRun {
  id: string
  conversation_id: string
  status: string
  query: string
  final_answer: string | null
  error_message: string | null
  /** 已持久化的有序步骤，用于切换阅读会话后恢复本组进度。 */
  steps?: AgentStep[]
  request_payload: { task: string; corpus_ids: number[] }
  result_payload: { result_type: string; payload: ReadingResult } | null
}
export interface ReadingCitation {
  citation_index: number
  corpus_id: number
  file_path: string
  page_start: number
  page_end: number
  quote_text: string
  /** 完整证据快照用于跨页高亮；旧服务未返回时使用短引文。 */
  content?: string
}
export interface ReadingMessage {
  id: string
  run_id: string
  role: string
  content: string
  citations: ReadingCitation[]
}
export interface ReadingConversation {
  id: string
  title: string
  messages: ReadingMessage[]
  reading_runs: {
    id: string
    status: string
    request_payload: { task: string; corpus_ids: number[] }
  }[]
}
export async function createReadingRun(payload: {
  request_id: string
  conversation_id?: string
  query: string
  options: {
    task: 'ANALYZE' | 'ASK'
    corpus_ids: number[]
    template_version: number
    focus_corpus_id?: number
  }
}) {
  return (
    await http.post<ApiEnvelope<{ run_id: string; conversation_id: string }>>(
      '/agents/literature/runs',
      { ...payload, entry_source: 'LITERATURE' },
      { timeout: 120_000 },
    )
  ).data.data
}
export async function fetchReadingRun(id: string): Promise<ReadingRun> {
  return (await http.get<ApiEnvelope<ReadingRun>>(`/agent-runs/${id}`)).data.data
}
export async function fetchReadingConversation(id: string): Promise<ReadingConversation> {
  return (await http.get<ApiEnvelope<ReadingConversation>>(`/conversations/${id}`, {
    params: { entry_source: 'LITERATURE' },
  })).data.data
}
export async function fetchReadingHistory(page = 1) {
  return (
    await http.get<
      ApiEnvelope<{ items: { id: string; title: string; updated_at: string }[]; total: number }>
    >('/literature/conversations', { params: { page } })
  ).data.data
}
