<!--
  溯知专业工作台：提交研究主题并由后端推导综述范围与输出规格，展示真实运行进度、
  研究主题/方法/争议/不足、模型溯源图、完整综述和可定位原文 Evidence。
-->
<script setup lang="ts">
import axios from 'axios'
import { Delete, Promotion, Reading } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  createSuzhiRun,
  deleteAgentRun,
} from '@/research/api/agents'
import { fetchKnowledgeBases } from '@/research/api/knowledge-bases'
import HistoryPanelHeader from '@/research/components/common/HistoryPanelHeader.vue'
import PaneResizeHandle from '@/research/components/common/PaneResizeHandle.vue'
import ResearchCommandHeader from '@/research/components/common/ResearchCommandHeader.vue'
import ReturnToQimingButton from '@/research/components/common/ReturnToQimingButton.vue'
import QimingEvidencePanel from '@/research/components/qiming/QimingEvidencePanel.vue'
import CitationPdfViewer from '@/research/components/qiming/CitationPdfViewer.vue'
import SuzhiProvenanceGraph from '@/research/components/suzhi/SuzhiProvenanceGraph.vue'
import SuzhiReviewReader from '@/research/components/suzhi/SuzhiReviewReader.vue'
import { useProfessionalRun } from '@/research/composables/useProfessionalRun'
import { usePaginatedAgentHistory } from '@/research/composables/usePaginatedAgentHistory'
import { useResizableResearchPanels } from '@/research/composables/useResizableResearchPanels'
import { useResearchWorkspaceStore } from '@/research/stores/research-workspace'
import type { ApiErrorPayload } from '@/research/types/api'
import type {
  AgentEvidenceItem,
  AgentRunHistoryItem,
  CitedReviewFinding,
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
} = usePaginatedAgentHistory('SUZHI')
const loading = ref(true)
const deletingId = ref('')
const activeTab = ref('overview')
const selectedCitation = ref<AgentEvidenceItem | null>(null)
const pdfVisible = ref(false)
const pdfMode = ref<'citation' | 'document'>('citation')
const evidenceVisible = ref(true)
const suzhiBody = ref<HTMLElement | null>(null)
const knowledgeBaseId = ref('')
const researchTopic = ref('')

const {
  selectedRunId, run, evidence, steps, running, runLoading, evidencePending,
  loadRun, startRun, reset: resetRun,
} = useProfessionalRun({
  executor: 'SUZHI',
  history,
  refreshHistory,
  onLoaded: (detail) => {
    knowledgeBaseId.value = detail.knowledge_base_id
    const item = history.value.find((candidate) => candidate.id === detail.id)
    if (item) researchTopic.value = item.query
    activeTab.value = 'overview'
  },
  onError: (error) => ElMessage.error(errorMessage(error, '运行详情或进度读取失败')),
})

const result = computed(() => run.value?.suzhi_result ?? null)
// 后端保留完整格式化条目用于结果快照；页面依据同一 Run Evidence 提取真实题名，
// 避免在前端重复解析不同引用规范中的作者、期刊和年份。
const referenceDocuments = computed(() => {
  const evidenceByDocument = new Map<string, AgentEvidenceItem>()
  for (const item of evidence.value) {
    if (!evidenceByDocument.has(item.evidence.document_id)) {
      evidenceByDocument.set(item.evidence.document_id, item)
    }
  }
  const candidates = [...evidenceByDocument.values()]
    .map((item) => ({ item, title: item.evidence.document_title.trim() }))
    .filter((candidate) => candidate.title.length > 0)
    .sort((left, right) => right.title.length - left.title.length)
  return (result.value?.references ?? []).flatMap((reference) => {
    const candidate = candidates.find((item) => reference.includes(item.title))
    return candidate
      ? [{ title: candidate.title, citationId: candidate.item.citation.citation_index }]
      : []
  })
})
const failedStep = computed(() => [...steps.value].reverse().find((item) => item.status === 'FAILED'))
const currentNode = computed(() => steps.value[steps.value.length - 1]?.node_name ?? '')
const nodeLabels: Record<string, string> = {
  ConceptExtraction: '提取研究概念',
  QueryExpansion: '规划跨语言检索',
  LiteratureRetrieval: '检索文献证据',
  EvidenceDedup: '合并重复证据',
  MetadataNormalization: '规范文献元数据',
  TopicClustering: '归纳主题并生成溯源图',
  // 历史 Run 仍保留旧节点审计记录，回放时继续显示原有中文名称。
  ProvenanceGraphBuild: '生成主题溯源图',
  AnalysisValidation: '校验分析与溯源图引用',
  ResearchMethodAnalysis: '分析方法变化',
  ControversyAnalysis: '分析主要争议',
  ResearchGapAnalysis: '梳理研究不足',
  ReviewDraft: '撰写完整综述',
  ReviewFallback: '根据已验证事实整理综述',
  ResearchReviewer: '复核证据逻辑',
  CitationValidator: '验证真实引用',
}
const progressLabel = computed(() => {
  if (running.value) return nodeLabels[currentNode.value] ?? '正在启动溯知'
  if (run.value?.status === 'SUCCESS') return '综述完成'
  if (run.value?.status === 'FAILED') return '综述失败'
  return '等待开始'
})
const {
  panelStyle: suzhiPanelStyle,
  resizeHistoryPanel,
  resizeEvidencePanel,
} = useResizableResearchPanels({
  body: suzhiBody,
  cssPrefix: 'suzhi',
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

/** 并行加载当前用户可见研究范围和最近一页溯知历史。 */
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
    ElMessage.error(errorMessage(error, '加载更多溯知历史失败'))
  }
}

/**
 * 创建专业任务；共用运行状态负责立即选中、保存路由和跟踪终态。
 */
async function submit(): Promise<void> {
  if (!knowledgeBaseId.value || !researchTopic.value.trim() || running.value) return
  const payload = {
    request_id: createClientUuid(),
    knowledge_base_id: knowledgeBaseId.value,
    research_topic: researchTopic.value.trim(),
  }
  await startRun(() => createSuzhiRun(payload, source))
}

/** 删除一条终态溯知 Run 及其精确关联消息。 */
async function removeHistory(item: AgentRunHistoryItem): Promise<void> {
  try {
    await ElMessageBox.confirm(`将删除“${item.query}”及其运行证据。`, '删除溯知任务', {
      confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning',
    })
    deletingId.value = item.id
    await deleteAgentRun(item.id)
    if (selectedRunId.value === item.id) {
      resetRun()
      await router.replace(`${rootPath}/suzhi`)
    }
    history.value = history.value.filter((historyItem) => historyItem.id !== item.id)
    try {
      await refreshHistory()
    } catch {
      ElMessage.warning('任务已删除，但历史列表刷新失败，请稍后刷新页面')
      return
    }
    ElMessage.success('溯知任务已删除')
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

/** 返回结构化结论区块的数据映射。 */
function findings(kind: string): CitedReviewFinding[] {
  if (!result.value) return []
  const sections: Record<string, CitedReviewFinding[]> = {
    topics: result.value.topics,
    theory: result.value.theoretical_paths,
    methods: result.value.methods,
    controversies: result.value.controversies,
    future: result.value.future_directions,
  }
  return sections[kind] ?? []
}

/** 原位规范历史结果的 Citation，并删除旧版本追加的重复段末汇总。 */
function normalizeCitationText(text: string): string {
  const normalized = text
    .replace(/【\s*(\d+)\s*】/g, '[$1]')
    .replace(/［\s*(\d+)\s*］/g, '[$1]')
    .replace(
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

/** 使用已验证的结构化 Citation 编号生成与智鉴一致的句末引用。 */
function citedText(text: string, citationIds: number[]): string {
  const cleaned = normalizeCitationText(text).trim()
  if (/\[\d+]/.test(cleaned)) return cleaned
  const markers = [...new Set(citationIds)]
    .filter((citationId) => Number.isInteger(citationId) && citationId > 0)
    .map((citationId) => `[${citationId}]`)
    .join('')
  if (!markers) return cleaned
  const punctuation = cleaned.match(/([。！？.!?])$/)?.[1]
  return punctuation
    ? `${cleaned.slice(0, -punctuation.length)}${markers}${punctuation}`
    : `${cleaned}${markers}`
}

/** 兼容展示升级前已经持久化的溯知综述。 */
function reviewText(text: string): string {
  return normalizeCitationText(text)
}

onMounted(async () => {
  try {
    await loadWorkspace()
    if (typeof route.params.runId === 'string') await loadRun(route.params.runId, false)
  } catch (error) {
    ElMessage.error(errorMessage(error, '溯知工作台加载失败'))
  } finally {
    loading.value = false
  }
})

</script>

<template>
  <section class="suzhi-workspace">
    <ResearchCommandHeader
      title="溯知·文献综述"
      subtitle="EVIDENCE-FIRST LITERATURE REVIEW"
      accent="#197568"
      :status-active="running"
      :status-label="progressLabel"
    >
      <template #icon><el-icon><Reading /></el-icon></template>
      <template #knowledge>
        <ResearchScopeSelect v-model="knowledgeBaseId" :options="knowledgeBases" :disabled="running || Boolean(selectedRunId)" />
      </template>
      <template #primary>
        <div class="topic-input"><input v-model="researchTopic" :disabled="running" maxlength="500" aria-label="研究主题"><button type="button" :disabled="running || !knowledgeBaseId || !researchTopic.trim()" @click="submit"><el-icon><Promotion /></el-icon>{{ running ? '综述中' : '开始溯知' }}</button></div>
      </template>
    </ResearchCommandHeader>

    <div
      ref="suzhiBody"
      v-loading="loading"
      class="suzhi-body"
      :class="{
        'history-hidden': !researchWorkspace.historyVisible,
        'evidence-hidden': !evidenceVisible,
      }"
      :style="suzhiPanelStyle"
    >
      <aside
        class="control-rail"
        :class="{ collapsed: !researchWorkspace.historyVisible }"
        @scroll.passive="handleHistoryScroll"
      >
        <HistoryPanelHeader
          :collapsed="!researchWorkspace.historyVisible"
          title="历史会话"
          @toggle="researchWorkspace.toggleHistory"
        />
        <template v-if="researchWorkspace.historyVisible">
        <el-button
          class="rail-new-btn"
          :disabled="running"
          @click="router.push(`${rootPath}/suzhi`)"
        >新建任务</el-button>
        <section class="history">
          <el-tooltip
            v-for="item in history"
            :key="item.id"
            :content="item.query"
            :disabled="true"
            placement="top"
            :show-after="250"
            popper-class="research-history-question-tooltip"
          >
            <article
              :class="{ active: item.id === selectedRunId }"
              :title="item.query"
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
        class="suzhi-history-resizer"
        label="调整溯知研究范围与历史栏宽度"
        @resize="resizeHistoryPanel"
      />

      <main v-loading="!loading && (running || runLoading)" class="result-pane">
        <div v-if="run?.status === 'FAILED'" class="boundary"><h2>本次综述未完成</h2><p>{{ run.error_message }}</p><p v-if="failedStep">失败节点：{{ nodeLabels[failedStep.node_name] ?? failedStep.node_name }}。{{ failedStep.error_message }}</p></div>
        <div v-else-if="!result" v-show="!runLoading" class="empty research-workspace-empty"><el-icon><Reading /></el-icon><h2>从一个研究主题开始</h2><p>溯知将先检索真实文献，再整理主题溯源和研究不足。</p></div>
        <template v-else>
          <nav><button v-for="tab in [['overview','总览'],['themes','主题与方法'],['gaps','争议与不足'],['review','完整综述'],['references','参考文献']]" :key="tab[0]" type="button" :class="{ active: activeTab === tab[0] }" @click="activeTab = tab[0]">{{ tab[1] }}</button></nav>
          <article v-if="activeTab === 'overview'" class="prose">
            <ReturnToQimingButton :conversation-id="run?.conversation_id" :run-id="run?.id" />
            <p class="eyebrow">{{ result.concept }}</p><h2>概念定义</h2><p>{{ citedText(result.concept_definition, result.concept_citation_ids) }}</p>
            <SuzhiProvenanceGraph :graph="result.provenance_graph ?? null" @citation="openCitationById" />
          </article>
          <article v-else-if="activeTab === 'themes'" class="prose"><template v-for="section in [['topics','核心主题'],['theory','理论路径'],['methods','研究方法变化']]" :key="section[0]"><h2>{{ section[1] }}</h2><ol class="cards"><li v-for="item in findings(section[0])" :key="item.title"><strong>{{ item.title }}</strong><p>{{ citedText(item.summary, item.citation_ids) }}</p></li></ol></template></article>
          <article v-else-if="activeTab === 'gaps'" class="prose"><h2>主要争议</h2><ol class="cards"><li v-for="item in result.controversies" :key="item.title"><strong>{{ item.title }}</strong><p>{{ citedText(item.summary, item.citation_ids) }}</p></li></ol><h2>研究不足</h2><ol class="cards gaps"><li v-for="item in result.research_gaps" :key="item.gap"><strong>{{ item.gap }}</strong><p>{{ citedText(item.evidence_logic, item.citation_ids) }}</p></li></ol><h2>未来方向</h2><ol class="cards"><li v-for="item in result.future_directions" :key="item.title"><strong>{{ item.title }}</strong><p>{{ citedText(item.summary, item.citation_ids) }}</p></li></ol></article>
          <SuzhiReviewReader v-else-if="activeTab === 'review'" :title="result.research_topic" :content="reviewText(result.review)" />
          <article v-else class="reference-pane">
            <ol v-if="referenceDocuments.length" class="reference-cards"><li v-for="item in referenceDocuments" :key="item.citationId"><button class="document-card-button" type="button" @click="openCitationById(item.citationId, 'document')">{{ item.title }}</button></li></ol>
            <p v-else class="reference-empty">本次运行尚未形成可验证的参考文献。</p>
          </article>
        </template>
      </main>

      <PaneResizeHandle
        v-if="evidenceVisible"
        class="suzhi-evidence-resizer"
        label="调整溯知证据引用栏宽度"
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
.suzhi-workspace { width: 100%; max-width: 100%; height: calc(100vh - var(--header-height)); min-width: 0; min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); overflow: hidden; container-type: inline-size; background: #f5f7f8; }
.topic-input { display: grid; grid-template-columns: minmax(0,1fr) 110px; }.topic-input input { box-sizing: border-box; min-width: 0; height: 46px; padding: 11px 12px; border: 1px solid #bfcfcd; outline: 0; }.topic-input button { height: 46px; display: flex; align-items: center; justify-content: center; gap: 6px; border: 0; background: #197568; color: #fff; cursor: pointer; font-size: 12px; font-weight: 700; }.topic-input button:disabled { opacity: .5; cursor: not-allowed; }
.suzhi-body { width: 100%; max-width: 100%; min-width: 0; min-height: 0; display: grid; grid-template-columns: var(--suzhi-history-width, 250px) 8px minmax(0,1fr) 8px var(--suzhi-evidence-width, 340px); overflow: hidden; }
.suzhi-body.history-hidden { grid-template-columns: 44px minmax(0,1fr) 8px var(--suzhi-evidence-width, 340px); }
.suzhi-body.evidence-hidden { grid-template-columns: var(--suzhi-history-width, 250px) 8px minmax(0,1fr) 44px; }
.suzhi-body.history-hidden.evidence-hidden { grid-template-columns: 44px minmax(0,1fr) 44px; }
.control-rail { min-height: 0; padding: 18px 16px; border-right: 1px solid #d9e1e4; overflow-y: auto; }.history { margin: 0; }.history { margin: 0; display: grid; gap: 8px; }
.history article { position: relative; margin-bottom: 0; border: 1px solid #d6dfde; background: #fff; }.history article.active { border-color: #197568; box-shadow: inset 3px 0 #197568; }.history article > button:first-child { width: 100%; padding: 11px 34px 11px 12px; border: 0; background: transparent; text-align: left; cursor: pointer; }.history strong,.history span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.history strong { color: #294643; font-size: 13px; font-weight: 600; line-height: 1.45; }.history span { margin-top: 5px; color: #7d8e8c; font-size: 11.5px; line-height: 1.5; }.delete { position: absolute; top: 5px; right: 4px; width: 25px; height: 25px; border: 0; background: transparent; color: #8d9998; cursor: pointer; }
.history article.unavailable { background: #f7f8fa; }
.history article.unavailable > button:first-child { cursor: not-allowed; opacity: .68; }
.control-rail.collapsed { padding: 0; overflow: hidden; }
.result-pane { min-width: 0; min-height: 0; overflow-y: auto; background: #fff; }.result-pane > nav { position: sticky; top: 0; z-index: 2; display: flex; border-bottom: 1px solid #d9e1e4; background: #fff; overflow-x: auto; }.result-pane > nav button { min-width: 105px; height: 50px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: #647a77; cursor: pointer; font-size: 10px; }.result-pane > nav button.active { border-color: #197568; color: #197568; font-weight: 700; }.empty { color: #7b8f8c; }.empty h2 { color: #294643; }.boundary { margin: 30px; padding: 20px; border: 1px solid #ead8b5; background: #fffaf0; color: #765820; }.boundary h2 { margin-top: 0; }.boundary p { font-size: 11px; line-height: 1.8; }.prose,.review { max-width: 920px; margin: 0 auto; padding: 30px 34px 60px; color: #344e4b; }.prose h2,.review > h2 { margin: 26px 0 12px; color: #173b3a; font: 600 19px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; }.prose > p { font-size: 12px; line-height: 2; }.review-markdown { font-size: 12px; line-height: 2; }.eyebrow { color: #197568; font-weight: 700; letter-spacing: .08em; }.prose b { color: #197568; }.cards,.references { margin: 0; padding: 0; list-style: none; }.cards li { margin-bottom: 10px; padding: 14px 16px; border-left: 3px solid #197568; background: #f5f8f7; }.cards strong { color: #294643; font-size: 12px; }.cards p { margin: 7px 0 0; font-size: 11px; line-height: 1.8; }.gaps li { border-left-color: #b57b27; background: #fffaf0; }.references { counter-reset: refs; }.references li { margin-bottom: 10px; padding-left: 26px; text-indent: -26px; font-size: 11px; line-height: 1.8; counter-increment: refs; }.references li::before { content: '[' counter(refs) '] '; color: #197568; font-weight: 700; }
.reference-pane { min-height: 240px; }
.reference-cards { margin: 0; padding: 24px 34px 48px; list-style: none; }
.reference-cards li { margin-bottom: 12px; padding: 0; border-left: 3px solid #197568; background: #f5f8f7; }
.document-card-button { width: 100%; padding: 15px 16px; border: 0; background: transparent; color: #294643; cursor: pointer; font-family: inherit; font-size: 12px; font-weight: 700; line-height: 1.8; text-align: left; }
.document-card-button:hover,.document-card-button:focus-visible { background: #eaf3f1; outline: 2px solid #197568; outline-offset: -2px; }
.reference-empty { margin: 24px 34px; padding: 34px 22px; border: 1px dashed #c9d9d6; background: #f5f8f7; color: #758985; font-size: 11px; text-align: center; }
@container (max-width: 1120px) { .suzhi-body { grid-template-columns: min(var(--suzhi-history-width, 250px), 23%) 8px minmax(0,1fr) 8px min(var(--suzhi-evidence-width, 340px), 32%); }.suzhi-body.history-hidden { grid-template-columns: 44px minmax(0,1fr) 8px min(var(--suzhi-evidence-width, 340px), 36%); }.suzhi-body.evidence-hidden { grid-template-columns: min(var(--suzhi-history-width, 250px), 25%) 8px minmax(0,1fr) 44px; }.suzhi-body.history-hidden.evidence-hidden { grid-template-columns: 44px minmax(0,1fr) 44px; } }
@media (max-width: 760px) { .suzhi-workspace { height: auto; overflow: visible; }.topic-input { grid-template-columns: minmax(0, 1fr); width: 100%; }.topic-input input,.topic-input button { height: 42px; }.suzhi-body { display: block; overflow: visible; }.suzhi-history-resizer,.suzhi-evidence-resizer { display: none; }.desktop-evidence { min-height: 520px; border-top: 1px solid #d9e1e4; border-left: 0; }.desktop-evidence.collapsed { min-height: 44px; height: 44px; }.result-pane { min-height: 520px; overflow: visible; }.prose,.review { padding: 22px 18px 45px; } }
</style>
