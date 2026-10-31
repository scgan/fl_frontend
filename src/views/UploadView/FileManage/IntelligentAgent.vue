<!-- 通用智答（原 AI 问答）：检索、研究、自然语言文献分析与知识库写作的会话内衔接。 -->
<script setup>
import { computed, nextTick, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getCorpusDetailService } from '@/api/public'
import { http } from '@/research/api/http'
import { fetchAgentEvidence } from '@/research/api/agents'
import { createClientUuid } from '@/research/utils/client-id'
import { fetchForeignKnowledgeBases } from '@/research/api/foreign-resources'
import { collectWritingActions, writingActionLocked } from '@/research/utils/writing-actions'
import { writingQuestion } from '@/research/utils/writing-question'
import { activeReadingContext, assistantDocuments, readingDocuments } from '@/research/utils/reading-materials'
import { readingCardState, readingGroupKey, readingAnalysisLocked } from '@/research/utils/reading-card-state'
import {
  ArrowLeft,
  ChatLineRound,
  Close,
  Delete,
  Expand,
  Fold,
  Menu,
  Plus,
  Reading,
} from '@element-plus/icons-vue'
import AiQuestionComposer from '@/components/ai/AiQuestionComposer.vue'
import AiWritingCard from '@/components/ai/AiWritingCard.vue'
import AiRunProgress from '@/components/ai/AiRunProgress.vue'
import AiReadingRecommendations from '@/components/ai/AiReadingRecommendations.vue'
import ResearchMarkdown from '@/research/components/common/ResearchMarkdown.vue'
import SuzhiProvenanceGraph from '@/research/components/suzhi/SuzhiProvenanceGraph.vue'
import ZhijianAnswer from '@/research/components/zhijian/ZhijianAnswer.vue'
import CitationPdfViewer from '@/research/components/qiming/CitationPdfViewer.vue'

const router = useRouter()
const route = useRoute()

/** 返回：回到进入「通用智答」之前的那一页；没有历史（直接打开链接）时回工作台首页。 */
function goBack() {
  if (window.history.state?.back) router.back()
  else router.push('/user/count')
}
const histories = ref([])
const conversation = ref(null)
// 旧单库会话仅保留历史，后续提问另建全库会话，避免更改历史来源或触发范围冲突。
const historicalDatabaseId = ref(null)
const turns = ref([])
// 最近选择或翻页的材料卡；普通输入优先使用它，避免旧列表的勾选被最新结果覆盖。
const activeMaterialSourceId = ref(null)
// 服务端运行是最终状态来源；POST 返回前的短暂状态防止快速连点和重复请求。
const writingSubmissions = ref({})
// 独立阅读状态按真实 Run 回查；仅导航中的短暂状态由当前页面持有。
const readingActionCache = ref({})
const handoffPending = ref(false)
const writingActions = computed(() => collectWritingActions(turns.value, writingSubmissions.value))
// 知识库仅供写作任务明确确认，普通搜索和问答保持原来的范围。
const knowledgeBases = ref([])
const librariesLoading = ref(false)
const librariesError = ref('')
const input = ref('')
const busy = ref(false)
const error = ref('')
const citation = ref(null)
const pdfVisible = ref(false)
// 全文模式与引用定位共用阅读器，附件选择独立于每轮问答的 selected 材料。
const readerDocument = ref(null)
const readerSource = ref(null)
const readerFiles = ref([])
const filePickerVisible = ref(false)
const readingId = ref(null)
// 文献与引用共用请求序号，连续点击时只展示最后一次选择。
let citationRequest = 0
const historyExpanded = ref(false)
// 桌面端左侧会话栏可收起（记在本地）；移动端仍走抽屉式展开。
const RAIL_KEY = 'ai.railCollapsed'
const railCollapsed = ref(localStorage.getItem(RAIL_KEY) === '1')
function toggleRail() {
  railCollapsed.value = !railCollapsed.value
  localStorage.setItem(RAIL_KEY, railCollapsed.value ? '1' : '0')
}
const historyPage = ref(1)
const historyTotal = ref(0)
// 滚动区只管理呈现行为，Research 会话和运行状态仍由本页面持有。
const thread = ref(null)
/* 右侧问题定位条：列出本轮对话里的每个提问，点击可滚到对应位置 */
const activeTurnIndex = ref(0)
const turnRail = computed(() =>
  turns.value.map((turn, index) => {
    const label = writingQuestion(turn, turns.value).replace(/\s+/g, ' ').trim()
    return {
      id: turn.id,
      index,
      label: label.length > 60 ? `${label.slice(0, 60)}…` : label,
    }
  }),
)
function turnNodes() {
  return thread.value ? Array.from(thread.value.querySelectorAll('.turn')) : []
}
function scrollToTurn(index) {
  const node = turnNodes()[index]
  if (!node) return
  activeTurnIndex.value = index
  node.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
/** 滚动时高亮当前正在看的问题（取视口上方 1/3 处作为判定线）。 */
function onThreadScroll() {
  const el = thread.value
  const nodes = turnNodes()
  if (!el || !nodes.length) return
  const line = el.getBoundingClientRect().top + el.clientHeight / 3
  let current = 0
  nodes.forEach((node, index) => {
    if (node.getBoundingClientRect().top <= line) current = index
  })
  activeTurnIndex.value = current
}
const allWritingArtifacts = computed(() => turns.value
  .map((turn) => turn.result_payload?.payload?.writing_result)
  .filter((item) => item?.artifact_id))
// 表格实例不放入消息快照；跨页选择由每轮 selected 中的真实文献 ID 维护。
const documentTables = new Map()
const activeTitle = computed(
  () => histories.value.find((item) => item.id === conversation.value)?.title || '通用智答',
)
/** 在提交或恢复会话后显示最近一轮问题，避免新结果出现在视口之外。 */
async function scrollToLatest() {
  await nextTick()
  if (thread.value) thread.value.scrollTop = thread.value.scrollHeight
}
let generation = 0
let timer
let wake

/** 清理轮询，同时唤醒等待方以便页面切换后尽快退出。 */
function stopPolling() {
  clearTimeout(timer)
  wake?.()
  wake = null
}
/** 在当前页面生命周期内等待下一次运行状态刷新。 */
function pause() {
  return new Promise((resolve) => {
    wake = resolve
    timer = setTimeout(resolve, 1200)
  })
}
/** 加载本人的 AI 会话分页，不混入独立阅读与写作工作台的会话。 */
async function loadHistory() {
  try {
    const { data } = await http.get('/conversations', {
      params: { entry_source: 'AI', page: historyPage.value },
    })
    histories.value = data.data.items
    historyTotal.value = data.data.total
  } catch (err) {
    error.value = describe(err)
  }
}
/** 提取后端可展示错误，保留失败态供用户重试。 */
function describe(err) {
  return (
    err.response?.data?.detail ||
    err.response?.data?.message ||
    err.message ||
    '请求失败，请稍后重试'
  )
}
/** 开始独立对话；旧运行仍由 Research 保存并可从历史恢复。 */
function newChat() {
  generation++
  citationRequest++
  readingId.value = null
  filePickerVisible.value = false
  pdfVisible.value = false
  stopPolling()
  conversation.value = null
  historicalDatabaseId.value = null
  turns.value = []
  activeMaterialSourceId.value = null
  writingSubmissions.value = {}
  readingActionCache.value = {}
  handoffPending.value = false
  documentTables.clear()
  busy.value = false
  error.value = ''
  historyExpanded.value = false
}

/** 把当前对话同步到路由：有会话时 /agent/c/:id，新建对话时 /agent。 */
function syncRoute(id) {
  const target = id ? `/agent/c/${id}` : '/agent'
  if (route.path === target) return
  router.replace(target)
}

/** 点击「新对话」：清空当前对话并回到 /agent。 */
function startNewChat() {
  newChat()
  syncRoute(null)
}
/** 将运行恢复成页面消息，候选、选中状态与回答来源分别管理。 */
function turnFrom(run) {
  const payload = run.result_payload?.payload || {}
  const documents = assistantDocuments(payload)
  return {
    ...run,
    selected: [],
    documents,
    documentPages: { 1: documents },
    documentTotal: Math.min(payload.total ?? documents.length, 500),
    documentPage: 1,
    loadingDocuments: false,
  }
}
/** 记录各轮独立表格，程序恢复勾选时不会触发用户选择事件。 */
function setDocumentTable(turn, table) {
  if (table) {
    documentTables.set(turn.id, table)
    void nextTick(() => {
      if (documentTables.get(turn.id) === table) syncDocumentSelection(turn)
    })
  }
  else documentTables.delete(turn.id)
}
/** 将恢复的 ID 选择同步到真实表格，程序勾选不作为用户重新选择。 */
function syncDocumentSelection(turn) {
  const table = documentTables.get(turn.id)
  const selected = new Set(turn.selected.map((item) => item.corpus_id))
  table?.clearSelection()
  for (const row of turn.documents) table?.toggleRowSelection(row, selected.has(row.corpus_id))
}
/** 立即保存当前卡片的跨页选择，避免跳转阅读页或切换会话后丢失。 */
function rememberDocumentSelection(turn) {
  readingCardState.select(turn.id, turn.selected, turn.documentPage)
  readingActionCache.value = { ...readingActionCache.value,
    [turn.id]: readingCardState.cachedAction(turn.id, turn.selected.map((item) => item.corpus_id)) }
}
/** 本会话分析结果与独立阅读共用同一组篇目的完成状态。 */
function readingAction(turn) {
  return readingCardState.action(turns.value, turn.id,
    turn.selected.map((item) => item.corpus_id), readingActionCache.value[turn.id])
}
/** 同组已完成或执行中的分析不能重复发起，空选择和页面忙碌时也不可提交。 */
function canHandoff(turn) {
  return !busy.value && !handoffPending.value && !turn.loadingDocuments
    && Boolean(readingGroupKey(turn.selected.map((item) => item.corpus_id)))
    && !readingAnalysisLocked(readingAction(turn))
}
/** 按真实运行状态解释按钮锁定，不把失败和取消显示成已分析。 */
function readingActionLabel(turn) {
  const status = readingAction(turn)?.status
  if (status === 'SUCCESS') return '已分析所选文献'
  if (['PENDING', 'RUNNING'].includes(status)) return '所选文献分析中'
  return handoffPending.value ? '正在打开文献问答' : '基于所选文献问答'
}
/** 返回会话后核对独立阅读终态；epoch 用于丢弃切换会话后的响应。 */
async function refreshReadingActions(epoch) {
  await Promise.all(turns.value.map(async (turn) => {
    const ids = turn.selected.map((item) => item.corpus_id)
    const cached = readingCardState.cachedAction(turn.id, ids)
    if (!cached?.runId) return
    try {
      const { data } = await http.get(`/agent-runs/${cached.runId}`, { params: { entry_source: 'LITERATURE' } })
      if (epoch !== generation) return
      const run = data.data
      if (run.request_payload?.task === 'ANALYZE'
          && readingGroupKey(run.request_payload.corpus_ids) === readingGroupKey(ids))
        readingCardState.record(turn.id, ids, run)
      else readingCardState.forgetAction(turn.id, ids)
    } catch (err) {
      if (epoch !== generation) return
      if ([403, 404].includes(err.response?.status)) readingCardState.forgetAction(turn.id, ids)
    }
    if (epoch === generation) readingActionCache.value = { ...readingActionCache.value,
      [turn.id]: readingCardState.cachedAction(turn.id, ids) }
  }))
}
/** 更新单篇选择，其他页面的勾选不受当前页数据替换影响。 */
function selectDocument(turn, selection, row) {
  activeMaterialSourceId.value = turn.id
  const selected = new Map(turn.selected.map((item) => [item.corpus_id, item]))
  if (selection.some((item) => item.corpus_id === row.corpus_id)) selected.set(row.corpus_id, row)
  else selected.delete(row.corpus_id)
  turn.selected = [...selected.values()]
  rememberDocumentSelection(turn)
}
/** 当前页全选或取消只修改本页 ID，保留其他页面已选择的文献。 */
function selectDocumentPage(turn, selection) {
  activeMaterialSourceId.value = turn.id
  const selected = new Map(turn.selected.map((item) => [item.corpus_id, item]))
  for (const row of turn.documents) selected.delete(row.corpus_id)
  for (const row of selection) selected.set(row.corpus_id, row)
  turn.selected = [...selected.values()]
  rememberDocumentSelection(turn)
}
/** 展示实际概念组合，让用户知道搜索条件没有被自动放宽。 */
function searchTerms(turn) {
  const plan = turn.result_payload?.payload?.search_plan
  if (!plan) return ''
  return [
    plan.concepts.map((group) => group.join(' / ')).join(' + '),
    plan.author && `作者：${plan.author}`,
    plan.language && `语言：${plan.language === 'ZH' ? '中文' : '英文'}`,
    (plan.year_from || plan.year_to) &&
      `年份：${plan.year_from || '不限'}—${plan.year_to || '不限'}`,
    plan.keyword_only && '仅关键词字段',
  ]
    .filter(Boolean)
    .join(' · ')
}
/** 显示实际执行能力，避免把溯源或比较结果误认为启明普通问答。 */
function answerLabel(turn) {
  const payload = turn.result_payload?.payload
  if (payload?.intent === 'WRITING') return '辅助创作 · 知识库写作'
  if (payload?.research_intent === 'CONCEPT_TRACE') return '溯知 · 概念溯源'
  if (payload?.agent_route?.includes('SUZHI')) return '溯知 · 文献综述'
  if (payload?.agent_route?.includes('ZHIJIAN')) return '智鉴 · 比对分析'
  if (payload?.research_intent === 'SIMPLE_QA') return '文昌 · 智能问答'
  return '通用智答'
}
/** 切换十篇一页的题录；恢复历史时可关闭来源激活、草稿保存及滚动。 */
async function changeDocumentPage(turn, page, { activate = true, remember = true, scroll = true } = {}) {
  if (turn.loadingDocuments) return
  const epoch = generation
  turn.loadingDocuments = true
  try {
    // 1. 只请求尚未缓存的页，失败时保留原页和跨页勾选。
    if (!turn.documentPages[page]) {
      const { data } = await http.get(`/agent-runs/${turn.id}/documents`, { params: { page } })
      if (epoch !== generation) return
      turn.documentPages[page] = data.data.documents
      turn.documentTotal = data.data.total
    }
    if (epoch !== generation) return
    // 2. 展示页与实际题录同时替换，再把已选 ID 同步到表格。
    turn.documents = turn.documentPages[page]
    turn.documentPage = page
    if (activate) activeMaterialSourceId.value = turn.id
    if (remember) rememberDocumentSelection(turn)
    await nextTick()
    if (epoch !== generation) return
    syncDocumentSelection(turn)
    if (scroll) documentTables.get(turn.id)?.$el.closest('.literature-panel')
      ?.scrollIntoView({ block: 'start', behavior: 'instant' })
  } catch (err) {
    if (epoch === generation) error.value = describe(err)
  } finally {
    turn.loadingDocuments = false
  }
}
/** 打开会话，并继续跟踪尚未完成的运行。 */
async function openChat(id) {
  newChat()
  const epoch = generation
  busy.value = true
  try {
    // 1. 取得服务端授权的历史快照，旧页面的晚到响应不能覆盖新会话。
    const { data } = await http.get(`/conversations/${id}`, { params: { entry_source: 'AI' } })
    if (epoch !== generation) return
    conversation.value = id
    // 每个对话一个独立路由，打开后同步地址栏
    syncRoute(id)
    historicalDatabaseId.value = data.data.database_id ?? null
    turns.value = data.data.assistant_runs.map(turnFrom)
    // 2. 恢复原始来源卡的勾选和实际页码，独立阅读状态在后台核对。
    activeMaterialSourceId.value = readingCardState.restore(turns.value)
    await Promise.all(turns.value.filter((turn) => turn.restoreDocumentPage > 1)
      .map((turn) => changeDocumentPage(turn, turn.restoreDocumentPage,
        { activate: false, remember: false, scroll: false })))
    if (epoch !== generation) return
    void refreshReadingActions(epoch)
    if (turns.value.some((turn) => turn.result_payload?.payload?.writing_result)) void loadKnowledgeBases()
    await scrollToLatest()
    // 3. 未完成的 AI 运行继续使用现有轮询，不重新提交分析任务。
    const pending = turns.value.find((turn) => ['PENDING', 'RUNNING'].includes(turn.status))
    if (pending) {
      busy.value = true
      await poll(pending, epoch)
    }
  } catch (err) {
    if (epoch === generation) error.value = describe(err)
  } finally {
    if (epoch === generation) busy.value = false
  }
}
/** 删除已结束会话；服务端拒绝删除执行中的任务。 */
async function deleteChat(id) {
  try {
    await ElMessageBox.confirm('删除后，这个对话里的提问与回答将一并移除，且无法恢复。', '删除这个对话？', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      customClass: 'ai-confirm',
      confirmButtonClass: 'ai-confirm-danger',
      cancelButtonClass: 'ai-confirm-cancel',
      distinguishCancelAndClose: true,
    })
    await http.delete(`/conversations/${id}`)
    if (conversation.value === id) {
      turns.value.forEach((turn) => readingCardState.forget(turn.id))
      newChat()
      syncRoute(null)
    }
    await loadHistory()
  } catch (err) {
    if (err !== 'cancel' && err !== 'close') error.value = describe(err)
  }
}
/** 轮询持久化运行；失败与取消不展示成成功回答。 */
async function poll(turn, epoch) {
  try {
    while (epoch === generation) {
      const { data } = await http.get(`/agent-runs/${turn.id}`, { params: { entry_source: 'AI' } })
      if (epoch !== generation) return
      Object.assign(turn, data.data)
      turn.progressDisconnected = false
      const payload = turn.result_payload?.payload || {}
      turn.documents = assistantDocuments(payload)
      turn.documentPages = { 1: turn.documents }
      turn.documentTotal = Math.min(payload.total ?? turn.documents.length, 500)
      if (!['PENDING', 'RUNNING'].includes(turn.status)) {
        if (turn.status === 'SUCCESS' && turn.documents.length) activeMaterialSourceId.value = turn.id
        if (payload.writing_result) void loadKnowledgeBases()
        if (turn.status !== 'SUCCESS') error.value = turn.error_message || '本轮任务未完成，请重试'
        await loadHistory()
        return
      }
      await pause()
    }
  } catch (err) {
    if (epoch === generation) {
      error.value = describe(err)
      turn.progressDisconnected = true
    }
  } finally {
    if (epoch === generation) busy.value = false
  }
}
/** 普通输入交给 AI 识别任务；写作知识库由任务卡片单独确认。 */
async function send() {
  await submitTurn(input.value.trim())
}
/** 在当前 AI 会话提交普通问题或已经确认的写作任务。 */
async function submitTurn(query, options = {}) {
  if (busy.value || query.length < 2) return false
  const epoch = generation
  busy.value = true
  error.value = ''
  try {
    // 页码和勾选只提示当前显示状态，具体文献仍由后端从原运行校验恢复。
    const context = activeReadingContext(turns.value, activeMaterialSourceId.value)
    const requestOptions = !options.writing && !options.reading && context && !historicalDatabaseId.value
      ? {
          ...options,
          reading_context: options.reading_context || context,
        }
      : options
    const { data } = await http.post('/agents/QIMING/runs', {
      request_id: createClientUuid(),
      conversation_id: historicalDatabaseId.value ? undefined : conversation.value || undefined,
      entry_source: 'AI',
      query,
      mode: 'FAST',
      options: requestOptions,
    })
    if (epoch !== generation) return
    if (historicalDatabaseId.value) turns.value = []
    historicalDatabaseId.value = null
    conversation.value = data.data.conversation_id
    // 新对话建立后把地址切到该对话的独立路由
    syncRoute(conversation.value)
    if (!options.writing) input.value = ''
    let turn = turns.value.find((item) => item.id === data.data.run_id)
    if (!turn) {
      turn = turnFrom({ id: data.data.run_id, query, status: data.data.status || 'PENDING', request_payload: requestOptions })
      turns.value.push(turn)
      // 轮询必须修改数组中的响应式代理，才能同步刷新依赖运行状态的卡片计算属性。
      turn = turns.value.at(-1)
    }
    await scrollToLatest()
    await loadHistory()
    await poll(turn, epoch)
    return true
  } catch (err) {
    if (epoch === generation) {
      error.value = describe(err)
      busy.value = false
    }
    return false
  }
}
/** 从最终结果或已提交的范围步骤恢复本轮阅读材料，执行中也能核对篇目。 */
function readingScope(turn) {
  const scope = turn.result_payload?.payload?.reading_result
    || [...(turn.steps || [])].reverse().find((step) => step.output_summary?.reading_scope)
      ?.output_summary.reading_scope
  return scope ? { ...scope, source_documents: readingDocuments(scope) } : undefined
}
/** 推荐问题明确执行原卡片的文献ASK，后端不再重新分类任务或选取其他材料。 */
function askReadingQuestion(turn, question) {
  return submitTurn(question, {
    reading: { source_run_id: turn.id, task: 'ASK' },
  })
}
/** 按页读取本人知识库，不用全库或上次页面的缓存选择替代用户确认。 */
async function loadKnowledgeBases() {
  if (librariesLoading.value) return
  librariesLoading.value = true
  librariesError.value = ''
  try {
    const first = await fetchForeignKnowledgeBases(1, 100)
    const items = [...first.items]
    for (let page = 2; items.length < first.total; page++) {
      const next = await fetchForeignKnowledgeBases(page, 100)
      if (!next.items.length) break
      items.push(...next.items)
    }
    knowledgeBases.value = items
  } catch (err) {
    librariesError.value = describe(err)
  } finally {
    librariesLoading.value = false
  }
}
/** 执行任务卡片提交的范围和阶段，不通过普通问答重新猜测产物操作。 */
async function executeWriting(task) {
  const { source_run_id: id, source_action: key } = task.writing
  if (busy.value || !id || !key || writingActionLocked(writingActions.value[id]?.[key])) return
  const epoch = generation
  writingSubmissions.value[id] ||= {}
  const card = writingSubmissions.value[id]
  card[key] = { status: 'SUBMITTING', query: task.query, writing: task.writing }
  const accepted = await submitTurn(task.query, { writing: task.writing })
  if (epoch !== generation) return
  if (accepted) delete card[key]
  else card[key] = { status: 'FAILED', query: task.query, writing: task.writing,
    error: error.value || '提交失败，请重试' }
}
/** 经当前用户授权导出指定阶段产物，沿用现有 Word 导出接口。 */
async function exportWriting(artifactId) {
  try {
    const { data } = await http.post('/quill/export-docx', { artifact_id: artifactId }, { responseType: 'blob' })
    const url = URL.createObjectURL(data)
    const link = document.createElement('a')
    link.href = url
    link.download = `写作产物-${artifactId.slice(0, 8)}.docx`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (err) {
    ElMessage.error(describe(err))
  }
}
/** 复用研究证据接口与 PDF 阅读器，按本轮引用定位页码并高亮原始 Evidence。 */
async function openCitation(turn, index) {
  const request = ++citationRequest
  const epoch = generation
  readingId.value = null
  filePickerVisible.value = false
  try {
    const items = await fetchAgentEvidence(turn.id)
    if (request !== citationRequest || epoch !== generation) return
    const item = items.find((entry) => entry.citation.citation_index === index)
    if (!item) {
      ElMessage.warning(`未找到引用 [${index}] 的原文证据`)
      return
    }
    readerDocument.value = null
    citation.value = item
    pdfVisible.value = true
  } catch (err) {
    if (request === citationRequest && epoch === generation) ElMessage.error(describe(err))
  }
}
/** 获取当前文献的真实附件；无须先勾选或等待正文索引，多 PDF 时由用户选择。 */
async function readDocument(row) {
  const request = ++citationRequest
  const epoch = generation
  readingId.value = row.corpus_id
  filePickerVisible.value = false
  try {
    const { data } = await getCorpusDetailService({ corpus_id: row.corpus_id })
    if (request !== citationRequest || epoch !== generation) return
    const files = (data.data.files || []).filter(
      (file) => file.file_path && /\.pdf$/i.test(file.filename || file.file_path),
    )
    if (!files.length) {
      ElMessage.info('该文献暂无可在线阅读的 PDF 附件')
      return
    }
    readerSource.value = row
    readerFiles.value = files
    if (files.length === 1) openDocumentFile(files[0])
    else filePickerVisible.value = true
  } catch (err) {
    if (request === citationRequest && epoch === generation) ElMessage.error(describe(err))
  } finally {
    if (request === citationRequest) readingId.value = null
  }
}
/** 通过服务端校验的文献附件接口从第一页阅读，保留当前对话与勾选状态。 */
function openDocumentFile(file) {
  const row = readerSource.value
  const query = new URLSearchParams({
    corpus_id: String(row.corpus_id),
    attachment_path: file.file_path,
  })
  readerDocument.value = {
    title: row.title,
    fileUrl: `/api/public/file/corpus?${query.toString()}`,
  }
  citation.value = null
  filePickerVisible.value = false
  pdfVisible.value = true
}
/** 把当前明确选文交接给阅读页；同组已分析或导航中的请求不重复发起。 */
async function handoff(turn) {
  const ids = turn.selected.map((item) => item.corpus_id)
  if (ids.length > 20) {
    ElMessage.warning('最多选择 20 篇文献')
    return
  }
  if (!ids.length) {
    ElMessage.warning('请先勾选文献')
    return
  }
  if (!canHandoff(turn)) return
  handoffPending.value = true
  rememberDocumentSelection(turn)
  try {
    await router.push({
      path: '/user/literature-detail',
      query: { ids: ids.join(','), source_run: turn.id, prompt: turn.query },
    })
  } catch (err) {
    ElMessage.error(describe(err))
  } finally {
    handoffPending.value = false
  }
}
onMounted(async () => {
  await loadHistory()
  // 直接打开 /agent/c/:id 时恢复该对话
  const id = route.params.conversationId
  if (id) void openChat(String(id))
})

// 路由变化（前进/后退、直接打开某对话）时同步切换当前对话
watch(
  () => route.params.conversationId,
  (id) => {
    const nextId = id ? String(id) : null
    if (nextId && nextId !== conversation.value) void openChat(nextId)
    else if (!nextId && conversation.value) newChat()
  },
)

onBeforeUnmount(() => {
  generation++
  stopPolling()
})
</script>

<template>
  <div class="ai-workspace" :class="{ 'rail-collapsed': railCollapsed }">
    <button
      v-if="historyExpanded"
      class="rail-backdrop"
      aria-label="关闭历史对话"
      @click="historyExpanded = false"
    ></button>
    <aside
      id="ai-history-panel"
      class="history"
      :class="{ expanded: historyExpanded }"
      aria-label="会话导航"
    >
      <div class="workspace-brand">
        <Reading class="brand-icon" aria-hidden="true" />
        <h1>通用智答</h1>
        <button
          class="rail-toggle icon-button"
          :aria-expanded="!railCollapsed"
          :aria-label="railCollapsed ? '展开会话侧边栏' : '收起会话侧边栏'"
          :title="railCollapsed ? '展开会话侧边栏' : '收起会话侧边栏'"
          @click="toggleRail"
        >
          <Expand v-if="railCollapsed" />
          <Fold v-else />
        </button>
        <button
          class="rail-close icon-button"
          aria-label="关闭历史对话"
          @click="historyExpanded = false"
        >
          <Close />
        </button>
      </div>
      <button class="new-chat" @click="startNewChat"><Plus aria-hidden="true" />新对话</button>
      <div class="history-heading">
        <h2>历史对话</h2>
        <span v-if="historyTotal">{{ historyTotal }}</span>
      </div>
      <nav class="history-list" aria-label="历史对话">
        <div
          v-for="item in histories"
          :key="item.id"
          class="history-row"
          :class="{ active: item.id === conversation }"
        >
          <button
            class="history-title"
            :title="item.title"
            :aria-current="item.id === conversation ? 'page' : undefined"
            @click="openChat(item.id)"
          >
            <ChatLineRound aria-hidden="true" /><span>{{ item.title }}</span>
          </button>
          <button
            class="history-delete icon-button"
            aria-label="删除对话"
            title="删除对话"
            @click="deleteChat(item.id)"
          >
            <Delete />
          </button>
        </div>
        <div v-if="!histories.length" class="empty-history">
          <ChatLineRound aria-hidden="true" />
          <p>还没有历史对话</p>
          <span>从一个研究问题开始吧</span>
        </div>
      </nav>
      <el-pagination
        v-if="historyTotal > 20"
        v-model:current-page="historyPage"
        small
        layout="prev, next"
        :page-size="20"
        :total="historyTotal"
        @current-change="loadHistory"
      />
      <button type="button" class="back-workspace" @click="goBack"
        ><ArrowLeft aria-hidden="true" />返回工作台</button
      >
    </aside>

    <main class="workspace-main" :class="{ 'has-turns': turns.length }" aria-label="通用智答">
      <header class="workspace-header">
        <div class="header-title">
          <button
            class="rail-expand icon-button"
            aria-label="展开会话侧边栏"
            title="展开会话侧边栏"
            @click="toggleRail"
          >
            <Expand />
          </button>
          <button
            class="mobile-history icon-button"
            :aria-expanded="historyExpanded"
            aria-controls="ai-history-panel"
            aria-label="打开历史对话"
            @click="historyExpanded = true"
          >
            <Menu />
          </button>
        </div>
        <span v-if="turns.length" class="conversation-title">{{ activeTitle }}</span>
      </header>
      <el-alert
        v-if="error"
        class="workspace-error"
        :title="error"
        type="error"
        show-icon
        closable
        @close="error = ''"
      />

      <section class="workspace-body" :class="{ 'conversation-layout': turns.length }">
        <div v-if="!turns.length" class="welcome">
          <div class="welcome-mark"><Reading aria-hidden="true" /></div>
          <h2>让每一个问题，都有文献可循</h2>
          <p>查找相关研究、追问文献观点，让研究与创作自然衔接。</p>
        </div>
        <div v-else ref="thread" class="thread" aria-label="研究对话" @scroll.passive="onThreadScroll">
          <div class="thread-inner">
            <article v-for="turn in turns" :key="turn.id" class="turn">
              <div class="user-message">
                <span class="message-label">你</span>
                <div class="question">{{ writingQuestion(turn, turns) }}</div>
              </div>
              <div class="assistant-message">
                <div class="answer-heading">
                  <span class="answer-mark"><Reading aria-hidden="true" /></span
                  ><strong>{{ answerLabel(turn) }}</strong>
                </div>
                <div class="answer-content">
                  <AiRunProgress
                    v-if="['PENDING', 'RUNNING'].includes(turn.status)"
                    :run="turn"
                  />
                  <details
                    v-if="readingScope(turn)?.source_documents?.length"
                    class="reading-scope"
                    aria-label="本次阅读材料"
                  >
                    <summary>本次基于 {{ readingScope(turn).source_documents.length }} 篇文献{{ readingScope(turn).task === 'ASK' ? '回答' : '分析' }}</summary>
                    <ol>
                      <li v-for="doc in readingScope(turn).source_documents" :key="doc.corpus_id">
                        {{ doc.title }}
                      </li>
                    </ol>
                  </details>
                  <ResearchMarkdown
                    v-if="turn.final_answer && !turn.result_payload?.payload?.research_result?.zhijian_result"
                    :content="turn.final_answer"
                    :citation-indices="
                      (turn.result_payload?.payload?.citations || []).map(
                        (item) => item.citation_index,
                      )
                    "
                    @citation-click="openCitation(turn, $event)"
                  />
                  <ZhijianAnswer
                    v-if="turn.result_payload?.payload?.research_result?.zhijian_result"
                    :result="turn.result_payload.payload.research_result.zhijian_result"
                    :summary="turn.final_answer || ''"
                    :citation-indices="
                      (turn.result_payload?.payload?.citations || []).map(
                        (item) => item.citation_index,
                      )
                    "
                    @citation-click="openCitation(turn, $event)"
                  />
                  <p
                    v-else-if="turn.status === 'SUCCESS' && turn.result_payload?.payload?.agent_route?.includes('ZHIJIAN')"
                    class="metadata"
                  >
                    此历史记录未保存完整比对结果，可重新提问生成。
                  </p>
                  <SuzhiProvenanceGraph
                    v-if="turn.result_payload?.payload?.research_result?.suzhi_result?.provenance_graph"
                    :graph="turn.result_payload.payload.research_result.suzhi_result.provenance_graph"
                    @citation="openCitation(turn, $event)"
                  />
                  <AiWritingCard
                    v-if="turn.status === 'SUCCESS' && turn.result_payload?.payload?.writing_result"
                    :result="turn.result_payload.payload.writing_result"
                    :source-run-id="turn.id"
                    :actions="writingActions[turn.id] || {}"
                    :query="turn.query"
                    :artifacts="allWritingArtifacts"
                    :knowledge-bases="knowledgeBases"
                    :loading="librariesLoading"
                    :error="librariesError"
                    :busy="busy"
                    @run="executeWriting"
                    @export="exportWriting"
                    @reload="loadKnowledgeBases"
                  />
                  <div
                    v-if="turn.status === 'SUCCESS' && turn.result_payload?.payload?.reading_result?.recommended_questions?.length"
                    class="reading-questions"
                    aria-label="继续追问文献"
                  >
                    <button
                      v-for="question in turn.result_payload.payload.reading_result.recommended_questions"
                      :key="question"
                      class="action-button"
                      :disabled="busy"
                      @click="askReadingQuestion(turn, question)"
                    >{{ question }}</button>
                  </div>
                  <p v-if="['FAILED', 'CANCELLED'].includes(turn.status)" class="failed">
                    本轮任务未完成，可以重新提问。
                  </p>
                  <p v-if="searchTerms(turn)" class="metadata" aria-label="检索条件">
                    检索条件：{{ searchTerms(turn) }}
                  </p>
                  <AiReadingRecommendations
                    v-if="turn.status === 'SUCCESS' && turn.result_payload?.payload?.reading_result?.task === 'ANALYZE'"
                    :result="turn.result_payload.payload.reading_result"
                    :source-ids="readingDocuments(turn.result_payload.payload.reading_result).map((doc) => doc.corpus_id)"
                    :reading-id="readingId"
                    @read="readDocument"
                    @ask="handoff({ ...turn, selected: $event })"
                  />
                  <section
                    v-else-if="turn.documents.length"
                    class="literature-panel"
                    aria-label="相关文献"
                  >
                    <div class="literature-heading">
                      <h3>{{ turn.result_payload?.payload?.intent === 'READING' ? '本次阅读材料' : '相关文献' }}</h3>
                      <span v-if="turn.result_payload?.payload?.total != null">
                        共 {{ turn.documentTotal }} 篇
                      </span>
                      <span v-else>共 {{ turn.documents.length }} 篇</span>
                    </div>
                    <el-table
                      :ref="(table) => setDocumentTable(turn, table)"
                      :data="turn.documents"
                      row-key="corpus_id"
                      :show-header="false"
                      @select="(selection, row) => selectDocument(turn, selection, row)"
                      @select-all="(selection) => selectDocumentPage(turn, selection)"
                    >
                      <el-table-column type="selection" width="40" />
                      <el-table-column
                        type="index"
                        :index="(turn.documentPage - 1) * 10 + 1"
                        label="序号"
                        width="44"
                      />
                      <el-table-column label="文献" min-width="180"
                        ><template #default="{ row }">
                          <button
                            type="button"
                            class="document-title"
                            title="查看文献原文"
                            :aria-busy="readingId === row.corpus_id"
                            @click.stop="readDocument(row)"
                          >
                            {{ row.title }}
                          </button>
                          <span v-if="readingId === row.corpus_id" class="metadata" role="status">
                            正在加载原文…
                          </span>
                          <p class="metadata">
                            {{ [row.author, row.year, row.source].filter(Boolean).join(' · ') }}
                          </p>
                          <p class="snippet">{{ row.snippet }}</p>
                          <p v-if="row.readable === false" class="metadata">正文索引未就绪</p>
                        </template></el-table-column
                      >
                    </el-table>
                    <div
                      v-if="turn.result_payload?.payload?.search_plan"
                      class="document-pagination"
                    >
                      <span>每页 10 篇</span>
                      <el-pagination
                        :current-page="turn.documentPage"
                        :page-size="10"
                        :total="turn.documentTotal"
                        :pager-count="5"
                        :disabled="turn.loadingDocuments"
                        layout="prev, pager, next"
                        @current-change="(page) => changeDocumentPage(turn, page)"
                      />
                    </div>
                    <div class="actions">
                      <span class="selection-count">已选 {{ turn.selected.length }} 篇</span>
                      <div class="selection-buttons">
                        <button
                          class="action-button primary"
                          :disabled="!canHandoff(turn)"
                          @click="handoff(turn)"
                        >
                          <ChatLineRound aria-hidden="true" />{{ readingActionLabel(turn) }}
                        </button>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </article>
          </div>
        </div>

        <div class="composer-area">
          <p v-if="historicalDatabaseId" class="metadata">
            此历史对话限定了数据库范围，继续提问将以全库文献开始新对话。
          </p>
          <AiQuestionComposer
            v-model="input"
            :busy="busy"
            :placeholder="
              turns.length ? '继续提问，或输入选题、提纲和章节写作要求…' : '提问、找文献，或输入：围绕双减设计论文提纲'
            "
            @submit="send"
          />
        </div>
        <p class="disclaimer">回答基于可访问的文献生成，请结合原文核验。</p>
      </section>

      <!-- 右侧问题定位条：条状卡片，悬停展开显示问题摘要，点击跳到对应提问 -->
      <nav v-if="turnRail.length > 1" class="turn-rail" aria-label="问题定位">
        <button
          v-for="item in turnRail"
          :key="item.id"
          type="button"
          class="turn-rail__item"
          :class="{ active: item.index === activeTurnIndex }"
          :title="item.label"
          :aria-label="`跳到第 ${item.index + 1} 个问题：${item.label}`"
          @click="scrollToTurn(item.index)"
        >
          <span class="turn-rail__label">{{ item.label }}</span>
        </button>
      </nav>

      <el-dialog v-model="filePickerVisible" title="选择文献附件" width="min(520px, 92vw)">
        <div class="document-files">
          <button
            v-for="file in readerFiles"
            :key="file.file_path"
            type="button"
            class="action-button"
            @click="openDocumentFile(file)"
          >
            {{ file.filename || file.file_path.split(/[\\/]/).at(-1) }}
          </button>
        </div>
      </el-dialog>
      <CitationPdfViewer
        v-model="pdfVisible"
        :item="citation"
        :document="readerDocument"
        :mode="readerDocument ? 'document' : 'citation'"
      />
    </main>
  </div>
</template>

<style scoped>
.reading-scope {
  margin: 0 0 18px;
  padding: 12px 16px;
  border: 1px solid #dbe7e5;
  border-radius: 10px;
  background: #f6faf9;
  font-size: 13px;
  line-height: 1.8;
  overflow-wrap: anywhere;
}
.reading-scope summary { cursor: pointer; font-weight: 600; }
.reading-scope ol { margin: 8px 0 0; padding-left: 22px; }
.reading-questions { display: flex; flex-wrap: wrap; gap: 8px; margin: 18px 0; }
.reading-questions .action-button { white-space: normal; text-align: left; }
/* 页面独立定义工作台令牌，避免其他路由的样式影响字体、主色和视口高度。 */
.ai-workspace {
  --ai-ink: #173b3d;
  --ai-muted: #839297;
  --ai-teal: #075e60;
  --ai-line: #e2ebeb;
  --el-color-primary: #075e60;
  --el-color-primary-light-9: #f0f7f6;
  --el-color-primary-light-7: #c7ddda;
  display: flex;
  height: 100vh;
  height: 100dvh;
  min-height: 480px;
  overflow: hidden;
  background: #fff;
  color: var(--ai-ink);
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 14px;
  line-height: 1.6;
  font-synthesis: none;
  /* 不再使用 antialiased：Windows 上会让文字变细变淡，观感"不实" */
  -webkit-font-smoothing: auto;
  text-rendering: auto;
}
.ai-workspace *,
.ai-workspace *::before,
.ai-workspace *::after {
  box-sizing: border-box;
}
button,
a {
  -webkit-tap-highlight-color: transparent;
}
button {
  font: inherit;
}
button:focus-visible,
a:focus-visible {
  outline: 3px solid #9ac7c3;
  outline-offset: 3px;
}
a {
  color: inherit;
  text-decoration: none;
}
.icon-button {
  display: inline-grid;
  place-items: center;
  padding: 0;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 6px;
  color: #7d9596;
  background: transparent;
  cursor: pointer;
}
.icon-button svg {
  width: 17px;
  height: 17px;
}
.icon-button:hover {
  color: var(--ai-teal);
  background: #e5efee;
}
.history {
  display: flex;
  flex-direction: column;
  width: 260px;
  flex: 0 0 260px;
  padding: 16px 16px 14px;
  border-right: 1px solid var(--ai-line);
  background: #f5f8f8;
}
.workspace-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 4px 14px;
}
.brand-icon {
  width: 24px;
  height: 24px;
  color: #064f54;
}
.workspace-brand h1 {
  display: block;
  margin: 0;
  font-size: 16px;
  line-height: 1.4;
  font-weight: 700;
  letter-spacing: 0.2px;
}
.new-chat {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 45px;
  border: 0;
  border-radius: 9px;
  background: var(--ai-teal);
  color: #fff;
  cursor: pointer;
  font-weight: 600;
  transition: background 0.18s;
}
.new-chat svg {
  width: 20px;
  height: 20px;
}
.new-chat:hover {
  background: #034c4f;
}
.history-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 30px 10px 12px;
}
.history-heading h2 {
  margin: 0;
  color: #41585b;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.8px;
}
.history-heading > span {
  font-size: 11px;
  color: #5b7074;
}
.history-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  margin: 0 -5px;
  padding: 0 3px;
  /* 细滚动条：平时几乎透明，悬停会话列表时才略微显现（与主界面侧边栏一致） */
  scrollbar-width: thin;
  scrollbar-color: rgb(7 94 96 / 18%) transparent;
}
.history-list::-webkit-scrollbar {
  width: 6px;
}
.history-list::-webkit-scrollbar-track {
  background: transparent;
}
.history-list::-webkit-scrollbar-thumb {
  background: rgb(7 94 96 / 14%);
  border-radius: 999px;
}
.history-list:hover::-webkit-scrollbar-thumb {
  background: rgb(7 94 96 / 30%);
}
.history-list::-webkit-scrollbar-thumb:hover {
  background: rgb(7 94 96 / 42%);
}
.history-row {
  display: flex;
  align-items: center;
  min-height: 43px;
  margin: 4px 0;
  padding-right: 3px;
  border-radius: 8px;
}
.history-row:hover {
  background: #eaf1f0;
}
.history-row.active {
  background: #e0eeee;
}
.history-title {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
  padding: 12px 10px;
  border: 0;
  background: transparent;
  color: #2b4749;
  text-align: left;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}
.history-title > svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: #3f6164;
}
.history-title > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.history-row.active .history-title {
  color: var(--ai-teal);
  font-weight: 700;
}
.history-delete {
  width: 25px;
  height: 27px;
  flex-shrink: 0;
  opacity: 0;
}
.history-row:hover .history-delete,
.history-row:focus-within .history-delete {
  opacity: 1;
}
.history-delete:hover {
  color: #b34b47;
}
.empty-history {
  padding: 30px 10px;
  text-align: center;
  color: #5b7074;
}
.empty-history > svg {
  width: 27px;
  height: 27px;
  opacity: 0.65;
}
.empty-history p {
  margin: 8px 0 3px;
  font-size: 12px;
}
.empty-history span {
  font-size: 11px;
  color: #64797d;
}
.back-workspace {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  margin-top: 18px;
  padding: 17px 10px 1px;
  border-top: 1px solid #dce7e7;
  border-right: 0;
  border-bottom: 0;
  border-left: 0;
  background: transparent;
  color: #365759;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
}
.back-workspace svg {
  width: 17px;
  height: 17px;
}
.back-workspace:hover {
  color: var(--ai-teal);
}
.rail-close,
.mobile-history,
.rail-backdrop,
.rail-toggle,
.rail-expand {
  display: none;
}
.rail-toggle {
  margin-left: auto;
  width: 26px;
  height: 26px;
  border: 1px solid #cfe0de;
  border-radius: 7px;
  background: #fff;
  color: #2f5a5c;
}
.rail-toggle svg {
  width: 14px;
  height: 14px;
}
.rail-toggle:hover {
  color: var(--ai-teal);
  background: #e5efee;
  border-color: #b6d3cf;
}
/* 桌面端：收起左侧会话栏；收起后顶栏保留一个展开按钮 */
@media (min-width: 761px) {
  .rail-toggle {
    display: inline-grid;
  }
  .ai-workspace.rail-collapsed .history {
    display: none;
  }
  .ai-workspace.rail-collapsed .rail-expand {
    display: inline-grid;
  }
}
.workspace-main {
  display: flex;
  flex-direction: column;
  position: relative;
  flex: 1;
  min-width: 0;
  height: 100%;
}
.workspace-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  gap: 20px;
  min-height: 52px;
  padding: 0 24px;
  border-bottom: 1px solid #edf1f1;
}
.header-title {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}
.conversation-title {
  font-size: 12px;
  color: #4f6467;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  max-width: 250px;
}
.workspace-error {
  width: min(880px, calc(100% - 48px));
  margin: 16px auto 0;
  flex-shrink: 0;
}
.workspace-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  min-height: 0;
  overflow-y: auto;
  padding: 42px 48px 90px;
}
.welcome {
  margin: 0 auto 30px;
  text-align: center;
}
.welcome-mark {
  display: grid;
  place-items: center;
  width: 68px;
  height: 68px;
  margin: 0 auto 23px;
  border-radius: 19px;
  background: #e8f5f3;
}
.welcome-mark svg {
  width: 36px;
  height: 36px;
  color: #075e60;
}
.welcome h2 {
  margin: 0 0 12px;
  color: #143b3f;
  font-size: clamp(25px, 2.4vw, 34px);
  font-weight: 650;
  line-height: 1.45;
  letter-spacing: -0.6px;
}
.welcome p {
  margin: 0;
  color: #5b7074;
  font-size: 15px;
  line-height: 1.8;
}
.composer-area {
  width: min(880px, 100%);
  margin: 0 auto;
  flex-shrink: 0;
}
.disclaimer {
  margin: 35px auto 0;
  font-size: 11px;
  line-height: 1.7;
  color: #6b7f83;
  text-align: center;
}
/* 对话状态将滚动区与输入区分开，长答案不会把提问入口挤出屏幕。 */
.workspace-body.conversation-layout {
  justify-content: flex-start;
  padding: 0;
  overflow: hidden;
}
.thread {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 34px 48px 20px;
  scrollbar-width: thin;
  scrollbar-color: #d7e3e1 transparent;
}
.thread-inner {
  width: min(880px, 100%);
  margin: 0 auto;
}
/* 右侧问题定位条：条状卡片，平时收成小条（只露右侧指示线），悬停整条展开显示问题摘要 */
.turn-rail {
  position: absolute;
  top: 50%;
  right: 10px;
  z-index: 6;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  max-height: 58vh;
  padding: 4px 0;
  overflow-y: auto;
  scrollbar-width: none;
  transform: translateY(-50%);
}
.turn-rail::-webkit-scrollbar {
  display: none;
}
.turn-rail__item {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0;
  width: 30px;
  height: 28px;
  flex: 0 0 auto;
  padding: 0 8px;
  overflow: hidden;
  border: 1px solid #e2ebeb;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 2px 8px rgb(16 45 45 / 6%);
  cursor: pointer;
  transition:
    width 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background-color 0.18s ease;
}
.turn-rail__label {
  flex: 1;
  min-width: 0;
  color: #33595b;
  font-size: 12px;
  line-height: 1.5;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.turn-rail__item::after {
  content: '';
  width: 10px;
  height: 3px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: #cfe0de;
  transition:
    background-color 0.18s ease,
    width 0.18s ease;
}
.turn-rail:hover .turn-rail__item {
  width: 214px;
  gap: 8px;
}
.turn-rail:hover .turn-rail__label {
  opacity: 1;
}
.turn-rail__item:hover {
  border-color: #9dc4c1;
  box-shadow: 0 5px 16px rgb(16 45 45 / 12%);
}
.turn-rail__item.active {
  border-color: #9dc4c1;
  background: #f2f8f7;
}
.turn-rail__item.active::after {
  width: 16px;
  background: var(--ai-teal);
}
.turn-rail__item:focus-visible {
  outline: 2px solid #92c4c1;
  outline-offset: 2px;
}
.turn {
  margin: 0 0 38px;
}
.user-message {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 7px;
  margin-bottom: 30px;
}
.message-label {
  color: #5b7074;
  font-size: 12px;
  font-weight: 500;
  margin-right: 2px;
}
.question {
  max-width: 85%;
  padding: 13px 18px;
  border-radius: 13px 13px 3px 13px;
  background: #edf5f4;
  color: #1e4144;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.8;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.answer-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.answer-mark {
  display: inline-grid;
  place-items: center;
  width: 29px;
  height: 29px;
  border-radius: 8px;
  background: #eaf5f3;
}
.answer-mark svg {
  width: 18px;
  height: 18px;
  color: var(--ai-teal);
}
.answer-heading strong {
  font-size: 14px;
  font-weight: 700;
  color: #143437;
}
.answer-content {
  padding-left: 39px;
  color: #16292b;
  font-size: 16px;
  line-height: 1.9;
}
/* 回答按标题层级加粗放大，正文保持清晰的字重与颜色 */
.answer-content :deep(.research-markdown h1) {
  margin: 26px 0 12px;
  color: #10292b;
  font-size: 21px;
  font-weight: 700;
  line-height: 1.4;
}
.answer-content :deep(.research-markdown h2) {
  margin: 24px 0 10px;
  padding-left: 10px;
  border-left: 3px solid var(--ai-teal);
  color: #10292b;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.45;
}
.answer-content :deep(.research-markdown h3) {
  margin: 20px 0 8px;
  color: #143437;
  font-size: 16.5px;
  font-weight: 700;
  line-height: 1.5;
}
.answer-content :deep(.research-markdown h4) {
  margin: 16px 0 6px;
  color: #143437;
  font-size: 15.5px;
  font-weight: 700;
}
.answer-content :deep(.research-markdown strong) {
  color: #0f2a2c;
  font-weight: 700;
}
.answer-content :deep(.research-markdown p) {
  margin: 0 0 12px;
}
.answer-content :deep(.research-markdown ul),
.answer-content :deep(.research-markdown ol) {
  margin: 0 0 14px;
  padding-left: 24px;
}
.answer-content :deep(.research-markdown li) {
  margin: 6px 0;
  color: #16292b;
}
.answer-content :deep(.research-markdown li + li) {
  margin-top: 6px;
}
.literature-panel {
  margin-top: 22px;
  border: 1px solid #e0eaea;
  border-radius: 11px;
  overflow: hidden;
}
.literature-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 15px 19px 10px;
}
.literature-heading h3 {
  margin: 0;
  color: #365759;
  font-size: 14px;
  font-weight: 600;
}
.literature-heading span {
  color: #5b7074;
  font-size: 11px;
}
.literature-panel :deep(.el-table) {
  --el-table-border-color: #ecf0f0;
  --el-table-row-hover-bg-color: #f8fbfa;
  color: #2f4d50;
  font-size: 13px;
}
.literature-panel :deep(.el-table .el-table__cell) {
  padding: 12px 0;
  vertical-align: top;
}
.literature-panel :deep(.el-table .cell) {
  padding-left: 10px;
  padding-right: 19px;
}
.literature-panel :deep(.el-table-column--selection .cell) {
  padding-top: 2px;
  padding-left: 18px;
  padding-right: 0;
}
.literature-panel :deep(.el-checkbox__inner) {
  border-color: #cadad7;
  border-radius: 3px;
}
/* 显式使用页面主色，保证文献勾选反馈与下方操作栏保持一致。 */
.literature-panel :deep(.el-checkbox__input.is-checked .el-checkbox__inner),
.literature-panel :deep(.el-checkbox__input.is-indeterminate .el-checkbox__inner) {
  background-color: #075e60;
  border-color: #075e60;
}
.literature-panel :deep(.el-checkbox__input.is-checked .el-checkbox__inner::after) {
  border-color: #fff;
}
.document-title {
  display: block;
  padding: 0;
  border: 0;
  background: transparent;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  color: #31575a;
  font-size: 14px;
  line-height: 1.7;
  font-weight: 550;
}
.document-title:hover {
  color: var(--ai-teal);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.document-title:focus-visible {
  outline: 2px solid var(--ai-teal);
  outline-offset: 3px;
  border-radius: 2px;
}
.document-files {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.document-files .action-button {
  white-space: normal;
  overflow-wrap: anywhere;
  text-align: left;
}
.metadata {
  color: #95a4a7;
  font-size: 12px;
  line-height: 1.7;
  margin: 4px 0;
}
.snippet {
  color: #819498;
  font-size: 13px;
  line-height: 1.8;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.document-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #ecf0f0;
  color: #819498;
  font-size: 12px;
}
.document-pagination :deep(.el-pagination) {
  --el-color-primary: #075e60;
  --el-pagination-button-width: 28px;
  --el-pagination-button-height: 28px;
}
.actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 16px;
  background: #f5f9f8;
}
.selection-count {
  color: #688582;
  font-size: 12px;
  white-space: nowrap;
}
.selection-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.action-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 34px;
  padding: 7px 12px;
  border: 1px solid #d9e4e2;
  border-radius: 7px;
  background: #fff;
  color: #547773;
  cursor: pointer;
  font-size: 13px;
  line-height: 1.5;
}
.action-button svg {
  width: 15px;
  height: 15px;
}
.action-button:hover:not(:disabled) {
  background: #edf5f3;
  border-color: #aac5be;
}
.action-button.primary {
  background: #075e60;
  border-color: #075e60;
  color: #fff;
}
.action-button.primary:hover:not(:disabled) {
  background: #034b4e;
}
.action-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.conversation-layout .composer-area {
  width: min(880px, calc(100% - 96px));
  padding-top: 10px;
}
.conversation-layout .disclaimer {
  margin: 10px auto 16px;
  flex-shrink: 0;
}
.failed {
  color: #b06459;
}
.citation-title {
  font: inherit;
  font-weight: 600;
  color: #31575a;
}
.citation-pages {
  color: #8a9d9b;
  font-size: 12px;
}
.citation-quote {
  margin: 20px 0;
  padding: 14px 18px;
  border-left: 3px solid #83b1a9;
  background: #f3f8f6;
  color: #526b67;
  font-size: 14px;
  line-height: 1.9;
}
@media (max-width: 1100px) {
  .history {
    width: 228px;
    flex-basis: 228px;
    padding-left: 14px;
    padding-right: 14px;
  }
  .workspace-body {
    padding-left: 30px;
    padding-right: 30px;
  }
  .thread {
    padding-left: 30px;
    padding-right: 30px;
  }
  .conversation-layout .composer-area {
    width: calc(100% - 60px);
  }
}
@media (max-width: 760px) {
  /* 窄屏隐藏右侧问题定位条，避免与内容重叠 */
  .turn-rail {
    display: none;
  }
  .history {
    position: fixed;
    z-index: 1101;
    inset: 0 auto 0 0;
    width: min(288px, calc(100vw - 52px));
    height: 100dvh;
    transform: translateX(-100%);
    transition: transform 0.2s ease;
  }
  .history.expanded {
    transform: translateX(0);
  }
  .rail-backdrop {
    display: block;
    position: fixed;
    z-index: 1100;
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
    background: rgb(17 43 43 / 25%);
  }
  .rail-close {
    display: inline-grid;
    margin-left: auto;
  }
  .mobile-history {
    display: inline-grid;
  }
  .history-delete {
    opacity: 1;
  }
  .workspace-header {
    min-height: 48px;
    padding: 0 16px;
    gap: 10px;
  }
  .header-title {
    gap: 9px;
  }
  .conversation-title {
    display: none;
  }
  .workspace-body {
    justify-content: flex-start;
    padding: clamp(30px, 10vh, 84px) 22px 30px;
  }
  .welcome {
    margin-bottom: 25px;
  }
  .welcome-mark {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    margin-bottom: 20px;
  }
  .welcome-mark svg {
    width: 29px;
    height: 29px;
  }
  .welcome h2 {
    text-wrap: balance;
    max-width: 300px;
    margin-left: auto;
    margin-right: auto;
    font-size: 25px;
    line-height: 1.55;
    letter-spacing: -0.5px;
  }
  .welcome p {
    text-wrap: balance;
    max-width: 290px;
    margin: 0 auto;
    font-size: 12px;
  }
  .disclaimer {
    font-size: 10px;
    margin-top: 22px;
  }
  .workspace-error {
    width: calc(100% - 36px);
  }
  .thread {
    padding: 22px 18px 8px;
  }
  .user-message {
    margin-bottom: 24px;
  }
  .question {
    max-width: 94%;
    font-size: 13px;
    padding: 11px 14px;
  }
  .answer-content {
    padding-left: 0;
    font-size: 13px;
  }
  .answer-heading {
    margin-bottom: 12px;
  }
  .literature-heading {
    padding: 13px 14px 8px;
  }
  .document-title {
    font-size: 13px;
  }
  .literature-panel :deep(.el-table .cell) {
    padding-right: 12px;
  }
  .actions {
    align-items: flex-start;
    flex-direction: column;
    padding: 12px;
    gap: 9px;
  }
  .selection-buttons {
    width: 100%;
    gap: 7px;
  }
  .action-button {
    font-size: 11px;
    padding: 7px 9px;
  }
  .conversation-layout .composer-area {
    width: calc(100% - 36px);
    padding-top: 6px;
  }
  .conversation-layout .disclaimer {
    margin: 8px 18px 10px;
    font-size: 9px;
  }
}
@media (max-height: 760px) and (min-width: 761px) {
  .workspace-body {
    padding-top: 25px;
    padding-bottom: 35px;
  }
  .welcome-mark {
    width: 54px;
    height: 54px;
    margin-bottom: 14px;
  }
  .welcome-mark svg {
    width: 30px;
    height: 30px;
  }
  .welcome {
    margin-bottom: 22px;
  }
  .welcome h2 {
    font-size: 28px;
  }
  .disclaimer {
    margin-top: 22px;
  }
}
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation: none !important;
    transition: none !important;
  }
}
</style>

<style>
/* 删除对话的确认弹窗：与 AI 问答界面同一套配色/圆角/字重（非 scoped，弹窗挂在 body 上） */
.ai-confirm.el-message-box {
  width: min(440px, calc(100vw - 40px));
  padding: 22px 24px 18px;
  border: 1px solid #e2ebeb;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 18px 48px rgb(16 45 45 / 14%);
}
.ai-confirm .el-message-box__header {
  padding: 0 0 10px;
}
.ai-confirm .el-message-box__title {
  color: #143437;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.2px;
}
.ai-confirm .el-message-box__content {
  padding: 0;
  color: #33595b;
  font-size: 14px;
  line-height: 1.75;
}
.ai-confirm .el-message-box__btns {
  gap: 10px;
  padding: 18px 0 0;
}
.ai-confirm .el-message-box__btns .el-button {
  height: 36px;
  margin: 0;
  padding: 0 18px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
}
.ai-confirm .el-button.ai-confirm-cancel {
  color: #33595b;
  border: 1px solid #cfe0de;
  background: #fff;
}
.ai-confirm .el-button.ai-confirm-cancel:hover {
  color: #075e60;
  border-color: #9dc4c1;
  background: #f2f8f7;
}
.ai-confirm .el-button.ai-confirm-danger {
  color: #fff;
  border-color: #075e60;
  background: #075e60;
}
.ai-confirm .el-button.ai-confirm-danger:hover {
  border-color: #03494c;
  background: #03494c;
}
.ai-confirm .el-message-box__headerbtn {
  top: 14px;
  right: 14px;
}
.ai-confirm .el-message-box__headerbtn .el-message-box__close {
  color: #8ba0a2;
}
.ai-confirm .el-message-box__headerbtn:hover .el-message-box__close {
  color: #075e60;
}
</style>
