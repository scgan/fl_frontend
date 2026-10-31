<!-- 实现启明普通问答、会话恢复、SSE 回答更新和 Evidence First 引用交互。 -->
<script setup lang="ts">
import axios from 'axios'
import {
  ArrowRight,
  ChatDotSquare,
  Collection,
  DocumentChecked,
  Delete,
  Plus,
  Promotion,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  createQimingRun,
  fetchAgentEvidence,
  fetchAgentRun,
  streamAgentRun,
} from '@/research/api/agents'
import { deleteConversation, fetchConversation, fetchConversations } from '@/research/api/conversations'
import { fetchKnowledgeBases } from '@/research/api/knowledge-bases'
import HistoryPanelHeader from '@/research/components/common/HistoryPanelHeader.vue'
import PaneResizeHandle from '@/research/components/common/PaneResizeHandle.vue'
import ResearchMarkdown from '@/research/components/common/ResearchMarkdown.vue'
import ResearchCommandHeader from '@/research/components/common/ResearchCommandHeader.vue'
import QimingEvidencePanel from '@/research/components/qiming/QimingEvidencePanel.vue'
import { useResizableResearchPanels } from '@/research/composables/useResizableResearchPanels'
import { useResearchWorkspaceStore } from '@/research/stores/research-workspace'
import type { ApiErrorPayload } from '@/research/types/api'
import type { AgentEvidenceItem, AgentRun, AgentStreamEvent, QimingMode } from '@/research/types/agents'
import type { ConversationDetail, ConversationMessage, ConversationRecord } from '@/research/types/conversations'
import type { KnowledgeBaseRecord } from '@/research/types/knowledge-bases'
import { createClientUuid } from '@/research/utils/client-id'
import { useResearchSource } from '@/research/composables/useResearchSource'
import ResearchScopeSelect from '@/research/components/common/ResearchScopeSelect.vue'
import { RONGTONG_UI_ENABLED } from '@/research/features'

// PDF.js 体积较大，仅在用户打开 Citation 时加载，不增加普通问答工作台的首屏成本。
const { source, rootPath, resourceLabel, databaseId, initialDatabaseId } = useResearchSource()
const CitationPdfViewer = defineAsyncComponent(
  () => import('@/research/components/qiming/CitationPdfViewer.vue'),
)

// 历史栏按固定小页加载，避免会话较多时首屏串行读取全部分页。
const HISTORY_PAGE_SIZE = 20

const route = useRoute()
const router = useRouter()
const researchWorkspace = useResearchWorkspaceStore()
const knowledgeBases = ref<KnowledgeBaseRecord[]>([])
const conversations = ref<ConversationRecord[]>([])
const conversationPage = ref(0)
const conversationTotal = ref(0)
const historyLoading = ref(false)
const selectedKnowledgeBaseId = ref('')
const selectedConversationId = ref<string | null>(null)
const mode = ref<QimingMode>('FAST')
const query = ref('')
/* 输入框随内容增高，最多到初始高度的 1.5 倍（之后内部滚动），发送按钮固定在框内底部一行 */
const composerRef = ref<HTMLTextAreaElement | null>(null)
function autoResizeComposer(): void {
  const el = composerRef.value
  if (!el) return
  el.style.height = 'auto'
  const max = Number.parseFloat(getComputedStyle(el).maxHeight) || Number.POSITIVE_INFINITY
  el.style.height = `${Math.min(el.scrollHeight, max)}px`
}
watch(query, () => autoResizeComposer(), { flush: 'post' })
const messages = ref<ConversationMessage[]>([])
const currentRun = ref<AgentRun | null>(null)
const evidence = ref<AgentEvidenceItem[]>([])
const liveNode = ref('AuthenticateContext')
// 以当前 Run 的步骤序号约束状态更新，避免重连重放把新阶段倒退为准备上下文。
let liveNodeSequence = 0
const liveExecutorCode = ref<'QIMING' | 'ZHIJIAN' | 'SUZHI' | 'RONGTONG'>('QIMING')
const loadingWorkspace = ref(true)
// 切换历史会话时遮罩消息区并暂隐旧证据，历史栏仍可快速切换。
const conversationLoading = ref(false)
const deletingConversationId = ref('')
const running = ref(false)
const evidenceLoading = ref(false)
const evidenceDrawerOpen = ref(false)
const evidenceVisible = ref(true)
const citationViewerOpen = ref(false)
const activeCitation = ref<AgentEvidenceItem | null>(null)
const messageViewport = ref<HTMLElement | null>(null)
const qimingBody = ref<HTMLElement | null>(null)
let streamController: AbortController | null = null
let historyLoadPromise: Promise<void> | null = null
// 历史详情和 Evidence 请求只允许最近一次选择写入页面。
let conversationLoadGeneration = 0
let runLoadGeneration = 0

const selectedKnowledgeBase = computed(() =>
  knowledgeBases.value.find((item) => item.id === selectedKnowledgeBaseId.value) ?? null,
)
const canSubmit = computed(() =>
  Boolean(selectedKnowledgeBase.value && query.value.trim().length >= 2
    && !running.value && !conversationLoading.value && !loadingWorkspace.value),
)
// 检索片段可能先于答案落库；桌面与抽屉均等当前运行结束后再展示证据卡。
const evidencePending = computed(() => loadingWorkspace.value || conversationLoading.value
  || evidenceLoading.value || running.value || Boolean(currentRun.value && (
    currentRun.value.status !== 'SUCCESS' || !messages.value.some((message) =>
      message.role === 'ASSISTANT' && message.agent_run_id === currentRun.value?.id
      && Boolean(message.content.trim())
      && message.content === currentRun.value?.final_answer,
    )
  )))
const evidencePendingMessage = computed(() => running.value
  ? '正在生成并校验回答，完成后展示证据与引用。'
  : currentRun.value && evidencePending.value && !conversationLoading.value && !evidenceLoading.value
    ? '尚未确认完整回答，证据暂不展示。请重新打开此会话以同步结果。'
    : '正在加载会话与证据…')
const currentVersion = computed(() =>
  currentRun.value?.knowledge_base_version ?? selectedKnowledgeBase.value?.current_version ?? null,
)
const focusedRunId = computed(() => (
  typeof route.query.focus_run === 'string' ? route.query.focus_run : ''
))
const hasMoreConversations = computed(() => (
  conversationPage.value * HISTORY_PAGE_SIZE < conversationTotal.value
))

type LiveExecutorCode = 'QIMING' | 'ZHIJIAN' | 'SUZHI' | 'RONGTONG'

interface LiveNodeStatus {
  executor?: LiveExecutorCode
  label: string
}

// 专业图的首个独有节点确定实际执行模块；共享审核节点继续沿用此前模块。
const LIVE_NODE_STATUS: Record<string, LiveNodeStatus> = {
  AuthenticateContext: { executor: 'QIMING', label: '准备上下文' },
  SecurityCheck: { executor: 'QIMING', label: '安全检查' },
  IntentClassifier: { executor: 'QIMING', label: '理解问题' },
  ComplexityClassifier: { executor: 'QIMING', label: '判断复杂度' },
  TaskPlanner: { executor: 'QIMING', label: '规划任务' },
  RoutingDecision: { executor: 'QIMING', label: '选择执行模块' },
  RetrieveEvidence: { executor: 'QIMING', label: '检索证据' },
  ParseLanguagePreference: { executor: 'QIMING', label: '识别回答语言' },
  GenerateAnswer: { executor: 'QIMING', label: '组织回答' },
  ResultReviewer: { label: '复核回答' },
  UnsupportedIntent: { executor: 'QIMING', label: '确认能力边界' },
  Synthesizer: { executor: 'QIMING', label: '整理回答' },
  ParseCompareRequest: { executor: 'ZHIJIAN', label: '理解比较任务' },
  NormalizeCompareObjects: { executor: 'ZHIJIAN', label: '规范比较对象' },
  ValidateCompareRequest: { executor: 'ZHIJIAN', label: '校验比较请求' },
  GenerateCompareDimensions: { executor: 'ZHIJIAN', label: '规划比较维度' },
  BuildCompareQueries: { executor: 'ZHIJIAN', label: '构造检索查询' },
  RetrieveObjectA: { executor: 'ZHIJIAN', label: '检索对象 A' },
  RetrieveObjectB: { executor: 'ZHIJIAN', label: '检索对象 B' },
  MergeCandidates: { executor: 'ZHIJIAN', label: '合并候选证据' },
  EvidenceAssignment: { executor: 'ZHIJIAN', label: '判断证据归属' },
  EvidenceBalanceCheck: { executor: 'ZHIJIAN', label: '检查证据平衡' },
  CrossAnalysis: { executor: 'ZHIJIAN', label: '进行交叉分析' },
  CompareAnalysisValidation: { executor: 'ZHIJIAN', label: '核对共同点与差异点引用' },
  SimilarityAnalysis: { executor: 'ZHIJIAN', label: '归纳共同点' },
  DifferenceAnalysis: { executor: 'ZHIJIAN', label: '归纳差异点' },
  TimelineBuilder: { executor: 'ZHIJIAN', label: '构建时间线' },
  TopicAggregator: { executor: 'ZHIJIAN', label: '汇总研究热点' },
  MatrixGenerator: { executor: 'ZHIJIAN', label: '构建对比矩阵' },
  FinalizeRestricted: { executor: 'ZHIJIAN', label: '整理受限结果' },
  ConceptExtraction: { executor: 'SUZHI', label: '提取研究概念' },
  QueryExpansion: { executor: 'SUZHI', label: '规划跨语言检索' },
  LiteratureRetrieval: { executor: 'SUZHI', label: '检索文献证据' },
  EvidenceDedup: { executor: 'SUZHI', label: '合并重复证据' },
  MetadataNormalization: { executor: 'SUZHI', label: '规范文献元数据' },
  TopicClustering: { executor: 'SUZHI', label: '归纳主题并生成溯源图' },
  AnalysisValidation: { executor: 'SUZHI', label: '校验分析与溯源图引用' },
  ResearchMethodAnalysis: { executor: 'SUZHI', label: '分析研究方法' },
  ControversyAnalysis: { executor: 'SUZHI', label: '分析主要争议' },
  ResearchGapAnalysis: { executor: 'SUZHI', label: '梳理研究不足' },
  ReviewDraft: { executor: 'SUZHI', label: '撰写文献综述' },
  ReviewFallback: { executor: 'SUZHI', label: '根据已验证事实整理综述' },
  PolicyOrConceptIdentify: { executor: 'RONGTONG', label: '识别政策或概念' },
  EvidenceRetrieval: { executor: 'RONGTONG', label: '检索研究证据' },
  PolicyStructureExtraction: { executor: 'RONGTONG', label: '提取事实结构' },
  PolicyAnalysisValidation: { executor: 'RONGTONG', label: '核对事实引用' },
  CrossCulturalRiskCheck: { executor: 'RONGTONG', label: '检查文化误解' },
  AudienceAdaptation: { executor: 'RONGTONG', label: '适配目标受众' },
  TranslationOrBilingualGeneration: { executor: 'RONGTONG', label: '生成传播内容' },
  ResearchReviewer: { label: '复核研究结论' },
  CitationValidator: { label: '验证真实引用' },
}

/** 按步骤序号推进阶段，同时保留共享校验节点所属的实际执行模块。 */
function updateLiveProgress(node: string, sequence?: number): void {
  if (sequence !== undefined && Number.isInteger(sequence) && sequence > 0) {
    if (sequence < liveNodeSequence) return
    liveNodeSequence = sequence
  } else if (liveNodeSequence > 0) {
    // 恢复过数据库快照后，无序号的旧事件不能覆盖已确认的进度。
    return
  }
  liveNode.value = node
  const executor = LIVE_NODE_STATUS[node]?.executor
  if (executor) liveExecutorCode.value = executor
}

/** 从当前运行的持久化步骤恢复阶段，不能等待 SSE 重放才撤下默认第一步。 */
function restoreLiveProgress(run: AgentRun | null): void {
  liveNodeSequence = 0
  liveNode.value = 'AuthenticateContext'
  const executor = run?.executor_agent_code
  liveExecutorCode.value = executor && ['QIMING', 'ZHIJIAN', 'SUZHI', 'RONGTONG'].includes(executor)
    ? executor as LiveExecutorCode : 'QIMING'
  for (const step of [...(run?.steps ?? [])].sort((left, right) => left.sequence - right.sequence)) {
    updateLiveProgress(step.node_name, step.sequence)
  }
}

const liveStatusLabel = computed(() => {
  const moduleLabels: Record<LiveExecutorCode, string> = {
    QIMING: '文昌',
    ZHIJIAN: '智鉴',
    SUZHI: '溯知',
    RONGTONG: '融通',
  }
  const stage = LIVE_NODE_STATUS[liveNode.value]?.label ?? '正在处理'
  return `${moduleLabels[liveExecutorCode.value]} · ${stage}`
})
const {
  panelStyle: qimingPanelStyle,
  resizeHistoryPanel,
  resizeEvidencePanel,
} = useResizableResearchPanels({
  body: qimingBody,
  cssPrefix: 'qiming',
  historyDefault: 244,
  evidenceDefault: 350,
  contentMinimum: 480,
  isHistoryVisible: () => researchWorkspace.historyVisible,
  isEvidenceVisible: () => evidenceVisible.value,
})

/** 从统一错误信封提取可操作提示，网络异常则使用安全兜底文案。 */
function requestErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiErrorPayload>(error)) {
    return error.response?.data.message ?? fallback
  }
  return error instanceof Error ? error.message : fallback
}

/** 把运行日期压缩为左栏需要的相对友好格式。 */
function formatConversationDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

/** 原位规范历史溯知消息的 Citation，并清除旧版本追加的重复段末汇总。 */
function messageContent(message: ConversationMessage): string {
  if (message.role !== 'ASSISTANT' || !message.content.includes('citation_id')) {
    return message.content
  }
  const normalized = message.content.replace(
    /\[\s*citation_id\s*:\s*\d+(?:\s*,\s*citation_id\s*:\s*\d+)*\s*]/gi,
    (group) => [...group.matchAll(/citation_id\s*:\s*(\d+)/gi)]
      .map((match) => `[${match[1]}]`)
      .join(''),
  )
  return normalized.split('\n\n').map((paragraph) => {
    const trailing = paragraph.match(/([。！？.!?])\s+((?:\[\d+])+)$/)
    if (!trailing || trailing.index === undefined) return paragraph
    const prior = paragraph.slice(0, trailing.index + trailing[1].length)
    const priorIds = new Set([...prior.matchAll(/\[(\d+)]/g)].map((match) => match[1]))
    const trailingIds = [...trailing[2].matchAll(/\[(\d+)]/g)].map((match) => match[1])
    return trailingIds.some((citationId) => priorIds.has(citationId))
      ? prior
      : paragraph
  }).join('\n\n')
}

/** 把内部 Agent 编码转换成消息元数据中的短标签。 */
function routeLabel(values: string[]): string {
  const labels: Record<string, string> = {
    QIMING: '文昌',
    GENERAL_RAG: '通用检索',
    ZHIJIAN: '智鉴',
    SUZHI: '溯知',
    RONGTONG: '融通',
  }
  return values.map((value) => labels[value] ?? value).join(' → ')
}

/** 当前占位回答才显示实时状态，历史回答和用户消息保持简洁。 */
function isLiveAssistantMessage(message: ConversationMessage): boolean {
  return Boolean(
    running.value
    && message.role === 'ASSISTANT'
    && message.agent_run_id
    && message.agent_run_id === currentRun.value?.id,
  )
}

/**
 * 判断一条摘要是否可跳转到智鉴完整结构化结果。
 *
 * @param message 当前助手消息及其运行元数据。
 * @returns 消息绑定智鉴专业结果时返回真。
 */
function canOpenZhijian(message: ConversationMessage): boolean {
  return Boolean(
    message.agent_run_id
    && message.executor_agent_code === 'ZHIJIAN'
    && message.result_type === 'ZHIJIAN_COMPARISON',
  )
}

/**
 * 判断一条摘要是否可跳转到溯知完整文献综述。
 *
 * @param message 当前助手消息及其运行元数据。
 * @returns 消息绑定溯知专业结果时返回真。
 */
function canOpenSuzhi(message: ConversationMessage): boolean {
  return Boolean(
    message.agent_run_id
    && message.executor_agent_code === 'SUZHI'
    && message.result_type === 'SUZHI_LITERATURE_REVIEW',
  )
}

/** 仅在融通页面开放时，为已保存的专业消息展示完整传播入口。 */
function canOpenRongtong(message: ConversationMessage): boolean {
  return Boolean(RONGTONG_UI_ENABLED && message.agent_run_id && message.executor_agent_code === 'RONGTONG'
    && message.result_type === 'RONGTONG_POLICY_COMMUNICATION')
}

/** 滚动到最新消息，保持 SSE 回答可见。 */
async function scrollToLatest(): Promise<void> {
  await nextTick()
  if (messageViewport.value) messageViewport.value.scrollTop = messageViewport.value.scrollHeight
}

/**
 * 将消息区定位到指定 Run 的第一条消息，使专业结果返回后保留原问答上下文。
 *
 * @param runId 需要定位的 Agent Run 主键。
 * @returns 找到并滚动到目标消息时返回真。
 */
async function scrollToRun(runId: string): Promise<boolean> {
  await nextTick()
  const target = Array.from(
    messageViewport.value?.querySelectorAll<HTMLElement>('[data-agent-run-id]') ?? [],
  ).find((element) => element.dataset.agentRunId === runId)
  if (!target) return false
  target.scrollIntoView({ block: 'start' })
  return true
}

/**
 * 读取一页会话，并按刷新或向下追加语义更新历史栏。
 *
 * @param page 从 1 开始的目标页码。
 * @param replace 是否用该页替换当前列表；刷新第一页时为真。
 */
async function loadConversationPage(page: number, replace: boolean): Promise<void> {
  historyLoading.value = true
  try {
    const result = await fetchConversations(page, HISTORY_PAGE_SIZE, source, databaseId)
    const merged = new Map<string, ConversationRecord>(
      (replace ? [] : conversations.value).map((item) => [item.id, item]),
    )
    result.items.forEach((item) => merged.set(item.id, item))
    conversations.value = [...merged.values()]
    conversationPage.value = result.page
    conversationTotal.value = result.total
  } finally {
    historyLoading.value = false
  }
}

/** 独占执行一次历史分页请求，防止连续滚动重复加载同一页。 */
async function runHistoryLoad(page: number, replace: boolean): Promise<void> {
  const request = loadConversationPage(page, replace)
  historyLoadPromise = request
  try {
    await request
  } finally {
    if (historyLoadPromise === request) historyLoadPromise = null
  }
}

/** 并行读取可访问研究范围和最近一页当前用户会话。 */
async function loadWorkspace(): Promise<void> {
  const [knowledgeResult] = await Promise.all([
    fetchKnowledgeBases({ page: 1, page_size: Number.MAX_SAFE_INTEGER }, source, databaseId),
    runHistoryLoad(1, true),
  ])
  knowledgeBases.value = knowledgeResult.items
  if (!selectedKnowledgeBaseId.value && knowledgeBases.value.length) {
    selectedKnowledgeBaseId.value = knowledgeBases.value.find((item) => item.id === initialDatabaseId)?.id ?? knowledgeBases.value[0].id
  }
}

/** 刷新左栏会话，而不覆盖当前对话内容。 */
async function refreshConversations(): Promise<void> {
  if (historyLoadPromise) {
    try {
      await historyLoadPromise
    } catch {
      // 刷新会重新请求第一页，不延续上一条滚动分页请求的失败状态。
    }
  }
  await runHistoryLoad(1, true)
}

/** 在历史栏接近底部时追加下一页，失败后允许用户再次滚动重试。 */
async function loadMoreConversations(): Promise<void> {
  if (historyLoadPromise || !hasMoreConversations.value) return
  try {
    await runHistoryLoad(conversationPage.value + 1, false)
  } catch (error) {
    ElMessage.error(requestErrorMessage(error, '加载更多历史会话失败'))
  }
}

/** 根据历史栏滚动位置触发预加载，保留少量阈值避免必须精确触底。 */
function handleHistoryScroll(event: Event): void {
  const target = event.currentTarget
  if (!(target instanceof HTMLElement)) return
  const remaining = target.scrollHeight - target.scrollTop - target.clientHeight
  if (remaining <= 96) void loadMoreConversations()
}

/**
 * 进入一条既有会话并恢复消息、最后一次运行和 Evidence。
 *
 * @param id 待打开的会话主键。
 * @param updateRoute 是否同步更新浏览器中的会话详情路由。
 */
async function openConversation(id: string, updateRoute = true): Promise<void> {
  // 1. 立即更新历史选中态，并使之前会话和 Evidence 的请求失效。
  const token = ++conversationLoadGeneration
  runLoadGeneration += 1
  selectedConversationId.value = id
  conversationLoading.value = true
  messages.value = []
  currentRun.value = null
  evidence.value = []
  citationViewerOpen.value = false
  activeCitation.value = null
  streamController?.abort()
  running.value = false
  evidenceLoading.value = false
  try {
    // 先同步选择到路由，避免耗时数据读取结束后才发起旧导航，覆盖用户更新的选择。
    if (updateRoute && route.params.id !== id) await router.push(`${rootPath}/qiming/conversations/${id}`)
    if (token !== conversationLoadGeneration || selectedConversationId.value !== id) return
    // 2. 先读取消息，再确定目标 Run 并并行读取详情与证据；加载期间不显示上一会话的内容。
    let detail: ConversationDetail = await fetchConversation(id, source, databaseId)
    if (token !== conversationLoadGeneration || selectedConversationId.value !== id) return
    const focusRunId = focusedRunId.value
    const requestedRunId = detail.messages.find(
      (item) => item.role === 'ASSISTANT' && item.agent_run_id === focusRunId,
    )?.agent_run_id
    const lastRunId = [...detail.messages].reverse().find((item) => item.agent_run_id)?.agent_run_id
    const targetRunId = requestedRunId ?? lastRunId
    const [runResult, evidenceResult] = targetRunId
      ? await Promise.all([fetchAgentRun(targetRunId, source, databaseId), fetchAgentEvidence(targetRunId)])
      : [null, []]
    if (token !== conversationLoadGeneration || selectedConversationId.value !== id) return
    // 消息快照可能早于任务完成；确认终态后补读，避免漏掉刚发布的回答。
    if (runResult?.status === 'SUCCESS' && !detail.messages.some(
      (item) => item.role === 'ASSISTANT' && item.agent_run_id === targetRunId
        && Boolean(item.content.trim()) && item.content === runResult.final_answer,
    )) {
      detail = await fetchConversation(id, source, databaseId)
      if (token !== conversationLoadGeneration || selectedConversationId.value !== id) return
    }
    // 3. 所有数据齐备且仍属当前选择时，一次提交消息、运行和证据视图。
    selectedKnowledgeBaseId.value = detail.knowledge_base_id
    messages.value = detail.messages
    currentRun.value = runResult
    evidence.value = evidenceResult
    restoreLiveProgress(runResult)
    // 运行中的 Assistant 消息尚未入库；恢复本地占位并重新订阅可重放的步骤事件。
    // 只为当前目标 Run 补位，历史已完成回答和其他会话均不受影响。
    running.value = Boolean(runResult && ['PENDING', 'RUNNING'].includes(runResult.status))
    if (running.value && targetRunId && !messages.value.some(
      (item) => item.role === 'ASSISTANT' && item.agent_run_id === targetRunId,
    )) {
      messages.value.push(pendingAssistantMessage(targetRunId, runResult!.knowledge_base_version))
    }
    if (!requestedRunId || !await scrollToRun(requestedRunId)) await scrollToLatest()
    if (running.value && targetRunId && token === conversationLoadGeneration) {
      void followRun(targetRunId, id, token)
    }
  } catch (error) {
    if (token === conversationLoadGeneration) {
      selectedConversationId.value = null
      ElMessage.error(requestErrorMessage(error, '会话读取失败'))
    }
  } finally {
    if (token === conversationLoadGeneration) conversationLoading.value = false
  }
}

/** 重置为未持久化的新会话，并保留当前研究范围选择。 */
async function newConversation(): Promise<void> {
  conversationLoadGeneration += 1
  runLoadGeneration += 1
  streamController?.abort()
  conversationLoading.value = false
  evidenceLoading.value = false
  selectedConversationId.value = null
  messages.value = []
  currentRun.value = null
  evidence.value = []
  liveNode.value = 'AuthenticateContext'
  liveNodeSequence = 0
  citationViewerOpen.value = false
  activeCitation.value = null
  liveExecutorCode.value = 'QIMING'
  running.value = false
  query.value = ''
  if (route.path !== `${rootPath}/qiming`) await router.push(`${rootPath}/qiming`)
}

/** 确认后软删除一条完整启明会话，并在删除当前项时重置工作台。 */
async function confirmDeleteConversation(item: ConversationRecord): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `将删除“${item.title}”及其全部问答、运行过程和证据映射。`,
      '删除会话',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    )
    deletingConversationId.value = item.id
    await deleteConversation(item.id)
    conversations.value = conversations.value.filter((conversation) => conversation.id !== item.id)
    if (selectedConversationId.value === item.id) await newConversation()
    try {
      await refreshConversations()
    } catch {
      ElMessage.warning('会话已删除，但历史列表刷新失败，请稍后刷新页面')
      return
    }
    ElMessage.success('会话已删除')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(requestErrorMessage(error, '删除会话失败'))
    }
  } finally {
    deletingConversationId.value = ''
  }
}

/** 恢复指定 Run 的详情和证据，并在右栏展示。 */
async function loadRun(id: string): Promise<void> {
  const token = ++runLoadGeneration
  const conversationToken = conversationLoadGeneration
  // 消息选中即撤下旧 Run 的证据和原文，不能在网络等待期间冒充新回答的引用。
  evidence.value = []
  citationViewerOpen.value = false
  activeCitation.value = null
  evidenceLoading.value = true
  try {
    const [runResult, evidenceResult] = await Promise.all([
      fetchAgentRun(id, source, databaseId),
      fetchAgentEvidence(id),
    ])
    if (token !== runLoadGeneration || conversationToken !== conversationLoadGeneration) return
    currentRun.value = runResult
    evidence.value = evidenceResult
  } finally {
    if (token === runLoadGeneration) evidenceLoading.value = false
  }
}

/** 点击历史回答时切换 Evidence Panel 到该消息对应 Run。 */
async function selectMessage(message: ConversationMessage): Promise<void> {
  if (conversationLoading.value || running.value) return
  if (message.role !== 'ASSISTANT' || !message.agent_run_id || message.agent_run_id === currentRun.value?.id) return
  await loadRun(message.agent_run_id)
}

/** 为尚未发布 Assistant 消息的活动 Run 构造界面占位。 */
function pendingAssistantMessage(runId: string, knowledgeBaseVersion: number): ConversationMessage {
  return {
    id: `local-assistant-${runId}`, role: 'ASSISTANT', content: '', agent_run_id: runId,
    agent_route: ['QIMING'], entry_agent_code: 'QIMING', executor_agent_code: 'QIMING',
    result_type: null, schema_version: null, evidence_level: null,
    knowledge_base_version: knowledgeBaseVersion, citations: [],
    created_at: new Date().toISOString(),
  }
}

/** 根据 SSE 事件更新当前会话；离开后的旧流不得覆盖新选择。 */
function handleStreamEvent(event: AgentStreamEvent, runId: string, conversationId: string, token: number): void {
  if (token !== conversationLoadGeneration || selectedConversationId.value !== conversationId
    || currentRun.value?.id !== runId) return
  if (event.event === 'run.started' && currentRun.value?.id === runId) {
    currentRun.value.status = String(event.data.status ?? currentRun.value.status)
  }
  if (event.event === 'node.started') {
    const node = String(event.data.node ?? '')
    const sequence = Number(event.data.sequence)
    updateLiveProgress(node, Number.isInteger(sequence) && sequence > 0 ? sequence : undefined)
    // 节点事件只可能来自已被执行器领取的 Run；同步为 RUNNING，避免界面继续显示排队。
    if (currentRun.value?.id === runId) currentRun.value.status = 'RUNNING'
  }
  if (event.event === 'answer.delta') {
    const target = messages.value.find(
      (message) => message.role === 'ASSISTANT' && message.agent_run_id === runId,
    )
    if (target) target.content += String(event.data.delta ?? '')
    void scrollToLatest()
  }
}

/** 订阅当前活动 Run，终态再用持久化会话替换本地占位。 */
async function followRun(runId: string, conversationId: string, token: number): Promise<void> {
  // 路由守卫也是异步边界；旧提交可能在用户切换后才返回，不能抢占新会话的流句柄。
  if (token !== conversationLoadGeneration || selectedConversationId.value !== conversationId) return
  const controller = new AbortController()
  streamController = controller
  const terminal = { failureMessage: '' }
  try {
    await streamAgentRun(runId, (event) => {
      if (event.event === 'run.failed') {
        terminal.failureMessage = String(event.data.message ?? '启明运行失败，请稍后重试')
      }
      handleStreamEvent(event, runId, conversationId, token)
    }, controller.signal)
    if (controller.signal.aborted || token !== conversationLoadGeneration
      || selectedConversationId.value !== conversationId) return
    // 先确认已发布的运行快照，再读取消息，避免早于终态的消息覆盖完整回答。
    await loadRun(runId)
    const detail = await fetchConversation(conversationId, source, databaseId)
    if (controller.signal.aborted || token !== conversationLoadGeneration
      || selectedConversationId.value !== conversationId) return
    messages.value = detail.messages
    if (controller.signal.aborted || token !== conversationLoadGeneration
      || selectedConversationId.value !== conversationId) return
    running.value = false
    if (terminal.failureMessage) ElMessage.error(terminal.failureMessage)
    await refreshConversations()
    await scrollToLatest()
  } catch (error) {
    if (controller.signal.aborted || token !== conversationLoadGeneration
      || selectedConversationId.value !== conversationId) return
    running.value = false
    const pending = messages.value.find((item) => item.role === 'ASSISTANT' && item.agent_run_id === runId && !item.content)
    if (pending) pending.content = '运行状态暂时无法读取，请重新打开会话查看结果。'
    ElMessage.error(requestErrorMessage(error, '运行状态连接中断，请重新打开会话'))
  } finally {
    if (streamController === controller) streamController = null
  }
}

/** 创建幂等 Run，写入本地消息占位并连接受鉴权的 SSE。 */
async function submitQuestion(): Promise<void> {
  const content = query.value.trim()
  if (!canSubmit.value || !content) return
  streamController?.abort()
  const token = ++conversationLoadGeneration
  runLoadGeneration += 1
  running.value = true
  evidence.value = []
  citationViewerOpen.value = false
  activeCitation.value = null
  liveNode.value = 'AuthenticateContext'
  liveNodeSequence = 0
  liveExecutorCode.value = 'QIMING'
  const requestId = createClientUuid()
  const optimisticUser: ConversationMessage = {
    id: `local-user-${requestId}`,
    role: 'USER',
    content,
    agent_run_id: null,
    agent_route: [],
    entry_agent_code: null,
    executor_agent_code: null,
    result_type: null,
    schema_version: null,
    evidence_level: null,
    knowledge_base_version: currentVersion.value,
    citations: [],
    created_at: new Date().toISOString(),
  }
  messages.value.push(optimisticUser)
  query.value = ''
  await scrollToLatest()
  try {
    const accepted = await createQimingRun({
      request_id: requestId,
      knowledge_base_id: selectedKnowledgeBaseId.value,
      ...(selectedConversationId.value ? { conversation_id: selectedConversationId.value } : {}),
      query: content,
      mode: mode.value,
    }, source)
    if (token !== conversationLoadGeneration) return
    selectedConversationId.value = accepted.conversation_id
    optimisticUser.agent_run_id = accepted.run_id
    currentRun.value = {
      id: accepted.run_id,
      request_id: accepted.request_id,
      conversation_id: accepted.conversation_id,
      agent_code: 'QIMING',
      agent_name: '文昌',
      entry_agent_code: 'QIMING',
      executor_agent_code: 'QIMING',
      knowledge_base_id: accepted.knowledge_base_id,
      knowledge_base_name: selectedKnowledgeBase.value?.name ?? '',
      knowledge_base_version: accepted.knowledge_base_version,
      status: accepted.status,
      intent: null,
      route: ['QIMING'],
      mode: mode.value,
      output_language: 'AUTO',
      original_language: null,
      final_answer: null,
      evidence_level: null,
      evidence_summary: {},
      reviewer_status: null,
      citation_validation_status: null,
      started_at: null,
      finished_at: null,
      error_code: null,
      error_message: null,
      created_at: new Date().toISOString(),
    }
    messages.value.push({
      id: `local-assistant-${requestId}`,
      role: 'ASSISTANT',
      content: '',
      agent_run_id: accepted.run_id,
      agent_route: ['QIMING'],
      entry_agent_code: 'QIMING',
      executor_agent_code: 'QIMING',
      result_type: null,
      schema_version: null,
      evidence_level: null,
      knowledge_base_version: accepted.knowledge_base_version,
      citations: [],
      created_at: new Date().toISOString(),
    })
    await router.replace(`${rootPath}/qiming/conversations/${accepted.conversation_id}`)
    if (token !== conversationLoadGeneration || selectedConversationId.value !== accepted.conversation_id) return
    // 创建接口返回时会话和 Run 已持久化；立即刷新左栏，让长任务在执行期间也可见。
    void refreshConversations().catch((error) => {
      ElMessage.warning(requestErrorMessage(error, '新会话已创建，但历史列表刷新失败'))
    })
    await followRun(accepted.run_id, accepted.conversation_id, token)
  } catch (error) {
    if (token !== conversationLoadGeneration) return
    running.value = false
    ElMessage.error(error instanceof Error ? error.message : '提交问题失败')
  }
}

/**
 * 在站内 PDF.js 阅读器中打开真实 Citation，并保留当前问答上下文。
 *
 * @param item Evidence 与 Citation 的一一映射。
 */
function openCitation(item: AgentEvidenceItem): void {
  activeCitation.value = item
  citationViewerOpen.value = true
}

/** 路由直接进入 /research/qiming/conversations/:id 时恢复对应会话。 */
async function restoreRouteConversation(): Promise<void> {
  const id = typeof route.params.id === 'string' ? route.params.id : ''
  if (id && id !== selectedConversationId.value) await openConversation(id, false)
  else if (!id && selectedConversationId.value) await newConversation()
}

watch([() => route.params.id, () => route.query.focus_run], () => { void restoreRouteConversation() })

onMounted(async () => {
  try {
    await loadWorkspace()
    await restoreRouteConversation()
  } catch {
    ElMessage.error('文昌工作台加载失败')
  } finally {
    loadingWorkspace.value = false
  }
})

onBeforeUnmount(() => {
  conversationLoadGeneration += 1
  runLoadGeneration += 1
  streamController?.abort()
})
</script>

<template>
  <section v-loading="loadingWorkspace" class="qiming-workspace">
    <ResearchCommandHeader
      title="库源智答"
      subtitle="QIMING · EVIDENCE FIRST"
    >
      <template #icon>Q</template>
      <template #knowledge>
        <ResearchScopeSelect v-model="selectedKnowledgeBaseId" :options="knowledgeBases" :disabled="running || Boolean(selectedConversationId)" />
      </template>
    </ResearchCommandHeader>

    <div
      ref="qimingBody"
      class="qiming-body"
      :class="{
        'history-hidden': !researchWorkspace.historyVisible,
        'evidence-hidden': !evidenceVisible,
      }"
      :style="qimingPanelStyle"
    >
      <aside
        class="conversation-rail"
        :class="{ collapsed: !researchWorkspace.historyVisible }"
        @scroll.passive="handleHistoryScroll"
      >
        <HistoryPanelHeader
          :collapsed="!researchWorkspace.historyVisible"
          title="历史会话"
          @toggle="researchWorkspace.toggleHistory"
        />
        <el-button
          v-if="researchWorkspace.historyVisible"
          class="rail-new-btn"
          :disabled="running"
          @click="newConversation"
        >新建对话</el-button>
        <div v-if="researchWorkspace.historyVisible" class="conversation-heading"><span>最近对话</span><small>{{ conversationTotal }}</small></div>
        <nav v-if="researchWorkspace.historyVisible">
          <el-tooltip
            v-for="item in conversations"
            :key="item.id"
            :content="item.title"
            :disabled="true"
            placement="top"
            :show-after="250"
            popper-class="research-history-question-tooltip"
          >
            <div
              class="conversation-item" :title="item.title"
              :class="{
                active: item.id === selectedConversationId,
              }"
            >
              <button
                type="button"
                class="conversation-open"
                @click="openConversation(item.id)"
              >
                <el-icon><ChatDotSquare /></el-icon>
                <span>
                  <strong>{{ item.title }}</strong>
                  <small>{{ item.knowledge_base_name ?? `${resourceLabel}已不可访问` }} · {{ formatConversationDate(item.updated_at) }}</small>
                  <em v-if="!item.knowledge_base_accessible" class="conversation-access-state">仅查看历史</em>
                </span>
              </button>
              <button
                type="button"
                class="conversation-delete"
                :disabled="deletingConversationId === item.id"
                :aria-label="`删除会话：${item.title}`"
                @click="confirmDeleteConversation(item)"
              ><el-icon><Delete /></el-icon></button>
            </div>
          </el-tooltip>
        </nav>
        <p
          v-if="researchWorkspace.historyVisible && historyLoading && conversations.length"
          class="conversation-load-status"
          role="status"
        >正在加载更多历史…</p>
      </aside>

      <PaneResizeHandle
        v-if="researchWorkspace.historyVisible"
        class="qiming-history-resizer"
        label="调整历史对话栏宽度"
        @resize="resizeHistoryPanel"
      />

      <main v-loading="conversationLoading && !loadingWorkspace" class="qiming-chat">
        <div ref="messageViewport" class="qiming-messages">
          <div v-if="!messages.length" class="qiming-welcome">
            <span><el-icon><Collection /></el-icon></span>
            <p class="page-kicker">ASK WITH TRACEABLE EVIDENCE</p>
            <h2>从一条可验证的问题开始</h2>
            <p>文昌在所选研究范围中检索，先形成证据，再回答并给出真实文献与页码。</p>
          </div>

          <article
            v-for="message in messages"
            :key="message.id"
            class="qiming-message"
            :class="message.role.toLowerCase()"
            :data-agent-run-id="message.agent_run_id"
            @click="selectMessage(message)"
          >
            <div class="message-avatar">{{ message.role === 'USER' ? '你' : 'Q' }}</div>
            <div class="message-content">
              <header>{{ message.role === 'USER' ? '研究者' : routeLabel([message.executor_agent_code ?? 'QIMING']) }}</header>
              <ResearchMarkdown
                v-if="message.content"
                class="message-text"
                :content="messageContent(message)"
              />
              <p v-else class="message-thinking" role="status" aria-live="polite">
                {{ isLiveAssistantMessage(message) ? liveStatusLabel : '正在依据证据组织回答…' }}
              </p>
              <footer
                v-if="message.role === 'ASSISTANT' && (
                  canOpenZhijian(message) || canOpenSuzhi(message) || canOpenRongtong(message)
                )"
              >
                <router-link
                  v-if="canOpenZhijian(message)"
                  class="professional-result-link"
                  :to="`${rootPath}/zhijian/runs/${message.agent_run_id}`"
                  @click.stop
                >查看完整智鉴比较</router-link>
                <router-link
                  v-if="canOpenSuzhi(message)"
                  class="professional-result-link"
                  :to="`${rootPath}/suzhi/runs/${message.agent_run_id}`"
                  @click.stop
                >查看完整溯知综述</router-link>
                <router-link v-if="canOpenRongtong(message)" class="professional-result-link"
                  :to="`${rootPath}/rongtong/runs/${message.agent_run_id}`" @click.stop>查看完整融通传播</router-link>
              </footer>
            </div>
          </article>
        </div>

        <div class="qiming-composer">
          <p v-if="selectedConversationId && !selectedKnowledgeBase && !conversationLoading" role="status">关联{{ resourceLabel }}已删除，可查看历史会话，不能继续提问。</p>
          <!-- 输入框：随内容增高（上限为初始高度 1.5 倍），发送按钮固定占据框内底部一行 -->
          <div class="composer-box">
            <textarea ref="composerRef" v-model="query" :disabled="running || conversationLoading || loadingWorkspace || !selectedKnowledgeBase" maxlength="4000" placeholder="请输入一个普通研究问题；Shift + Enter 换行" @keydown.ctrl.enter.prevent="submitQuestion" />
            <div class="composer-actions">
              <button type="button" class="qiming-submit" :disabled="!canSubmit" @click="submitQuestion">
                <el-icon v-if="!running"><Promotion /></el-icon>
                <span>{{ running ? '运行中' : '发送' }}</span>
                <el-icon><ArrowRight /></el-icon>
              </button>
            </div>
          </div>
          <!-- 提示信息：输入框正下方 -->
          <div class="composer-hint">
            <span><el-icon><DocumentChecked /></el-icon>答案必须经过 Reviewer 与 Citation Validator</span>
            <button class="evidence-mobile-button" type="button" @click="evidenceDrawerOpen = true">查看证据</button>
          </div>
        </div>
      </main>

      <PaneResizeHandle
        v-if="evidenceVisible"
        class="qiming-evidence-resizer"
        label="调整证据引用栏宽度"
        @resize="resizeEvidencePanel"
      />
      <QimingEvidencePanel
        class="desktop-evidence"
        :items="evidence"
        :loading="evidenceLoading && !loadingWorkspace && !conversationLoading"
        :pending="evidencePending"
        :pending-message="evidencePendingMessage"
        :collapsed="!evidenceVisible"
        @toggle="evidenceVisible = !evidenceVisible"
        @open-citation="openCitation"
      />
    </div>

    <el-drawer v-model="evidenceDrawerOpen" title="Evidence Panel" direction="rtl" size="420px">
      <QimingEvidencePanel :items="evidence" :loading="evidenceLoading && !loadingWorkspace && !conversationLoading" :pending="evidencePending" :pending-message="evidencePendingMessage" @toggle="evidenceDrawerOpen = false" @open-citation="openCitation" />
    </el-drawer>

    <CitationPdfViewer
      v-if="activeCitation"
      v-model="citationViewerOpen"
      :item="activeCitation"
    />
  </section>
</template>
