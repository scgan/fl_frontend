<!-- AI 对话中的智鉴结果：纵向展示比较内容并保留字段级引用，文献统一由外层“相关文献”列表展示。 -->
<script setup lang="ts">
import { computed } from 'vue'
import ResearchMarkdown from '@/research/components/common/ResearchMarkdown.vue'
import ZhijianResearchVisuals from './ZhijianResearchVisuals.vue'
import { formatCitedText, matrixCellText } from '@/research/utils/comparison-text'
import type { ZhijianResult } from '@/research/types/agents'

const props = withDefaults(defineProps<{
  /** 本轮保存的专业结果，不重新执行比较任务。 */
  result: ZhijianResult
  /** 本轮发布正文只在总体结论中展示一次。 */
  summary?: string
  /** 仅允许打开本轮已发布并验证的引用。 */
  citationIndices?: number[]
}>(), { summary: '', citationIndices: () => [] })
const emit = defineEmits<{ 'citation-click': [index: number] }>()
const objectA = computed(() => props.result.object_a?.canonical_name || '对象 A')
const objectB = computed(() => props.result.object_b?.canonical_name || '对象 B')
const balance = computed(() => props.result.evidence_balance)
const boundaryTitle = computed(() => ({
  NEEDS_CLARIFICATION: '需要补充比较信息',
  INSUFFICIENT_EVIDENCE: '比较证据不足',
  UNSUPPORTED_SOURCE_LANGUAGE: '暂不支持当前来源语言',
}[props.result.status] || '本次比较未完成'))
/** 将结构化引用附在对应结论后，重复或未发布的编号不生成点击入口。 */
function withCitations(text: string, indices: number[] = []): string {
  return formatCitedText(text, indices, props.citationIndices)
}

/** 将研究热点的证据归属映射到本次比较对象。 */
function objectLabel(assignment: string): string {
  return assignment === 'A' ? objectA.value : assignment === 'B' ? objectB.value : '双方共同'
}

</script>

<template>
  <section class="comparison-answer" aria-label="完整智鉴比对结果">
    <section v-if="result.status !== 'SUCCESS'" class="result-boundary" role="status">
      <h2>{{ boundaryTitle }}</h2>
      <ResearchMarkdown :content="result.clarification_question || result.summary || summary || boundaryTitle" :citation-indices="citationIndices" @citation-click="emit('citation-click', $event)" />
      <ul v-if="result.limitations?.length"><li v-for="item in result.limitations" :key="item">{{ item }}</li></ul>
    </section>
    <template v-else>
      <article class="result-prose overview-section" aria-label="智鉴总览">
        <h2>总体结论</h2>
        <ResearchMarkdown :content="summary || result.summary || '本次结果未提供总体结论。'" :citation-indices="citationIndices" @citation-click="emit('citation-click', $event)" />
        <p v-if="result.topic" class="comparison-meta">比较主题：{{ result.topic }}</p>
        <p v-if="result.compare_dimensions?.length" class="comparison-meta">比较维度：{{ result.compare_dimensions.join('、') }}</p>
        <p v-if="result.time_range?.length" class="comparison-meta">研究时间范围：{{ result.time_range.join('—') }}</p>
        <div class="object-summaries">
          <section><h3>{{ objectA }}</h3><ResearchMarkdown :content="result.object_a_summary || '本次结果未提供该侧概述。'" :citation-indices="citationIndices" @citation-click="emit('citation-click', $event)" /></section>
          <section><h3>{{ objectB }}</h3><ResearchMarkdown :content="result.object_b_summary || '本次结果未提供该侧概述。'" :citation-indices="citationIndices" @citation-click="emit('citation-click', $event)" /></section>
        </div>
        <h2>研究证据概览</h2>
        <p>共引用 {{ result.evidence?.length ?? 0 }} 个 Chunk，来自 {{ balance?.source_diversity ?? 0 }} 篇文献；年份覆盖 {{ balance?.year_coverage?.join('–') || '未识别' }}。</p>
        <ZhijianResearchVisuals :object-a="objectA" :object-b="objectB" :object-a-documents="balance?.object_a_document_count ?? 0" :object-b-documents="balance?.object_b_document_count ?? 0" :timeline="result.timeline || []" :show-timeline="false" />
      </article>

      <section class="stacked-section" aria-label="对比矩阵">
        <h2 class="section-title">对比矩阵</h2>
        <div v-if="result.comparison_matrix?.length" class="matrix-wrap" role="region" aria-label="对比矩阵表格，可横向滚动" tabindex="0">
          <table>
            <thead><tr><th scope="col">维度</th><th scope="col">{{ objectA }}</th><th scope="col">{{ objectB }}</th><th scope="col">异同</th></tr></thead>
            <tbody><tr v-for="(row, index) in result.comparison_matrix" :key="index">
              <th scope="row">{{ row.dimension }}</th>
              <td><ResearchMarkdown :content="matrixCellText(row, 'object_a', citationIndices)" :citation-indices="citationIndices" @citation-click="emit('citation-click', $event)" /></td>
              <td><ResearchMarkdown :content="matrixCellText(row, 'object_b', citationIndices)" :citation-indices="citationIndices" @citation-click="emit('citation-click', $event)" /></td>
              <td><strong>同：</strong><ResearchMarkdown :content="matrixCellText(row, 'similarity', citationIndices)" :citation-indices="citationIndices" @citation-click="emit('citation-click', $event)" /><strong>异：</strong><ResearchMarkdown :content="matrixCellText(row, 'difference', citationIndices)" :citation-indices="citationIndices" @citation-click="emit('citation-click', $event)" /></td>
            </tr></tbody>
          </table>
        </div>
        <p v-else class="section-empty">本次结果未提供对比矩阵。</p>
      </section>

      <section class="stacked-section" aria-label="共同点">
        <h2 class="section-title">共同点</h2>
        <ol v-if="result.similarities?.length" class="finding-list"><li v-for="(item, index) in result.similarities" :key="index"><ResearchMarkdown :content="withCitations(item.text, item.citation_ids)" :citation-indices="citationIndices" @citation-click="emit('citation-click', $event)" /></li></ol>
        <p v-else class="section-empty">本次结果未提供共同点。</p>
      </section>

      <section class="stacked-section" aria-label="差异点">
        <h2 class="section-title">差异点</h2>
        <ol v-if="result.differences?.length" class="finding-list differences"><li v-for="(item, index) in result.differences" :key="index"><ResearchMarkdown :content="withCitations(item.text, item.citation_ids)" :citation-indices="citationIndices" @citation-click="emit('citation-click', $event)" /></li></ol>
        <p v-else class="section-empty">本次结果未提供差异点。</p>
      </section>

      <section class="stacked-section" aria-label="双轨时间线">
        <h2 class="section-title">双轨时间线</h2>
        <div class="timeline-tab"><ZhijianResearchVisuals :object-a="objectA" :object-b="objectB" :object-a-documents="balance?.object_a_document_count ?? 0" :object-b-documents="balance?.object_b_document_count ?? 0" :timeline="result.timeline || []" :show-paper-counts="false" :citation-indices="citationIndices" @citation-click="emit('citation-click', $event)" /></div>
      </section>

      <section class="stacked-section" aria-label="研究热点">
        <h2 class="section-title">研究热点</h2>
        <div v-if="result.topic_distribution?.length" class="topic-list"><article v-for="(item, index) in result.topic_distribution" :key="index"><span>{{ objectLabel(item.object) }}</span><h3>{{ item.topic }}</h3><ResearchMarkdown :content="withCitations(item.summary, item.citation_ids)" :citation-indices="citationIndices" @citation-click="emit('citation-click', $event)" /></article></div>
        <p v-else class="section-empty">本次结果未提供可验证的研究热点。</p>
      </section>

      <section v-if="result.limitations?.length" class="stacked-section" aria-label="分析局限"><h2 class="section-title">分析局限</h2><ul class="finding-list"><li v-for="item in result.limitations" :key="item">{{ item }}</li></ul></section>

    </template>
  </section>
</template>

<style scoped src="./zhijian-result.css"></style>
<style scoped>
.comparison-answer { min-width: 0; max-width: 100%; color: #354a62; }
.stacked-section { min-width: 0; margin-top: 18px; }
.section-title { margin: 0; padding: 0 22px; color: #102a43; font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; font-size: 19px; }
.overview-section { padding-top: 0; padding-bottom: 12px; }
.overview-section > .research-markdown { margin-bottom: 16px; color: #354a62; font-size: 12px; line-height: 1.9; }
.overview-section .comparison-meta { margin-bottom: 6px; color: #718397; font-size: 11px; }
.object-summaries { gap: 12px; margin-bottom: 18px; }
.object-summaries section { padding: 12px; }
.object-summaries :deep(.research-markdown) { color: #52677e; font-size: 11px; line-height: 1.8; }
.overview-section :deep(.research-visuals) { margin-top: 12px; }
.matrix-wrap { max-width: 100%; padding: 12px 22px 0; }
.matrix-wrap table { min-width: 650px; }
.matrix-wrap th, .matrix-wrap td { overflow-wrap: anywhere; }
.finding-list { padding: 10px 22px 0; }
.finding-list li { margin-bottom: 6px; padding: 10px 12px; }
.finding-list li:last-child { margin-bottom: 0; }
.finding-list :deep(.research-markdown) { color: #354a62; font-size: 12px; line-height: 1.8; }
.timeline-tab { padding: 0 22px; }
.timeline-tab :deep(.research-visuals) { margin-top: 12px; }
.topic-list { gap: 10px; padding: 12px 22px 0; }
.topic-list article { padding: 12px; }
.topic-list :deep(.research-markdown) { color: #52677e; font-size: 10px; line-height: 1.7; }
.section-empty { margin: 10px 22px 0; padding: 16px; }
.result-boundary { padding: 18px; border: 1px solid #ead8b5; background: #fffaf0; }
.result-boundary h2 { margin: 0 0 12px; color: #805b20; font-size: 18px; }
@media (max-width: 600px) { .result-prose { padding-left: 0; padding-right: 0; } .section-title { padding: 0; } .matrix-wrap { padding: 10px 0 0; } .finding-list { padding: 10px 0 0; } .timeline-tab { padding: 0; } .topic-list { padding: 10px 0 0; } .section-empty { margin-left: 0; margin-right: 0; } }
</style>
