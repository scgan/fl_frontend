<!-- 管理单个私有知识库的文献集合，添加弹窗只提供分页勾选。 -->
<script setup>
import { computed, defineAsyncComponent, nextTick, onMounted, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Plus, Collection } from '@element-plus/icons-vue'
import FileEdit from '../FileManage/components/FileEdit.vue'
import { getCorpusDetailService } from '@/api/public'
const CitationPdfViewer = defineAsyncComponent(() => import('@/research/components/qiming/CitationPdfViewer.vue'))
import {
  addKnowledgeBaseDocuments,
  getKnowledgeBase,
  listKnowledgeBaseCandidates,
  listKnowledgeBaseDocuments,
  removeKnowledgeBaseDocument,
  rebuildKnowledgeBaseDocumentIndex,
} from '@/api/knowledgeBase'

const route = useRoute()
const router = useRouter()
const id = route.params.id
const base = ref(null)
const documents = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const pickerOpen = ref(false)
const candidates = ref([])
const candidateTotal = ref(0)
const candidatePage = ref(1)
const candidatePageSize = ref(20)
const candidateLoading = ref(false)
const submitting = ref(false)
const selected = ref(new Set())
const selectedCount = computed(() => selected.value.size)
const fileDetailRef = ref()
const readerOpen = ref(false)
const readerDocument = ref(null)
const readingId = ref(null)
const filePickerOpen = ref(false)
const pdfFiles = ref([])
const readingRow = ref(null)
const rebuildingIds = ref(new Set())
let refreshTimer = null
let loadSequence = 0
let disposed = false
const indexLabels = {
  NOT_INDEXED: '未建立', PENDING: '排队中', RUNNING: '处理中',
  SUCCESS: '已就绪', FAILED: '失败', CANCELLED: '已取消', STALE: '待重建',
}
const indexTagTypes = {
  SUCCESS: 'success', FAILED: 'danger', PENDING: 'warning', RUNNING: 'primary', STALE: 'warning',
}

/** 提交后立即显示排队状态，禁止同一行重复提交。 */
async function rebuildIndex(row) {
  if (!row.index?.can_rebuild || rebuildingIds.value.has(row.corpus_id)) return
  rebuildingIds.value.add(row.corpus_id)
  try {
    const response = await rebuildKnowledgeBaseDocumentIndex(id, row.corpus_id)
    loadSequence += 1
    row.index = response.data.data.index
    ElMessage.success(response.data.message || '已提交索引重建')
    await load({ silent: true })
  } finally {
    rebuildingIds.value.delete(row.corpus_id)
  }
}

async function readDocument(row) {
  if (readingId.value !== null) return
  readingId.value = row.corpus_id
  try {
    const response = await getCorpusDetailService({ corpus_id: row.corpus_id })
    const files = (response.data.data.files || []).filter(file =>
      file.file_path && /\.pdf$/i.test(file.filename || file.file_path)
    )
    if (!files.length) {
      ElMessage.info('该文献暂无可在线阅读的 PDF 附件，可通过“查看”查看元数据')
      return
    }
    readingRow.value = row
    pdfFiles.value = files
    if (files.length === 1) openPdf(files[0])
    else filePickerOpen.value = true
  } finally {
    readingId.value = null
  }
}

function openPdf(file) {
  const row = readingRow.value
  const query = new URLSearchParams({ corpus_id: String(row.corpus_id), attachment_path: file.file_path })
  readerDocument.value = {
    title: row.title_cn || row.title_en || file.filename,
    fileUrl: `/api/public/file/corpus?${query.toString()}`,
  }
  filePickerOpen.value = false
  readerOpen.value = true
}

function viewDocument(row) {
  fileDetailRef.value.open({ ...row, corpus_id: row.corpus_id, ban: true, judgeFlag: true })
}

/** 读取知识库信息及当前文献页。 */
async function load(options = {}) {
  const silent = options?.silent === true
  const sequence = ++loadSequence
  clearTimeout(refreshTimer)
  if (!silent) loading.value = true
  try {
    const [detail, list] = await Promise.all([
      getKnowledgeBase(id),
      listKnowledgeBaseDocuments(id, { page_num: page.value, page_size: pageSize.value }),
    ])
    if (disposed || sequence !== loadSequence) return
    base.value = detail.data.data
    documents.value = list.data.data
    total.value = list.data.pagination.total
  } finally {
    if (sequence === loadSequence) {
      loading.value = false
      // 临时网络错误后仍需轮询，否则页面会永久停在上次排队状态。
      if (!disposed && documents.value.some(row => ['PENDING', 'RUNNING'].includes(row.index?.status))) {
        refreshTimer = setTimeout(() => load({ silent: true }).catch(() => {}), 4000)
      }
    }
  }
}

/** 读取没有加入当前知识库的候选文献页。 */
async function loadCandidates() {
  candidateLoading.value = true
  try {
    const response = await listKnowledgeBaseCandidates(id, {
      page_num: candidatePage.value,
      page_size: candidatePageSize.value,
    })
    candidates.value = response.data.data
    candidateTotal.value = response.data.pagination.total
  } finally {
    candidateLoading.value = false
  }
}

/** 打开无搜索条件的分页文献选择弹窗。 */
async function openPicker() {
  selected.value = new Set()
  candidatePage.value = 1
  pickerOpen.value = true
  await nextTick()
  await loadCandidates()
}

/** 将当前页的勾选状态保存在跨页集合中。 */
function toggleCandidate(corpusId, checked) {
  const next = new Set(selected.value)
  if (checked) {
    if (next.size >= 100) {
      ElMessage.warning('一次最多添加 100 篇文献')
      return
    }
    next.add(corpusId)
  } else {
    next.delete(corpusId)
  }
  selected.value = next
}

/** 一次提交用户明确勾选的文献 ID。 */
async function addSelected() {
  if (!selectedCount.value) return
  submitting.value = true
  try {
    const response = await addKnowledgeBaseDocuments(id, [...selected.value])
    pickerOpen.value = false
    ElMessage.success(`已添加 ${response.data.data.added_count} 篇文献`)
    page.value = 1
    await load()
  } finally {
    submitting.value = false
  }
}

/** 二次确认后移除单篇文献。 */
async function remove(row) {
  try {
    await ElMessageBox.confirm(`确定移除“${row.title_cn || row.title_en}”吗？`, '移除文献', { type: 'warning' })
  } catch {
    return
  }
  await removeKnowledgeBaseDocument(id, row.corpus_id)
  ElMessage.success('文献已移除')
  if (documents.value.length === 1 && page.value > 1) page.value -= 1
  await load()
}

onMounted(load)
onBeforeUnmount(() => {
  disposed = true
  loadSequence += 1
  clearTimeout(refreshTimer)
})
</script>

<template>
  <PageContainer :title="base?.name || '知识库详情'">
    <template #extra>
      <el-button :icon="ArrowLeft" @click="router.push('/user/knowledge-bases')">返回列表</el-button>
      <el-button type="primary" :icon="Plus" :disabled="!base" @click="openPicker">添加文献</el-button>
    </template>
    <div v-loading="loading">
      <section class="base-summary">
        <span class="summary-icon"><el-icon :size="26"><Collection /></el-icon></span>
        <div class="summary-copy"><span class="summary-label">个人知识库</span><p class="description">{{ base?.description || '按主题收集与整理文献，构建你的研究资料库。' }}</p></div>
        <div class="summary-count"><strong>{{ total }}</strong><span>篇文献</span></div>
      </section>
      <div class="section-heading"><h2>文献列表</h2><span>管理已收录的研究资料</span><el-button class="refresh-list" link type="primary" @click="load">刷新列表</el-button></div>
      <el-table class="document-table" :data="documents" empty-text="当前知识库暂无文献，点击右上角添加文献">
        <el-table-column label="标题" min-width="280">
          <template #default="{ row }">{{ row.title_cn || row.title_en || '未命名文献' }}</template>
        </el-table-column>
        <el-table-column prop="author" label="作者" min-width="130" />
        <el-table-column prop="language" label="语言" width="100" />
        <el-table-column prop="publish_time" label="年份" width="90" />
        <el-table-column label="索引状态" width="115">
          <template #default="{ row }">
            <el-tooltip :content="row.index?.description || '尚未建立索引'" placement="top">
              <el-tag :type="indexTagTypes[row.index?.status] || 'info'" effect="light">
                {{ row.index?.retry_pending ? '等待重试' : (indexLabels[row.index?.status] || '未建立') }}
              </el-tag>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="310" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewDocument(row)">查看</el-button>
            <el-button link type="primary" :loading="readingId === row.corpus_id" :disabled="readingId !== null && readingId !== row.corpus_id" @click="readDocument(row)">阅读文献</el-button>
            <el-button link type="primary" :loading="rebuildingIds.has(row.corpus_id)" :disabled="!row.index?.can_rebuild" @click="rebuildIndex(row)">重建索引</el-button>
            <el-button link type="danger" @click="remove(row)">移除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        class="pager"
        layout="total, sizes, prev, pager, next"
        :page-sizes="[10, 20, 50]"
        :total="total"
        @change="load"
      />
    </div>
    <FileEdit ref="fileDetailRef" />
    <CitationPdfViewer v-if="readerDocument" v-model="readerOpen" :document="readerDocument" mode="document" />
    <el-dialog v-model="filePickerOpen" title="选择要阅读的 PDF" width="min(560px, 92vw)">
      <div class="pdf-file-list">
        <el-button v-for="file in pdfFiles" :key="file.file_path" class="pdf-file-option" @click="openPdf(file)">{{ file.filename }}</el-button>
      </div>
    </el-dialog>
    <el-dialog v-model="pickerOpen" title="添加已审核文献" width="min(900px, 95vw)" destroy-on-close>
      <p class="picker-tip">已选择 <strong>{{ selectedCount }} / 100</strong> 篇<span>翻页后保留勾选</span></p>
      <el-table v-loading="candidateLoading" :data="candidates" height="420" empty-text="没有可添加的文献" stripe>
        <el-table-column width="52">
          <template #default="{ row }">
            <el-checkbox
              :model-value="selected.has(row.corpus_id)"
              :aria-label="`选择 ${row.title_cn || row.title_en || row.corpus_id}`"
              @change="(checked) => toggleCandidate(row.corpus_id, checked)"
            />
          </template>
        </el-table-column>
        <el-table-column label="标题" min-width="280">
          <template #default="{ row }">{{ row.title_cn || row.title_en || '未命名文献' }}</template>
        </el-table-column>
        <el-table-column prop="author" label="作者" min-width="120" />
        <el-table-column prop="language" label="语言" width="90" />
        <el-table-column prop="publish_time" label="年份" width="90" />
      </el-table>
      <el-pagination
        v-model:current-page="candidatePage"
        v-model:page-size="candidatePageSize"
        class="pager"
        layout="total, sizes, prev, pager, next"
        :page-sizes="[10, 20, 50]"
        :total="candidateTotal"
        @change="loadCandidates"
      />
      <template #footer>
        <el-button @click="pickerOpen = false">取消</el-button>
        <el-button type="primary" :loading="submitting" :disabled="!selectedCount" @click="addSelected">
          添加 {{ selectedCount }} 篇
        </el-button>
      </template>
    </el-dialog>
  </PageContainer>
</template>

<style scoped>
.base-summary { display: flex; align-items: center; gap: 18px; margin: 4px 0 28px; padding: 24px; background: #f7f9fc; border: 1px solid #edf0f5; border-radius: 12px; }
.summary-icon { display: grid; place-items: center; width: 54px; height: 54px; flex-shrink: 0; color: #005767; background: #e8f2ff; border-radius: 14px; }
.summary-copy { flex: 1; min-width: 0; }
.summary-label { color: #303133; font-size: 15px; font-weight: 600; }
.description { color: #909399; font-size: 14px; line-height: 1.7; margin: 8px 0 0; overflow-wrap: anywhere; }
.summary-count { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 100px; color: #909399; font-size: 12px; }
.summary-count strong { color: #303133; font-size: 28px; font-weight: 600; font-variant-numeric: tabular-nums; }
.section-heading { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
.section-heading h2 { font-size: 16px; color: #303133; margin: 0; }
.section-heading span { color: #a0a4ac; font-size: 12px; }
.refresh-list { margin-left: auto; }
.document-table { --el-table-header-bg-color: #f7f9fc; --el-table-header-text-color: #606266; --el-table-border-color: #edf0f5; }
.document-table :deep(.el-table__cell) { padding-top: 16px; padding-bottom: 16px; }
.picker-tip { display: flex; gap: 6px; align-items: center; padding: 12px 16px; background: #f7f9fc; border-radius: 8px; color: #606266; font-size: 13px; }
.picker-tip strong { display: inline-block; min-width: 62px; font-variant-numeric: tabular-nums; }
.picker-tip span { margin-left: auto; color: #909399; }
.pager { justify-content: flex-end; margin-top: 18px; }
.pdf-file-list { display: flex; flex-direction: column; gap: 10px; }
.pdf-file-option { margin-left: 0; height: auto; min-height: 40px; white-space: normal; text-align: left; justify-content: flex-start; }
.pdf-file-option :deep(span) { overflow-wrap: anywhere; }
@media (max-width: 640px) {
  .base-summary { flex-wrap: wrap; padding: 16px; }
  .summary-count { min-width: 64px; }
  .pager { overflow-x: auto; justify-content: flex-start; }
  .picker-tip { flex-wrap: wrap; }
}
</style>
