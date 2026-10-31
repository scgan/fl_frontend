<!-- 溯知完整综述的独立阅读排版：区分文档标题、章节与正文，适配窄栏、表格和移动端。 -->
<script setup lang="ts">
import ResearchMarkdown from '@/research/components/common/ResearchMarkdown.vue'

defineProps<{
  /** 本次综述的研究主题，作为文档主标题展示。 */
  title: string
  /** 已保存并规范化引用格式的 Markdown 综述正文。 */
  content: string
}>()
</script>

<template>
  <article class="suzhi-review-reader" aria-label="完整综述正文">
    <header class="review-document-header">
      <h1 class="review-document-title">{{ title }}</h1>
    </header>
    <ResearchMarkdown class="review-document-body" :content="content" />
  </article>
</template>

<style scoped>
/* 独立类名避免工作台统一正文样式将 Markdown 标题与加粗全部压平。 */
.suzhi-review-reader {
  width: 100%;
  max-width: 860px;
  margin: 0 auto;
  padding: 36px clamp(22px, 4%, 48px) 80px;
  color: #33444b;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  container-type: inline-size;
}
.review-document-header {
  margin-bottom: 30px;
  padding-bottom: 24px;
  border-bottom: 1px solid #dfe8e8;
}
.review-document-title {
  margin: 0;
  color: #17363d;
  font-family: inherit;
  font-size: 27px;
  font-weight: 700;
  line-height: 1.5;
  text-wrap: balance;
  overflow-wrap: anywhere;
}
.review-document-body {
  color: #33444b;
  font-family: inherit;
  font-size: 16px;
  font-weight: 400;
  line-height: 1.95;
}
.review-document-body :deep(:is(h1, h2, h3, h4)) {
  color: #203f45;
  font-family: inherit;
  font-weight: 650;
  line-height: 1.6;
  scroll-margin-top: 72px;
}
.review-document-body :deep(h1) { margin: 40px 0 18px; font-size: 23px; }
.review-document-body :deep(h2) {
  margin: 38px 0 18px;
  padding: 0 0 10px;
  border: 0;
  border-bottom: 1px solid #e8eeee;
  font-size: 20px;
}
.review-document-body :deep(h3) { margin: 28px 0 12px; font-size: 17px; }
.review-document-body :deep(h4) { margin: 24px 0 10px; font-size: 16px; }
.review-document-body :deep(p) { margin: 0 0 18px; text-wrap: pretty; }
.review-document-body :deep(:is(strong, b)) { color: #243c43; font-weight: 700; }
.review-document-body :deep(:is(ul, ol)) { margin: 14px 0 24px; padding-left: 1.5em; }
.review-document-body :deep(li) { padding-left: 4px; }
.review-document-body :deep(li + li) { margin-top: 9px; }
.review-document-body :deep(li::marker) { color: #497e7c; }
.review-document-body :deep(blockquote) {
  margin: 24px 0;
  padding: 14px 18px;
  border-left: 3px solid #8eb9b2;
  background: #f4f8f7;
  color: #526a6e;
}
.review-document-body :deep(blockquote p) { margin: 0; }
.review-document-body :deep(blockquote p + p) { margin-top: 12px; }
/* 宽表格与代码只在自身区域滚动，不撑开整个阅读栏。 */
.review-document-body :deep(table) {
  display: block;
  width: 100%;
  max-width: 100%;
  margin: 22px 0 28px;
  overflow-x: auto;
  border-collapse: collapse;
  font-size: 14px;
  line-height: 1.8;
}
.review-document-body :deep(:is(th, td)) { padding: 11px 14px; border-color: #dfe7e7; }
.review-document-body :deep(th) { background: #f0f6f5; color: #284d51; font-weight: 600; }
.review-document-body :deep(tbody tr:nth-child(even)) { background: #fafcfc; }
.review-document-body :deep(pre) { margin: 22px 0; border-radius: 6px; font-size: 14px; }
.review-document-body :deep(hr) { margin: 32px 0; border: 0; border-top: 1px solid #e3ebeb; }
.review-document-body :deep(> :first-child) { margin-top: 0; }
.review-document-body :deep(> :last-child) { margin-bottom: 0; }

/* 字号随实际阅读栏宽度调整，左右面板展开时同样保持清楚的标题层级。 */
@container (max-width: 480px) {
  .review-document-title { font-size: 23px; }
  .review-document-body { font-size: 15px; line-height: 1.95; }
  .review-document-body :deep(h2) { font-size: 18px; }
  .review-document-body :deep(h3) { font-size: 16px; }
  .review-document-body :deep(h4) { font-size: 15px; }
}
@media (max-width: 760px) {
  .suzhi-review-reader { padding-top: 26px; padding-bottom: 48px; }
  .review-document-header { margin-bottom: 24px; padding-bottom: 20px; }
}
</style>
