/** 定义启明会话、消息和消息 Citation 前端类型。 */

/** 回答消息下方可打开的真实引用。 */
export interface ConversationCitation {
  citation_index: number
  document_id: string
  chunk_id: string
  document_title: string
  page_start: number
  page_end: number
  quote_text: string
  file_url: string
}

/** 一条用户或 Assistant 消息。 */
export interface ConversationMessage {
  id: string
  role: 'USER' | 'ASSISTANT'
  content: string
  agent_run_id: string | null
  agent_route: string[]
  entry_agent_code: string | null
  executor_agent_code: string | null
  result_type: string | null
  schema_version: number | null
  evidence_level: string | null
  knowledge_base_version: number | null
  citations: ConversationCitation[]
  created_at: string
}

/** 左侧会话列表项。 */
export interface ConversationRecord {
  id: string
  title: string
  knowledge_base_id: string
  /** 当前仍有读取权限时返回知识库名称，撤权后不暴露实时资源元数据。 */
  knowledge_base_name: string | null
  /** 是否允许打开详情并继续基于关联知识库提问。 */
  knowledge_base_accessible: boolean
  message_count: number
  created_at: string
  updated_at: string
}

/** 会话列表响应。 */
export interface ConversationListResult {
  items: ConversationRecord[]
  total: number
  page: number
  page_size: number
}

/** 包含完整消息的会话详情。 */
export interface ConversationDetail extends ConversationRecord {
  messages: ConversationMessage[]
}

/** 启明会话聚合软删除结果。 */
export interface ConversationDeleteResult {
  conversation_id: string
  deleted_run_count: number
  deleted_message_count: number
}
