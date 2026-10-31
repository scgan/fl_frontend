<!--
  智鉴专业工作台：提供一句话比较入口、真实 LangGraph 进度、结构化比较结果、
  动态矩阵、A/B 论文数量、双轨时间轴与 A/B/SHARED 原文面板。
-->
<script setup lang="ts">
import axios from 'axios'
import { DataAnalysis, Delete, Promotion } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  createZhijianRun,
  deleteAgentRun,
} from '@/research/api/agents'
import { fetchKnowledgeBases } from '@/research/api/knowledge-bases'
import HistoryPanelHeader from '@/research/components/common/HistoryPanelHeader.vue'
import PaneResizeHandle from '@/research/components/common/PaneResizeHandle.vue'
import ResearchCommandHeader from '@/research/components/common/ResearchCommandHeader.vue'
import ReturnToQimingButton from '@/research/components/common/ReturnToQimingButton.vue'
import CitationPdfViewer from '@/research/components/qiming/CitationPdfViewer.vue'
import ZhijianEvidencePanel from '@/research/components/zhijian/ZhijianEvidencePanel.vue'
import ZhijianResearchVisuals from '@/research/components/zhijian/ZhijianResearchVisuals.vue'
import { useProfessionalRun } from '@/research/composables/useProfessionalRun'
import { usePaginatedAgentHistory } from '@/research/composables/usePaginatedAgentHistory'
import { useResizableResearchPanels } from '@/research/composables/useResizableResearchPanels'
import { useResearchWorkspaceStore } from '@/research/stores/research-workspace'
import type { ApiErrorPayload } from '@/research/types/api'
import type { AgentEvidenceItem, AgentRunHistoryItem } from '@/research/types/agents'
import type { KnowledgeBaseRecord } from '@/research/types/knowledge-bases'
import { createClientUuid } from '@/research/utils/client-id'
import { useResearchSource } from '@/research/composables/useResearchSource'
import ResearchScopeSelect from '@/research/components/common/ResearchScopeSelect.vue'

const { source, rootPath, resourceLabel, databaseId, initialDatabaseId } = useResearchSource()
const knowledgeBases = ref<KnowledgeBaseRecord[]>([])
const {
  items: historyItems,
  loading: historyLoading,
  refresh: loadHistory,
  loadMore: loadMoreHistory,
} = usePaginatedAgentHistory('ZHIJIAN')
const workspaceLoading = ref(true)
const deletingRunId = ref('')
const knowledgeBaseId = ref('')
const query = ref('')
const activeTab = ref('overview')
const selectedCitation = ref<AgentEvidenceItem | null>(null)
const pdfVisible = ref(false)
const pdfMode = ref<'citation' | 'document'>('citation')
const zhijianBody = ref<HTMLElement | null>(null)
const evidenceVisible = ref(true)
const route = useRoute()
const router = useRouter()
const researchWorkspace = useResearchWorkspaceStore()

const {
  selectedRunId, run, evidence, steps, running, runLoading, evidencePending,
  loadRun: loadHistoricalRun, startRun, reset: resetRun,
} = useProfessionalRun({
  executor: 'ZHIJIAN',
  history: historyItems,
  refreshHistory: loadHistory,
  onLoaded: (detail) => {
    knowledgeBaseId.value = detail.knowledge_base_id
    const item = historyItems.value.find((candidate) => candidate.id === detail.id)
    if (item) query.value = item.query
    activeTab.value = 'overview'
  },
  onFinished: (detail) => {
    if (detail.zhijian_result?.status === 'NEEDS_CLARIFICATION') {
      ElMessage.warning(detail.zhijian_result.clarification_question ?? '请补充比较对象')
    }
  },
  onError: (error) => ElMessage.error(requestErrorMessage(error, '运行详情或进度读取失败')),
})

const result = computed(() => run.value?.zhijian_result ?? null)
const balance = computed(() => result.value?.evidence_balance ?? null)
const failedStep = computed(() => [...steps.value].reverse().find((item) => item.status === 'FAILED') ?? null)
const {
  panelStyle: zhijianPanelStyle,
  resizeHistoryPanel,
  resizeEvidencePanel,
} = useResizableResearchPanels({
  body: zhijianBody,
  cssPrefix: 'zhijian',
  historyDefault: 250,
  evidenceDefault: 340,
  contentMinimum: 500,
  isHistoryVisible: () => researchWorkspace.historyVisible,
  isEvidenceVisible: () => evidenceVisible.value,
})

/** 从统一错误信封读取后端删除原因，网络错误则返回安全兜底提示。 */
function requestErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiErrorPayload>(error)) {
    return error.response?.data.message ?? fallback
  }
  return error instanceof Error ? error.message : fallback
}

const stageLabel = computed(() => {
  if (!running.value) {
    if (run.value?.status === 'SUCCESS') return '分析完成'
    if (run.value?.status === 'FAILED') return '分析失败'
    return '等待开始'
  }
  const latest = steps.value[steps.value.length - 1]?.node_name
  const labels: Record<string, string> = {
    ParseCompareRequest: '正在理解比较任务',
    NormalizeCompareObjects: '正在规范化比较对象',
    ValidateCompareRequest: '正在规范化并校验比较请求',
    GenerateCompareDimensions: '正在规划比较维度',
    BuildCompareQueries: '正在构造双侧检索查询',
    RetrieveObjectA: '正在检索证据',
    RetrieveObjectB: '正在检索证据',
    MergeCandidates: '正在合并候选证据',
    EvidenceAssignment: '正在判断候选证据归属',
    EvidenceBalanceCheck: '正在检查双侧证据充分性',
    CrossAnalysis: '正在进行交叉分析',
    CompareAnalysisValidation: '正在核对共同点与差异点引用',
    MatrixGenerator: '正在构建对比矩阵',
    ResearchReviewer: '正在复核研究结论',
    CitationValidator: '正在验证引用',
  }
  return labels[latest ?? ''] ?? '正在启动智鉴'
})

/** 加载当前用户可访问的研究范围，并默认选择全库。 */
async function loadKnowledgeBases(): Promise<void> {
  try {
    const data = await fetchKnowledgeBases({ page: 1, page_size: Number.MAX_SAFE_INTEGER }, source, databaseId)
    knowledgeBases.value = data.items
    knowledgeBaseId.value ||= data.items.find((item) => item.id === initialDatabaseId)?.id ?? data.items[0]?.id ?? ''
  } catch {
    ElMessage.error(`${resourceLabel}加载失败`)
  }
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
    ElMessage.error(requestErrorMessage(error, '加载更多智鉴历史失败'))
  }
}

/** 清空当前比较结果，返回可提交新任务的智鉴初始状态。 */
function resetCurrentComparison(): void {
  resetRun()
  selectedCitation.value = null
  pdfVisible.value = false
  activeTab.value = 'overview'
}

/** 确认后软删除单次智鉴 Run，只从历史中移除该任务。 */
async function confirmDeleteHistory(item: AgentRunHistoryItem): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `将删除“${item.query}”这一次分析及其运行过程。`,
      '删除智鉴任务',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    )
    deletingRunId.value = item.id
    await deleteAgentRun(item.id)
    historyItems.value = historyItems.value.filter((history) => history.id !== item.id)
    if (selectedRunId.value === item.id) {
      resetCurrentComparison()
      if (route.path !== `${rootPath}/zhijian`) await router.replace(`${rootPath}/zhijian`)
    }
    try {
      await loadHistory()
    } catch {
      ElMessage.warning('任务已删除，但历史列表刷新失败，请稍后刷新页面')
      return
    }
    ElMessage.success('智鉴任务已删除')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(requestErrorMessage(error, '删除智鉴任务失败'))
    }
  } finally {
    deletingRunId.value = ''
  }
}

/**
 * 格式化历史运行时间。
 *
 * @param value ISO 时间字符串。
 * @returns 历史栏使用的月日时分。
 */
function formatHistoryDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

/**
 * 创建专业任务；共用运行状态负责立即选中、保存路由和跟踪终态。
 */
async function submit(): Promise<void> {
  if (!knowledgeBaseId.value || !query.value.trim() || running.value) return
  const payload = {
    request_id: createClientUuid(),
    knowledge_base_id: knowledgeBaseId.value,
    query: query.value.trim(),
  }
  await startRun(() => createZhijianRun(payload, source))
}

/** 根据详情路由恢复历史，供启明摘要按钮和刷新页面共同复用。 */
async function restoreRouteRun(): Promise<void> {
  const id = typeof route.params.runId === 'string' ? route.params.runId : ''
  if (!id || id === run.value?.id) return
  try {
    await loadHistoricalRun(id, false)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '智鉴历史恢复失败')
  }
}

/** 打开复用的鉴权 PDF.js Citation 阅读器。 */
function openCitation(item: AgentEvidenceItem): void {
  pdfMode.value = 'citation'
  selectedCitation.value = item
  pdfVisible.value = true
}

/** 依据参考文献 Citation 打开对应的鉴权 PDF，历史异常数据缺失映射时给出明确提示。 */
function openReference(citationId: number): void {
  const item = evidence.value.find(
    (candidate) => candidate.citation.citation_index === citationId,
  )
  if (item) {
    pdfMode.value = 'document'
    selectedCitation.value = item
    pdfVisible.value = true
    return
  }
  ElMessage.warning(`未找到 Evidence [${citationId}]`)
}


onMounted(async () => {
  try {
    await Promise.all([loadKnowledgeBases(), loadHistory()])
    await restoreRouteRun()
  } catch {
    ElMessage.error('智鉴工作台加载失败')
  } finally {
    workspaceLoading.value = false
  }
})
</script>

<template>
  <section class="zhijian-workspace">
    <ResearchCommandHeader
      title="智鉴·比对分析"
      subtitle="一句话发起 Evidence First 专业比较"
      :status-active="running"
      :status-label="stageLabel"
    >
      <template #icon><el-icon><DataAnalysis /></el-icon></template>
      <template #knowledge>
        <ResearchScopeSelect v-model="knowledgeBaseId" :options="knowledgeBases" :disabled="running || Boolean(selectedRunId)" />
      </template>
      <template #primary>
        <div class="zhijian-query">
          <input v-model="query" :disabled="running" maxlength="4000" aria-label="自然语言比较请求" @keydown.enter.prevent="submit">
          <button type="button" :disabled="running || !query.trim() || !knowledgeBaseId" @click="submit">
            <el-icon><Promotion /></el-icon>{{ running ? '分析中' : '开始智鉴' }}
          </button>
        </div>
      </template>
    </ResearchCommandHeader>

    <div
      ref="zhijianBody"
      v-loading="workspaceLoading"
      class="zhijian-body"
      :class="{
        'history-hidden': !researchWorkspace.historyVisible,
        'evidence-hidden': !evidenceVisible,
      }"
      :style="zhijianPanelStyle"
    >
      <aside
        class="zhijian-task-rail"
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
          @click="router.push(`${rootPath}/zhijian`)"
        >新建任务</el-button>
        <section class="zhijian-history">
          <el-tooltip
            v-for="item in historyItems"
            :key="item.id"
            :content="item.query"
            :disabled="true"
            placement="top"
            :show-after="250"
            popper-class="research-history-question-tooltip"
          >
            <div
              class="zhijian-history-item" :title="item.query"
              :class="{ active: item.id === selectedRunId }"
            >
              <button
                type="button"
                class="zhijian-history-open"
                @click="loadHistoricalRun(item.id)"
              >
                <strong>{{ item.query }}</strong>
                <span>{{ item.knowledge_base_name ?? `${resourceLabel}已不可访问` }}</span>
                <span>{{ formatHistoryDate(item.created_at) }} · {{ item.status }}</span>
              </button>
              <button
                type="button"
                class="zhijian-history-delete"
                :disabled="deletingRunId === item.id || item.status === 'PENDING' || item.status === 'RUNNING'"
                :aria-label="`删除智鉴任务：${item.query}`"
                @click="confirmDeleteHistory(item)"
              ><el-icon><Delete /></el-icon></button>
            </div>
          </el-tooltip>
          <p v-if="!historyLoading && !historyItems.length">暂无已保存的智鉴分析</p>
          <p
            v-if="historyLoading && historyItems.length"
            class="research-history-load-status"
            role="status"
          >正在加载更多历史…</p>
        </section>
        </template>
      </aside>

      <PaneResizeHandle
        v-if="researchWorkspace.historyVisible"
        class="zhijian-history-resizer"
        label="调整智鉴历史栏宽度"
        @resize="resizeHistoryPanel"
      />

      <main v-loading="!workspaceLoading && (running || runLoading)" class="zhijian-result">
        <div v-if="run?.status === 'FAILED'" class="result-boundary" role="alert">
          <h2>本次分析未完成</h2>
          <p>{{ run.error_message ?? '智鉴运行失败，请稍后重试。' }}</p>
          <p v-if="failedStep">
            失败节点：{{ failedStep.node_name }}。{{ failedStep.error_message }}
          </p>
        </div>
        <div v-else-if="!result" v-show="!runLoading" class="zhijian-empty research-workspace-empty">
          <el-icon><DataAnalysis /></el-icon>
          <h2>输入一句自然语言比较请求</h2>
          <p>对象、时间、来源语言和比较维度会由系统自动理解；只有关键歧义才会追问。</p>
        </div>
        <template v-else>
          <div v-if="result.status !== 'SUCCESS'" class="result-boundary">
            <h2>{{ result.status === 'INSUFFICIENT_EVIDENCE' ? '证据不足' : '需要补充信息' }}</h2>
            <p>{{ result.summary }}</p>
          </div>
          <template v-else>
            <nav class="result-tabs" aria-label="智鉴结果栏目">
              <button v-for="tab in [
                ['overview', '总览'], ['matrix', '对比矩阵'], ['similarities', '共同点'],
                ['differences', '差异点'], ['timeline', '双轨时间线'], ['topics', '研究热点'],
                ['references', '参考文献'],
              ]" :key="tab[0]" type="button" :class="{ active: activeTab === tab[0] }" @click="activeTab = tab[0]">{{ tab[1] }}</button>
            </nav>
            <article v-if="activeTab === 'overview'" class="result-prose">
              <ReturnToQimingButton :conversation-id="run?.conversation_id" :run-id="run?.id" />
              <h2>总体结论</h2><p>{{ result.summary }}</p>
              <div class="object-summaries"><section><h3>{{ result.object_a?.canonical_name }}</h3><p>{{ result.object_a_summary }}</p></section><section><h3>{{ result.object_b?.canonical_name }}</h3><p>{{ result.object_b_summary }}</p></section></div>
              <h2>研究证据概览</h2>
              <p>共引用 {{ evidence.length }} 个 Chunk，来自 {{ balance?.source_diversity ?? 0 }} 篇文献；年份覆盖 {{ balance?.year_coverage.join('–') || '未识别' }}。</p>
              <ZhijianResearchVisuals
                :object-a="result.object_a?.canonical_name ?? '对象 A'"
                :object-b="result.object_b?.canonical_name ?? '对象 B'"
                :object-a-documents="balance?.object_a_document_count ?? 0"
                :object-b-documents="balance?.object_b_document_count ?? 0"
                :timeline="result.timeline"
              />
            </article>
            <div v-else-if="activeTab === 'matrix'" class="matrix-wrap">
              <table><thead><tr><th>维度</th><th>{{ result.object_a?.canonical_name }}</th><th>{{ result.object_b?.canonical_name }}</th><th>异同</th></tr></thead><tbody><tr v-for="row in result.comparison_matrix" :key="row.dimension"><th>{{ row.dimension }}</th><td>{{ row.object_a }}</td><td>{{ row.object_b }}</td><td><strong>同：</strong>{{ row.similarity }}<br><strong>异：</strong>{{ row.difference }}</td></tr></tbody></table>
            </div>
            <ol v-else-if="activeTab === 'similarities'" class="finding-list"><li v-for="item in result.similarities" :key="item.text"><p>{{ item.text }}</p></li></ol>
            <ol v-else-if="activeTab === 'differences'" class="finding-list"><li v-for="item in result.differences" :key="item.text"><p>{{ item.text }}</p></li></ol>
            <div v-else-if="activeTab === 'timeline'" class="timeline-tab">
              <ZhijianResearchVisuals
                :object-a="result.object_a?.canonical_name ?? '对象 A'"
                :object-b="result.object_b?.canonical_name ?? '对象 B'"
                :object-a-documents="balance?.object_a_document_count ?? 0"
                :object-b-documents="balance?.object_b_document_count ?? 0"
                :timeline="result.timeline"
                :show-paper-counts="false"
              />
            </div>
            <div v-else-if="activeTab === 'topics'" class="topic-list">
              <article v-for="item in result.topic_distribution" :key="`${item.object}-${item.topic}`"><span>{{ item.object }}</span><h3>{{ item.topic }}</h3><p>{{ item.summary }}</p></article>
              <p v-if="!result.topic_distribution.length" class="section-empty">当前 Evidence 尚不足以归纳可验证的研究热点。</p>
            </div>
            <div v-else class="document-tab">
              <ol v-if="result.references?.length" class="finding-list document-list"><li v-for="item in (result.references ?? [])" :key="item.document_id"><button class="document-card-button" type="button" @click="openReference(item.citation_id)">{{ item.title }}</button></li></ol>
              <p v-else class="section-empty">本次分析尚未引用可展示的参考文献。</p>
            </div>
          </template>
        </template>
      </main>

      <PaneResizeHandle
        v-if="evidenceVisible"
        class="zhijian-evidence-resizer"
        label="调整智鉴证据引用栏宽度"
        @resize="resizeEvidencePanel"
      />
      <ZhijianEvidencePanel
        :items="evidence"
        :loading="false"
        :pending="workspaceLoading || evidencePending"
        :collapsed="!evidenceVisible"
        @toggle="evidenceVisible = !evidenceVisible"
        @open-citation="openCitation"
      />
    </div>
    <CitationPdfViewer v-model="pdfVisible" :item="selectedCitation" :mode="pdfMode" />
  </section>
</template>

<style scoped src="../../components/zhijian/zhijian-result.css"></style>
<style scoped>
.zhijian-workspace { height: calc(100vh - var(--header-height)); min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); overflow: hidden; container-type: inline-size; background: #f7f9fb; }
.zhijian-query { min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr) 110px; }
.zhijian-query input { box-sizing: border-box; min-width: 0; height: 46px; padding: 11px 13px; border: 1px solid #bfcddd; border-right: 0; border-radius: 2px 0 0 2px; outline: 0; color: #20364e; font: 12px/1.6 inherit; }
.zhijian-query input:focus { border-color: #005767; }
.zhijian-query button { min-height: 46px; display: flex; align-items: center; justify-content: center; gap: 6px; border: 1px solid #005767; border-radius: 0 2px 2px 0; background: #005767; color: #fff; cursor: pointer; font-size: 12px; font-weight: 700; }
.zhijian-query button:disabled { cursor: not-allowed; opacity: .5; }
.zhijian-body { width: 100%; max-width: 100%; min-width: 0; min-height: 0; display: grid; grid-template-columns: var(--zhijian-history-width, 250px) 8px minmax(0, 1fr) 8px var(--zhijian-evidence-width, 340px); overflow: hidden; }
.zhijian-body.history-hidden { grid-template-columns: 44px minmax(0, 1fr) 8px var(--zhijian-evidence-width, 340px); }
.zhijian-body.evidence-hidden { grid-template-columns: var(--zhijian-history-width, 250px) 8px minmax(0, 1fr) 44px; }
.zhijian-body.history-hidden.evidence-hidden { grid-template-columns: 44px minmax(0, 1fr) 44px; }
.zhijian-task-rail { min-width: 0; min-height: 0; padding: 18px 16px; border-right: 1px solid #d8e1ea; background: #f3f6f9; overflow-y: auto; }
.zhijian-task-rail.collapsed { padding: 0; overflow: hidden; }
.zhijian-history { margin: 0 !important; padding: 0; border: 0; display: grid; gap: 8px; }
.zhijian-history-item { position: relative; margin-bottom: 0; border: 1px solid #d8e1ea; background: #fff; }
.zhijian-history-item.active { border-color: #005767; box-shadow: inset 3px 0 #005767; }
.zhijian-history-item.unavailable { background: #f7f8fa; }
.zhijian-history-open { width: 100%; padding: 11px 34px 11px 12px; border: 0; background: transparent; color: #52677e; cursor: pointer; text-align: left; }
.zhijian-history-item.unavailable .zhijian-history-open { cursor: not-allowed; opacity: .68; }
.zhijian-history-open strong, .zhijian-history-open span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.zhijian-history-open strong { margin-bottom: 5px; color: #20364e; font-size: 13px; font-weight: 600; line-height: 1.45; }
.zhijian-history-open span { margin-top: 5px; font-size: 11.5px; line-height: 1.5; }
.zhijian-history-delete { position: absolute; top: 6px; right: 5px; width: 25px; height: 25px; display: grid; place-items: center; border: 0; background: transparent; color: #8796a7; cursor: pointer; opacity: .55; }
.zhijian-history-item:hover .zhijian-history-delete, .zhijian-history-delete:focus-visible { opacity: 1; }
.zhijian-history-delete:hover { background: #fff0f0; color: #c43d3d; }
.zhijian-history-delete:disabled { cursor: not-allowed; opacity: .25; }
.zhijian-history > p { color: #7d8da0; font-size: 10px; line-height: 1.6; }
.zhijian-result { min-width: 0; min-height: 0; overflow-y: auto; background: #fff; }
.zhijian-empty { color: #7d8da0; }
.zhijian-empty h2 { color: #20364e; }
.result-boundary { margin: 32px; padding: 22px; border: 1px solid #ead8b5; background: #fffaf0; }
.result-boundary h2 { margin: 0 0 8px; color: #805b20; font-size: 18px; }
.result-boundary p { margin: 0; color: #6d5b3b; font-size: 12px; line-height: 1.8; }
.result-tabs { position: sticky; top: 0; z-index: 2; display: flex; padding: 0 22px; border-bottom: 1px solid #d8e1ea; background: #fff; overflow-x: auto; }
.result-tabs button { min-width: 92px; height: 52px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: #52677e; cursor: pointer; font-size: 11px; }
.result-tabs button.active { border-color: #005767; color: #005767; font-weight: 700; }
@media (max-width: 760px) { .zhijian-workspace { height: auto; min-height: calc(100vh - var(--header-height)); overflow: visible; } .zhijian-body { display: block; overflow: visible; } .zhijian-history-resizer, .zhijian-evidence-resizer { display: none; } .zhijian-result { min-height: 520px; overflow: visible; } .zhijian-evidence { min-height: 520px; border-top: 1px solid #d8e1ea; border-left: 0; } .zhijian-evidence.collapsed { min-height: 44px; height: 44px; } .object-summaries, .topic-list { grid-template-columns: 1fr; } }

/* 中等宽度继续尊重用户的共享历史栏状态，不再因切换模块而自动隐藏左栏。 */
@container (max-width: 1120px) {
  .zhijian-body { grid-template-columns: min(var(--zhijian-history-width, 250px), 23%) 8px minmax(0, 1fr) 8px min(var(--zhijian-evidence-width, 340px), 32%); }
  .zhijian-body.history-hidden { grid-template-columns: 44px minmax(0, 1fr) 8px min(var(--zhijian-evidence-width, 340px), 36%); }
  .zhijian-body.evidence-hidden { grid-template-columns: min(var(--zhijian-history-width, 250px), 25%) 8px minmax(0, 1fr) 44px; }
  .zhijian-body.history-hidden.evidence-hidden { grid-template-columns: 44px minmax(0, 1fr) 44px; }
}

@container (max-width: 720px) {
  .zhijian-body { display: block; overflow: visible; }
  .zhijian-evidence-resizer { display: none; }
}
</style>
