<!-- 呈现 Agent Run 的真实 Evidence、页码、评分、来源删除状态和可打开的 Citation。 -->
<script setup lang="ts">
import { Document, Link } from '@element-plus/icons-vue'

import EvidencePanelHeader from '@/research/components/common/EvidencePanelHeader.vue'
import type { AgentEvidenceItem } from '@/research/types/agents'

defineProps<{
  items: AgentEvidenceItem[]
  loading: boolean
  /** 会话加载或运行期间隐藏证据，避免提前展示尚未完成校验的片段。 */
  pending?: boolean
  /** 启明提供运行/加载进度；其他工作台保持原有 pending 展示。 */
  pendingMessage?: string
  collapsed?: boolean
}>()

const emit = defineEmits<{
  openCitation: [item: AgentEvidenceItem]
  toggle: []
}>()

/** 把 0 到 1 的相关性分数格式化为百分数。 */
function scoreLabel(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '暂无'
  return `${Math.round(value * 100)}%`
}

/** 合并作者名称，兼容解析器尚未识别作者的文献。 */
function authorLabel(authors: Array<{ name?: string }>): string {
  const names = authors.map((author) => author.name?.trim()).filter(Boolean)
  return names.length ? names.join('、') : '作者未识别'
}

/** 输出单页或跨页 Citation 的页码范围。 */
function pageLabel(start: number, end: number): string {
  return start === end ? `第 ${start} 页` : `第 ${start}–${end} 页`
}
</script>

<template>
  <aside class="evidence-panel" :class="{ collapsed }" aria-label="Evidence Panel">
    <EvidencePanelHeader :collapsed="collapsed" @toggle="emit('toggle')" />

    <div v-if="!collapsed && pending && pendingMessage" class="evidence-panel-body" role="status" aria-live="polite">
      <div class="evidence-empty"><p>{{ pendingMessage }}</p></div>
    </div>

    <div v-if="!collapsed && !pending" v-loading="loading" class="evidence-panel-body">
      <div v-if="!items.length && !loading" class="evidence-empty">
        <el-icon><Document /></el-icon>
        <strong>尚无证据</strong>
        <p>运行研究任务后，这里会列出实际检索到的文献片段和页码。</p>
      </div>

      <article
        v-for="item in items"
        :key="item.evidence.chunk_id"
        class="evidence-card"
        :class="{ 'source-deleted': item.source_deleted }"
      >
        <div class="evidence-card-number">{{ item.citation.citation_index }}</div>
        <div class="evidence-card-content">
          <h3>{{ item.evidence.document_title }}</h3>
          <p v-if="item.source_deleted" class="source-deleted-notice">
            来源文献已删除，历史引用摘录仅供审计
          </p>
          <p class="evidence-source">
            {{ authorLabel(item.evidence.authors) }}
            <template v-if="item.evidence.publication_year"> · {{ item.evidence.publication_year }}</template>
          </p>
          <p class="evidence-quote">{{ item.citation.quote }}</p>
          <dl>
            <div><dt>定位</dt><dd>{{ pageLabel(item.citation.page_start, item.citation.page_end) }}</dd></div>
            <div><dt>相关性</dt><dd>{{ scoreLabel(item.evidence.relevance_score) }}</dd></div>
          </dl>
          <button
            type="button"
            class="citation-open"
            :disabled="item.source_deleted"
            @click="emit('openCitation', item)"
          >
            <el-icon><Link /></el-icon>{{ item.source_deleted ? '原文已不可用' : '打开原文定位' }}
          </button>
        </div>
      </article>
    </div>
  </aside>
</template>
