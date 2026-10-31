<!--
  智鉴 Evidence 面板：按当前 Run 的 A/B/SHARED 语义归属筛选真实文献片段，
  标记历史来源删除状态，并把仍有效的 Citation 交给鉴权 PDF 阅读器打开原始页码。
-->
<script setup lang="ts">
import { Link } from '@element-plus/icons-vue'
import { computed, ref } from 'vue'

import EvidencePanelHeader from '@/research/components/common/EvidencePanelHeader.vue'
import type { AgentEvidenceItem } from '@/research/types/agents'

const props = defineProps<{
  items: AgentEvidenceItem[]
  loading: boolean
  /** 当前 Run 的结果尚未就绪时隐藏证据，避免比主结果提前显示。 */
  pending?: boolean
  collapsed?: boolean
}>()

const emit = defineEmits<{
  openCitation: [item: AgentEvidenceItem]
  toggle: []
}>()

type EvidenceFilter = 'ALL' | 'A' | 'B' | 'SHARED'
const activeFilter = ref<EvidenceFilter>('ALL')

const filteredItems = computed(() => (
  activeFilter.value === 'ALL'
    ? props.items
    : props.items.filter((item) => item.assignment === activeFilter.value)
))

/** 返回当前筛选分组中的真实证据数量。 */
function countFor(filter: EvidenceFilter): number {
  return filter === 'ALL'
    ? props.items.length
    : props.items.filter((item) => item.assignment === filter).length
}

/** 输出 Citation 的单页或跨页范围。 */
function pageLabel(item: AgentEvidenceItem): string {
  const { page_start: start, page_end: end } = item.citation
  return start === end ? `第 ${start} 页` : `第 ${start}–${end} 页`
}

/** 把当前检索内的重排分数格式化为百分数，不将其表述为概率。 */
function scoreLabel(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '暂无'
  return `${Math.round(value * 100)}%`
}

/** 将智鉴的证据相关等级转换为面向用户的中文标签。 */
function relevanceLabel(value: AgentEvidenceItem['relevance']): string {
  if (!value) return '未标注'
  return ({ HIGH: '高', MEDIUM: '中', LOW: '低' })[value]
}
</script>

<template>
  <aside class="zhijian-evidence" :class="{ collapsed }" aria-label="Evidence Panel">
    <EvidencePanelHeader :collapsed="collapsed" @toggle="emit('toggle')" />
    <nav v-if="!collapsed && !pending" aria-label="Evidence 分组">
      <button
        v-for="filter in (['ALL', 'A', 'B', 'SHARED'] as EvidenceFilter[])"
        :key="filter"
        type="button"
        :class="{ active: activeFilter === filter }"
        @click="activeFilter = filter"
      >
        {{ filter }} <span>{{ countFor(filter) }}</span>
      </button>
    </nav>
    <div v-if="!collapsed && !pending" v-loading="loading" class="zhijian-evidence-list">
      <el-empty v-if="!filteredItems.length && !loading" description="当前分组暂无证据" />
      <article
        v-for="item in filteredItems"
        :key="item.evidence.chunk_id"
        :class="{ 'source-deleted': item.source_deleted }"
      >
        <div class="evidence-label-row">
          <span :class="`assignment-${item.assignment?.toLowerCase()}`">{{ item.assignment }}</span>
          <small>[{{ item.citation.citation_index }}]</small>
        </div>
        <h3>{{ item.evidence.document_title }}</h3>
        <p v-if="item.source_deleted" class="source-deleted-notice">
          来源文献已删除，历史引用摘录仅供审计
        </p>
        <p>{{ item.citation.quote }}</p>
        <dl class="evidence-metadata">
          <div>
            <dt>定位</dt>
            <dd>{{ pageLabel(item) }}</dd>
          </div>
          <div>
            <dt>相关性</dt>
            <dd class="relevance-score">{{ scoreLabel(item.evidence.relevance_score) }}</dd>
          </div>
          <div>
            <dt>归属相关度</dt>
            <dd>{{ relevanceLabel(item.relevance) }}</dd>
          </div>
          <div>
            <dt>语言</dt>
            <dd>{{ item.evidence.language_code.toUpperCase() }}</dd>
          </div>
        </dl>
        <footer>
          <button type="button" :disabled="item.source_deleted" @click="emit('openCitation', item)">
            <el-icon><Link /></el-icon>{{ item.source_deleted ? '原文已不可用' : '打开原文定位' }}
          </button>
        </footer>
      </article>
    </div>
  </aside>
</template>

<style scoped>
.zhijian-evidence { min-width: 0; min-height: 0; display: grid; grid-template-rows: auto auto minmax(0, 1fr); border-left: 1px solid #d8e1ea; background: #fff; overflow: hidden; }
.zhijian-evidence.collapsed { grid-template-rows: minmax(0, 1fr); }
.zhijian-evidence nav { display: grid; grid-template-columns: repeat(4, 1fr); padding: 10px 12px; border-bottom: 1px solid #d8e1ea; }
.zhijian-evidence nav button { height: 32px; border: 1px solid #d8e1ea; border-right: 0; background: #fff; color: #52677e; cursor: pointer; font-size: 10px; }
.zhijian-evidence nav button:last-child { border-right: 1px solid #d8e1ea; }
.zhijian-evidence nav button.active { border-color: #005767; background: #eef5f6; color: #005767; font-weight: 700; }
.zhijian-evidence nav span { margin-left: 2px; color: #8b99aa; }
.zhijian-evidence-list { min-height: 0; overflow-y: auto; padding: 12px; }
.zhijian-evidence article { margin-bottom: 10px; padding: 13px; border: 1px solid #d8e1ea; border-left: 3px solid #005767; }
.zhijian-evidence article.source-deleted { border-color: #e5c7a3; background: #fffaf3; }
.evidence-label-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.evidence-label-row span { padding: 3px 6px; background: #eef5f6; color: #005767; font-size: 9px; font-weight: 800; }
.evidence-label-row .assignment-shared { background: #eef9f8; color: #147d73; }
.evidence-label-row small { color: #8493a5; font-size: 9px; }
.zhijian-evidence h3 { margin: 10px 0 7px; color: #102a43; font-size: 12px; line-height: 1.5; }
.zhijian-evidence article p { display: -webkit-box; margin: 0; overflow: hidden; color: #52677e; font-size: 10px; line-height: 1.7; -webkit-box-orient: vertical; -webkit-line-clamp: 5; }
.zhijian-evidence article .source-deleted-notice { display: block; margin: 0 0 8px; color: #a05a14; font-weight: 700; }
.evidence-metadata { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px 12px; margin: 11px 0 0; padding-top: 9px; border-top: 1px solid #edf1f5; }
.evidence-metadata div { display: flex; align-items: baseline; gap: 5px; min-width: 0; }
.evidence-metadata dt { flex: none; color: #8493a5; font-size: 9px; }
.evidence-metadata dd { min-width: 0; margin: 0; overflow: hidden; color: #52677e; font-size: 9px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.evidence-metadata .relevance-score { color: #147d73; }
.zhijian-evidence article footer { display: flex; justify-content: flex-end; margin-top: 10px; }
.zhijian-evidence article footer button { display: inline-flex; align-items: center; gap: 4px; padding: 0; border: 0; background: transparent; color: #005767; cursor: pointer; font-size: 10px; }
</style>
