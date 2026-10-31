<!-- 文献问答工作台：统一选择库内与本地材料，展示原文和分析，并管理会话与追问。 -->
<script setup>
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  ChatDotRound,
  Download,
  Document,
  Expand,
  Fold,
  Loading,
  Refresh,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.js'
import worker from 'pdfjs-dist/legacy/build/pdf.worker.js?url'
import { fetchReadingMaterial, fetchReadingFile } from '@/research/api/literature-files'
import LiteratureMaterials from '@/research/components/literature/LiteratureMaterials.vue'
import { streamAgentRun } from '@/research/api/agents'
import {
  createReadingRun,
  fetchReadingConversation,
  fetchReadingHistory,
  fetchReadingRun,
} from '@/research/api/literature'
import ResearchMarkdown from '@/research/components/common/ResearchMarkdown.vue'
import ReadingSynthesis from '@/research/components/literature/ReadingSynthesis.vue'
import { createClientUuid } from '@/research/utils/client-id'
import { readingCardState } from '@/research/utils/reading-card-state'
import { literatureProgressLabel, mergeLiteratureProgress } from '@/research/utils/literature-progress'
import {
  displayRecommendations, recommendationLink,
} from '@/research/utils/literature-recommendations'
import { buildCitationHighlightRects } from '@/research/utils/citationHighlight'
import { locateCitationHighlights } from '@/research/utils/citationRangeHighlight'
import { pdfDocumentOptions } from '@/research/utils/pdf-document'
import ContinuousPdfViewer from '@/research/components/common/ContinuousPdfViewer.vue'

pdfjs.GlobalWorkerOptions.workerSrc = worker
const route = useRoute(),
  router = useRouter()

/** 返回：回到跳转进本界面之前的那一页（可能是某个 AI 对话、也可能是文献问答创建页等）。 */
function goBackFromReading() {
  if (window.history.state?.back) router.back()
  else router.push('/user/search')
}
const ids = ref([]),
  documents = ref([]),
  selected = ref(null),
  sessionId = ref('')
const analysis = ref(null),
  messages = ref([]),
  questions = ref([])
const input = ref(''),
  busy = ref(false),
  error = ref('')
// 顶部进度只来自当前 Run 的快照；切换材料或会话时清空并从服务端恢复。
const progressRun = ref(null)
const progress = computed(() => literatureProgressLabel(progressRun.value))
const tab = ref('analysis'),
  mobile = ref('analysis'),
  collapsed = ref(false),
  pdfCollapsed = ref(false),
  panelWidth = ref(430)
const activeRun = ref(''),
  activeTask = ref('ANALYZE')
// 保留来源卡身份，分析页更新会话 URL 后仍能回写这一组材料的真实状态。
const readingSourceId = ref('')
const historyVisible = ref(false),
  historyPage = ref(1),
  historyData = ref({ items: [], total: 0 })
const historyLoading = ref(false),
  workspace = ref(null),
  chatBody = ref(null)
const historyError = ref('')
const historyList = ref(null)
// 服务端标题可能截断，不能用标题分隔符推断实际文献篇数。
const historyGroups = computed(() => {
  const groups = new Map()
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  for (const item of historyData.value.items) {
    const date = String(item.updated_at || '')
      .replace('T', ' ')
      .slice(0, 16)
    const day = date.slice(0, 10)
    const label =
      day === localDateKey(today)
        ? '今天'
        : day === localDateKey(yesterday)
          ? '昨天'
          : day || '更早的记录'
    const titles = String(item.title || '')
      .split(' / ')
      .map((title) => title.trim())
      .filter(Boolean)
    if (!groups.has(label)) groups.set(label, { label, items: [] })
    groups.get(label).items.push({
      ...item,
      title: item.title || '未命名阅读会话',
      primaryTitle: titles[0] || '未命名阅读会话',
      otherTitles: titles.slice(1).join(' / '),
      date,
      time: date.slice(11) || '时间未知',
    })
  }
  return [...groups.values()]
})
/** 返回本地日历日期，用于历史记录的今天、昨天分组。 */
function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const pdfViewer = ref(null),
  pdfSource = shallowRef(null),
  pdfLoading = ref(false),
  pdfError = ref('')
const activeCitation = ref(null),
  highlights = ref([]),
  highlightMessage = ref(''),
  highlightComplete = ref(false)
let citationTextPages = new Map(),
  citationMatches = null,
  highlightReadError = ''
const page = ref(1),
  pages = ref(0),
  scale = ref(1),
  attachment = ref('')
let epoch = 0,
  pdfEpoch = 0,
  disposed = false
let controller, pdf, loadingTask, stopResize
const current = computed(() => documents.value.find((item) => item.id === selected.value))
// 未开始分析的材料独立保存在 draft 参数，避免添加选文直接改动会话范围。
const draftIds = computed(() => parseMaterialIds(route.query.draft))
const canAsk = computed(() => analysis.value?.documents?.some((item) => item.analysis))
const recommendedDocuments = computed(() => displayRecommendations(
  analysis.value?.recommended_documents || [], ids.value,
))
const sectionTitles = {
  background: '背景与研究问题',
  ideas: '核心观点与框架',
  methods: '研究方法与材料',
  findings: '主要发现与结论',
  contributions: '贡献与价值',
  limitations: '局限与适用范围',
}
const describeError = (err) =>
  err?.response?.data?.error ||
  err?.response?.data?.detail ||
  err?.response?.data?.message ||
  err?.message ||
  '请求失败，请稍后重试'
const claimText = (claim) => claim.text

function showDocument(id) {
  showPdf()
  void selectDocument(id)
}
/** 重新显示原文时保留已加载的文档、页码及缩放，由阅读器刷新可见视口。 */
function showPdf() {
  pdfCollapsed.value = false
  mobile.value = 'pdf'
}
function togglePdf() {
  stopResize?.()
  pdfCollapsed.value = !pdfCollapsed.value
  mobile.value = pdfCollapsed.value ? 'analysis' : 'pdf'
}
/** 在左侧原文定位引用页码，并按完整证据片段高亮。 */
async function openCitation(message, index) {
  const citation = message.citations?.find((item) => item.citation_index === index)
  const document = documents.value.find((item) => item.id === citation?.corpus_id)
  if (
    !citation ||
    !document?.attachments.includes(citation.file_path) ||
    !Number.isSafeInteger(citation.page_start) ||
    citation.page_start < 1
  ) {
    ElMessage.warning('该引用的原文定位已不可用')
    return
  }
  showPdf()
  await selectDocument(citation.corpus_id, citation.file_path, citation.page_start, true, citation)
}
function showChat() {
  tab.value = 'chat'
  void scrollChat()
}

/** 解析页面材料列表；非法、重复或超限范围不得用于分析。 */
function parseMaterialIds(value) {
  const values = String(value || '')
    .split(',')
    .filter(Boolean)
    .map(Number)
  if (
    !values.length ||
    values.length > 20 ||
    values.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
    new Set(values).size !== values.length
  )
    return []
  return values
}
/** 只读取已确认开始分析的固定范围，草稿不能触发自动运行。 */
function routeIds() {
  return parseMaterialIds(route.query.ids || route.query.id)
}
/** 将独立阅读的真实分析状态交回来源卡，后续追问不会覆盖初次分析状态。 */
function rememberSourceAnalysis(run) {
  if (readingSourceId.value && run.request_payload?.task === 'ANALYZE')
    readingCardState.record(readingSourceId.value, run.request_payload.corpus_ids, run)
}
/** 统一授权读取公共文献与本人文件，私人原文不经过公开下载接口。 */
async function loadDocuments(generation) {
  const rows = await Promise.all(
    ids.value.map(async (id) => {
      const item = await fetchReadingMaterial(id)
      if (!item) throw new Error('所选文献已不可阅读，请返回搜索重新选择')
      return {
        ...item,
        id,
        title: item.title_cn || item.title_en || `文献 ${id}`,
        attachments: (item.attachment || [])
          .map((path) => (typeof path === 'string' ? path : path.file_path))
          .filter(Boolean),
      }
    }),
  )
  if (generation !== epoch) return
  documents.value = rows
  selected.value = ids.value[0]
  void selectDocument(selected.value)
}
/** 恢复同范围阅读会话及来源分析状态，generation 隔离路由切换后的响应。 */
async function restore(id, generation) {
  // 1. 核对历史范围，恢复初次分析状态与已成功的追问。
  const session = await fetchReadingConversation(id)
  if (!session.reading_runs?.length) throw new Error('这不是文献阅读会话')
  if (generation !== epoch) return
  const runs = session.reading_runs,
    scope = runs[0].request_payload.corpus_ids
  if (ids.value.length && JSON.stringify(ids.value) !== JSON.stringify(scope))
    throw new Error('页面文献与历史会话范围不一致')
  sessionId.value = id
  ids.value = scope
  const sourceAnalysis = runs.filter((run) => run.request_payload.task === 'ANALYZE').at(-1)
  if (sourceAnalysis) rememberSourceAnalysis(sourceAnalysis)
  messages.value = session.messages.filter((message) =>
    runs.some(
      (run) =>
        run.id === message.run_id && run.status === 'SUCCESS' && run.request_payload.task === 'ASK',
    ),
  )
  const latestAnalysis = runs
    .filter((run) => run.status === 'SUCCESS' && run.request_payload.task === 'ANALYZE')
    .at(-1)
  // 2. 综合分析读取完整结果，追问与失败记录不能替代初次分析。
  if (latestAnalysis) {
    const run = await fetchReadingRun(latestAnalysis.id)
    if (generation !== epoch) return
    analysis.value = run.result_payload?.payload
    questions.value = analysis.value?.recommended_questions || []
  }
  const latest = runs.at(-1)
  // 3. 继续追踪执行中的任务，失败记录保留供手动重试。
  if (['PENDING', 'RUNNING'].includes(latest?.status)) {
    busy.value = true
    activeRun.value = latest.id
    activeTask.value = latest.request_payload.task
    progressRun.value = { ...latest, steps: [] }
    void follow(latest.id, generation)
  } else if (latest?.status === 'FAILED') {
    const run = await fetchReadingRun(latest.id)
    if (generation === epoch) {
      error.value = run.error_message || '上次运行未完成，可以重试'
      activeRun.value = run.id
      activeTask.value = latest.request_payload.task
    }
  }
}
/** 恢复固定范围的历史会话，或核对所选两种来源的材料全部就绪后启动分析。 */
async function initialize() {
  const id = String(route.query.conversation || ''),
    scope = routeIds()
  if (id && id === sessionId.value && JSON.stringify(scope) === JSON.stringify(ids.value)) return
  const generation = ++epoch
  readingSourceId.value = typeof route.query.source_run === 'string' ? route.query.source_run : ''
  ++pdfEpoch
  void releaseReadingPdf()
  clearHighlights()
  controller?.abort()
  busy.value = false
  error.value = ''
  activeRun.value = ''
  activeTask.value = 'ANALYZE'
  progressRun.value = null
  sessionId.value = ''
  analysis.value = null
  messages.value = []
  questions.value = []
  documents.value = []
  ids.value = scope
  tab.value = 'analysis'
  mobile.value = 'analysis'
  input.value = String(route.query.prompt || '')
  try {
    if (localStorage.getItem('userRole') !== '2') throw new Error('文献阅读目前仅对数据收集者开放')
    if (id) await restore(id, generation)
    else if (!scope.length) {
      if (route.query.ids || route.query.id) throw new Error('请选择 1～20 篇不重复的有效材料')
      return
    }
    if (generation !== epoch) return
    await loadDocuments(generation)
    if (!id && generation === epoch) {
      if (documents.value.some((item) => item.index.status !== 'SUCCESS')) {
        error.value = '所选材料尚未全部就绪，请点击「调整材料」查看处理进度后开始分析'
        return
      }
      await start('ANALYZE')
    }
  } catch (err) {
    if (generation === epoch) {
      busy.value = false
      error.value = describeError(err)
    }
  }
}
/** 提交固定材料的分析或追问，并把已接受的分析运行交回来源卡。 */
async function start(task, question = '') {
  if (busy.value || !ids.value.length || (task === 'ASK' && (!canAsk.value || !question.trim())))
    return
  // 新请求也建立独立的响应代次，阻止同会话上一次完成后的晚到恢复覆盖本轮。
  const generation = ++epoch
  const sourceId = readingSourceId.value
  const materialIds = [...ids.value]
  controller?.abort()
  busy.value = true
  activeRun.value = ''
  activeTask.value = task
  error.value = ''
  progressRun.value = { id: '', status: 'PENDING', request_payload: { task }, steps: [] }
  if (task === 'ASK') tab.value = 'chat'
  try {
    // 1. 固定本次来源和材料，离开页面也不把已接受的请求误记到其他来源。
    const accepted = await createReadingRun({
      request_id: createClientUuid(),
      conversation_id: sessionId.value || undefined,
      query:
        task === 'ASK' ? question.trim() : '请分析所选文献，生成固定模板的阅读分析与推荐问题。',
      options: {
        task,
        corpus_ids: materialIds,
        template_version: 1,
        ...(task === 'ASK' && selected.value ? { focus_corpus_id: selected.value } : {}),
      },
    })
    // 已接受的请求即使页面先离开，也要保存真实运行引用，避免返回后再次发起。
    if (task === 'ANALYZE' && sourceId) readingCardState.record(sourceId, materialIds, {
      id: accepted.run_id, status: accepted.status || 'PENDING',
    })
    if (generation !== epoch) return
    // 2. 接受后绑定阅读会话，保留来源参数供刷新及返回时恢复状态。
    sessionId.value = accepted.conversation_id
    activeRun.value = accepted.run_id
    progressRun.value = { ...progressRun.value, id: accepted.run_id, status: accepted.status || 'PENDING' }
    await router.replace({
      query: { ids: ids.value.join(','), conversation: accepted.conversation_id,
        ...(sourceId ? { source_run: sourceId } : {}) },
    })
    if (generation !== epoch) return
    if (task === 'ASK') {
      messages.value.push({
        id: `pending-${accepted.run_id}`,
        run_id: accepted.run_id,
        role: 'USER',
        content: question.trim(),
        citations: [],
      })
      input.value = ''
      await scrollChat()
    }
    // 3. 跟踪真实终态，断线或失败由页面显示可重试状态。
    await follow(accepted.run_id, generation)
  } catch (err) {
    if (generation === epoch && err?.name !== 'AbortError') {
      busy.value = false
      error.value = describeError(err)
    }
  }
}
/** 跟踪进度并回读持久化终态；断线时保留真实运行，避免重新提交。 */
async function follow(id, generation) {
  if (generation !== epoch || id !== activeRun.value) return
  controller?.abort()
  const connection = new AbortController()
  controller = connection
  /** 任务 ID、页面代次和连接身份必须同时匹配，旧组回包不改变当前组。 */
  const isCurrent = () => generation === epoch && id === activeRun.value
    && controller === connection && !connection.signal.aborted
  try {
    // 1. 先读取本组持久化步骤，返回会话不沿用上一组文案，也不等待 SSE 重放才恢复。
    let run = await fetchReadingRun(id)
    if (!isCurrent()) return
    progressRun.value = run
    // 2. 有序合并本组事件；终态必须回读确认，迟到或重放的旧步骤不能倒退进度。
    if (['PENDING', 'RUNNING'].includes(run.status)) {
      await streamAgentRun(id, (event) => {
        if (isCurrent()) progressRun.value = mergeLiteratureProgress(progressRun.value, id, event)
      }, connection.signal)
      if (!isCurrent()) return
      run = await fetchReadingRun(id)
      if (!isCurrent()) return
      progressRun.value = run
    }
    // 3. 仅本组真实终态更新来源卡及结果，失败允许重试。
    rememberSourceAnalysis(run)
    busy.value = false
    if (['PENDING', 'RUNNING'].includes(run.status))
      throw new Error('进度连接已断开，分析仍在后台运行，请重新连接')
    if (run.status !== 'SUCCESS') throw new Error(run.error_message || '分析未完成，请重试')
    await restore(sessionId.value, generation)
    if (!isCurrent()) return
    if (run.request_payload.task === 'ASK') {
      questions.value = run.result_payload?.payload.recommended_questions || []
      await scrollChat()
    }
  } catch (err) {
    if (isCurrent()) {
      busy.value = false
      error.value = describeError(err)
    }
  }
}
/** 优先重连尚在执行的运行；已终止的分析才允许重新提交。 */
async function retry() {
  const generation = epoch
  if (activeRun.value) {
    try {
      const run = await fetchReadingRun(activeRun.value)
      if (generation !== epoch) return
      rememberSourceAnalysis(run)
      if (['PENDING', 'RUNNING'].includes(run.status)) {
        busy.value = true
        error.value = ''
        await follow(run.id, generation)
        return
      }
      if (run.request_payload.task === 'ASK') {
        input.value = run.query
        tab.value = 'chat'
        error.value = ''
        return
      }
    } catch (err) {
      if (generation === epoch) error.value = describeError(err)
      return
    }
  }
  await start('ANALYZE')
}
async function scrollChat() {
  await nextTick()
  if (chatBody.value) chatBody.value.scrollTop = chatBody.value.scrollHeight
}
async function openHistory() {
  historyVisible.value = true
  historyPage.value = 1
  await loadHistory()
}
async function loadHistory() {
  historyLoading.value = true
  historyError.value = ''
  try {
    historyData.value = await fetchReadingHistory(historyPage.value)
    await nextTick()
    if (historyList.value) historyList.value.scrollTop = 0
  } catch (err) {
    historyError.value = describeError(err)
  } finally {
    historyLoading.value = false
  }
}
async function openSession(id) {
  historyVisible.value = false
  await router.push({ query: { conversation: id } })
}

function clearHighlights() {
  activeCitation.value = null
  highlights.value = []
  highlightMessage.value = ''
  highlightComplete.value = false
  citationTextPages = new Map()
  citationMatches = null
  highlightReadError = ''
}
async function prepareHighlights(document, citation, generation) {
  const textPages = [],
    rawPages = new Map(),
    lastPage = Math.min(
      document.numPages,
      Number.isSafeInteger(citation.page_end)
        ? Math.max(citation.page_start, citation.page_end)
        : citation.page_start,
    )
  try {
    for (let number = citation.page_start; number <= lastPage; number++) {
      const sheet = await document.getPage(number)
      if (generation !== pdfEpoch || document !== pdf || disposed) return
      const text = await sheet.getTextContent()
      if (generation !== pdfEpoch || document !== pdf || disposed) return
      const items = text.items.filter((item) => 'str' in item && item.str.trim()).map((item) => ({
        ...item,
        ascent: text.styles?.[item.fontName]?.ascent,
        descent: text.styles?.[item.fontName]?.descent,
      }))
      rawPages.set(number, items)
      const viewport = sheet.getViewport({ scale: 1 })
      textPages.push({
        pageNumber: number,
        width: viewport.width,
        height: viewport.height,
        items: items.map((item) => ({
          str: item.str,
          width: item.width,
          transform: pdfjs.Util.transform(viewport.transform, item.transform),
        })),
      })
    }
    citationMatches = locateCitationHighlights(textPages, citation.content || citation.quote_text || '')
    citationTextPages = rawPages
  } catch {
    if (generation === pdfEpoch && document === pdf)
      highlightReadError = '已打开原文，文字层读取失败，暂时无法高亮'
  }
}
function updateHighlights(viewport) {
  if (!activeCitation.value) return
  const indexes = citationMatches?.indexesByPage.get(page.value) || new Set(),
    items = citationTextPages.get(page.value) || []
  highlights.value = buildCitationHighlightRects(items, indexes, viewport,
    citationMatches?.rangeLocated ? citationMatches.rangesByPage.get(page.value) : undefined)
  const matched = citationMatches?.matchedCharacterCount || 0,
    target = citationMatches?.targetCharacterCount || 0,
    citation = activeCitation.value
  highlightComplete.value = indexes.size > 0 && target > 0 && (citationMatches?.rangeLocated
    ? !citationMatches.approximate : matched >= target)
  if (highlightReadError) highlightMessage.value = highlightReadError
  else if (
    page.value < citation.page_start ||
    page.value > (citation.page_end || citation.page_start)
  )
    highlightMessage.value = '当前页不在引用页码范围内'
  else if (!indexes.size) highlightMessage.value = '已定位引用页，未匹配到可高亮的原文'
  else if (citationMatches?.rangeLocated)
    highlightMessage.value = citationMatches.approximate
      ? '已按首尾定位连续高亮，少量文字采用近似匹配'
      : activeCitation.value.page_end > activeCitation.value.page_start
        ? '已按首尾定位跨页原文，向下滚动可继续查看高亮'
        : '已按首尾定位连续高亮'
  else if (highlightComplete.value)
    highlightMessage.value =
      citation.page_end > citation.page_start
        ? '已匹配跨页原文，向下滚动可继续查看高亮'
        : '已高亮引用原文'
  else highlightMessage.value = `原文部分匹配（${matched}/${target} 字符），仅高亮已匹配内容`
}
/** 为连续阅读器的每一页生成独立高亮，避免把当前页坐标复用到其他页面。 */
function pageHighlights(pageNumber, viewport) {
  return buildCitationHighlightRects(
    citationTextPages.get(pageNumber) || [],
    citationMatches?.indexesByPage.get(pageNumber) || new Set(),
    viewport,
    citationMatches?.rangeLocated ? citationMatches.rangesByPage.get(pageNumber) : undefined,
  )
}
/** 可见页随滚动变化时同步工具栏页码与引用匹配提示。 */
function onPdfPageChange(pageNumber, viewport) {
  page.value = pageNumber
  updateHighlights(viewport)
}
/** 先让连续阅读器撤下页面，再释放对应文档，避免销毁中的 Worker 被旧页面继续访问。 */
async function releaseReadingPdf() {
  const previousTask = loadingTask,
    previousDocument = pdf
  loadingTask = null
  pdf = null
  pdfSource.value = null
  await nextTick()
  try {
    if (previousTask) await previousTask.destroy()
    else await previousDocument?.destroy()
  } catch {
    // 快速切换时旧任务可能已经由 PDF.js 取消，清理失败不阻止新文档加载。
  }
}
/** 授权获取当前原文并载入 PDF，切换材料时撤销旧加载和引用高亮。 */
async function selectDocument(id, path = '', targetPage = 1, strictPage = false, citation = null) {
  const generation = ++pdfEpoch
  clearHighlights()
  activeCitation.value = citation
  selected.value = id
  const target = path || current.value?.attachments[0]
  pages.value = 0
  pdfError.value = ''
  attachment.value = target || ''
  await releaseReadingPdf()
  if (generation !== pdfEpoch || disposed) return
  if (!target) {
    pdfLoading.value = false
    pdfError.value = '这篇文献没有可预览的附件'
    return
  }
  pdfLoading.value = true
  try {
    const response = await fetchReadingFile({ corpus_id: id, attachment_path: target })
    if (generation !== pdfEpoch) return
    const bytes = await response.data.arrayBuffer()
    if (generation !== pdfEpoch) return
    loadingTask = pdfjs.getDocument(pdfDocumentOptions(bytes))
    const loaded = await loadingTask.promise
    if (generation !== pdfEpoch) {
      loaded.destroy()
      return
    }
    pdf = loaded
    pages.value = loaded.numPages
    if (strictPage && targetPage > loaded.numPages) {
      pdfError.value = '引用页码超出当前 PDF 范围，请核对原文附件'
      return
    }
    page.value = Math.max(1, Math.min(targetPage, loaded.numPages))
    if (citation) {
      highlightMessage.value = '正在匹配引用原文'
      await prepareHighlights(loaded, citation, generation)
      if (generation !== pdfEpoch || loaded !== pdf || disposed) return
    }
    const initialPage = page.value
    pdfLoading.value = false
    pdfSource.value = loaded
    await nextTick()
    await pdfViewer.value?.scrollToPage(initialPage, Boolean(citation))
  } catch (err) {
    if (generation === pdfEpoch && err?.name !== 'RenderingCancelledException')
      pdfError.value = '附件无法预览，请尝试下载原文'
  } finally {
    if (generation === pdfEpoch) pdfLoading.value = false
  }
}
function fitWidth() {
  pdfViewer.value?.fitToWidth()
}
function zoom(delta) {
  pdfViewer.value?.zoomBy(delta)
}
/** 通过当前材料的授权接口下载原文，不暴露私人文件的公开链接。 */
async function download() {
  if (!attachment.value) return
  try {
    const response = await fetchReadingFile({
      corpus_id: selected.value,
      attachment_path: attachment.value,
    })
    const url = URL.createObjectURL(response.data),
      link = document.createElement('a')
    link.href = url
    link.download = attachment.value.split(/[\\/]/).at(-1) || '文献.pdf'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (err) {
    ElMessage.error(describeError(err))
  }
}
function resize(event) {
  event.preventDefault()
  stopResize?.()
  const startX = event.clientX,
    width = panelWidth.value
  const move = (next) => {
    panelWidth.value = Math.max(
      340,
      Math.min(
        width + startX - next.clientX,
        workspace.value.clientWidth - (collapsed.value ? 48 : 210) - 320,
      ),
    )
  }
  const stop = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', stop)
    window.removeEventListener('pointercancel', stop)
    stopResize = null
  }
  stopResize = stop
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', stop)
  window.addEventListener('pointercancel', stop)
}
function adjustPanel(delta) {
  if (!workspace.value) return
  const listWidth = workspace.value.querySelector('.document-list').clientWidth
  panelWidth.value = Math.max(
    320,
    Math.min(panelWidth.value + delta, workspace.value.clientWidth - listWidth - 320),
  )
}
/** 材料范围变化开启新会话，既有会话及引用仍绑定原选择。 */
async function analyzeMaterials(materialIds) {
  if (busy.value) return
  const query = { ids: materialIds.join(',') }
  if (!route.query.conversation && query.ids === route.query.ids) await initialize()
  else await router.push({ name: 'literatureDetail', query })
}
/** 更新选材草稿时替换当前地址，避免每次勾选产生一条浏览器历史。 */
async function saveMaterialDraft(materialIds) {
  if (ids.value.length || route.query.conversation) return
  await router.replace({ query: { ...route.query, draft: materialIds.length ? materialIds.join(',') : undefined } })
}
/** 先保存已有材料再进入全局搜索，搜索返回时只追加草稿，不自动分析。 */
async function searchMaterials(materialIds) {
  await saveMaterialDraft(materialIds)
  await router.push({ name: 'search', query: { reading: '1', materials: materialIds.join(',') || undefined } })
}
/** 用当前会话材料作为新草稿；历史会话仍保留原范围及分析结果。 */
async function editMaterials() {
  if (!busy.value) await router.push({ name: 'literatureDetail', query: { draft: ids.value.join(',') } })
}
watch(() => [route.query.ids, route.query.id, route.query.conversation], initialize, {
  immediate: true,
})
watch(() => [mobile.value, pdfCollapsed.value], async () => {
  await nextTick()
  if (mobile.value === 'pdf' && !pdfCollapsed.value) pdfViewer.value?.refresh()
})
onBeforeUnmount(() => {
  disposed = true
  ++epoch
  ++pdfEpoch
  controller?.abort()
  void releaseReadingPdf()
  stopResize?.()
})
</script>

<template>
  <section class="reading-workspace" aria-label="文献阅读工作台">
    <header class="workspace-header">
      <el-button v-if="ids.length" :icon="ArrowLeft" @click="goBackFromReading">返回</el-button>
      <span v-if="ids.length" class="scope-label">已选 {{ ids.length }} 篇</span
      ><span class="spacer"></span
      >
      <el-button v-if="ids.length" :disabled="busy" @click="editMaterials">调整材料</el-button>
      <el-button :icon="Clock" @click="openHistory">{{ ids.length ? '历史' : '历史会话' }}</el-button>
    </header>
    <div v-if="!ids.length" class="reading-start">
      <div class="start-content">
        <el-icon class="start-icon" :size="32"><ChatDotRound /></el-icon>
        <h2>选择材料，一起分析</h2>
        <p>从文献库搜索选文，或添加本地 PDF，统一开始阅读分析与追问。</p>
        <p class="start-hint">支持单篇阅读与多篇混合分析，本地文件仅本人可见。</p>
        <p v-if="error" class="start-error" role="alert">{{ error }}</p>
        <LiteratureMaterials :current-ids="draftIds" :busy="busy" @change="saveMaterialDraft" @search="searchMaterials" @analyze="analyzeMaterials" />
      </div>
    </div>
    <div v-if="ids.length" class="mobile-tabs">
      <button :class="{ active: mobile === 'pdf' }" @click="showPdf">阅读原文</button
      ><button :class="{ active: mobile === 'analysis' }" @click="mobile = 'analysis'">
        分析与追问
      </button>
    </div>
    <div
      v-if="ids.length"
      ref="workspace"
      class="workspace-body"
      :class="{ collapsed, 'pdf-collapsed': pdfCollapsed, 'show-pdf': mobile === 'pdf' }"
      :style="{ '--panel-width': `${panelWidth}px` }"
    >
      <aside class="document-list">
        <div class="list-header">
          <h2 v-if="!collapsed">所选文献</h2>
          <el-button
            text
            :icon="collapsed ? Expand : Fold"
            :aria-label="collapsed ? '展开文献列表' : '收起文献列表'"
            @click="collapsed = !collapsed"
          />
        </div>
        <div class="document-items">
          <button
            v-for="(item, index) in documents"
            :key="item.id"
            class="document-item"
            :class="{ selected: selected === item.id }"
            :title="item.title"
            @click="showDocument(item.id)"
          >
            <span class="document-number">{{ index + 1 }}</span
            ><span v-if="!collapsed" class="document-info"
              ><strong>{{ item.title }}</strong
              ><small>{{ item.author || '作者未提供' }}</small
              ><small>{{ item.origin === 'PERSONAL' ? '我的上传' : '文献库' }}</small
              ><small>{{ item.publish_time || '年份未提供' }}</small
              ><small
                v-if="
                  analysis?.documents.find((doc) => doc.corpus_id === item.id)?.status ===
                  'UNAVAILABLE'
                "
                >材料未就绪</small
              ></span
            >
          </button>
        </div>
      </aside>
      <section id="reading-pdf-panel" v-show="!pdfCollapsed" class="pdf-panel" aria-label="文献原文">
        <div class="pdf-title">
          <strong>{{ current?.title || '选择文献预览' }}</strong>
          <div class="pdf-title-actions">
            <el-button
              text
              :icon="Download"
              :disabled="!attachment"
              aria-label="下载原文"
              @click="download"
            />
            <el-button
              text
              :icon="Fold"
              aria-label="收起原文"
              aria-controls="reading-pdf-panel"
              :aria-expanded="!pdfCollapsed"
              @click="togglePdf"
            />
          </div>
        </div>
        <div v-if="current?.attachments.length > 1" class="attachment-select">
          <el-select
            v-model="attachment"
            aria-label="选择预览附件"
            @change="(path) => selectDocument(selected, path)"
            ><el-option
              v-for="path in current.attachments"
              :key="path"
              :value="path"
              :label="path.split(/[\\/]/).at(-1)"
          /></el-select>
        </div>
        <div class="pdf-toolbar">
          <span class="pdf-page-indicator">{{ pages ? page : 0 }} / {{ pages }} 页</span>
          <span class="pdf-scroll-hint">滚动阅读</span><span class="spacer"></span
          ><el-button size="small" :disabled="!pages" @click="fitWidth">适合宽度</el-button
          ><el-button size="small" :disabled="!pages" aria-label="缩小" @click="zoom(-0.15)"
            >−</el-button
          ><small class="zoom-label">{{ Math.round(scale * 100) }}%</small
          ><el-button size="small" :disabled="!pages" aria-label="放大" @click="zoom(0.15)"
            >＋</el-button
          >
        </div>
        <div class="pdf-canvas-area">
          <div v-if="pdfLoading" class="pdf-state">
            <el-icon class="is-loading"><Loading /></el-icon>正在加载原文
          </div>
          <div v-else-if="pdfError" class="pdf-state">
            <p>{{ pdfError }}</p>
            <el-button v-if="attachment" @click="selectDocument(selected, attachment)"
              >重新加载</el-button
            >
          </div>
          <ContinuousPdfViewer
            v-show="!pdfError && !pdfLoading && pages > 0"
            ref="pdfViewer"
            :document="pdfSource"
            :get-highlights="pageHighlights"
            @page-change="onPdfPageChange"
            @scale-change="(value) => (scale = value)"
            @error="(value) => (pdfError = value)"
          />
        </div>
      </section>
      <aside v-if="pdfCollapsed" class="pdf-collapsed-panel" aria-label="原文已收起">
        <button
          type="button"
          class="pdf-expand-button"
          aria-label="展开原文"
          aria-controls="reading-pdf-panel"
          :aria-expanded="!pdfCollapsed"
          @click="togglePdf"
        >
          <el-icon><Expand /></el-icon><span>展开原文</span>
        </button>
      </aside>
      <div
        v-show="!pdfCollapsed"
        class="panel-divider"
        role="separator"
        aria-label="调整分析区域宽度"
        aria-orientation="vertical"
        tabindex="0"
        @pointerdown="resize"
        @keydown.left.prevent="adjustPanel(20)"
        @keydown.right.prevent="adjustPanel(-20)"
      ></div>
      <section class="analysis-panel" aria-label="分析与问答">
        <div class="analysis-tabs">
          <button :class="{ active: tab === 'analysis' }" @click="tab = 'analysis'">文献分析</button
          ><button :class="{ active: tab === 'chat' }" @click="showChat">继续提问</button>
          <button :class="{ active: tab === 'recommendations' }" @click="tab = 'recommendations'">
            文献推荐
          </button>
        </div>
        <div v-if="busy" class="progress" role="status">
          <el-icon class="is-loading"><Loading /></el-icon>{{ progress }}
        </div>
        <div v-if="error" class="error" role="alert">
          <p>{{ error }}</p>
          <el-button size="small" :disabled="busy" :icon="Refresh" @click="retry"
            >重试 / 重新连接</el-button
          >
        </div>
        <div v-show="tab === 'analysis'" class="analysis-scroll">
          <template v-if="analysis">
            <ReadingSynthesis
              v-if="analysis.overview"
              :overview="analysis.overview"
            />
            <section class="analysis-section">
              <h2>逐篇分析</h2>
              <details
                v-for="(item, index) in analysis.documents"
                :key="item.corpus_id"
                :open="analysis.documents.length === 1"
              >
                <summary>
                  <span class="document-number">{{ index + 1 }}</span
                  ><strong>{{ item.title }}</strong
                  ><span class="disclosure">›</span>
                </summary>
                <div v-if="item.analysis" class="document-analysis">
                  <small
                    >{{ item.analysis.document_type }} · {{ item.chunk_count }} 个解析片段<span
                      v-if="item.batch_count > 1"
                    >
                      · 分 {{ item.batch_count }} 批阅读</span
                    ></small
                  >
                  <p v-for="(claim, i) in item.analysis.summary" :key="i">
                    {{ claimText(claim) }}
                  </p>
                  <section v-for="part in item.analysis.sections" :key="part.key">
                    <h3>{{ sectionTitles[part.key] }}</h3>
                    <p v-if="!part.claims.length" class="muted">{{ part.missing_reason }}</p>
                    <p v-for="(claim, i) in part.claims" :key="i">
                      {{ claimText(claim) }}
                    </p>
                  </section>
                </div>
                <p v-else class="unavailable">未分析：{{ item.reason }}</p>
              </details>
            </section>
            <section v-if="questions.length" class="analysis-section recommendations">
              <h2>推荐问题</h2>
              <button
                v-for="question in questions"
                :key="question"
                :disabled="busy || !canAsk"
                @click="start('ASK', question)"
              >
                <span>{{ question }}</span
                ><el-icon><ArrowRight /></el-icon>
              </button>
            </section>
            <p class="coverage">
              分析范围：所选文献当前版本的全部可核验解析片段（含索引附件）。可在左侧切换原文阅读。{{
                analysis.documents.some((item) => !item.analysis)
                  ? '部分文献材料未就绪，未纳入综合结论。'
                  : ''
              }}
            </p>
            <el-button text :icon="Refresh" :disabled="busy" @click="start('ANALYZE')"
              >重新分析</el-button
            ></template
          >
          <div v-else class="empty">
            <h2>正在准备阅读分析</h2>
            <p>自动整理核心观点、方法、发现与局限，并生成推荐问题。</p>
            <p>分析范围始终是本次选择的全部文献。</p>
          </div>
        </div>
        <div v-show="tab === 'chat'" ref="chatBody" class="chat-scroll">
          <div v-if="!messages.length" class="empty">
            <h2>围绕文献继续提问</h2>
            <p>询问某篇的方法、核对结论，或比较多篇文献。也可以点击推荐问题。</p>
          </div>
          <article
            v-for="message in messages"
            :key="message.id"
            class="message"
            :class="{ 'user-message': message.role === 'USER' }"
          >
            <small>{{ message.role === 'USER' ? '你' : '文献助手' }}</small
            ><ResearchMarkdown
              :content="message.content"
              :citation-indices="
                message.role === 'ASSISTANT'
                  ? (message.citations || []).map((item) => item.citation_index)
                  : []
              "
              @citation-click="(index) => openCitation(message, index)"
            />
          </article>
        </div>
        <div v-show="tab === 'recommendations'" class="recommendation-scroll">
          <template v-if="recommendedDocuments.length">
            <p class="muted">相关文献 {{ recommendedDocuments.length }} 篇</p>
            <article
              v-for="(item, index) in recommendedDocuments"
              :key="item.origin === 'WEB' ? item.doi || item.external_url : item.corpus_id"
              class="literature-recommendation"
            >
              <div class="recommendation-title">
                <span class="document-number">{{ index + 1 }}</span>
                <h3>{{ item.title }}</h3>
              </div>
              <span class="recommendation-origin">{{ item.origin === 'WEB' ? '联网文献' : '库内文献' }}</span>
              <p>{{ [item.author, item.year, item.source].filter(Boolean).join(' · ') }}</p>
              <a
                v-if="recommendationLink(item)"
                :href="recommendationLink(item)"
                target="_blank"
                rel="noopener noreferrer"
                >{{ item.origin === 'WEB' ? '查看论文来源' : '查看原文' }} <span aria-hidden="true">↗</span></a
              >
              <span v-else class="muted">暂无原文附件</span>
            </article>
          </template>
          <div v-else class="empty">
            <template v-if="busy && activeTask === 'ANALYZE'"
              ><h2>正在准备文献推荐</h2>
              <p>分析完成后展示相关文献。</p></template
            >
            <template v-else-if="!analysis"
              ><h2>文献推荐</h2>
              <p>完成阅读分析后，在这里查看相关文献。</p></template
            >
            <template v-else-if="!analysis.recommendation_status"
              ><h2>此历史记录尚未生成推荐</h2>
              <p>重新分析后可查看相关文献。</p></template
            >
            <template v-else
              ><h2>暂未找到相关文献</h2>
              <p>可以选择其他文献后再试。</p></template
            >
            <el-button
              v-if="
                analysis &&
                !busy &&
                 !analysis.recommendation_status
              "
              text
              :icon="Refresh"
              @click="start('ANALYZE')"
              >重新分析</el-button
            >
          </div>
        </div>
        <form
          v-show="tab !== 'recommendations'"
          class="question-form"
          @submit.prevent="start('ASK', input)"
        >
          <el-input
            v-model="input"
            type="textarea"
            :rows="4"
            resize="none"
            maxlength="4000"
            :placeholder="canAsk ? '围绕所选文献继续提问…' : '完成分析后即可继续提问'"
            aria-label="文献提问"
            @keydown.enter="
              (event) => {
                if (!event.shiftKey && !event.isComposing) {
                  event.preventDefault()
                  start('ASK', input)
                }
              }
            "
          /><el-button
            native-type="submit"
            type="primary"
            :disabled="busy || !canAsk || !input.trim()"
            >发送</el-button
          >
        </form>
      </section>
    </div>
    <el-dialog
      v-model="historyVisible"
      class="reading-history-dialog"
      title="文献阅读历史"
      width="min(720px, 94vw)"
      top="8vh"
      :append-to-body="true"
    >
      <template #header="{ titleId, titleClass }">
        <div class="history-heading">
          <span class="history-heading-icon"
            ><el-icon><Clock /></el-icon
          ></span>
          <div>
            <h2 :id="titleId" :class="titleClass">文献阅读历史</h2>
            <p>找回阅读脉络，继续上次的讨论</p>
          </div>
        </div>
      </template>
      <div ref="historyList" v-loading="historyLoading" class="history-list" :aria-busy="historyLoading">
        <div v-if="historyError" class="history-empty" role="alert">
          <el-icon><Refresh /></el-icon>
          <strong>历史记录加载失败</strong>
          <p>{{ historyError }}</p>
          <el-button :icon="Refresh" @click="loadHistory">重新加载</el-button>
        </div>
        <template v-else>
          <section v-for="group in historyGroups" :key="group.label" class="history-group">
            <h3>{{ group.label }}</h3>
            <button
              v-for="item in group.items"
              :key="item.id"
              type="button"
              class="history-item"
              :class="{ 'is-current': item.id === sessionId }"
              :aria-label="`继续阅读：${item.title}，${item.date}`"
              :disabled="historyLoading"
              @click="openSession(item.id)"
            >
              <span class="history-document-icon"
                ><el-icon><Document /></el-icon
              ></span>
              <span class="history-item-body">
                <span class="history-item-meta">
                  <span class="history-kind">{{ item.otherTitles ? '多篇阅读' : '文献阅读' }}</span>
                  <span v-if="item.id === sessionId" class="history-current">当前会话</span>
                  <time :datetime="item.updated_at" :title="item.date">{{ item.time }}</time>
                </span>
                <el-tooltip
                  :content="item.title"
                  placement="top"
                  :show-after="400"
                  :popper-style="{ maxWidth: 'min(520px, 85vw)', lineHeight: '1.7' }"
                >
                  <span class="history-titles">
                    <strong>{{ item.primaryTitle }}</strong>
                    <span v-if="item.otherTitles" class="history-other-titles"
                      >另含：{{ item.otherTitles }}</span
                    >
                  </span>
                </el-tooltip>
              </span>
              <el-icon class="history-item-arrow"><ArrowRight /></el-icon>
            </button>
          </section>
          <div v-if="!historyData.items.length && !historyLoading" class="history-empty">
            <el-icon><Clock /></el-icon>
            <strong>还没有阅读记录</strong>
            <p>开始一次文献阅读后，就可以在这里继续讨论</p>
          </div>
        </template>
      </div>
      <template #footer>
        <div class="history-footer">
          <span>{{
            historyLoading
              ? '正在加载记录…'
              : historyError
                ? '请重新加载记录'
                : `共 ${historyData.total} 条阅读记录`
          }}</span>
          <el-pagination
            v-if="historyData.total > 20"
            v-model:current-page="historyPage"
            :total="historyData.total"
            :page-size="20"
            :pager-count="5"
            :disabled="historyLoading"
            size="small"
            layout="prev, pager, next"
            @current-change="loadHistory"
          />
        </div>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.reading-workspace {
  --accent: #075762;
  display: flex;
  flex-direction: column;
  height: calc(100dvh - 110px);
  min-height: 480px;
  background: #fff;
  border: 1px solid #dfe7ea;
  border-radius: 10px;
  overflow: hidden;
  color: #25343d;
  font-size: 14px;
  font-family: 'Microsoft YaHei', 'PingFang SC', system-ui, sans-serif;
}
.workspace-header {
  min-height: 62px;
  flex-wrap: wrap;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 10px 18px;
  border-bottom: 1px solid #dfe7ea;
}
h1 {
  margin: 0;
  color: var(--accent);
  font-size: 18px;
  font-weight: 650;
}
h2 {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 650;
}
h3 {
  font-size: 14px;
  margin: 20px 0 8px;
}
.spacer {
  flex: 1;
}
.scope-label {
  color: #637580;
  font-size: 13px;
  padding-left: 18px;
  border-left: 1px solid #dfe7ea;
}
.workspace-body {
  --document-column: 210px;
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: grid;
  grid-template-columns: var(--document-column) minmax(280px, 1fr) 6px minmax(340px, var(--panel-width));
}
.workspace-body.collapsed {
  --document-column: 48px;
}
.document-list {
  min-width: 0;
  min-height: 0;
  border-right: 1px solid #dfe7ea;
  display: flex;
  flex-direction: column;
}
.list-header {
  height: 54px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #edf1f3;
  flex-shrink: 0;
}
.reading-start {
  flex: 1;
  min-height: 0;
  display: grid;
  align-items: start;
  justify-items: center;
  overflow-y: auto;
  padding: 32px 24px;
}
.start-content {
  width: min(100%, 820px);
  margin: 12px 0;
}
.start-icon {
  width: 64px;
  height: 64px;
  margin-bottom: 24px;
  color: var(--accent);
  background: #eaf4f5;
  border-radius: 16px;
}
.start-content h2 {
  font-size: 24px;
  margin-bottom: 18px;
}
.start-hint {
  color: #75838c;
}
.start-error {
  color: #965632;
}
.start-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
}
.start-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}
.start-actions :deep(.el-button--primary) {
  --el-color-primary: #075762;
  --el-color-primary-light-3: #357f88;
}
.list-header h2 {
  margin: 0;
  font-size: 14px;
}
.collapsed .list-header {
  padding: 0 6px;
}
.document-items {
  overflow-y: auto;
  padding: 7px;
}
.document-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  text-align: left;
  background: transparent;
  border: 0;
  border-radius: 6px;
  padding: 13px 9px;
  width: 100%;
  cursor: pointer;
  color: inherit;
  margin-bottom: 4px;
}
.document-item:hover {
  background: #f3f7f8;
}
.document-item.selected {
  background: #eaf4f5;
}
.document-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 23px;
  height: 23px;
  font-size: 12px;
  color: #55727a;
  background: #eff4f5;
  border-radius: 4px;
  flex-shrink: 0;
}
.selected .document-number {
  background: #d4ecef;
  color: var(--accent);
}
.document-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
  line-height: 1.5;
}
.document-info strong {
  font-size: 13px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
small {
  font-size: 12px;
  color: #798993;
}
.pdf-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: #f2f5f7;
}
.pdf-title {
  height: 54px;
  flex-shrink: 0;
  background: #fff;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-bottom: 1px solid #edf1f3;
}
.pdf-title strong {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
}
.pdf-title-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 2px;
}
.pdf-title-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}
.pdf-collapsed-panel {
  border-right: 1px solid #dfe7ea;
  background: #f7fafb;
}
.pdf-expand-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 18px 8px;
  border: 0;
  background: none;
  color: var(--accent);
  font: inherit;
  cursor: pointer;
}
.pdf-expand-button:hover {
  background: #eaf4f5;
}
.pdf-expand-button span {
  writing-mode: vertical-rl;
  letter-spacing: 3px;
  font-size: 13px;
}
.pdf-toolbar {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 10px 12px;
  flex-wrap: wrap;
  border-bottom: 1px solid #e4eaee;
  flex-shrink: 0;
  font-size: 12px;
}
.pdf-toolbar :deep(.el-button + .el-button) {
  margin-left: 0;
}
.attachment-select {
  padding: 8px 12px;
}
.attachment-select :deep(.el-select) {
  width: 100%;
}
.pdf-canvas-area {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.pdf-page-indicator {
  white-space: nowrap;
}
.pdf-scroll-hint {
  color: #8a979f;
  font-size: 11px;
}
.pdf-state {
  display: flex;
  gap: 12px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 180px;
  color: #768991;
  font-size: 13px;
}
.panel-divider {
  background: #fff;
  cursor: col-resize;
  border-left: 1px solid #dfe7ea;
  touch-action: none;
}
.panel-divider:hover,
.panel-divider:focus-visible {
  background: #cce7e9;
  outline: none;
}
.analysis-panel {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.analysis-tabs {
  display: flex;
  gap: 22px;
  height: 54px;
  padding: 0 18px;
  border-bottom: 1px solid #dfe7ea;
  flex-shrink: 0;
  overflow-x: auto;
}
.analysis-tabs button {
  white-space: nowrap;
  border: 0;
  background: none;
  color: #687581;
  padding: 0 3px;
  font: inherit;
  cursor: pointer;
  border-bottom: 2px solid transparent;
}
.analysis-tabs button.active {
  color: var(--accent);
  font-weight: 600;
  border-bottom-color: var(--accent);
}
.analysis-scroll,
.recommendation-scroll,
.chat-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 22px 20px;
}
.literature-recommendation {
  padding: 16px 0;
  border-bottom: 1px solid #e8edef;
}
.recommendation-origin {
  display: inline-block;
  margin-top: 7px;
  padding: 2px 7px;
  color: #46666e;
  background: #eef5f5;
  border-radius: 4px;
  font-size: 12px;
}
.recommendation-title {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.recommendation-title h3 {
  margin: 0;
  font-size: 15px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.literature-recommendation p {
  color: #687581;
  margin: 9px 0;
}
.literature-recommendation a {
  color: var(--accent);
  font-size: 13px;
  text-decoration: none;
}
.literature-recommendation a:hover {
  text-decoration: underline;
}
.analysis-section {
  border-bottom: 1px solid #e8edef;
  padding-bottom: 19px;
  margin-bottom: 20px;
}
p {
  font-size: 13px;
  line-height: 1.85;
  margin: 0 0 11px;
  overflow-wrap: anywhere;
}

details {
  border: 1px solid #dce5e8;
  border-radius: 5px;
  margin: 8px 0;
}
summary {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 10px;
  cursor: pointer;
  font-size: 13px;
  list-style: none;
}
summary::-webkit-details-marker {
  display: none;
}
summary strong {
  flex: 1;
  font-weight: 500;
  overflow-wrap: anywhere;
}
.disclosure {
  color: #6c7e87;
  font-size: 20px;
}
details[open] .disclosure {
  transform: rotate(90deg);
}
.document-analysis {
  padding: 0 12px 12px;
}
.document-analysis > small {
  display: block;
  margin-bottom: 12px;
}
.unavailable {
  padding: 0 12px 10px;
  color: #8a654d;
}
.coverage {
  color: #798991;
  font-size: 11px;
}
.muted {
  color: #7c8a93;
}
.empty {
  padding: 12px 0;
}
.empty p {
  color: #75838c;
}
.progress {
  padding: 12px 18px;
  background: #edf7f7;
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--accent);
  font-size: 12px;
  flex-shrink: 0;
}
.error {
  padding: 12px 18px;
  background: #fff5ef;
  color: #965632;
  flex-shrink: 0;
}
.error p {
  font-size: 12px;
}
.recommendations > button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  margin-bottom: 6px;
  background: #fff;
  border: 1px solid #bed5db;
  color: #35535e;
  border-radius: 5px;
  text-align: left;
  font: inherit;
  font-size: 12px;
  line-height: 1.6;
  cursor: pointer;
}
.recommendations > button:hover:not(:disabled) {
  background: #f1f8f8;
  border-color: var(--accent);
}
button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.question-form {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 12px 18px;
  border-top: 1px solid #edf1f3;
  flex-shrink: 0;
}
.question-form :deep(.el-textarea__inner) {
  font-size: 12px;
  line-height: 1.6;
  /* 原两行输入框为 3.2em 加 10px 内边距，整体高度翻倍。 */
  height: calc(6.4em + 20px);
  box-shadow: 0 0 0 1px #d5e1e6 inset;
}
.question-form :deep(.el-button--primary) {
  --el-color-primary: #075762;
  --el-color-primary-light-3: #357f88;
}
.message {
  margin-bottom: 24px;
  font-size: 13px;
  line-height: 1.85;
}
.message > small {
  display: block;
  font-size: 11px;
  margin-bottom: 8px;
}
.user-message {
  margin-left: 25px;
  background: #eff6f7;
  padding: 12px 14px;
  border-radius: 8px;
}

:global(.reading-history-dialog) {
  --el-dialog-padding-primary: 24px;
  border-radius: 16px;
  font-family: 'Microsoft YaHei', 'PingFang SC', system-ui, sans-serif;
}
.history-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 8px 18px;
}
.history-heading h2 {
  margin: 0;
  color: #203b43;
  font-size: 19px;
  font-weight: 650;
}
.history-heading p {
  margin: 5px 0 0;
  color: #7b8993;
  font-size: 12px;
}
.history-heading-icon,
.history-document-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #075762;
  background: #edf5f5;
  border-radius: 12px;
}
.history-heading-icon {
  width: 44px;
  height: 44px;
  font-size: 22px;
}
.history-list {
  min-height: 220px;
  height: min(540px, 58dvh);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: #cfdbdf transparent;
  padding: 0 8px 8px;
}
.history-group + .history-group {
  margin-top: 22px;
}
.history-group h3 {
  margin: 0 0 9px;
  padding: 0 2px;
  font-size: 12px;
  font-weight: 500;
  color: #788991;
  line-height: 24px;
}
.history-item {
  display: flex;
  align-items: flex-start;
  gap: 13px;
  width: 100%;
  border: 1px solid #e7edef;
  border-radius: 10px;
  padding: 15px;
  background: #fff;
  cursor: pointer;
  text-align: left;
  font: inherit;
  transition:
    background 150ms,
    border-color 150ms;
}
.history-item + .history-item {
  margin-top: 9px;
}
.history-item:hover,
.history-item.is-current {
  background: #f2f8f8;
  border-color: #bfd8da;
}
.history-item:focus-visible {
  outline: 2px solid #075762;
  outline-offset: 2px;
}
.history-item:disabled {
  cursor: wait;
}
.history-document-icon {
  width: 36px;
  height: 40px;
  font-size: 18px;
  border-radius: 8px;
}
.history-item-body {
  min-width: 0;
  flex: 1;
}
.history-item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 11px;
  line-height: 18px;
}
.history-kind {
  color: #778a91;
}
.history-current {
  padding: 0 6px;
  color: #075762;
  background: #e0eeee;
  border-radius: 4px;
}
.history-item time {
  margin-left: auto;
  color: #8a979f;
  white-space: nowrap;
}
.history-titles {
  display: block;
}
.history-titles strong {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
  color: #2a3e47;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.65;
}
.history-other-titles {
  display: block;
  margin-top: 5px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: #8a979f;
  font-size: 12px;
  line-height: 1.6;
}
.history-item-arrow {
  align-self: center;
  flex-shrink: 0;
  color: #a5b2b8;
  font-size: 13px;
}
.history-item:hover .history-item-arrow {
  color: #075762;
}
.history-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 26px;
  margin-top: 8px;
  padding: 14px 8px 0;
  border-top: 1px solid #edf1f3;
  color: #8a979f;
  font-size: 12px;
}
.history-footer :deep(.el-pagination) {
  --el-color-primary: #075762;
}
.history-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 220px;
  height: 100%;
  gap: 12px;
  text-align: center;
  color: #7b8993;
}
.history-empty > .el-icon {
  padding: 16px;
  border-radius: 50%;
  background: #f0f6f6;
  color: #7b9c9f;
  font-size: 26px;
}
.history-empty strong {
  color: #425c65;
  font-size: 14px;
}
.history-empty p {
  margin: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
  font-size: 12px;
}
@media (max-width: 540px) {
  :global(.reading-history-dialog) {
    --el-dialog-padding-primary: 18px;
  }
  .history-heading {
    padding-left: 0;
  }
  .history-heading h2 {
    font-size: 17px;
  }
  .history-list {
    padding-left: 0;
    padding-right: 0;
  }
  .history-item {
    padding: 12px;
    gap: 10px;
  }
  .history-document-icon {
    display: none;
  }
  .history-footer {
    padding-left: 0;
    padding-right: 0;
    flex-wrap: wrap;
  }
}
.mobile-tabs {
  display: none;
}
@media (max-width: 1380px) {
  .workspace-body {
    --document-column: 175px;
    grid-template-columns: var(--document-column) minmax(240px, 1fr) 6px minmax(320px, var(--panel-width));
  }
  .workspace-body.collapsed {
    grid-template-columns: var(--document-column) minmax(240px, 1fr) 6px minmax(320px, var(--panel-width));
  }
}
.workspace-body.pdf-collapsed {
  grid-template-columns: var(--document-column) 48px minmax(0, 1fr);
}
@media (max-width: 1200px) {
  .workspace-body,
  .workspace-body.collapsed,
  .workspace-body.pdf-collapsed {
    grid-template-columns: 48px minmax(0, 1fr);
  }
  .document-list {
    grid-column: 1;
    grid-row: 1;
  }
  .document-info,
  .list-header h2 {
    display: none;
  }
  .list-header {
    padding: 0 6px;
  }
  .document-item {
    padding: 12px 5px;
  }
  .document-items {
    padding: 4px;
  }
  .panel-divider {
    display: none;
  }
  .pdf-collapsed-panel {
    display: none;
  }
  .pdf-panel,
  .analysis-panel {
    grid-column: 2;
    grid-row: 1;
  }
  .pdf-panel {
    display: none;
  }
  .show-pdf .pdf-panel {
    display: flex;
  }
  .show-pdf .analysis-panel {
    display: none;
  }
  .mobile-tabs {
    display: flex;
    border-bottom: 1px solid #dfe7ea;
    padding: 0 16px;
    gap: 20px;
    flex-shrink: 0;
  }
  .mobile-tabs button {
    background: none;
    border: 0;
    padding: 12px 0;
    font: inherit;
    color: #7a8990;
    cursor: pointer;
  }
  .mobile-tabs button.active {
    color: var(--accent);
    border-bottom: 2px solid var(--accent);
  }
  .workspace-header {
    gap: 10px;
    padding: 0 12px;
  }
  .scope-label {
    padding-left: 10px;
  }
}
@media (max-width: 640px) {
  .reading-workspace {
    height: calc(100dvh - 105px);
    min-height: 400px;
  }
  .workspace-header {
    gap: 8px;
    padding: 8px 10px;
  }
  .workspace-header :deep(.materials-entry) {
    width: 100%;
  }
  h1 {
    font-size: 15px;
  }
  .scope-label {
    font-size: 11px;
    padding-left: 6px;
  }
  .analysis-scroll,
  .chat-scroll {
    padding: 16px 12px;
  }
  .question-form {
    padding-left: 12px;
    padding-right: 12px;
  }
  .zoom-label {
    display: none;
  }
  :global(.layout-container:has(.reading-workspace) .el-aside) {
    display: none;
  }
  :global(.layout-container:has(.reading-workspace) .el-aside__logo) {
    height: 54px;
    background-size: 48px auto;
  }
  :global(.layout-container:has(.reading-workspace) .el-menu-item span) {
    display: none;
  }
  :global(.layout-container:has(.reading-workspace) .el-main) {
    padding: 8px;
  }
  :global(.layout-container:has(.reading-workspace) .el-header) {
    padding: 0 12px;
    font-size: 12px;
  }
  :global(.layout-container:has(.reading-workspace) .choiceRole) {
    margin-right: 10px;
    font-size: 12px;
  }
}
</style>
