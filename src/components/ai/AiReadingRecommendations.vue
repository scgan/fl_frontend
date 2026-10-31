<!-- 综合分析的真实推荐文献列表：库内文献可阅读和勾选，联网文献提供安全外链；选择不改变原分析范围。 -->
<script setup>
import { computed, ref } from 'vue'
import {
  displayRecommendations,
  recommendationLink,
} from '@/research/utils/literature-recommendations'

const props = defineProps({
  // 直接读取本轮分析保存的推荐结果，不用原阅读材料补齐推荐列表。
  result: { type: Object, required: true },
  // 原分析材料用于去重；推荐不自动进入后续文献追问的证据范围。
  sourceIds: { type: Array, default: () => [] },
  readingId: { type: Number, default: null },
})
const emit = defineEmits(['read', 'ask'])
const selected = ref([])
const items = computed(() => displayRecommendations(
  props.result.recommended_documents || [], props.sourceIds,
))
const emptyMessage = computed(() => {
  if (!props.result.recommendation_status) return '此历史记录尚未生成推荐，可重新分析后查看。'
  return '暂未找到相关的推荐文献。'
})

/** 联网文献没有库内ID，不能交给库内阅读或勾选问答接口。 */
function canSelect(row) {
  return row.origin !== 'WEB' && Number.isInteger(row.corpus_id) && row.corpus_id > 0
}
/** null ID的不同联网推荐分别使用链接作为键，不合并为同一行。 */
function rowKey(row) {
  return canSelect(row) ? `library:${row.corpus_id}` : `web:${row.external_url || row.title}`
}
/** 推荐选择单独保存，不污染父页面原阅读材料的选中状态。 */
function updateSelection(rows) {
  selected.value = rows.filter(canSelect)
}
</script>

<template>
  <section class="reading-recommendations" aria-label="推荐文献">
    <div class="recommendation-heading">
      <h3>推荐文献</h3>
      <span>共 {{ items.length }} 篇</span>
    </div>
    <el-table
      v-if="items.length"
      :data="items"
      :row-key="rowKey"
      :show-header="false"
      @selection-change="updateSelection"
    >
      <el-table-column type="selection" width="40" :selectable="canSelect" reserve-selection />
      <el-table-column type="index" label="序号" width="44" />
      <el-table-column label="推荐文献" min-width="180">
        <template #default="{ row }">
          <a
            v-if="row.origin === 'WEB'"
            class="document-title"
            :href="recommendationLink(row)"
            target="_blank"
            rel="noopener noreferrer"
          >{{ row.title }}<span class="origin-label">联网文献 ↗</span></a>
          <button
            v-else
            type="button"
            class="document-title"
            title="查看推荐文献原文"
            :aria-busy="readingId === row.corpus_id"
            @click="emit('read', row)"
          >{{ row.title }}</button>
          <p class="metadata">{{ [row.author, row.year, row.source].filter(Boolean).join(' · ') }}</p>
          <p v-if="canSelect(row) && readingId === row.corpus_id" class="metadata" role="status">
            正在加载原文…
          </p>
        </template>
      </el-table-column>
    </el-table>
    <p v-else class="recommendation-message">{{ emptyMessage }}</p>
    <div v-if="items.some(canSelect)" class="recommendation-actions">
      <span>已选 {{ selected.length }} 篇库内文献</span>
      <button type="button" :disabled="!selected.length" @click="emit('ask', selected)">
        基于所选文献问答
      </button>
    </div>
  </section>
</template>

<style scoped>
.reading-recommendations {
  margin-top: 22px;
  overflow: hidden;
  border: 1px solid #dbe7e9;
  border-radius: 12px;
  color: #335d60;
}
.recommendation-heading, .recommendation-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  font-size: 12px;
}
.recommendation-heading h3 { margin: 0; font-size: 15px; }
.document-title {
  border: 0;
  padding: 0;
  background: none;
  color: #245c64;
  font: inherit;
  font-weight: 600;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
  overflow-wrap: anywhere;
}
.document-title:hover { text-decoration: underline; }
.origin-label { margin-left: 8px; color: #7a9598; font-size: 11px; font-weight: 400; }
.metadata { margin: 8px 0 0; color: #82989e; font-size: 12px; }
.reading-recommendations :deep(.el-table td.el-table__cell) { padding: 18px 0; }
.recommendation-message { margin: 0; padding: 14px 16px; color: #82989e; font-size: 13px; }
.recommendation-actions { flex-wrap: wrap; background: #f5f9f8; }
.recommendation-actions button {
  border: 0;
  border-radius: 8px;
  padding: 9px 14px;
  background: #075f62;
  color: white;
  font: inherit;
  cursor: pointer;
}
.recommendation-actions button:disabled { opacity: .45; cursor: default; }
@media (max-width: 760px) {
  .recommendation-heading, .recommendation-actions { padding: 12px; }
}
</style>
