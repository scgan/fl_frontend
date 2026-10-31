/** 封装当前用户启明会话列表和详情 API。 */

import { http } from '@/research/api/http'
import {
  fetchResearchResources, fetchResearchHistory, assertResearchBinding, researchResourceId, researchResourceLabel, type ResearchResource, type ResearchSource, type SourceBinding,
} from '@/research/api/research-source'
import type { ApiEnvelope } from '@/research/types/api'
import type {
  ConversationDeleteResult,
  ConversationDetail,
  ConversationListResult,
} from '@/research/types/conversations'

interface ForeignConversation extends SourceBinding { id: string; title: string; created_at: string; updated_at: string }
interface ForeignCitation { citation_index: number; corpus_id: number; point_id: string; file_path: string; page_start: number | null; page_end: number | null; quote_text: string }
interface ForeignMessage {
  id: string; run_id: string; role: 'USER' | 'ASSISTANT'; content: string; created_at: string; citations: ForeignCitation[];
  entry_agent_code: string; executor_agent_code: string; result_type: string | null;
  schema_version: number | null; evidence_level: string | null;
}
interface ForeignConversationDetail extends ForeignConversation { messages: ForeignMessage[] }

/** 将共库会话摘要投影到既有启明展示模型。 */
function mapConversation(item: ForeignConversation, bases: ResearchResource[], source: ResearchSource): ConversationDetail {
  const resourceId = researchResourceId(item, source)
  const base = bases.find((candidate) => String(candidate.id) === resourceId)
  return {
    id: item.id, title: item.title, knowledge_base_id: resourceId,
    knowledge_base_name: researchResourceLabel(base), knowledge_base_accessible: Boolean(base),
    message_count: 0, created_at: item.created_at, updated_at: item.updated_at, messages: [],
  }
}

/** 分页读取当前用户会话，并用 Foreign 知识库列表补足名称与可访问状态。 */
export async function fetchConversations(page = 1, pageSize = 20, source: ResearchSource = 'RESEARCH', databaseId?: number): Promise<ConversationListResult> {
  const [response, bases] = await Promise.all([
    fetchResearchHistory<ForeignConversation>('/conversations', { entry_source: source }, page, pageSize, databaseId),
    fetchResearchResources(1, Number.MAX_SAFE_INTEGER, source),
  ])
  const items = response.items.map((item) => mapConversation(item, bases.items, source))
  return { ...response, items }
}

/** 读取共库会话，并投影完整消息及 Foreign 原文链接。 */
export async function fetchConversation(id: string, source: ResearchSource = 'RESEARCH', databaseId?: number): Promise<ConversationDetail> {
  const [response, knowledge] = await Promise.all([
    http.get<ApiEnvelope<ForeignConversationDetail>>(`/conversations/${id}`, {
      params: { entry_source: 'RESEARCH', ...(databaseId === undefined ? {} : { database_id: databaseId }) },
    }),
    fetchResearchResources(1, Number.MAX_SAFE_INTEGER, source),
  ])
  const foreign = response.data.data
  assertResearchBinding(foreign, databaseId)
  const base = mapConversation(foreign, knowledge.items, source)
  const foreignBase = '/api'
  base.messages = foreign.messages.map((message) => ({
    id: message.id, role: message.role, content: message.content, agent_run_id: message.run_id,
    agent_route: [...new Set([message.entry_agent_code, message.executor_agent_code])],
    entry_agent_code: message.entry_agent_code, executor_agent_code: message.executor_agent_code,
    result_type: message.result_type, schema_version: message.schema_version,
    evidence_level: message.evidence_level, knowledge_base_version: 0,
    created_at: message.created_at,
    citations: message.citations.map((citation) => ({
      citation_index: citation.citation_index, document_id: String(citation.corpus_id),
      chunk_id: citation.point_id, document_title: `Foreign 文献 #${citation.corpus_id}`,
      page_start: citation.page_start ?? 0, page_end: citation.page_end ?? citation.page_start ?? 0,
      quote_text: citation.quote_text,
      file_url: `${foreignBase}/public/file/corpus?corpus_id=${citation.corpus_id}&attachment_path=${encodeURIComponent(citation.file_path)}`,
    })),
  }))
  base.message_count = base.messages.length
  return base
}

/** 软删除一条无活动任务的共库启明会话。 */
export async function deleteConversation(id: string): Promise<ConversationDeleteResult> {
  const response = await http.delete<ApiEnvelope<ConversationDeleteResult>>(`/conversations/${id}`)
  return response.data.data
}
