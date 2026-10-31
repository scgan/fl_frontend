<!--
  Citation PDF 阅读器：鉴权加载原始论文，支持从 Citation 页高亮 Evidence，
  或从第一页开始的全文阅读；共用连续滚动组件按可见页渲染。
-->
<script setup lang="ts">
import { ZoomIn, ZoomOut } from '@element-plus/icons-vue'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js'
import pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.js?url'
import { pdfDocumentOptions } from '@/research/utils/pdf-document'
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist'
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'

import { fetchCitationFile } from '@/research/api/agents'
import type { AgentEvidenceItem } from '@/research/types/agents'
import { buildCitationHighlightRects } from '@/research/utils/citationHighlight'
import type { CitationItemRange } from '@/research/utils/citationHighlight'
import { locateCitationHighlights } from '@/research/utils/citationRangeHighlight'
import ContinuousPdfViewer from '@/research/components/common/ContinuousPdfViewer.vue'

// 使用 PDF.js 3.x legacy worker，兼容低版本浏览器（Safari 等）
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    item?: AgentEvidenceItem | null
    document?: { title: string; fileUrl: string } | null
    mode?: 'citation' | 'document'
  }>(),
  {
    mode: 'citation',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

interface PdfTextItem {
  /** PDF.js 提取的当前文字片段。 */
  str: string
  /** 从 PDF 坐标转换到视口坐标的文字矩阵。 */
  transform: number[]
  /** 文字片段在 PDF 用户空间中的宽度。 */
  width: number
  ascent?: number
  descent?: number
}

interface HighlightRect {
  /** 高亮矩形距离页面左侧的 CSS 像素。 */
  left: number
  /** 高亮矩形距离页面顶部的 CSS 像素。 */
  top: number
  /** 高亮矩形宽度。 */
  width: number
  /** 高亮矩形高度。 */
  height: number
}

interface PageTextItems {
  /** PDF 中从 1 开始的真实页码。 */
  pageNumber: number
  /** 当前页按 PDF.js 阅读顺序提取的文字项。 */
  items: PdfTextItem[]
  width?: number
  height?: number
}

const pdfViewer = ref<InstanceType<typeof ContinuousPdfViewer> | null>(null)
const pdfSource = shallowRef<PDFDocumentProxy | null>(null)
const loading = ref(false)
const errorMessage = ref('')
const matchMessage = ref('')
/** 仅完整匹配显示绿色；低覆盖率明确提示部分匹配。 */
const matchComplete = ref(false)
const currentPage = ref(1)
const pageCount = ref(0)
const scale = ref(1.25)

let pdfDocument: PDFDocumentProxy | null = null
let documentLoadingTask: PDFDocumentLoadingTask | null = null
let loadSequence = 0
let textItemsByPage = new Map<number, PdfTextItem[]>()
let matchedIndexesByPage = new Map<number, Set<number>>()
let rangesByPage = new Map<number, Map<number, CitationItemRange>>()
let rangeLocated = false
let approximateRange = false
let matchedCharacterCount = 0
let targetCharacterCount = 0

const dialogTitle = computed(
  () => props.document?.title ?? props.item?.evidence.document_title ?? '文献阅读',
)
const sourceLabel = computed(() =>
  props.mode === 'document' ? 'DOCUMENT SOURCE' : 'CITATION SOURCE',
)
const pageLabel = computed(() => {
  if (props.mode === 'document') return '全文阅读 · 从第 1 页开始'
  const citation = props.item?.citation
  if (!citation) return ''
  return citation.page_start === citation.page_end
    ? `引用定位：第 ${citation.page_start} 页`
    : `引用定位：第 ${citation.page_start}–${citation.page_end} 页`
})

/**
 * 取消当前渲染并释放 PDF.js Worker、字体缓存与文档代理。
 *
 * @returns PDF.js 完成资源清理后结束。
 */
async function releasePdfDocument(): Promise<void> {
  pdfSource.value = null
  const task = documentLoadingTask
  documentLoadingTask = null
  pdfDocument = null
  textItemsByPage = new Map<number, PdfTextItem[]>()
  matchedIndexesByPage = new Map<number, Set<number>>()
  rangesByPage = new Map()
  rangeLocated = false
  approximateRange = false
  matchedCharacterCount = 0
  targetCharacterCount = 0
  await nextTick()
  await task?.destroy()
}

/**
 * 提取 Citation 页码范围内的文本层，并预计算所有页面的 Evidence 高亮。
 *
 * @param item 当前打开的真实 Evidence 与 Citation。
 * @param sequence 本次加载序号，用于放弃已经被新 Citation 替代的异步结果。
 * @returns 文本提取与匹配完成后结束。
 */
async function prepareCitationHighlights(item: AgentEvidenceItem, sequence: number): Promise<void> {
  if (!pdfDocument) return
  const pageStart = Math.min(Math.max(item.citation.page_start, 1), pdfDocument.numPages)
  const pageEnd = Math.min(Math.max(item.citation.page_end, pageStart), pdfDocument.numPages)
  const pages: PageTextItems[] = []

  for (let pageNumber = pageStart; pageNumber <= pageEnd; pageNumber += 1) {
    const page = await pdfDocument.getPage(pageNumber)
    const textContent = await page.getTextContent()
    if (sequence !== loadSequence || !props.modelValue) return
    const items: PdfTextItem[] = textContent.items.flatMap((textItem) => {
      if (!('str' in textItem) || !textItem.str.trim()) return []
      const style = textContent.styles[textItem.fontName]
      return [
        {
          str: textItem.str,
          transform: textItem.transform.map(Number),
          width: textItem.width,
          ascent: style?.ascent,
          descent: style?.descent,
        },
      ]
    })
    textItemsByPage.set(pageNumber, items)
    // 用未缩放的视口统一旋转页与普通页的上下方向；高亮仍使用原始矩阵。
    const viewport = page.getViewport({ scale: 1 })
    pages.push({
      pageNumber,
      width: viewport.width,
      height: viewport.height,
      items: items.map((item) => ({
        ...item,
        transform: pdfjsLib.Util.transform(viewport.transform, item.transform),
      })),
    })
  }

  const result = locateCitationHighlights(pages, item.evidence.content || item.citation.quote)
  matchedIndexesByPage = result.indexesByPage
  rangesByPage = result.rangesByPage
  rangeLocated = result.rangeLocated
  approximateRange = result.approximate
  matchedCharacterCount = result.matchedCharacterCount
  targetCharacterCount = result.targetCharacterCount
}

/** 为连续阅读器的每一页独立计算高亮，跨页证据沿用完整原文匹配结果。 */
function pageHighlights(
  pageNumber: number,
  viewport: { transform: number[]; scale: number },
): HighlightRect[] {
  if (props.mode !== 'citation') return []
  return buildCitationHighlightRects(
    textItemsByPage.get(pageNumber) ?? [],
    matchedIndexesByPage.get(pageNumber) ?? new Set<number>(),
    viewport,
    rangeLocated ? rangesByPage.get(pageNumber) : undefined,
  )
}

/** 同步滚动位置和当前页的匹配状态，全文模式不显示证据状态。 */
function onPageChange(pageNumber: number): void {
  currentPage.value = pageNumber
  matchComplete.value = false
  if (props.mode === 'document') {
    matchMessage.value = ''
    return
  }
  const citation = props.item?.citation
  if (!citation || pageNumber < citation.page_start || pageNumber > citation.page_end) {
    matchMessage.value = citation ? '当前页不在引用页码范围内' : ''
  } else if (!matchedIndexesByPage.get(pageNumber)?.size) {
    matchMessage.value = '已定位引用页，当前页未匹配到可高亮原文'
  } else {
    matchComplete.value = rangeLocated
      ? !approximateRange
      : matchedCharacterCount >= targetCharacterCount
    matchMessage.value = matchComplete.value
      ? '已高亮引用原文，滚动可查看上下文'
      : '原文部分匹配，仅高亮已匹配内容'
  }
}

/**
 * 鉴权下载原始 PDF，并按入口模式初始化到 Citation 起始页或文献第一页。
 *
 * 每次打开都会从后端权限接口获取最新 Blob；序列号阻止较慢的旧请求在用户快速
 * 切换 Citation 后覆盖新文档。PDF.js 仅接收内存字节，不创建长期对象 URL。
 */
async function loadCitation(): Promise<void> {
  const item = props.item
  const fileUrl =
    props.mode === 'document' && props.document ? props.document.fileUrl : item?.citation.file_url
  if (!props.modelValue || !fileUrl || (props.mode === 'citation' && !item)) return
  const sequence = ++loadSequence
  loading.value = true
  errorMessage.value = ''
  matchMessage.value = ''
  matchComplete.value = false
  try {
    await releasePdfDocument()
    if (sequence !== loadSequence || !props.modelValue) return
    const blob = await fetchCitationFile(fileUrl)
    const bytes = await blob.arrayBuffer()
    if (sequence !== loadSequence || !props.modelValue) return
    const nextLoadingTask = pdfjsLib.getDocument(pdfDocumentOptions(new Uint8Array(bytes)))
    documentLoadingTask = nextLoadingTask
    const nextDocument = await nextLoadingTask.promise
    if (sequence !== loadSequence || !props.modelValue) {
      await nextLoadingTask.destroy()
      return
    }
    pdfDocument = nextDocument
    pageCount.value = nextDocument.numPages
    currentPage.value =
      props.mode === 'document'
        ? 1
        : Math.min(Math.max(item?.citation.page_start ?? 1, 1), pageCount.value)
    if (props.mode === 'citation' && item) await prepareCitationHighlights(item, sequence)
    if (sequence !== loadSequence || !props.modelValue) return
    const initialPage = currentPage.value
    pdfSource.value = nextDocument
    loading.value = false
    await nextTick()
    await pdfViewer.value?.scrollToPage(initialPage, props.mode === 'citation')
  } catch (error) {
    if (sequence !== loadSequence || !props.modelValue) return
    console.error('PDF 原文加载失败', error)
    errorMessage.value = '原文加载失败，请检查文件服务或阅读器资源是否正常'
  } finally {
    if (sequence === loadSequence) loading.value = false
  }
}

/**
 * 调整 PDF 页面缩放比例并重新渲染高亮坐标。
 *
 * @param delta 缩放增量；连续阅读器统一限制为 25% 到 300%。
 */
function changeScale(delta: number): void {
  pdfViewer.value?.zoomBy(delta)
}

watch(
  () => [props.modelValue, props.item, props.mode, props.document?.fileUrl] as const,
  ([open]) => {
    if (open) void loadCitation()
    else {
      loadSequence += 1
      void releasePdfDocument()
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  loadSequence += 1
  void releasePdfDocument()
})
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    class="citation-pdf-dialog"
    width="min(1080px, 96vw)"
    top="2vh"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header>
      <div class="citation-viewer-heading">
        <div>
          <span>{{ sourceLabel }}</span>
          <h2>{{ dialogTitle }}</h2>
        </div>
        <p>{{ pageLabel }}</p>
      </div>
    </template>

    <div class="citation-viewer-toolbar" aria-label="PDF 阅读控制">
      <div>
        <strong>第 {{ currentPage }} / {{ pageCount || '—' }} 页</strong>
        <small>滚动阅读</small>
      </div>
      <div>
        <el-button :disabled="loading || !pageCount" @click="pdfViewer?.fitToWidth()"
          >适合宽度</el-button
        >
        <el-button
          aria-label="缩小 PDF"
          :icon="ZoomOut"
          :disabled="loading || scale <= 0.25"
          @click="changeScale(-0.15)"
        />
        <span>{{ Math.round(scale * 100) }}%</span>
        <el-button
          aria-label="放大 PDF"
          :icon="ZoomIn"
          :disabled="loading || scale >= 3"
          @click="changeScale(0.15)"
        />
      </div>
    </div>

    <p v-if="matchMessage" class="citation-match-message" :class="{ complete: matchComplete }">
      {{ matchMessage }}
    </p>
    <div v-loading="loading" class="citation-pdf-viewport">
      <ContinuousPdfViewer
        v-if="!errorMessage"
        ref="pdfViewer"
        :document="pdfSource"
        :get-highlights="pageHighlights"
        @page-change="onPageChange"
        @scale-change="(value) => (scale = value)"
        @error="(value) => (errorMessage = value)"
      />
      <el-empty v-else :description="errorMessage" />
    </div>
  </el-dialog>
</template>

<style scoped>
.citation-viewer-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  padding-right: 28px;
}

.citation-viewer-heading span {
  color: #2563eb;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
}

.citation-viewer-heading h2 {
  margin: 5px 0 0;
  color: #102a43;
  font-size: 20px;
}

.citation-viewer-heading p {
  margin: 0;
  color: #526779;
  white-space: nowrap;
}

.citation-viewer-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 14px;
  border: 1px solid #d7e1eb;
  background: #f7f9fa;
}

.citation-viewer-toolbar > div {
  display: flex;
  align-items: center;
  gap: 10px;
}

.citation-viewer-toolbar strong,
.citation-viewer-toolbar span {
  min-width: 84px;
  color: #334e68;
  text-align: center;
}

.citation-pdf-viewport {
  display: flex;
  height: min(74vh, 900px);
  overflow: hidden;
  border: 1px solid #d7e1eb;
  background: #dfe6ec;
}

.citation-match-message {
  margin: 0;
  padding: 7px 14px;
  color: #88703b;
  background: #faf8f0;
  font-size: 12px;
}
.citation-match-message.complete {
  color: #287367;
  background: #f0f8f5;
}
.citation-viewer-toolbar small {
  color: #7b8993;
  white-space: nowrap;
}
.citation-pdf-viewport :deep(.el-empty) {
  margin: auto;
}

@media (max-width: 720px) {
  .citation-viewer-heading,
  .citation-viewer-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .citation-viewer-heading p {
    white-space: normal;
  }
  .citation-viewer-toolbar > div {
    justify-content: space-between;
  }
  .citation-pdf-viewport {
    height: 60vh;
  }
}
</style>
