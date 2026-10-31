/** 封装四个研究模块的 Run 创建、历史、Evidence 和带 Bearer Token 的 SSE 流。 */

import { authorizedFetch, http } from '@/research/api/http'
import { fetchForeignCorpusDetail } from '@/research/api/foreign-resources'
import { fetchResearchResources, fetchResearchHistory, assertResearchBinding, researchPayload, researchResourceId, researchResourceLabel, type ResearchSource, type SourceBinding } from '@/research/api/research-source'
import type { ApiEnvelope } from '@/research/types/api'
import type {
  AgentEvidenceItem,
  AgentRun,
  AgentRunDeleteResult,
  AgentRunHistoryList,
  AgentRunAccepted,
  AgentStep,
  AgentStreamEvent,
  QimingRunPayload,
  SuzhiRunPayload,
  RongtongRunPayload,
  ZhijianRunPayload,
  ZhijianResult,
  SuzhiResult,
  RongtongResult,
} from '@/research/types/agents'

/** 创建一个幂等启明 Run。 */
export async function createQimingRun(payload: QimingRunPayload, source: ResearchSource = 'RESEARCH'): Promise<AgentRunAccepted> {
  const response = await http.post<ApiEnvelope<{ created: boolean; run_id: string; conversation_id: string; scope_version: number; status: string; stream_url: string }>>('/agents/qiming/runs', {
    ...researchPayload(payload, source),
  }, {
    timeout: 120_000,
  })
  const run = response.data.data
  return {
    ...run, request_id: payload.request_id, knowledge_base_id: payload.knowledge_base_id,
    // Foreign scope_version 是集合指纹，不是知识库版本号。
    knowledge_base_version: 0,
  }
}

/** 创建只包含一句自然语言业务输入的智鉴 Run。 */
export async function createZhijianRun(payload: ZhijianRunPayload, source: ResearchSource = 'RESEARCH'): Promise<AgentRunAccepted> {
  return createProfessionalRun('zhijian', payload, source)
}

/** 创建溯知 Run；未显式提供的研究范围和输出规格使用后端默认值。 */
export async function createSuzhiRun(payload: SuzhiRunPayload, source: ResearchSource = 'RESEARCH'): Promise<AgentRunAccepted> {
  const { research_topic, concept, year_from, year_to, review_length, citation_style, ...context } = payload
  return createProfessionalRun('suzhi', {
    ...context, query: research_topic,
    options: { concept, year_from, year_to, review_length, citation_style },
  }, source)
}

/** 将专业工作台输入提交到共库统一运行接口，并补足现有组件需要的上下文。 */
async function createProfessionalRun(
  code: 'zhijian' | 'suzhi' | 'rongtong',
  payload: ZhijianRunPayload & { options?: Record<string, unknown> },
  source: ResearchSource,
): Promise<AgentRunAccepted> {
  const response = await http.post<ApiEnvelope<{
    created: boolean; run_id: string; conversation_id: string; status: string; stream_url: string;
  }>>(`/agents/${code}/runs`, {
    ...researchPayload(payload, source),
  }, { timeout: 120_000 })
  return {
    ...response.data.data, request_id: payload.request_id,
    knowledge_base_id: payload.knowledge_base_id, knowledge_base_version: 0,
  }
}

/** 将共库 Run 详情投影到未改动的研究工作台展示模型。 */
export async function fetchAgentRun(id: string, source?: ResearchSource, databaseId?: number): Promise<AgentRun> {
  const response = await http.get<ApiEnvelope<{
    id: string; request_id: string; conversation_id: string; knowledge_base_id: number; database_id?: number;
    status: string; entry_agent: string; executor_agent: string; intent: string | null;
    mode: string; output_language: string;
    final_answer: string | null; evidence_level: string | null; error_code: string | null;
    error_message: string | null; created_at: string; steps?: AgentStep[]; result_payload: { result_type: string; schema_version: number; payload: Record<string, unknown> } | null;
  }>>(`/agent-runs/${id}`, source ? { params: { entry_source: 'RESEARCH', ...(databaseId === undefined ? {} : { database_id: databaseId }) } } : undefined)
  const run = response.data.data
  assertResearchBinding(run, databaseId)
  return {
    id: run.id, request_id: run.request_id, conversation_id: run.conversation_id,
    agent_code: run.entry_agent, agent_name: run.entry_agent,
    entry_agent_code: run.entry_agent, executor_agent_code: run.executor_agent,
    knowledge_base_id: researchResourceId(run, source || 'RESEARCH'), knowledge_base_name: '', knowledge_base_version: 0,
    status: run.status, intent: run.intent, route: [run.entry_agent, run.executor_agent],
    mode: run.mode, output_language: run.output_language, original_language: null,
    final_answer: run.final_answer, evidence_level: run.evidence_level, evidence_summary: {},
    reviewer_status: null, citation_validation_status: null,
    started_at: null, finished_at: null, error_code: run.error_code, error_message: run.error_message,
    created_at: run.created_at, steps: run.steps ?? [], professional_result: run.result_payload,
    // 三个工作台仍使用各自的类型化字段，必须从共库统一快照投影，不能只返回封套。
    zhijian_result: run.result_payload?.result_type === 'ZHIJIAN_COMPARISON'
      ? run.result_payload.payload as unknown as ZhijianResult : null,
    suzhi_result: run.result_payload?.result_type === 'SUZHI_LITERATURE_REVIEW'
      ? run.result_payload.payload as unknown as SuzhiResult : null,
    rongtong_result: run.result_payload?.result_type === 'RONGTONG_POLICY_COMMUNICATION'
      ? run.result_payload.payload as unknown as RongtongResult : null,
  }
}

/**
 * 按实际执行模块读取当前用户的轻量分页历史。
 *
 * @param executorAgentCode 实际执行模块编码。
 * @param page 从 1 开始的页码。
 * @param pageSize 单页最大记录数。
 * @returns 不包含完整矩阵和 Evidence 正文的运行摘要。
 */
export async function fetchAgentRunHistory(
  executorAgentCode: string,
  page = 1,
  pageSize = 20,
  source: ResearchSource = 'RESEARCH',
  databaseId?: number,
): Promise<AgentRunHistoryList> {
  const [response, bases] = await Promise.all([
    fetchResearchHistory<AgentRunHistoryList['items'][number] & SourceBinding>(
      '/agent-runs', { executor_agent_code: executorAgentCode, entry_source: source }, page, pageSize, databaseId,
    ),
    fetchResearchResources(1, Number.MAX_SAFE_INTEGER, source),
  ])
  return {
    ...response,
    items: response.items.map((item) => ({
      ...item,
      knowledge_base_id: researchResourceId(item as SourceBinding, source),
      knowledge_base_name: item.knowledge_base_accessible
        ? researchResourceLabel(bases.items.find((base) => base.id === researchResourceId(item as SourceBinding, source)))
        : null,
    })),
  }
}

/** 软删除一个无活动任务的专业模块 Run。 */
export async function deleteAgentRun(id: string): Promise<AgentRunDeleteResult> {
  const response = await http.delete<ApiEnvelope<AgentRunDeleteResult>>(`/agent-runs/${id}`)
  return response.data.data
}

/** 读取 Agent Run 有序步骤。 */
export async function fetchAgentSteps(id: string): Promise<AgentStep[]> {
  const response = await http.get<ApiEnvelope<{ steps: AgentStep[] }>>(`/agent-runs/${id}`)
  return response.data.data.steps
}

/** 读取共库 Evidence，并用 Foreign 当前公开题录复核来源与附件。 */
export async function fetchAgentEvidence(id: string): Promise<AgentEvidenceItem[]> {
  const response = await http.get<ApiEnvelope<Array<{
    corpus_id: number; point_id: string; content_snapshot: string; retrieval_score: number; relevance_score?: number | null;
    evidence_rank: number; page_start: number | null; page_end: number | null;
    file_path: string | null; source_unavailable: boolean;
    assignment: AgentEvidenceItem['assignment']; assignment_payload: Partial<AgentEvidenceItem> | null;
  }>>>(`/agent-runs/${id}/evidence`)
  const rows = response.data.data
  const titles = new Map(await Promise.all([...new Set(rows.map((row) => row.corpus_id))].map(async (corpusId) => [corpusId, await fetchForeignCorpusDetail(corpusId)] as const)))
  const foreignBase = '/api'
  return rows.map((row) => {
    const source = titles.get(row.corpus_id)
    const title = source?.title_cn || source?.title_en || `Foreign 文献 #${row.corpus_id}`
    const page = row.page_start ?? 0
    const fileUrl = row.file_path ? `${foreignBase}/public/file/corpus?corpus_id=${row.corpus_id}&attachment_path=${encodeURIComponent(row.file_path)}` : ''
    return {
      assignment: row.assignment,
      supports_a: row.assignment_payload?.supports_a,
      supports_b: row.assignment_payload?.supports_b,
      relevance: row.assignment_payload?.relevance,
      retrieval_branches: row.assignment_payload?.retrieval_branches,
      cell_supports: row.assignment_payload?.cell_supports,
      retrieval_contexts: row.assignment_payload?.retrieval_contexts,
      evidence: {
        citation_index: row.evidence_rank, document_id: String(row.corpus_id), chunk_id: row.point_id,
        document_title: title, authors: source?.author ? [{ name: source.author }] : [],
        publication_year: source?.publish_time ? Number(String(source.publish_time).slice(0, 4)) || null : null,
        journal: null, language_code: source?.language ?? '', page_start: page,
        page_end: row.page_end ?? page, section: null, content: row.content_snapshot,
        relevance_score: row.relevance_score ?? null, retrieval_score: row.retrieval_score,
        vector_rank: null, lexical_rank: null,
      },
      citation: {
        citation_index: row.evidence_rank, document_id: String(row.corpus_id), chunk_id: row.point_id,
        document_title: title, page_start: page, page_end: row.page_end ?? page,
        section: null, quote: row.content_snapshot, file_url: fileUrl,
      },
      // Foreign 的公开详情只返回当前已审核且未删除的文献；再核对附件路径。
      // 共库 Agent 当前会把可公开读取的附件标为不可用，因此以 Foreign 当前数据为准。
      source_deleted: !source || !row.file_path || !source.attachment?.includes(row.file_path) || !row.page_start,
    }
  })
}

/**
 * 订阅带身份校验的 SSE；推送静默时定期核对数据库快照，防止代理缓冲造成假卡住。
 *
 * @param id Agent Run 主键。
 * @param onEvent 每解析到一条完整事件时调用。
 * @param signal 页面卸载或新运行开始时用于终止旧连接。
 */
export async function streamAgentRun(
  id: string,
  onEvent: (event: AgentStreamEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) throw new DOMException('SSE 已取消', 'AbortError')
  const controller = new AbortController()
  /** 页面取消时同时终止推送和只读快照查询。 */
  const stop = (): void => controller.abort()
  signal.addEventListener('abort', stop, { once: true })
  const sent = new Set<string>()
  const finishedSteps = new Set<number>()
  let terminal = false
  let lastProgressAt = Date.now()
  const intervalMs = 5000

  /** 合并推送与查询事件，终态只发布一次，迟到的 started 不覆盖已经完成的步骤。 */
  function publish(event: AgentStreamEvent): void {
    if (controller.signal.aborted || terminal || (event.id && sent.has(event.id))) return
    const sequence = Number(event.data.sequence)
    if (event.event === 'node.started' && finishedSteps.has(sequence)) return
    if (['node.completed', 'node.failed'].includes(event.event)) finishedSteps.add(sequence)
    if (event.id) sent.add(event.id)
    if (event.event.startsWith('node.')) lastProgressAt = Date.now()
    terminal = ['run.completed', 'run.failed'].includes(event.event)
    onEvent(event)
  }

  /** 在等待响应头或后续流块期间独立核对步骤；临时查询失败不打断仍可用的推送。 */
  async function reconcileWhileSilent(): Promise<void> {
    while (!controller.signal.aborted) {
      await waitForReconnect(intervalMs, controller.signal)
      if (Date.now() - lastProgressAt < intervalMs) continue
      try {
        const response = await http.get<ApiEnvelope<{
          status: string; steps?: AgentStep[]; error_code?: string | null;
        }>>(`/agent-runs/${id}`, { signal: controller.signal })
        if (controller.signal.aborted || terminal) return
        const snapshot = response.data.data
        for (const step of [...(snapshot.steps ?? [])].sort((a, b) => a.sequence - b.sequence)) {
          publish({
            id: `${id}:step:${step.sequence}:${step.status}`,
            event: step.status === 'RUNNING' ? 'node.started'
              : ['FAILED', 'CANCELLED'].includes(step.status) ? 'node.failed' : 'node.completed',
            data: { node: step.node_name, sequence: step.sequence, status: step.status },
          })
        }
        if (['SUCCESS', 'FAILED', 'CANCELLED'].includes(snapshot.status)) {
          publish({
            id: `${id}:terminal`,
            event: snapshot.status === 'SUCCESS' ? 'run.completed' : 'run.failed',
            data: { status: snapshot.status, message: snapshot.error_code ?? '' },
          })
          return
        }
      } catch (error) {
        if (controller.signal.aborted) throw error
      }
    }
  }

  // 1. 两条链路只读取同一个 Run，静默查询不创建、重试或重新执行模型任务。
  try {
    await Promise.race([
      followAgentStream(id, publish, controller.signal),
      reconcileWhileSilent(),
    ])
  } finally {
    // 2. 任一链路确认终态或页面取消后，同时清理流、查询和等待计时器。
    controller.abort()
    signal.removeEventListener('abort', stop)
  }
}

/** 消费 SSE 并有限重连，连接明确失败后沿用持久化终态查询。 */
async function followAgentStream(
  id: string,
  onEvent: (event: AgentStreamEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  let lastEventId = ''
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await consumeAgentStream(
        id,
        (event) => {
          // 在回调前推进游标；即使随后发生网络异常，重连也从最后已处理事件继续。
          lastEventId = event.id || lastEventId
          onEvent(event)
        },
        signal,
        lastEventId,
      )
      lastEventId = result.lastEventId
      if (result.terminal) return
    } catch (error) {
      if (
        signal.aborted ||
        (error instanceof DOMException && error.name === 'AbortError')
      ) {
        throw error
      }
      lastError = error
    }
    if (attempt < 2) await waitForReconnect(400 * (attempt + 1), signal)
  }
  // SSE 不可用时继续核对持久化状态，避免已经完成的任务永久停在思考中。
  let failures = 0
  while (!signal.aborted) {
    try {
      const run = await fetchAgentRun(id)
      if (signal.aborted) return
      if (['SUCCESS', 'FAILED', 'CANCELLED'].includes(run.status)) {
        onEvent({ id: `${id}:terminal`, event: run.status === 'SUCCESS' ? 'run.completed' : 'run.failed',
          data: { status: run.status, message: run.error_message ?? '' } })
        return
      }
      failures = 0
    } catch (error) {
      lastError = error
      if (++failures >= 3) break
    }
    await waitForReconnect(2000, signal)
  }
  if (signal.aborted) return
  const detail = lastError instanceof Error ? `：${lastError.message}` : ''
  throw new Error(`运行状态读取失败，请重新打开会话${detail}`)
}

/**
 * 消费单次 SSE 连接，并返回可供下一次请求续传的稳定事件 ID。
 *
 * @param id Agent Run 主键。
 * @param onEvent 已解析事件回调。
 * @param signal 页面取消信号。
 * @param lastEventId 上一次连接最后确认的事件 ID。
 * @returns 最新事件 ID 和是否已经收到运行终态。
 */
async function consumeAgentStream(
  id: string,
  onEvent: (event: AgentStreamEvent) => void,
  signal: AbortSignal,
  lastEventId: string,
): Promise<{ lastEventId: string; terminal: boolean }> {
  const headers: Record<string, string> = { Accept: 'text/event-stream' }
  if (lastEventId) headers['Last-Event-ID'] = lastEventId
  const response = await authorizedFetch(`/agent-runs/${id}/stream`, {
    method: 'GET',
    headers,
    signal,
  })
  if (!response.ok || !response.body) throw new Error(`SSE 连接失败：${response.status}`)
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let latestId = lastEventId
  let terminal = false
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
    let boundary = buffer.indexOf('\n\n')
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      const parsed = parseSseBlock(block)
      if (parsed) {
        latestId = parsed.id || latestId
        terminal ||= parsed.event === 'run.completed' || parsed.event === 'run.failed'
        onEvent(parsed)
        // 终态是业务完成信号，不等待代理或服务端关闭 HTTP 连接才展示回答。
        if (terminal) {
          void reader.cancel().catch(() => {})
          return { lastEventId: latestId, terminal: true }
        }
      }
      boundary = buffer.indexOf('\n\n')
    }
  }
  return { lastEventId: latestId, terminal }
}

/**
 * 在 SSE 重连退避期间响应页面取消信号。
 *
 * @param delayMs 当前重连等待毫秒数。
 * @param signal 页面取消信号。
 * @returns 退避结束或被取消的 Promise。
 */
function waitForReconnect(delayMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = (): void => {
      window.clearTimeout(timer)
      reject(new DOMException('SSE 已取消', 'AbortError'))
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, delayMs)
    if (signal.aborted) onAbort()
    else signal.addEventListener('abort', onAbort, { once: true })
  })
}

/** 将共库 step/complete 事件映射为研究工作台既有的流事件。 */
function parseSseBlock(block: string): AgentStreamEvent | null {
  if (!block || block.startsWith(':')) return null
  let id = ''
  let event = 'message'
  const data: string[] = []
  for (const line of block.split('\n')) {
    if (line.startsWith('id:')) id = line.slice(3).trim()
    if (line.startsWith('event:')) event = line.slice(6).trim()
    if (line.startsWith('data:')) data.push(line.slice(5).trimStart())
  }
  if (!data.length) return null
  const payload = JSON.parse(data.join('\n')) as Record<string, unknown>
  if (event === 'step') {
    return { id, event: payload.status === 'RUNNING' ? 'node.started' : ['FAILED', 'CANCELLED'].includes(String(payload.status)) ? 'node.failed' : 'node.completed', data: { node: payload.name, status: payload.status, sequence: payload.sequence } }
  }
  if (event === 'complete') {
    return {
      id, event: payload.status === 'SUCCESS' ? 'run.completed' : 'run.failed',
      data: { status: payload.status, message: payload.error_code ?? '' },
    }
  }
  return { id, event, data: payload }
}

/** 从 Foreign 公开文件接口或旧鉴权接口读取 Citation PDF。 */
export async function fetchCitationFile(fileUrl: string): Promise<Blob> {
  const source = fileUrl.split('#', 1)[0]
  if (source.startsWith('/api/public/file/')) {
    const response = await fetch(source)
    if (!response.ok) throw new Error(`Foreign 原文读取失败：${response.status}`)
    return response.blob()
  }
  const apiPath = source.replace(/^\/api\/v1/, '')
  const response = await http.get<Blob>(apiPath, { responseType: 'blob', timeout: 120_000 })
  return response.data
}

/** 创建必选语言与自然语言请求的融通 Run。 */
export async function createRongtongRun(payload: RongtongRunPayload, source: ResearchSource = 'RESEARCH'): Promise<AgentRunAccepted> {
  return createProfessionalRun('rongtong', {
    request_id: payload.request_id, knowledge_base_id: payload.knowledge_base_id,
    query: payload.policy_or_concept, options: { target_language: payload.target_language },
  }, source)
}
