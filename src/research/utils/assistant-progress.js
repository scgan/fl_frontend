/** 根据 AI 任务真实步骤及创建时间展示进度和累计用时，覆盖检索、研究、阅读与写作。 */

// 只描述后端已经进入的节点，不按等待时间伪造后续步骤或完成百分比。
const stepLabels = {
  AuthenticateContext: '正在确认本次任务…',
  SecurityCheck: '正在检查问题内容…',
  IntentClassifier: '正在理解你的问题…',
  ComplexityClassifier: '正在分析问题需求…',
  TaskPlanner: '正在安排研究步骤…',
  RoutingDecision: '正在确定处理方式…',
  ExtractSearchConditions: '正在提取文献检索条件…',
  DiscoverLiterature: '正在查找相关文献…',
  QimingQA: '正在准备文献问答…',
  LiteratureReading: '正在准备文献分析…',
  ResolveReadingScope: '正在确认本次阅读材料…',
  ReadMaterials: '正在读取所选文献原文…',
  AnalyzeDocuments: '正在逐篇分析文献…',
  SynthesizeReading: '正在综合文献分析…',
  AnswerFollowup: '正在根据所选文献回答…',
  FinalizeReading: '正在整理阅读结果…',
  RecommendLiterature: '正在整理延伸阅读…',
  RetrieveEvidence: '正在检索文献证据…',
  ParseLanguagePreference: '正在确认回答要求…',
  GenerateAnswer: '正在根据文献生成回答…',
  ResultReviewer: '正在检查回答内容…',
  CitationValidator: '正在核对引用与来源…',
  Synthesizer: '正在整理最终结果…',
  ConceptExtraction: '正在梳理研究主题…',
  QueryExpansion: '正在准备检索关键词…',
  LiteratureRetrieval: '正在检索相关文献…',
  EvidenceDedup: '正在筛选文献证据…',
  MetadataNormalization: '正在整理文献资料…',
  TheorySynthesis: '正在整理理论框架…',
  AnalysisValidation: '正在检查分析结果…',
  RQSynthesis: '正在生成选题与研究问题…',
  RQValidation: '正在检查选题依据…',
  PlanSynthesis: '正在生成论文提纲…',
  PlanValidation: '正在检查提纲结构…',
  DraftSynthesis: '正在起草章节正文…',
  DraftValidation: '正在检查章节内容…',
  ReviseSynthesis: '正在按要求修改稿件…',
  ReviseValidation: '正在检查修改结果…',
  ParseCompareRequest: '正在理解比较任务…',
  ValidateCompareRequest: '正在确认比较对象…',
  GenerateCompareDimensions: '正在确定比较维度…',
  BuildCompareQueries: '正在准备比较检索…',
  RetrieveObjectA: '正在检索第一组文献…',
  RetrieveObjectB: '正在检索第二组文献…',
  MergeCandidates: '正在汇总比较资料…',
  EvidenceAssignment: '正在归类比较证据…',
  EvidenceBalanceCheck: '正在检查两侧证据…',
  CrossAnalysis: '正在分析文献异同…',
  CompareAnalysisValidation: '正在检查比较分析…',
  TimelineBuilder: '正在梳理研究时间线…',
  TopicAggregator: '正在汇总研究主题…',
  MatrixGenerator: '正在生成比较结果…',
  FinalizeRestricted: '正在整理现有证据与限制…',
  TopicClustering: '正在归纳文献主题…',
  ReviewDraft: '正在撰写文献综述…',
  ResearchReviewer: '正在检查综述内容…',
  ReviewFallback: '正在整理可确认的研究结论…',
  UnsupportedIntent: '正在整理本次任务的说明…',
}
const writingStages = {
  THEORY: '理论框架',
  RQ: '选题与研究问题',
  PLAN: '论文提纲',
  DRAFT: '章节起草',
  REVISE: '学术修改',
}
const wrapperSteps = new Set([
  'QimingQA',
  'WritingTask',
  'LiteratureReading',
  'GeneralRAG',
  'SuzhiGraph',
  'ZhijianGraph',
])

/** 优先显示执行中的子步骤；仅父节点仍在运行时使用最新记录，避免进度倒退或遮盖并行检索。 */
export function latestAssistantStep(steps = []) {
  const items = Array.isArray(steps) ? steps : []
  const active = items.filter(
    (step) => step.status === 'RUNNING' && !wrapperSteps.has(step.node_name),
  )
  return (active.length ? active : items).reduce((latest, step, index) => {
    const sequence = Number(step.sequence ?? index)
    return !latest || sequence >= latest.sequence ? { step, sequence } : latest
  }, null)?.step
}

/** 将当前 Run 快照投影为阶段文字；终态不展示加载，断线不假装仍在更新。 */
export function assistantProgressLabel(run) {
  if (!['PENDING', 'RUNNING'].includes(run.status)) return ''
  if (run.progressDisconnected) return '进度暂时无法更新，请重新打开会话查看'
  const step = latestAssistantStep(run.steps)
  if (!step) return run.status === 'PENDING' ? '请求已提交，等待开始…' : '正在启动本次任务…'
  if (step.status === 'SUCCESS')
    return step.node_name === 'Synthesizer' ? '正在保存本次结果…' : '正在衔接下一步处理…'
  if (['FAILED', 'CANCELLED'].includes(step.status)) return '正在结束本次任务…'
  if (step.node_name === 'WritingTask') {
    const stage = writingStages[run.request_payload?.writing?.stage]
    return stage ? `正在准备${stage}…` : '正在准备写作任务确认…'
  }
  if (step.node_name === 'LiteratureRetrieval' && run.request_payload?.writing)
    return '正在检索知识库文献…'
  if (step.node_name.startsWith('AnalyzeDocument:')) return '正在分析文献原文…'
  return stepLabels[step.node_name] || '正在处理你的问题…'
}

/** 解析研究服务时间；MySQL DATETIME 返回的无时区时间按服务端 UTC 约定处理。 */
function runTimestamp(value) {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})?$/i.test(text))
    return null
  const timestamp = text.replace(' ', 'T').replace(/(\.\d{3})\d+/, '$1')
  const zoned = /(?:Z|[+-]\d{2}:\d{2})$/i.test(timestamp) ? timestamp : `${timestamp}Z`
  const parsed = Date.parse(zoned)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * 按真实任务创建时间累计秒数，包含排队和离开页面期间的耗时，终态固定到完成时间。
 * @param {object} run 服务端运行快照；临时受理记录还没有时间时不展示计时。
 * @param {number} now 浏览器当前毫秒时间，仅用于执行中的任务。
 * @returns {number|null} 非负秒数；缺少有效起止时间时返回 null，避免重新从页面打开时间计数。
 */
export function assistantElapsedSeconds(run, now = Date.now()) {
  const start = runTimestamp(run.created_at)
  const end = ['PENDING', 'RUNNING'].includes(run.status) ? now : runTimestamp(run.finished_at)
  if (start === null || end === null || !Number.isFinite(end)) return null
  return Math.max(0, Math.floor((end - start) / 1000))
}
