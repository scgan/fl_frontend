<template>
  <div class="pdf-highlighter" ref="containerRef">
    <!-- 工具栏 -->
    <div class="toolbar">
      <el-button-group>
        <el-button size="small" @click="prevPage" :disabled="currentPage <= 1">
          <el-icon><ArrowLeft /></el-icon>
        </el-button>
        <el-button size="small" disabled>
          {{ currentPage }} / {{ totalPages }}
        </el-button>
        <el-button size="small" @click="nextPage" :disabled="currentPage >= totalPages">
          <el-icon><ArrowRight /></el-icon>
        </el-button>
      </el-button-group>
      <el-slider
        v-model="currentPage"
        :min="1"
        :max="totalPages"
        :show-tooltip="false"
        style="width: 200px; margin: 0 16px"
      />
      <el-select v-model="scale" size="small" style="width: 100px">
        <el-option :value="0.5" label="50%" />
        <el-option :value="0.75" label="75%" />
        <el-option :value="1" label="100%" />
        <el-option :value="1.25" label="125%" />
        <el-option :value="1.5" label="150%" />
        <el-option :value="2" label="200%" />
      </el-select>
    </div>

    <!-- PDF 内容区 -->
    <div class="pdf-content" ref="pdfContentRef">
      <div class="page-container" :style="{ transform: `scale(${scale})` }">
        <canvas ref="canvasRef"></canvas>
        <svg
          class="highlight-layer"
          ref="svgRef"
          :width="pageWidth"
          :height="pageHeight"
        >
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g v-for="block in currentHighlights" :key="block.id">
            <rect
              :x="block.x"
              :y="block.y"
              :width="block.w"
              :height="block.h"
              :class="['highlight-rect', { active: activeCitationId === block.citation_id }]"
              @click="handleHighlightClick(block)"
            />
            <g
              v-if="block.showLabel"
              :transform="`translate(${block.x + block.w / 2 - 8}, ${block.y - 20})`"
              class="citation-label"
              @click.stop="handleLabelClick(block)"
            >
              <rect x="0" y="0" width="16" height="16" rx="3" />
              <text x="8" y="12" text-anchor="middle">{{ block.label }}</text>
            </g>
          </g>
        </svg>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'

const props = defineProps({
  fileUrl: {
    type: String,
    required: true
  },
  citations: {
    type: Array,
    default: () => []
  },
  activeCitationId: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['citation-click', 'page-change'])

const containerRef = ref(null)
const pdfContentRef = ref(null)
const canvasRef = ref(null)
const svgRef = ref(null)

const currentPage = ref(1)
const totalPages = ref(1)
const scale = ref(1)
const pageWidth = ref(0)
const pageHeight = ref(0)
const pdfDoc = ref(null)
const loading = ref(false)

const highlightMap = computed(() => {
  const map = new Map()
  for (const citation of props.citations) {
    const blocks = citation.bbox_blocks || []
    for (const block of blocks) {
      const pageKey = block.page || citation.page_start
      if (!map.has(pageKey)) {
        map.set(pageKey, [])
      }
      map.get(pageKey).push({
        ...block,
        citation_id: citation.citation_id,
        label: citation.citation_id.replace('C', ''),
        showLabel: true
      })
    }
  }
  return map
})

const currentHighlights = computed(() => {
  return highlightMap.value.get(currentPage.value) || []
})

const initPdfJs = async () => {
  if (window.pdfjsLib) return

  await new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      resolve()
    }
    script.onerror = reject
    document.head.appendChild(script)
  })
}

const loadPdf = async () => {
  loading.value = true
  try {
    await initPdfJs()

    const loadingTask = window.pdfjsLib.getDocument(props.fileUrl)
    pdfDoc.value = await loadingTask.promise
    totalPages.value = pdfDoc.value.numPages

    await renderPage(currentPage.value)
  } catch (error) {
    console.error('PDF 加载失败:', error)
  } finally {
    loading.value = false
  }
}

const renderPage = async (pageNum) => {
  if (!pdfDoc.value) return

  const page = await pdfDoc.value.getPage(pageNum)
  const viewport = page.getViewport({ scale: 1 })

  pageWidth.value = viewport.width
  pageHeight.value = viewport.height

  const canvas = canvasRef.value
  const context = canvas.getContext('2d')

  canvas.width = viewport.width
  canvas.height = viewport.height

  const renderContext = {
    canvasContext: context,
    viewport: viewport
  }

  await page.render(renderContext).promise

  await nextTick()
  if (svgRef.value) {
    svgRef.value.setAttribute('width', viewport.width)
    svgRef.value.setAttribute('height', viewport.height)
  }

  emit('page-change', pageNum)
}

const jumpToPage = (pageNum) => {
  if (pageNum >= 1 && pageNum <= totalPages.value) {
    currentPage.value = pageNum
    renderPage(currentPage.value)
  }
}

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
    renderPage(currentPage.value)
  }
}

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    renderPage(currentPage.value)
  }
}

const jumpToCitation = (citation) => {
  const pageNum = citation.page_start || citation.bbox_blocks?.[0]?.page || 1
  jumpToPage(pageNum)
  emit('citation-click', citation)
}

const handleHighlightClick = (block) => {
  const citation = props.citations.find(c => c.citation_id === block.citation_id)
  if (citation) {
    emit('citation-click', citation)
  }
}

const handleLabelClick = (block) => {
  const citation = props.citations.find(c => c.citation_id === block.citation_id)
  if (citation) {
    emit('citation-click', citation)
  }
}

watch(() => props.citations, (newCitations) => {
  if (newCitations && newCitations.length > 0) {
    const firstCitation = newCitations[0]
    const pageNum = firstCitation.page_start || 1
    jumpToPage(pageNum)
  }
}, { immediate: true })

watch(() => props.fileUrl, () => {
  if (props.fileUrl) {
    currentPage.value = 1
    loadPdf()
  }
})

onMounted(() => {
  if (props.fileUrl) {
    loadPdf()
  }
})

defineExpose({
  jumpToPage,
  jumpToCitation
})
</script>

<style scoped>
.pdf-highlighter {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f5f5f5;
}

.toolbar {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background: white;
  border-bottom: 1px solid #e0e0e0;
}

.pdf-content {
  flex: 1;
  overflow: auto;
  display: flex;
  justify-content: center;
  padding: 20px;
  background: #525659;
}

.page-container {
  position: relative;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  transform-origin: top center;
}

canvas {
  display: block;
}

.highlight-layer {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}

.highlight-rect {
  fill: rgba(255, 235, 59, 0.4);
  stroke: rgba(255, 193, 7, 0.8);
  stroke-width: 1;
  pointer-events: all;
  cursor: pointer;
  transition: all 0.2s ease;
}

.highlight-rect:hover {
  fill: rgba(255, 235, 59, 0.6);
  stroke: rgba(255, 193, 7, 1);
  stroke-width: 2;
}

.highlight-rect.active {
  fill: rgba(255, 87, 34, 0.5);
  stroke: rgba(255, 87, 34, 1);
  stroke-width: 2;
  filter: url(#glow);
}

.citation-label {
  pointer-events: all;
  cursor: pointer;
}

.citation-label rect {
  fill: #1976d2;
  stroke: #0d47a1;
  stroke-width: 1;
}

.citation-label text {
  fill: white;
  font-size: 10px;
  font-weight: bold;
  font-family: Arial, sans-serif;
}

.citation-label:hover rect {
  fill: #1565c0;
}
</style>
