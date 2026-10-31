<!-- 连续 PDF 阅读器：复用 PDF.js 的可见页渲染、页面缓存和缩放定位，并为各页叠加业务引用高亮。 -->
<script setup lang="ts">
// Viewer 与文档解析器必须使用同一版本；先加载 core，让 legacy Viewer 取得 pdfjsLib。
import 'pdfjs-dist/legacy/build/pdf.js'
import { EventBus, PDFViewer } from 'pdfjs-dist/legacy/web/pdf_viewer.js'
import 'pdfjs-dist/legacy/web/pdf_viewer.css'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { PageViewport } from 'pdfjs-dist/types/src/display/display_utils'
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { CitationHighlightRect } from '@/research/utils/citationHighlight'
import CitationHighlightLayer from './CitationHighlightLayer.vue'

const props = defineProps<{
  document: PDFDocumentProxy | null
  getHighlights?: (pageNumber: number, viewport: PageViewport) => CitationHighlightRect[]
}>()
const emit = defineEmits<{
  'page-change': [pageNumber: number, viewport: PageViewport]
  'scale-change': [scale: number]
  error: [message: string]
}>()
const container = ref<HTMLDivElement | null>(null)
const pages = ref<HTMLDivElement | null>(null)
/** 仅保留仍在 PDF.js 页面缓存中的绘制层，释放离屏页时同时释放对应高亮。 */
const overlays = shallowRef<
  {
    pageNumber: number
    host: HTMLDivElement
    rects: CitationHighlightRect[]
  }[]
>([])
const eventBus = new EventBus()
let viewer: PDFViewer | null = null
let resizeObserver: ResizeObserver | null = null
let fit = true
let sequence = 0
let ready: Promise<void> = Promise.resolve()
let resolveReady: (() => void) | null = null
let resizeFrame = 0
let previousWidth = 0
const cssUnits = 96 / 72

/** 同步当前可见页、实际 Canvas 缩放和引用状态；滚动过程中不重新下载文件。 */
function reportPage(): void {
  if (!viewer?.pdfDocument) return
  const pageNumber = viewer.currentPageNumber
  const view = viewer.getPageView(pageNumber - 1)
  if (!view?.viewport) return
  emit('page-change', pageNumber, view.viewport)
  emit('scale-change', view.viewport.scale)
  overlays.value = overlays.value.filter((item) => item.host.isConnected)
}

/** 页面重绘后把高亮挂到真实页面内，使滚动、旋转和缩放共用页面坐标。 */
function decoratePage({
  pageNumber,
  error,
  source,
}: {
  pageNumber: number
  error?: Error
  source?: unknown
}): void {
  if (!viewer?.pdfDocument || viewer.pdfDocument !== props.document) return
  const view = viewer.getPageView(pageNumber - 1)
  if (!view || (source && source !== view)) return
  if (error) {
    emit('error', 'PDF 页面渲染失败，请重新加载原文')
    return
  }
  if (!view?.div || !view.viewport) return
  const rects = props.getHighlights?.(pageNumber, view.viewport) || []
  const existing = view.div.querySelector('.pdf-evidence-host') as HTMLDivElement | null
  const host = existing || document.createElement('div')
  if (!existing) {
    host.className = 'pdf-evidence-host'
    view.div.append(host)
  }
  overlays.value = [
    ...overlays.value.filter((item) => item.pageNumber !== pageNumber && item.host.isConnected),
    { pageNumber, host, rects },
  ]
  reportPage()
}

/** 挂接新文档前撤下旧页面和高亮；PDF.js 负责取消旧页面的 RenderTask。 */
function attachDocument(): void {
  if (!viewer) return
  sequence += 1
  resolveReady?.()
  overlays.value = []
  fit = true
  ready = new Promise<void>((resolve) => {
    resolveReady = resolve
  })
  // 3.x 的声明漏掉了 null；运行时用 null 撤下文档并取消页面渲染。
  viewer.setDocument(props.document!)
  if (!props.document) resolveReady?.()
  if (container.value) {
    container.value.scrollTop = 0
    container.value.scrollLeft = 0
  }
}

/** 跳到引用页或首页；需要高亮时进一步对齐到第一个证据片段。 */
async function scrollToPage(pageNumber: number, highlight = false): Promise<void> {
  const generation = sequence
  await ready
  const pdf = props.document
  if (!viewer || !pdf || generation !== sequence) return
  const target = Math.max(1, Math.min(pageNumber, pdf.numPages))
  const pdfPage = await pdf.getPage(target)
  if (generation !== sequence || pdf !== props.document) return
  const view = viewer.getPageView(target - 1)
  if (!view.pdfPage) view.setPdfPage(pdfPage)
  viewer.scrollPageIntoView({ pageNumber: target, ignoreDestinationZoom: true })
  if (highlight && container.value) {
    const rect = props.getHighlights?.(target, view.viewport)?.[0]
    if (rect) {
      const top =
        view.div.getBoundingClientRect().top -
        container.value.getBoundingClientRect().top +
        container.value.scrollTop
      container.value.scrollTop = Math.max(0, top + rect.top - 60)
    }
  }
  viewer.update()
  reportPage()
}

/** 使用 PDF.js 的页面位置锚点调整缩放，保留正在阅读的原文位置。 */
function zoomBy(delta: number): void {
  if (!viewer?.pdfDocument) return
  fit = false
  const scale = Math.max(0.25, Math.min(3, viewer.currentScale * cssUnits + delta))
  viewer.currentScale = scale / cssUnits
  reportPage()
}

/** 适合宽度时让 PDF.js 计算比例，同时保留当前页和页内位置。 */
function fitToWidth(): void {
  if (!viewer?.pdfDocument || !container.value?.clientWidth) return
  fit = true
  viewer.currentScaleValue = 'page-width'
  viewer.update()
  reportPage()
}

/** 隐藏面板重新显示或栏宽改变后刷新视口；手动缩放时保持用户选择的比例。 */
function refresh(): void {
  if (fit) fitToWidth()
  else viewer?.update()
}

onMounted(() => {
  if (!container.value || !pages.value) return
  viewer = new PDFViewer({
    container: container.value,
    viewer: pages.value,
    eventBus,
    textLayerMode: 0,
    annotationMode: 0,
    annotationEditorMode: -1,
    removePageBorders: true,
    maxCanvasPixels: 12_000_000,
  })
  eventBus.on('pagesinit', () => {
    fitToWidth()
    resolveReady?.()
    reportPage()
  })
  eventBus.on('pagechanging', reportPage)
  eventBus.on('updateviewarea', reportPage)
  eventBus.on('pagerendered', decoratePage)
  eventBus.on('scalechanging', () => {
    // PDF.js 可能先以 CSS 缩放旧画布再重绘；过渡期也要让高亮使用新页面坐标。
    overlays.value = overlays.value
      .filter((item) => item.host.isConnected)
      .map((item) => ({
        ...item,
        rects:
          props.getHighlights?.(
            item.pageNumber,
            viewer!.getPageView(item.pageNumber - 1).viewport,
          ) || [],
      }))
  })
  resizeObserver = new ResizeObserver(() => {
    const width = container.value?.clientWidth || 0
    if (!width || width === previousWidth) return
    previousWidth = width
    cancelAnimationFrame(resizeFrame)
    resizeFrame = requestAnimationFrame(refresh)
  })
  resizeObserver.observe(container.value)
  attachDocument()
})
watch(() => props.document, attachDocument)
onBeforeUnmount(() => {
  sequence += 1
  resolveReady?.()
  resizeObserver?.disconnect()
  cancelAnimationFrame(resizeFrame)
  overlays.value = []
  viewer?.setDocument(null!)
  viewer = null
})
defineExpose({ scrollToPage, zoomBy, fitToWidth, refresh })
</script>

<template>
  <div class="continuous-pdf-reader">
    <div ref="container" class="continuous-pdf-scroll" tabindex="0" aria-label="PDF 连续阅读区域">
      <div ref="pages" class="pdfViewer"></div>
    </div>
    <Teleport v-for="overlay in overlays" :key="overlay.pageNumber" :to="overlay.host">
      <CitationHighlightLayer :rects="overlay.rects" />
    </Teleport>
  </div>
</template>

<style scoped>
.continuous-pdf-reader {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex: 1;
}
.continuous-pdf-scroll {
  position: absolute;
  inset: 0;
  overflow: auto;
  overscroll-behavior: contain;
  background: #edf1f4;
  outline-offset: -2px;
}
.pdfViewer {
  padding: 20px 0;
  min-height: 100%;
}
.pdfViewer :deep(.page) {
  margin-bottom: 18px;
  box-shadow: 0 2px 14px #253b491a;
}
.pdfViewer :deep(.pdf-evidence-host) {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
@media (max-width: 720px) {
  .pdfViewer {
    padding: 12px 0;
  }
}
</style>
