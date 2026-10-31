<!-- 综合阅读分析：普通维度保留自然段，创新方向按自适应标签分项展开，兼容旧正文且不展示文献列表。 -->
<script setup lang="ts">
import { computed } from 'vue'
import type { ReadingInnovation, ReadingOverview } from '@/research/api/literature'
import ResearchMarkdown from '@/research/components/common/ResearchMarkdown.vue'

const props = defineProps<{
  overview: ReadingOverview
}>()
const parts = [
  { key: 'overview', title: '整体概览' },
  { key: 'common_themes', title: '共同主题' },
  { key: 'differences', title: '主要差异' },
  { key: 'potential_innovations', title: '潜在创新点' },
] as const

/** 仅创新方向使用新分项，其余维度和旧正文保持原格式，旧 references 不参与展示。 */
const sections = computed(() =>
  parts
    .map((part) => ({
      ...part,
      claims: (props.overview[part.key] || []).map((claim, index) => {
        return {
          text: claim.text || '',
          title:
            claim.title || (part.key === 'potential_innovations' ? `创新方向 ${index + 1}` : ''),
          validation_path: (claim as ReadingInnovation).validation_path || '',
          points:
            part.key === 'potential_innovations' ? (claim as ReadingInnovation).points || [] : [],
        }
      }),
    }))
    .filter((part) => part.claims.length || part.key === 'potential_innovations'),
)
</script>

<template>
  <section v-for="part in sections" :key="part.key" class="synthesis-section">
    <h2>{{ part.title }}</h2>
    <p v-if="!part.claims.length" class="synthesis-empty">
      暂无潜在创新点，可点击下方「重新分析」生成。
    </p>
    <article v-for="(claim, index) in part.claims" :key="index" class="synthesis-topic">
      <h3 v-if="claim.title">{{ index + 1 }}. {{ claim.title }}</h3>
      <ul v-if="claim.points.length" class="innovation-points">
        <li v-for="(point, pointIndex) in claim.points" :key="pointIndex">
          <strong class="innovation-label">{{ point.label }}：</strong
          ><ResearchMarkdown class="topic-text innovation-text" :content="point.text" />
        </li>
      </ul>
      <template v-else>
        <ResearchMarkdown class="topic-text" :content="claim.text" />
        <div v-if="claim.validation_path" class="validation-path">
          <h4>验证路径</h4>
          <ResearchMarkdown class="topic-text" :content="claim.validation_path" />
        </div>
      </template>
    </article>
  </section>
</template>

<style scoped>
.synthesis-section {
  min-width: 0;
  border-bottom: 1px solid #e8edef;
  padding-bottom: 22px;
  margin-bottom: 22px;
  color: #202a32;
  font-size: 14px;
  line-height: 1.9;
  overflow-wrap: anywhere;
}
.synthesis-section h2 {
  font-size: 16px;
  font-weight: 650;
  line-height: 1.6;
  margin: 0 0 18px;
}
.synthesis-topic + .synthesis-topic {
  margin-top: 25px;
}
.synthesis-topic h3 {
  font-size: 14px;
  font-weight: 650;
  line-height: 1.75;
  margin: 0 0 13px;
}
.topic-text :deep(p) {
  margin: 0;
  white-space: pre-line;
}
.topic-text :deep(p + p) {
  margin-top: 12px;
}
.topic-text :deep(strong) {
  font-weight: 650;
}
.innovation-points {
  margin: 0;
  padding-left: 18px;
}
.innovation-points > li + li {
  margin-top: 14px;
}
.innovation-points > li::marker {
  color: #737b83;
}
.innovation-label {
  font-weight: 650;
}
.innovation-text {
  display: inline;
}
.innovation-text :deep(p:first-child) {
  display: inline;
}
.validation-path {
  margin-top: 14px;
}
.validation-path h4 {
  margin: 0 0 6px;
  font-size: inherit;
  font-weight: 600;
}
.synthesis-empty {
  margin: 0;
  color: #687581;
  font-size: 13px;
}
</style>
