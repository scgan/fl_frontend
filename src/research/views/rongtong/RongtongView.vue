<!--
  融通专业工作台：自然语言与必选输出语言入口；受众、风格和篇幅由后端从原话识别；
  展示政策事实、跨文化澄清、传播正文、真实运行历史及可定位原文 Evidence。
-->
<script setup lang="ts">
import axios from 'axios'
import { Delete, Promotion, Reading } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  createRongtongRun,
  deleteAgentRun,
} from '@/research/api/agents'
import { fetchKnowledgeBases } from '@/research/api/knowledge-bases'
import HistoryPanelHeader from '@/research/components/common/HistoryPanelHeader.vue'
import PaneResizeHandle from '@/research/components/common/PaneResizeHandle.vue'
import ResearchMarkdown from '@/research/components/common/ResearchMarkdown.vue'
import ResearchCommandHeader from '@/research/components/common/ResearchCommandHeader.vue'
import ReturnToQimingButton from '@/research/components/common/ReturnToQimingButton.vue'
import QimingEvidencePanel from '@/research/components/qiming/QimingEvidencePanel.vue'
import CitationPdfViewer from '@/research/components/qiming/CitationPdfViewer.vue'
import { useProfessionalRun } from '@/research/composables/useProfessionalRun'
import { usePaginatedAgentHistory } from '@/research/composables/usePaginatedAgentHistory'
import { useResizableResearchPanels } from '@/research/composables/useResizableResearchPanels'
import { useResearchWorkspaceStore } from '@/research/stores/research-workspace'
import type { ApiErrorPayload } from '@/research/types/api'
import type {
  AgentEvidenceItem,
  AgentRunHistoryItem,
  RongtongResult,
} from '@/research/types/agents'
import type { KnowledgeBaseRecord } from '@/research/types/knowledge-bases'
import { createClientUuid } from '@/research/utils/client-id'
import { useResearchSource } from '@/research/composables/useResearchSource'
import ResearchScopeSelect from '@/research/components/common/ResearchScopeSelect.vue'

const { source, rootPath, resourceLabel, databaseId, initialDatabaseId } = useResearchSource()
const route = useRoute()
const router = useRouter()
const researchWorkspace = useResearchWorkspaceStore()
const knowledgeBases = ref<KnowledgeBaseRecord[]>([])

/**
 * 将历史运行的创建时间格式化为与智鉴历史卡片一致的月日时分。
 *
 * @param value ISO 时间字符串。
 * @returns 本地时区的月日时分。
 */
function formatHistoryDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

const {
  items: history,
  loading: historyLoading,
  refresh: refreshHistory,
  loadMore: loadMoreHistory,
} = usePaginatedAgentHistory('RONGTONG')
const loading = ref(true)
const deletingId = ref('')
const activeTab = ref('overview')
const selectedCitation = ref<AgentEvidenceItem | null>(null)
const pdfVisible = ref(false)
const pdfMode = ref<'citation' | 'document'>('citation')
const evidenceVisible = ref(true)
const rongtongBody = ref<HTMLElement | null>(null)
const knowledgeBaseId = ref('')
// 用户自然语言请求；语言必选，受众、风格和篇幅由后端自动解析。
const researchTopic = ref('')
const targetLanguage = ref<'ZH' | 'EN' | ''>('')

const {
  selectedRunId, run, evidence, steps, running, runLoading, evidencePending,
  loadRun, startRun, reset: resetRun,
} = useProfessionalRun({
  executor: 'RONGTONG',
  history,
  refreshHistory,
  onLoaded: (detail) => {
    knowledgeBaseId.value = detail.knowledge_base_id
    const item = history.value.find((candidate) => candidate.id === detail.id)
    if (item) researchTopic.value = item.query
    activeTab.value = 'overview'
    // 旧双语结果仍可查看，重新提交前需选择当前支持的中文或英文。
    targetLanguage.value = detail.output_language === 'ZH' || detail.output_language === 'EN'
      ? detail.output_language : ''
  },
  onError: (error) => ElMessage.error(errorMessage(error, '运行详情或进度读取失败')),
})

const result = computed(() => run.value?.rongtong_result ?? (
  run.value?.professional_result?.result_type === 'RONGTONG_POLICY_COMMUNICATION'
    ? run.value.professional_result.payload as unknown as RongtongResult : null
))
/** 展示内容按必选语言选择，Evidence 与来源题名保持原文。 */
function localized(zh: string, en: string): string {
  return result.value?.target_language === 'EN' ? en
    : result.value?.target_language === 'BILINGUAL' ? `${zh} / ${en}` : zh
}
/** 将结构化 Citation 编号作为普通行内文本追加，保持小卡片与智鉴一致且不可点击。 */
function withInlineCitations(text: string, citationIds: number[]): string {
  const existing = new Set([...text.matchAll(/\[(\d+)]/g)].map((match) => Number(match[1])))
  const suffix = citationIds.filter((id) => !existing.has(id)).map((id) => `[${id}]`).join('')
  return `${text.trim()}${suffix}`
}
/** 首项页签由后端 LLM 识别结果决定，旧历史不猜测类型。 */
const tabs = computed(() => [
  ['overview', result.value?.subject_type === 'CONCEPT' ? '概念解读'
    : result.value?.subject_type === 'POLICY' ? '政策解读' : '解读'],
  ['culture', '跨文化解释'], ['communication', '传播正文'], ['references', '参考文献'],
])
/** 按真实文献去重，每篇文献只保留一个全文阅读入口。 */
const referenceDocuments = computed(() => {
  // 从同一 Run 的 Evidence 提取真实题名，不能把未使用的检索候选当成参考文献。
  const documents = new Map<string, { title: string; citationId: number }>()
  for (const item of evidence.value) {
    const title = item.evidence.document_title.trim()
    if (title && !documents.has(item.evidence.document_id)) {
      documents.set(item.evidence.document_id, {
        title,
        citationId: item.citation.citation_index,
      })
    }
  }
  return [...documents.values()]
})
/** 概念与政策使用不同内容分区，语言由本次已保存结果决定。 */
const factSections = computed(() => result.value?.subject_type === 'CONCEPT' ? {
  definition: localized('概念定义', 'Definition'),
  boundaries: localized('概念边界', 'Conceptual boundaries'),
  characteristics: localized('核心特征与原理', 'Key characteristics and principles'),
  applications: localized('适用语境', 'Application contexts'),
  distinctions: localized('相关概念区别', 'Distinctions from related concepts'),
} : {
  background: localized('政策背景', 'Policy background'),
  objectives: localized('政策目标', 'Policy objectives'),
  mechanisms: localized('治理机制与政策工具', 'Governance mechanisms and policy instruments'),
  stakeholders: localized('利益相关者', 'Stakeholders'),
  impacts: localized('实施影响', 'Implementation impacts'),
  international_comparison: localized('国际比较', 'International comparison'),
})
/** 旧版英文/双语解读未生成对应语言，明确提示重跑，不能伪装成已翻译。 */
const legacyLanguageMismatch = computed(() => !result.value?.subject_type
  && result.value?.target_language !== 'ZH')
const failedStep = computed(() => [...steps.value].reverse().find((item) => item.status === 'FAILED'))
const currentNode = computed(() => steps.value[steps.value.length - 1]?.node_name ?? '')
const nodeLabels: Record<string, string> = {
  PolicyOrConceptIdentify: '识别政策或概念任务',
  EvidenceRetrieval: '检索研究证据', PolicyStructureExtraction: '提取政策或概念事实',
  PolicyAnalysisValidation: '核对全部事实与引用', CrossCulturalRiskCheck: '检查跨文化误解',
  AudienceAdaptation: '适配受众与风格', TranslationOrBilingualGeneration: '生成目标语言内容',
  ResearchReviewer: '审核事实与双语一致性', CitationValidator: '验证真实引用',
}
const progressLabel = computed(() => {
  if (running.value) return nodeLabels[currentNode.value] ?? '正在启动融通'
  if (result.value?.status === 'INSUFFICIENT_EVIDENCE') return '证据不足'
  if (run.value?.status === 'SUCCESS') return '传播完成'
  if (run.value?.status === 'FAILED') return '传播失败'
  return '等待开始'
})
const {
  panelStyle: rongtongPanelStyle,
  resizeHistoryPanel,
  resizeEvidencePanel,
} = useResizableResearchPanels({
  body: rongtongBody,
  cssPrefix: 'rongtong',
  historyDefault: 250,
  evidenceDefault: 340,
  contentMinimum: 500,
  isHistoryVisible: () => researchWorkspace.historyVisible,
  isEvidenceVisible: () => evidenceVisible.value,
})

/** 从统一错误信封提取可展示消息。 */
function errorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiErrorPayload>(error)) return error.response?.data.message ?? fallback
  return error instanceof Error ? error.message : fallback
}

/** 并行加载当前用户可见研究范围和最近一页融通历史。 */
async function loadWorkspace(): Promise<void> {
  const [bases] = await Promise.all([
    fetchKnowledgeBases({ page: 1, page_size: Number.MAX_SAFE_INTEGER }, source, databaseId),
    refreshHistory(),
  ])
  knowledgeBases.value = bases.items
  knowledgeBaseId.value ||= bases.items.find((item) => item.id === initialDatabaseId)?.id ?? bases.items[0]?.id ?? ''
}

/** 在历史栏接近底部时追加下一页，失败后允许再次滚动重试。 */
async function handleHistoryScroll(event: Event): Promise<void> {
  const target = event.currentTarget
  if (!(target instanceof HTMLElement)) return
  const remaining = target.scrollHeight - target.scrollTop - target.clientHeight
  if (remaining > 96) return
  try {
    await loadMoreHistory()
  } catch (error) {
    ElMessage.error(errorMessage(error, '加载更多融通历史失败'))
  }
}

/**
 * 创建专业任务；共用运行状态负责立即选中、保存路由和跟踪终态。
 */
async function submit(): Promise<void> {
  if (!knowledgeBaseId.value || !researchTopic.value.trim() || !targetLanguage.value || running.value) return
  const payload = {
    request_id: createClientUuid(),
    knowledge_base_id: knowledgeBaseId.value,
    policy_or_concept: researchTopic.value.trim(),
    target_language: targetLanguage.value,
  }
  await startRun(() => createRongtongRun(payload, source))
}

/** 删除一条终态融通 Run 及其精确关联消息。 */
async function removeHistory(item: AgentRunHistoryItem): Promise<void> {
  try {
    await ElMessageBox.confirm(`将删除“${item.query}”及其运行证据。`, '删除融通任务', {
      confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning',
    })
    deletingId.value = item.id
    await deleteAgentRun(item.id)
    if (selectedRunId.value === item.id) {
      resetRun()
      await router.replace(`${rootPath}/rongtong`)
    }
    history.value = history.value.filter((historyItem) => historyItem.id !== item.id)
    try {
      await refreshHistory()
    } catch {
      ElMessage.warning('任务已删除，但历史列表刷新失败，请稍后刷新页面')
      return
    }
    ElMessage.success('融通任务已删除')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(errorMessage(error, '删除失败'))
  } finally {
    deletingId.value = ''
  }
}

/** 打开与 Evidence 真实页码绑定的鉴权 PDF 阅读器。 */
function openCitation(item: AgentEvidenceItem): void {
  pdfMode.value = 'citation'
  selectedCitation.value = item
  pdfVisible.value = true
}

/**
 * 将结构化结果的 Citation 编号映射到当前 Run Evidence，并按指定入口打开鉴权阅读器。
 *
 * @param citationId 当前 Run 内的真实 Citation 编号。
 * @param mode Citation 定位高亮或从第一页开始的全文阅读模式。
 */
function openCitationById(citationId: number, mode: 'citation' | 'document' = 'citation'): void {
  const item = evidence.value.find(
    (candidate) => candidate.citation.citation_index === citationId,
  )
  if (item) {
    pdfMode.value = mode
    selectedCitation.value = item
    pdfVisible.value = true
    return
  }
  ElMessage.warning(`未找到 Evidence [${citationId}]`)
}

onMounted(async () => {
  try {
    await loadWorkspace()
    if (typeof route.params.runId === 'string') await loadRun(route.params.runId, false)
  } catch (error) {
    ElMessage.error(errorMessage(error, '融通工作台加载失败'))
  } finally {
    loading.value = false
  }
})

</script>

<template>
  <section class="rongtong-workspace">
    <ResearchCommandHeader
      title="融通·国际传播"
      subtitle="EVIDENCE-FIRST POLICY COMMUNICATION"
      accent="#8c6239"
      :status-active="running"
      :status-label="progressLabel"
    >
      <template #icon><el-icon><Reading /></el-icon></template>
      <template #knowledge>
        <ResearchScopeSelect v-model="knowledgeBaseId" :options="knowledgeBases" :disabled="running || Boolean(selectedRunId)" />
      </template>
      <template #primary>
        <div class="primary-controls">
        <el-select v-model="targetLanguage" :disabled="running" placeholder="输出语言（必选）" aria-label="输出语言（必选）">
          <el-option label="中文" value="ZH" /><el-option label="英文" value="EN" />
        </el-select>
        <div class="topic-input"><input v-model="researchTopic" :disabled="running" maxlength="4000" aria-label="政策或概念请求" placeholder="用自然语言描述政策、受众和传播目标"><button type="button" :disabled="running || !knowledgeBaseId || !researchTopic.trim() || !targetLanguage" @click="submit"><el-icon><Promotion /></el-icon>{{ running ? '传播中' : '开始融通' }}</button></div></div>
      </template>
    </ResearchCommandHeader>

    <div
      ref="rongtongBody"
      v-loading="loading"
      class="rongtong-body"
      :class="{
        'history-hidden': !researchWorkspace.historyVisible,
        'evidence-hidden': !evidenceVisible,
      }"
      :style="rongtongPanelStyle"
    >
      <aside
        class="control-rail"
        :class="{ collapsed: !researchWorkspace.historyVisible }"
        @scroll.passive="handleHistoryScroll"
      >
        <HistoryPanelHeader
          :collapsed="!researchWorkspace.historyVisible"
          title="融通历史"
          @toggle="researchWorkspace.toggleHistory"
        />
        <template v-if="researchWorkspace.historyVisible">
        <el-button text :disabled="running" @click="router.push(`${rootPath}/rongtong`)">新建任务</el-button>
        <section class="history">
          <el-tooltip
            v-for="item in history"
            :key="item.id"
            :content="item.query"
            placement="right"
            :show-after="250"
            popper-class="research-history-question-tooltip"
          >
            <article
              :class="{ active: item.id === selectedRunId }"
            >
              <button
                type="button"
                @click="loadRun(item.id)"
              >
                <strong>{{ item.query }}</strong>
                <span>{{ item.knowledge_base_name ?? `${resourceLabel}已不可访问` }}</span>
                <span>{{ formatHistoryDate(item.created_at) }} · {{ item.status }}</span>
              </button>
              <button
                class="delete"
                type="button"
                :disabled="deletingId === item.id || ['PENDING','RUNNING'].includes(item.status)"
                :aria-label="`删除${item.query}`"
                @click="removeHistory(item)"
              ><el-icon><Delete /></el-icon></button>
            </article>
          </el-tooltip>
          <p
            v-if="historyLoading && history.length"
            class="research-history-load-status"
            role="status"
          >正在加载更多历史…</p>
        </section>
        </template>
      </aside>

      <PaneResizeHandle
        v-if="researchWorkspace.historyVisible"
        class="rongtong-history-resizer"
        label="调整融通研究范围与历史栏宽度"
        @resize="resizeHistoryPanel"
      />

      <main v-loading="!loading && (running || runLoading)" class="result-pane">
        <div v-if="run?.status === 'FAILED'" class="boundary"><h2>本次传播未完成</h2><p>{{ run.error_message }}</p><p v-if="failedStep">失败节点：{{ nodeLabels[failedStep.node_name] ?? failedStep.node_name }}。{{ failedStep.error_message }}</p></div>
        <div v-else-if="!result" v-show="!runLoading" class="empty research-workspace-empty"><el-icon><Reading /></el-icon><h2>从一项政策或概念开始</h2><p>选择输出语言，描述传播需求。融通先检索证据，再解释政策并适配受众。</p></div>
        <template v-else-if="result">
          <nav><button v-for="tab in tabs" :key="tab[0]" type="button" :class="{ active: activeTab === tab[0] }" @click="activeTab = tab[0]">{{ tab[1] }}</button></nav>
          <article v-if="activeTab !== 'references'" class="prose">
            <ReturnToQimingButton :conversation-id="run?.conversation_id" :run-id="run?.id" />
            <p class="eyebrow">{{ result.policy_or_concept }}</p>
            <div v-if="result.status === 'INSUFFICIENT_EVIDENCE'" class="boundary">{{ localized('本次证据不足，未生成可靠传播内容。', 'Insufficient evidence for reliable communication.') }}</div>
            <div v-if="legacyLanguageMismatch && activeTab !== 'communication'" class="boundary">旧版历史未保存对应语言的解读与文化解释，请重新运行以生成正确内容。</div>
            <template v-else-if="activeTab === 'overview'">
              <template v-for="(label, field) in factSections" :key="field">
                <h2 v-if="result.facts[field]?.length">{{ label }}</h2>
                <ol v-if="result.facts[field]?.length" class="cards"><li v-for="(fact, index) in result.facts[field]" :key="index">
                  <ResearchMarkdown class="interpretation-markdown" :content="withInlineCitations(fact.text, fact.citation_ids)" />
                </li></ol>
              </template>
            </template>
            <template v-else-if="activeTab === 'culture'">
              <h2>{{ localized('可能的误解与语境澄清', 'Potential misunderstandings and contextual clarification') }}</h2>
              <ol class="cards"><li v-for="(risk, index) in result.cultural_risks" :key="index"><strong>{{ risk.misunderstanding }}</strong><p>{{ withInlineCitations(risk.explanation, risk.citation_ids) }}</p></li></ol>
              <p v-if="!result.cultural_risks.length">{{ localized('当前证据未支持具体的跨文化误解判断。', 'The evidence does not support a specific cross-cultural misunderstanding.') }}</p>
            </template>
            <template v-else-if="activeTab === 'communication'">
              <h2>{{ localized('目标语言传播内容', 'Communication text') }}</h2><ResearchMarkdown class="communication-markdown" :content="result.communication_text" />
            </template>
          </article>
          <article v-else class="reference-pane">
            <ol v-if="referenceDocuments.length" class="reference-cards">
              <li v-for="item in referenceDocuments" :key="item.citationId">
                <button class="document-card-button" type="button" @click="openCitationById(item.citationId, 'document')">{{ item.title }}</button>
              </li>
            </ol>
            <p v-else class="reference-empty">{{ localized('本次运行尚未形成可验证的参考文献。', 'No verifiable references are available for this run.') }}</p>
          </article>
        </template>
      </main>

      <PaneResizeHandle
        v-if="evidenceVisible"
        class="rongtong-evidence-resizer"
        label="调整融通证据引用栏宽度"
        @resize="resizeEvidencePanel"
      />
      <QimingEvidencePanel
        class="desktop-evidence"
        :items="evidence"
        :loading="false"
        :pending="loading || evidencePending"
        :collapsed="!evidenceVisible"
        @toggle="evidenceVisible = !evidenceVisible"
        @open-citation="openCitation"
      />
    </div>
    <CitationPdfViewer v-model="pdfVisible" :item="selectedCitation" :mode="pdfMode" />
  </section>
</template>

<style scoped>
.primary-controls { min-width: 0; display: grid; grid-template-columns: 140px minmax(0,1fr); gap: 8px; }
@media (max-width: 760px) { .primary-controls { grid-template-columns: minmax(0,1fr); } }

.rongtong-workspace { width: 100%; max-width: 100%; height: calc(100vh - var(--header-height)); min-width: 0; min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); overflow: hidden; container-type: inline-size; background: #f5f7f8; }
.topic-input { display: grid; grid-template-columns: minmax(0,1fr) 110px; }.topic-input input { box-sizing: border-box; min-width: 0; height: 46px; padding: 11px 12px; border: 1px solid #bfcfcd; outline: 0; }.topic-input button { height: 46px; display: flex; align-items: center; justify-content: center; gap: 6px; border: 0; background: #8c6239; color: #fff; cursor: pointer; font-size: 12px; font-weight: 700; }.topic-input button:disabled { opacity: .5; cursor: not-allowed; }
.rongtong-body { width: 100%; max-width: 100%; min-width: 0; min-height: 0; display: grid; grid-template-columns: var(--rongtong-history-width, 250px) 8px minmax(0,1fr) 8px var(--rongtong-evidence-width, 340px); overflow: hidden; }
.rongtong-body.history-hidden { grid-template-columns: 44px minmax(0,1fr) 8px var(--rongtong-evidence-width, 340px); }
.rongtong-body.evidence-hidden { grid-template-columns: var(--rongtong-history-width, 250px) 8px minmax(0,1fr) 44px; }
.rongtong-body.history-hidden.evidence-hidden { grid-template-columns: 44px minmax(0,1fr) 44px; }
.control-rail { min-height: 0; padding: 18px 16px; border-right: 1px solid #d9e1e4; overflow-y: auto; }.history { margin: 0; }.history article { position: relative; margin-bottom: 7px; border: 1px solid #d6dfde; background: #fff; }.history article.active { border-color: #8c6239; box-shadow: inset 3px 0 #8c6239; }.history article > button:first-child { width: 100%; padding: 9px 30px 9px 10px; border: 0; background: transparent; text-align: left; cursor: pointer; }.history strong,.history span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.history strong { color: #294643; font-size: 10px; }.history span { margin-top: 4px; color: #7d8e8c; font-size: 9px; }.delete { position: absolute; top: 5px; right: 4px; width: 25px; height: 25px; border: 0; background: transparent; color: #8d9998; cursor: pointer; }
.history article.unavailable { background: #f7f8fa; }
.history article.unavailable > button:first-child { cursor: not-allowed; opacity: .68; }
.control-rail.collapsed { padding: 0; overflow: hidden; }
.result-pane { min-width: 0; min-height: 0; overflow-y: auto; background: #fff; }.result-pane > nav { position: sticky; top: 0; z-index: 2; display: flex; border-bottom: 1px solid #d9e1e4; background: #fff; overflow-x: auto; }.result-pane > nav button { min-width: 105px; height: 50px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: #647a77; cursor: pointer; font-size: 10px; }.result-pane > nav button.active { border-color: #8c6239; color: #8c6239; font-weight: 700; }.empty { color: #7b8f8c; }.empty h2 { color: #294643; }.boundary { margin: 30px; padding: 20px; border: 1px solid #ead8b5; background: #fffaf0; color: #765820; }.boundary h2 { margin-top: 0; }.boundary p { font-size: 11px; line-height: 1.8; }.prose,.review { max-width: 920px; margin: 0 auto; padding: 30px 34px 60px; color: #344e4b; }.prose h2,.review > h2 { margin: 26px 0 12px; color: #173b3a; font: 600 19px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; }.prose > p,.interpretation-markdown,.communication-markdown { font-size: 12px; line-height: 2; }.review-markdown { font-size: 12px; line-height: 2; }.eyebrow { color: #8c6239; font-weight: 700; letter-spacing: .08em; }.prose b { color: #8c6239; }.cards,.stage-list,.references { margin: 0; padding: 0; list-style: none; }.cards li { margin-bottom: 10px; padding: 14px 16px; border-left: 3px solid #8c6239; background: #f5f8f7; }.cards strong { color: #294643; font-size: 12px; }.cards p { margin: 7px 0 0; font-size: 11px; line-height: 1.8; }.gaps li { border-left-color: #b57b27; background: #fffaf0; }.stage-list li { position: relative; margin-left: 72px; padding: 0 0 26px 24px; border-left: 1px solid #9abbb6; }.stage-list time { position: absolute; left: -78px; color: #8c6239; font-size: 10px; }.stage-list h3 { margin: 0 0 8px; color: #294643; font-size: 14px; }.stage-list p,.stage-list small { font-size: 10px; line-height: 1.8; }.stage-list small { color: #788b88; }.references { counter-reset: refs; }.references li { margin-bottom: 10px; padding-left: 26px; text-indent: -26px; font-size: 11px; line-height: 1.8; counter-increment: refs; }.references li::before { content: '[' counter(refs) '] '; color: #8c6239; font-weight: 700; }
.reference-pane { min-height: 240px; }
.reference-cards { margin: 0; padding: 24px 34px 48px; list-style: none; }
.reference-cards li { margin-bottom: 12px; padding: 0; border-left: 3px solid #8c6239; background: #f5f8f7; }
.cards li.document-card { padding: 0; }
.document-card-button { width: 100%; padding: 15px 16px; border: 0; background: transparent; color: #294643; cursor: pointer; font-family: inherit; font-size: 12px; font-weight: 700; line-height: 1.8; text-align: left; }
.document-card-button:hover,.document-card-button:focus-visible { background: #eaf3f1; outline: 2px solid #8c6239; outline-offset: -2px; }
.reference-empty { margin: 24px 34px; padding: 34px 22px; border: 1px dashed #c9d9d6; background: #f5f8f7; color: #758985; font-size: 11px; text-align: center; }
@container (max-width: 1120px) { .rongtong-body { grid-template-columns: min(var(--rongtong-history-width, 250px), 23%) 8px minmax(0,1fr) 8px min(var(--rongtong-evidence-width, 340px), 32%); }.rongtong-body.history-hidden { grid-template-columns: 44px minmax(0,1fr) 8px min(var(--rongtong-evidence-width, 340px), 36%); }.rongtong-body.evidence-hidden { grid-template-columns: min(var(--rongtong-history-width, 250px), 25%) 8px minmax(0,1fr) 44px; }.rongtong-body.history-hidden.evidence-hidden { grid-template-columns: 44px minmax(0,1fr) 44px; } }
@media (max-width: 760px) { .rongtong-workspace { height: auto; overflow: visible; }.topic-input { grid-template-columns: minmax(0, 1fr); width: 100%; }.topic-input input,.topic-input button { height: 42px; }.rongtong-body { display: block; overflow: visible; }.rongtong-history-resizer,.rongtong-evidence-resizer { display: none; }.desktop-evidence { min-height: 520px; border-top: 1px solid #d9e1e4; border-left: 0; }.desktop-evidence.collapsed { min-height: 44px; height: 44px; }.result-pane { min-height: 520px; overflow: visible; }.prose,.review { padding: 22px 18px 45px; } }
</style>
