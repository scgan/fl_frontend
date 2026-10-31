/** 定义启明 Agent Run、步骤、Evidence、Citation 和 SSE 前端类型。 */

export type QimingMode = 'FAST' | 'DEEP'

/** 启明运行创建参数。 */
export interface QimingRunPayload {
  request_id: string
  knowledge_base_id: string
  conversation_id?: string
  query: string
  mode: QimingMode
}

/** 后端接受异步 Agent Run 后返回的固定上下文。 */
export interface AgentRunAccepted {
  created: boolean
  run_id: string
  request_id: string
  conversation_id: string
  knowledge_base_id: string
  knowledge_base_version: number
  status: string
  stream_url: string
}

/** 可审计 LangGraph 节点步骤。 */
export interface AgentStep {
  id: string
  node_name: string
  sequence: number
  status: string
  started_at: string
  finished_at: string | null
  input_summary: Record<string, unknown>
  output_summary: Record<string, unknown>
  retry_count: number
  error_message: string | null
}

/** Evidence 对应的真实文档和切块来源。 */
export interface AgentEvidence {
  citation_index: number
  document_id: string
  chunk_id: string
  document_title: string
  authors: Array<{ name?: string }>
  publication_year: number | null
  journal: string | null
  language_code: string
  page_start: number
  page_end: number
  section: string | null
  content: string
  relevance_score: number | null
  retrieval_score: number
  vector_rank: number | null
  lexical_rank: number | null
}

/** 与 Evidence 一一对应且能打开真实 PDF 页的 Citation。 */
export interface AgentCitation {
  citation_index: number
  document_id: string
  chunk_id: string
  document_title: string
  page_start: number
  page_end: number
  section: string | null
  quote: string
  file_url: string
}

/** Evidence Panel 使用的证据和引用组合。 */
export interface AgentEvidenceItem {
  evidence: AgentEvidence
  citation: AgentCitation
  /** 来源已软删除时保留历史摘录，但禁止继续打开原始 PDF。 */
  source_deleted: boolean
  assignment?: 'A' | 'B' | 'SHARED' | null
  supports_a?: boolean | null
  supports_b?: boolean | null
  relevance?: 'HIGH' | 'MEDIUM' | 'LOW' | null
  retrieval_branches?: string[]
  cell_supports?: Array<{
    object: 'A' | 'B'
    dimension: string
    relevance: 'HIGH' | 'MEDIUM' | 'LOW'
  }>
  retrieval_contexts?: Array<{
    query_id: string
    object: 'A' | 'B'
    dimension: string
    relevance_score: number
  }>
}

/** 智鉴一句话运行创建参数。 */
export interface ZhijianRunPayload {
  request_id: string
  knowledge_base_id: string
  conversation_id?: string
  query: string
}

export type SuzhiLanguage = 'ZH' | 'EN' | 'BILINGUAL'
export type SuzhiReviewLength = 'SHORT' | 'MEDIUM' | 'LONG'
export type SuzhiCitationStyle = 'GBT7714' | 'APA' | 'MLA'

/** 溯知综述运行创建参数；输出规格省略时由后端采用统一默认值。 */
export interface SuzhiRunPayload {
  request_id: string
  knowledge_base_id: string
  conversation_id?: string
  research_topic: string
  concept?: string
  year_from?: number
  year_to?: number
  review_length?: SuzhiReviewLength
  citation_style?: SuzhiCitationStyle
}

/** 溯知结构化结论的共用引用模型。 */
export interface CitedReviewFinding {
  title: string
  summary: string
  citation_ids: number[]
}

/** 溯源图中的单个技术或主题演进里程碑。 */
export interface ProvenanceGraphNode {
  id: string
  label: string
  subtitle: string
  summary: string
  year: number | null
  stage: number
  lane: number
  citation_ids: number[]
}

/** 溯源图中由模型归纳的有向研究演进关系。 */
export interface ProvenanceGraphEdge {
  source: string
  target: string
  relation: string
  label: string
  summary: string
  citation_ids: number[]
}

/** 前端 ECharts 直接消费的结构化溯源图。 */
export interface ProvenanceGraph {
  title: string
  nodes: ProvenanceGraphNode[]
  edges: ProvenanceGraphEdge[]
}

/** 溯知专业工作台读取的版本化综述结果。 */
export interface SuzhiResult {
  status: string
  research_topic: string
  concept: string
  language: SuzhiLanguage
  review_length: SuzhiReviewLength
  citation_style: SuzhiCitationStyle
  concept_definition: string
  concept_citation_ids: number[]
  topics: CitedReviewFinding[]
  theoretical_paths: CitedReviewFinding[]
  methods: CitedReviewFinding[]
  controversies: CitedReviewFinding[]
  research_gaps: Array<{
    gap: string
    evidence_logic: string
    citation_ids: number[]
  }>
  future_directions: CitedReviewFinding[]
  provenance_graph: ProvenanceGraph | null
  review: string
  references: string[]
  evidence_summary: Record<string, unknown>
  limitations: string[]
  evidence_level: string
}

/** 智鉴规范化比较对象。 */
export interface CompareObject {
  raw: string
  canonical_name: string
  type: string
  identifier: string
  aliases: string[]
}

/** 一条带真实 Citation 编号的比较结论。 */
export interface CitedFinding {
  text: string
  citation_ids: number[]
}

/** 对比矩阵单行。 */
export interface ComparisonMatrixRow {
  dimension: string
  object_a: string
  object_b: string
  similarity: string
  difference: string
  object_a_citation_ids: number[]
  object_b_citation_ids: number[]
  shared_citation_ids: number[]
  citation_ids: number[]
}

/** 智鉴 Evidence Balance 可解释统计。 */
export interface EvidenceBalance {
  status: string
  object_a_evidence_count: number
  object_b_evidence_count: number
  shared_evidence_count: number
  object_a_document_count: number
  object_b_document_count: number
  year_coverage: number[]
  source_diversity: number
  source_language_coverage: Record<string, number>
  relevance_distribution: Record<string, number>
  dimension_coverage: Array<{
    dimension: string
    object_a_evidence_count: number
    object_b_evidence_count: number
    status: 'SUFFICIENT' | 'PARTIAL' | 'INSUFFICIENT'
  }>
}

/** 智鉴结构化结果；矩阵覆盖可视化直接消费后端确定性评分。 */
export interface ZhijianResult {
  status: string
  clarification_question: string | null
  topic: string | null
  object_a: CompareObject | null
  object_b: CompareObject | null
  time_range: number[]
  compare_dimensions: string[]
  summary: string
  object_a_summary: string
  object_b_summary: string
  similarities: CitedFinding[]
  differences: CitedFinding[]
  comparison_matrix: ComparisonMatrixRow[]
  timeline: Array<{ year: number; object: 'A' | 'B' | 'SHARED'; event: string; citation_ids: number[] }>
  topic_distribution: Array<{ topic: string; object: 'A' | 'B' | 'SHARED'; summary: string; citation_ids: number[] }>
  references: Array<{ citation_id: number; document_id: string; title: string }>
  evidence: Array<{
    chunk_id: string
    document_id: string
    citation_id: number
    assignment: 'A' | 'B' | 'SHARED'
    supports_a: boolean
    supports_b: boolean
    relevance: 'HIGH' | 'MEDIUM' | 'LOW'
    retrieval_branches: string[]
    cell_supports: Array<{
      object: 'A' | 'B'
      dimension: string
      relevance: 'HIGH' | 'MEDIUM' | 'LOW'
    }>
    retrieval_contexts: Array<{
      query_id: string
      object: 'A' | 'B'
      dimension: string
      relevance_score: number
    }>
  }>
  evidence_balance: EvidenceBalance | null
  limitations: string[]
  evidence_level: string
}

/** 一次 Agent Run 的完整可观察结果。 */
export interface AgentRun {
  id: string
  request_id: string
  conversation_id: string
  agent_code: string
  agent_name: string
  entry_agent_code: string
  executor_agent_code: string
  knowledge_base_id: string
  knowledge_base_name: string
  knowledge_base_version: number
  status: string
  intent: string | null
  route: string[]
  mode: string
  output_language: string
  original_language: string | null
  final_answer: string | null
  evidence_level: string | null
  evidence_summary: Record<string, unknown>
  reviewer_status: string | null
  citation_validation_status: string | null
  started_at: string | null
  finished_at: string | null
  error_code: string | null
  error_message: string | null
  created_at: string
  /** 已落库的步骤快照，重新进入活动会话时据此恢复真实阶段。 */
  steps?: AgentStep[]
  professional_result?: ProfessionalResult | null
  zhijian_result?: ZhijianResult | null
  suzhi_result?: SuzhiResult | null
  /** 融通结果兼容投影，持久化仍采用唯一 professional_result。 */
  rongtong_result?: RongtongResult | null
}

/** 各专业 Agent 共用的版本化结果外壳。 */
export interface ProfessionalResult {
  result_type: string
  schema_version: number
  payload: Record<string, unknown>
}

/** 智鉴历史栏使用的轻量运行摘要。 */
export interface AgentRunHistoryItem {
  id: string
  conversation_id: string
  conversation_title: string
  query: string
  /** 知识库权限失效时为空，防止历史列表泄露回答与证据内容。 */
  summary: string
  entry_agent_code: string
  executor_agent_code: string
  result_type: string | null
  schema_version: number | null
  status: string
  knowledge_base_id: string
  knowledge_base_name: string | null
  /** 当前用户是否仍可访问本次运行关联的知识库。 */
  knowledge_base_accessible: boolean
  knowledge_base_version: number
  created_at: string
}

/** 分页的专业 Agent 运行历史。 */
export interface AgentRunHistoryList {
  items: AgentRunHistoryItem[]
  total: number
  page: number
  page_size: number
}

/** 专业模块单次 Run 软删除结果。 */
export interface AgentRunDeleteResult {
  run_id: string
  conversation_id: string
  executor_agent_code: string
  deleted_message_count: number
  conversation_deleted: boolean
}

/** SSE 解析后的单条规范事件。 */
export interface AgentStreamEvent {
  id: string
  event: string
  data: Record<string, unknown>
}

/** 融通结果中记录的实际受众和表达风格。 */
export type RongtongAudience = 'INTERNATIONAL_RESEARCHER' | 'FOREIGN_TEACHER' | 'INTERNATIONAL_STUDENT' | 'POLICY_MAKER' | 'MEDIA' | 'GENERAL_PUBLIC'
export type RongtongStyle = 'ACADEMIC' | 'POPULAR' | 'MEDIA' | 'BRIEFING'

/** 融通自然语言提交，输出语言为必填。 */
export interface RongtongRunPayload {
  /** 客户端幂等键。 */
  request_id: string
  /** 当前知识库上下文。 */
  knowledge_base_id: string
  /** 原始自然语言请求。 */
  policy_or_concept: string
  /** 必选目标语言。 */
  target_language: 'ZH' | 'EN' | 'BILINGUAL'
}

/** 一条有来源事实。 */
export interface RongtongFact {
  /** 已审核事实正文。 */
  text: string
  /** 本 Run 真实 Citation 编号。 */
  citation_ids: number[]
}

/** 可恢复的融通专业结果。 */
export interface RongtongResult {
  /** 业务成功或证据不足的受限结果。 */
  status: 'SUCCESS' | 'INSUFFICIENT_EVIDENCE'
  /** LLM 识别政策或概念；旧历史可能尚无此字段。 */
  subject_type?: 'POLICY' | 'CONCEPT'
  /** 自然语言传播任务或已识别的政策主题。 */
  policy_or_concept: string
  /** 必选中文、英文或中英双语输出。 */
  target_language: 'ZH' | 'EN' | 'BILINGUAL'
  /** 从自然语言识别或按规则默认的目标受众。 */
  target_audience: RongtongAudience
  /** 从自然语言识别或按受众规则默认的传播风格。 */
  style: RongtongStyle
  /** 目标字数或词数，100–5000，作为生成指导。 */
  desired_length: number
  /** 按政策或概念 Schema 组织、符合目标语言的共同事实。 */
  facts: Record<string, RongtongFact[]>
  /** 有来源的潜在误解及语境澄清。 */
  cultural_risks: Array<{ misunderstanding: string; explanation: string; citation_ids: number[] }>
  /** 已审核的目标语言传播正文，引用由程序绑定。 */
  communication_text: string
  /** 证据边界及未覆盖分区。 */
  limitations: string[]
  /** 根据真实文献覆盖确定的证据等级。 */
  evidence_level: string
  /** 真实文献、语言及引用覆盖统计。 */
  evidence_summary: Record<string, unknown>
}
