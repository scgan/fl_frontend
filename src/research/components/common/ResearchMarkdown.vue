<!--
  研究文本 Markdown 渲染器：统一呈现启明回答与溯知综述，修复模型标题黏连，
  并在插入页面前清理生成的 HTML，避免把模型内容当作可信 DOM 执行。
-->
<script setup lang="ts">
import DOMPurify from 'dompurify'
import MarkdownIt from 'markdown-it'
import { computed } from 'vue'

const props = defineProps<{
  /** 模型生成或历史记录中保存的 Markdown/纯文本正文。 */
  content: string
  citationIndices?: number[]
}>()

const emit = defineEmits<{ 'citation-click': [index: number] }>()
const allowedCitations = computed(() => new Set(props.citationIndices || []))

const markdown = new MarkdownIt({
  breaks: false,
  html: false,
  linkify: true,
  typographer: false,
})

markdown.inline.ruler.before('link', 'citation', (state, silent) => {
  // markdown-it 14 exposes linkLevel at runtime; its bundled declarations omit it.
  if ((state as typeof state & { linkLevel: number }).linkLevel > 0 || state.src[state.pos] !== '[')
    return false
  const match = /^\[([1-9]\d*)\]/.exec(state.src.slice(state.pos))
  if (!match || !allowedCitations.value.has(Number(match[1]))) return false
  // Preserve explicit links and reference links, while allowing adjacent [1][2].
  const tail = state.src.slice(state.pos + match[0].length)
  if (tail.startsWith('(') || /^\[(?![1-9]\d*\])/.test(tail) || state.env.references?.[match[1]])
    return false
  if (!silent) {
    const token = state.push('citation', '', 0)
    token.content = match[1]
  }
  state.pos += match[0].length
  return true
})
markdown.renderer.rules.citation = (tokens, index) => {
  const number = tokens[index].content
  return `<button type="button" class="research-citation" data-citation-index="${number}" aria-label="查看引用 ${number} 的原文">[${number}]</button>`
}

function onClick(event: MouseEvent) {
  const target = (event.target as Element)?.closest<HTMLButtonElement>(
    'button[data-citation-index]',
  )
  if (!target || !(event.currentTarget as Element)?.contains(target)) return
  const index = Number(target.dataset.citationIndex)
  if (allowedCitations.value.has(index)) emit('citation-click', index)
}

/**
 * 为旧结果中黏在正文后的 Markdown 标题补充行边界。
 *
 * 新回答主要依赖 Prompt 生成规范换行；这里只修复“正文## 2. 标题”这类明确模式，
 * 不猜测没有任何边界的标题正文；连续井号内部不插换行，保留合法多级标题。
 */
function normalizeMarkdownHeadings(content: string): string {
  return content
    .replace(/\r\n?/g, '\n')
    .replace(/([^\n#])(?=#{2,6}\s+(?:\d+(?:\.\d+)*[.、]?\s*)?\S)/g, '$1\n\n')
}

/** 将 Markdown 转换为关闭原始 HTML且经过白名单清理的展示内容。 */
const renderedContent = computed(() =>
  DOMPurify.sanitize(markdown.render(normalizeMarkdownHeadings(props.content)), {
    USE_PROFILES: { html: true },
  }),
)
</script>

<template>
  <div class="research-markdown" @click="onClick" v-html="renderedContent"></div>
</template>

<style scoped>
.research-markdown {
  min-width: 0;
  color: inherit;
  line-height: inherit;
  overflow-wrap: anywhere;
  word-break: break-word;
  white-space: normal;
}
/* 标题与强调：按层级加粗、放大，正文保持常规字重 */
.research-markdown :deep(h1),
.research-markdown :deep(h2),
.research-markdown :deep(h3),
.research-markdown :deep(h4) {
  color: #14343d;
  font-family: inherit;
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: -0.01em;
}
.research-markdown :deep(h1) {
  margin: 28px 0 14px;
  font-size: 1.32em;
}
.research-markdown :deep(h2) {
  margin: 26px 0 12px;
  padding-left: 10px;
  border-left: 3px solid #005767;
  font-size: 1.16em;
}
.research-markdown :deep(h3) {
  margin: 20px 0 9px;
  font-size: 1.05em;
  font-weight: 650;
}
.research-markdown :deep(h4) {
  margin: 16px 0 7px;
  font-size: 1em;
  font-weight: 650;
}
.research-markdown :deep(h1:first-child),
.research-markdown :deep(h2:first-child),
.research-markdown :deep(h3:first-child) {
  margin-top: 0;
}
.research-markdown :deep(p) {
  margin: 0 0 14px;
}
.research-markdown :deep(strong),
.research-markdown :deep(b) {
  color: #14343d;
  font-weight: 650;
}
.research-markdown :deep(ul),
.research-markdown :deep(ol) {
  margin: 0 0 16px;
  padding-left: 24px;
}
.research-markdown :deep(li + li) {
  margin-top: 6px;
}
.research-markdown :deep(blockquote) {
  margin: 16px 0;
  padding: 8px 14px;
  border-left: 3px solid #77a9a1;
  background: #f5f8f7;
  color: #526a67;
}
.research-markdown :deep(code) {
  padding: 2px 5px;
  border-radius: 6px;
  background: #eef3f2;
  font-family: 'Cascadia Code', Consolas, monospace;
  font-size: 0.92em;
}
.research-markdown :deep(pre) {
  max-width: 100%;
  margin: 16px 0;
  padding: 14px;
  overflow-x: auto;
  background: #eef3f2;
}
.research-markdown :deep(pre code) {
  padding: 0;
}
.research-markdown :deep(table) {
  display: block;
  width: 100%;
  margin: 16px 0;
  border-collapse: collapse;
  overflow-x: auto;
}
.research-markdown :deep(th),
.research-markdown :deep(td) {
  padding: 8px 10px;
  border: 1px solid #d4dfdd;
  text-align: left;
  vertical-align: top;
}
.research-markdown :deep(th) {
  background: #f3f7f6;
  color: #294643;
}
.research-markdown :deep(a) {
  color: #197568;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
}
.research-markdown :deep(.research-citation) {
  display: inline;
  padding: 0 2px;
  border: 0;
  background: transparent;
  color: #087887;
  font: inherit;
  cursor: pointer;
}
.research-markdown :deep(.research-citation:hover) {
  text-decoration: underline;
}
.research-markdown :deep(.research-citation:focus-visible) {
  outline: 2px solid #087887;
  outline-offset: 2px;
}
.research-markdown :deep(> :first-child) {
  margin-top: 0;
}
.research-markdown :deep(> :last-child) {
  margin-bottom: 0;
}
</style>
