<!-- 文献问答的统一材料清单：衔接全局搜索与个人 PDF，显示就绪状态后统一启动分析。 -->
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { FolderOpened, Search, Upload } from '@element-plus/icons-vue'
import {
  deleteReadingPdf,
  fetchMaterials,
  fetchReadingMaterial,
  retryReadingPdf,
  uploadReadingPdf,
  type ReadingMaterial,
} from '@/research/api/literature-files'

const props = defineProps<{ currentIds: number[]; busy: boolean }>()
const emit = defineEmits<{
  analyze: [ids: number[]]
  change: [ids: number[]]
  search: [ids: number[]]
}>()
const visible = ref(false)
const query = ref('')
const page = ref(1)
const total = ref(0)
const rows = ref<ReadingMaterial[]>([])
// 草稿与已发布会话分开；这里只更新选材，不在添加材料时触发分析。
const chosen = ref<ReadingMaterial[]>([])
const loading = ref(false)
const restoring = ref(false)
const uploading = ref(false)
const acting = ref<number | null>(null)
const error = ref('')
const fileInput = ref<HTMLInputElement>()
let timer: ReturnType<typeof setTimeout> | undefined
let listEpoch = 0
let selectionEpoch = 0
let disposed = false
const pendingCount = computed(
  () => chosen.value.filter((item) => item.index.status !== 'SUCCESS').length,
)
const personalCount = computed(
  () => chosen.value.filter((item) => item.origin === 'PERSONAL').length,
)
const canAnalyze = computed(
  () =>
    chosen.value.length > 0 &&
    !pendingCount.value &&
    !props.busy &&
    !restoring.value &&
    !uploading.value &&
    acting.value === null,
)
const locked = computed(
  () => props.busy || restoring.value || uploading.value || acting.value !== null,
)

/** 返回服务端业务原因。 */
function describeError(value: unknown): string {
  const err = value as { response?: { data?: { error?: string } }; message?: string }
  return err.response?.data?.error || err.message || '请求失败，请重试'
}
/** 返回材料展示名称。 */
function title(item: ReadingMaterial): string {
  return item.title_cn || item.title_en || `材料 ${item.id}`
}
/** 把索引处理状态转换成用户可理解的标签。 */
function statusLabel(item: ReadingMaterial): string {
  if (item.index.retry_pending) return '等待重试'
  return (
    (
      {
        SUCCESS: '可分析',
        PENDING: '排队中',
        RUNNING: '正在解析',
        FAILED: '处理失败',
        STALE: '需要重建',
        NOT_INDEXED: '尚未处理',
        CANCELLED: '已取消',
        UNAVAILABLE: '读取失败',
      } as Record<string, string>
    )[item.index.status] || '状态未知'
  )
}
/** 不可读取的材料仍占据原草稿位置，交由用户重试或移除，禁止静默缩小分析范围。 */
function unavailable(id: number, reason: unknown): ReadingMaterial {
  const previous = chosen.value.find((item) => item.id === id)
  return {
    id,
    title_cn: null,
    title_en: null,
    author: null,
    publish_time: null,
    attachment: [],
    status: 0,
    owner_id: null,
    origin: 'LIBRARY',
    ...previous,
    index: {
      status: 'UNAVAILABLE',
      description: describeError(reason),
      can_rebuild: false,
      retry_pending: false,
    },
  }
}
/** 发布草稿 ID，父页面将其保存在地址中，切页、刷新和返回都可以恢复。 */
function publishSelection(): void {
  ++selectionEpoch
  restoring.value = false
  emit(
    'change',
    chosen.value.map((item) => item.id),
  )
  scheduleRefresh()
}
/** 更新材料状态，不改变本次选择顺序。 */
function updateMaterial(item: ReadingMaterial): void {
  rows.value = rows.value.map((row) => (row.id === item.id ? item : row))
  chosen.value = chosen.value.map((row) => (row.id === item.id ? item : row))
  scheduleRefresh()
}
/** 授权恢复或刷新整份草稿；旧请求和已卸载页面不能覆盖新选择。 */
async function restoreSelection(ids: number[]): Promise<void> {
  const generation = ++selectionEpoch
  restoring.value = true
  try {
    const results = await Promise.allSettled(ids.map(fetchReadingMaterial))
    if (generation !== selectionEpoch || disposed) return
    chosen.value = results.map((result, index) =>
      result.status === 'fulfilled' ? result.value : unavailable(ids[index], result.reason),
    )
  } finally {
    if (generation === selectionEpoch && !disposed) {
      restoring.value = false
      scheduleRefresh()
    }
  }
}
/** 搜索本人文件；列表请求拥有独立序号，翻页不会取消草稿状态刷新。 */
async function refreshFiles(): Promise<void> {
  const generation = ++listEpoch
  loading.value = true
  error.value = ''
  try {
    const result = await fetchMaterials('PERSONAL', query.value.trim(), page.value)
    if (generation !== listEpoch || !visible.value || disposed) return
    rows.value = result.items
    total.value = result.total
  } catch (err) {
    if (generation === listEpoch && !disposed) error.value = describeError(err)
  } finally {
    if (generation === listEpoch && !disposed) loading.value = false
  }
}
/** 仅在个人文件面板打开或材料处理中轮询，已有就绪清单不会持续请求。 */
function scheduleRefresh(): void {
  clearTimeout(timer)
  if (
    disposed ||
    (!visible.value &&
      !chosen.value.some(
        (item) => ['PENDING', 'RUNNING'].includes(item.index.status) || item.index.retry_pending,
      ))
  )
    return
  timer = setTimeout(async () => {
    if (uploading.value || acting.value !== null) {
      scheduleRefresh()
      return
    }
    await Promise.all([
      restoreSelection(chosen.value.map((item) => item.id)),
      ...(visible.value ? [refreshFiles()] : []),
    ])
  }, 5000)
}
/** 打开我的文件，不提供重复的库内搜索入口。 */
function open(): void {
  visible.value = true
  query.value = ''
  page.value = 1
  void refreshFiles()
  scheduleRefresh()
}
/** 关闭本人文件列表后继续刷新仍在处理的已选材料。 */
function close(): void {
  visible.value = false
  ++listEpoch
  loading.value = false
  scheduleRefresh()
}
/** 搜索或翻页时重新读取本人文件。 */
function search(nextPage = 1): void {
  page.value = nextPage
  void refreshFiles()
}
/** 勾选或移除材料后立即同步统一草稿，超过上限时不部分添加。 */
function toggle(item: ReadingMaterial): void {
  if (locked.value) return
  if (chosen.value.some((row) => row.id === item.id)) {
    chosen.value = chosen.value.filter((row) => row.id !== item.id)
  } else if (chosen.value.length < 20) chosen.value.push(item)
  else {
    ElMessage.warning('一次最多分析 20 篇材料')
    return
  }
  publishSelection()
}
/** 打开本机 PDF 文件选择框。 */
function pickFiles(): void {
  fileInput.value?.click()
}
/** 逐个上传到本人空间并加入统一草稿；上传本身不会触发分析。 */
async function upload(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  input.value = ''
  if (!files.length || locked.value) return
  uploading.value = true
  try {
    for (const file of files) {
      if (disposed) break
      if (!file.name.toLowerCase().endsWith('.pdf') || file.size > 50 * 1024 * 1024) {
        ElMessage.error(`${file.name}：请选择不超过 50 MB 的 PDF`)
        continue
      }
      try {
        const item = await uploadReadingPdf(file)
        if (disposed) return
        if (!chosen.value.some((row) => row.id === item.id) && chosen.value.length < 20) {
          chosen.value.push(item)
          publishSelection()
        } else if (chosen.value.length >= 20)
          ElMessage.info('文件已保存到我的文件，本次选择已达 20 篇上限')
      } catch (err) {
        ElMessage.error(`${file.name}：${describeError(err)}`)
      }
    }
    query.value = ''
    page.value = 1
    if (visible.value) await refreshFiles()
  } finally {
    uploading.value = false
    scheduleRefresh()
  }
}
/** 重试本人未就绪文件，并立即使用服务端返回的排队状态。 */
async function retry(item: ReadingMaterial): Promise<void> {
  if (locked.value) return
  acting.value = item.id
  try {
    updateMaterial(await retryReadingPdf(item.id))
  } catch (err) {
    ElMessage.error(describeError(err))
  } finally {
    acting.value = null
    scheduleRefresh()
  }
}
/** 删除个人原件需要确认；成功后同步移出草稿，普通移除操作不会删除原文件。 */
async function remove(item: ReadingMaterial): Promise<void> {
  if (locked.value) return
  try {
    await ElMessageBox.confirm(
      `删除「${title(item)}」后，引用和历史会话将无法继续读取此文件。`,
      '删除我的文件',
      { type: 'warning' },
    )
  } catch {
    return
  }
  acting.value = item.id
  try {
    const result = await deleteReadingPdf(item.id)
    chosen.value = chosen.value.filter((row) => row.id !== item.id)
    publishSelection()
    ElMessage.success(
      result.cleanup_pending ? '文件已移出个人空间，存储清理尚未完成' : '文件已删除',
    )
    await refreshFiles()
  } catch (err) {
    ElMessage.error(describeError(err))
  } finally {
    acting.value = null
    scheduleRefresh()
  }
}
/** 所有材料就绪后统一启动新分析，已有会话不受草稿变更影响。 */
function analyze(): void {
  if (canAnalyze.value)
    emit(
      'analyze',
      chosen.value.map((item) => item.id),
    )
}
watch(
  () => props.currentIds.join(','),
  () => {
    if (props.currentIds.join(',') !== chosen.value.map((item) => item.id).join(',')) {
      void restoreSelection([...props.currentIds])
    }
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  disposed = true
  ++listEpoch
  ++selectionEpoch
  clearTimeout(timer)
})
</script>

<template>
  <section class="reading-materials" aria-label="本次分析材料">
    <div class="materials-entry">
      <el-button
        :icon="Search"
        :disabled="locked"
        @click="
          emit(
            'search',
            chosen.map((item) => item.id),
          )
        "
        >从文献库添加</el-button
      >
      <el-button :icon="FolderOpened" :disabled="locked" @click="open">从本地添加</el-button>
    </div>
    <header class="materials-heading">
      <h3>
        本次分析材料 <span>已选 {{ chosen.length }} / 20 篇</span>
      </h3>
      <small v-if="chosen.length"
        >本地文件 {{ personalCount }} 篇 · 文献库 {{ chosen.length - personalCount }} 篇</small
      >
    </header>
    <p v-if="restoring && !chosen.length" class="materials-empty" role="status">
      正在恢复已选材料…
    </p>
    <div v-else-if="!chosen.length" class="materials-empty">
      还没有添加材料，可从文献库或本地文件添加。
    </div>
    <div v-else class="chosen-table" role="table" aria-label="已选分析材料">
      <div class="chosen-header" role="row">
        <span role="columnheader">材料</span><span role="columnheader">来源</span
        ><span role="columnheader">状态</span><span role="columnheader">操作</span>
      </div>
      <div v-for="item in chosen" :key="item.id" class="chosen-row" role="row">
        <span class="chosen-title" role="cell"
          >{{ title(item)
          }}<small v-if="item.index.status === 'UNAVAILABLE' || item.index.status === 'FAILED'">{{
            item.index.description
          }}</small></span
        >
        <span class="material-origin" role="cell">{{
          item.origin === 'PERSONAL' ? '本地文件' : '文献库'
        }}</span>
        <span role="cell"
          ><span
            class="material-status"
            :class="{
              ready: item.index.status === 'SUCCESS',
              failed: ['FAILED', 'UNAVAILABLE'].includes(item.index.status),
            }"
            :title="item.index.description"
            >{{ statusLabel(item) }}</span
          ></span
        >
        <span role="cell"
          ><el-button
            link
            :disabled="locked"
            :aria-label="`移除 ${title(item)}`"
            @click="toggle(item)"
            >移除</el-button
          ></span
        >
      </div>
    </div>
    <footer class="analysis-footer">
      <div class="selection-hint" role="status">
        <template v-if="pendingCount">{{ pendingCount }} 篇尚未就绪，全部就绪后可开始分析</template>
        <template v-else-if="uploading">正在上传文件…</template>
        <template v-else-if="restoring">正在核对材料状态…</template>
        <template v-else-if="chosen.length">已选材料将一起分析</template>
        <template v-else>支持混合选择，最多 20 篇</template>
        <el-button
          v-if="pendingCount"
          link
          :disabled="locked"
          @click="restoreSelection(chosen.map((item) => item.id))"
          >刷新状态</el-button
        >
      </div>
      <el-button type="primary" size="large" :disabled="!canAnalyze" @click="analyze"
        >开始分析{{ chosen.length ? `（${chosen.length} 篇）` : '' }}</el-button
      >
    </footer>
  </section>
  <el-drawer
    v-model="visible"
    title="我的文件"
    size="min(820px, 100vw)"
    class="literature-materials"
    :close-on-click-modal="!uploading"
    :show-close="!uploading"
    :close-on-press-escape="!uploading"
    @closed="close"
  >
    <p class="privacy-note">本地文件仅本人可见，勾选后加入本次分析材料。</p>
    <input
      ref="fileInput"
      class="file-input"
      type="file"
      accept=".pdf,application/pdf"
      multiple
      aria-label="选择本地 PDF 文件"
      @change="upload"
    />
    <div class="material-search">
      <el-input
        v-model="query"
        clearable
        placeholder="搜索我的文件"
        aria-label="搜索我的文件"
        @keyup.enter="search()"
        @clear="search()"
      />
      <el-button @click="search()">搜索</el-button>
      <el-button
        :icon="Upload"
        :loading="uploading"
        :disabled="locked && !uploading"
        @click="pickFiles"
        >上传 PDF</el-button
      >
    </div>
    <p v-if="error" class="material-error" role="alert">
      {{ error }} <el-button link @click="refreshFiles">重试</el-button>
    </p>
    <el-table
      :data="rows"
      row-key="id"
      :empty-text="loading ? '正在加载…' : '还没有文件，上传 PDF 即可添加'"
      class="materials-table"
    >
      <el-table-column label="选择" width="58">
        <template #default="{ row }"
          ><el-checkbox
            :model-value="chosen.some((item) => item.id === row.id)"
            :disabled="locked"
            :aria-label="`选择 ${title(row)}`"
            @change="toggle(row)"
        /></template>
      </el-table-column>
      <el-table-column label="文件" min-width="170">
        <template #default="{ row }">
          <strong class="material-title">{{ title(row) }}</strong>
          <small class="material-meta">{{ row.author || '作者未提供' }}</small>
          <div class="material-inline-actions">
            <el-button
              v-if="row.index.can_rebuild && row.index.status !== 'SUCCESS'"
              link
              :disabled="locked"
              @click="retry(row)"
              >重试</el-button
            >
            <el-button link type="danger" :disabled="locked" @click="remove(row)">删除</el-button>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="处理状态" width="110">
        <template #default="{ row }"
          ><span
            class="material-status"
            :class="{
              ready: row.index.status === 'SUCCESS',
              failed: row.index.status === 'FAILED',
            }"
            :title="row.index.description"
            >{{ statusLabel(row) }}</span
          ></template
        >
      </el-table-column>
    </el-table>
    <el-pagination
      v-if="total > 20"
      layout="prev, pager, next"
      :total="total"
      :page-size="20"
      :current-page="page"
      @current-change="search"
    />
    <template #footer>
      <div class="material-footer">
        <span>本次共选 {{ chosen.length }} / 20 篇，含本地文件 {{ personalCount }} 篇</span
        ><el-button type="primary" :disabled="uploading" @click="visible = false"
          >完成选择</el-button
        >
      </div>
    </template>
  </el-drawer>
</template>

<style scoped>
.reading-materials {
  margin-top: 24px;
  text-align: left;
}
.materials-entry,
.material-search,
.material-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.materials-entry :deep(.el-button + .el-button) {
  margin-left: 0;
}
.materials-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin: 28px 0 12px;
}
.materials-heading h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #25343d;
}
.materials-heading h3 span {
  margin-left: 12px;
  font-size: 13px;
  font-weight: 400;
  color: #637580;
}
.materials-heading > small {
  font-size: 12px;
  color: #75838c;
}
.materials-empty {
  margin: 0;
  padding: 32px 16px;
  text-align: center;
  background: #f7f9fa;
  border: 1px dashed #dfe7ea;
  border-radius: 8px;
  color: #75838c;
  font-size: 13px;
}
.chosen-header,
.chosen-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 72px 92px 44px;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #edf1f3;
}
.chosen-header {
  font-size: 12px;
  color: #75838c;
}
.chosen-row {
  font-size: 13px;
}
.chosen-title {
  min-width: 0;
  overflow-wrap: anywhere;
  line-height: 1.6;
}
.chosen-title small {
  display: block;
  font-size: 12px;
  color: #b42318;
}
.material-origin {
  font-size: 12px;
  color: #637580;
}
.analysis-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 22px;
}
.selection-hint {
  font-size: 12px;
  color: #637580;
  line-height: 1.8;
}
.analysis-footer :deep(.el-button--primary) {
  --el-color-primary: #075762;
  --el-color-primary-light-3: #357f88;
}
.file-input {
  display: none;
}
.privacy-note,
.material-meta {
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
}
.material-search {
  flex-wrap: nowrap;
  margin: 8px 0 16px;
}
.material-search .el-input {
  flex: 1;
  min-width: 100px;
}
.material-search .el-button {
  margin-left: 0;
}
.material-title {
  font-weight: 500;
  overflow-wrap: anywhere;
  line-height: 1.6;
}
.material-meta {
  display: block;
  font-size: 12px;
}
.materials-table {
  width: 100%;
  margin-bottom: 16px;
}
.material-error {
  color: #b42318;
  line-height: 1.6;
}
.material-status {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #64748b;
  font-size: 12px;
  white-space: nowrap;
}
.material-status.ready {
  background: #eef8f0;
  color: #278044;
}
.material-status.failed {
  background: #fff1f0;
  color: #b42318;
}
.material-footer {
  justify-content: space-between;
}
.material-footer > span {
  font-size: 12px;
  color: #64748b;
}
@media (max-width: 600px) {
  .materials-entry {
    gap: 8px;
  }
  .materials-entry .el-button {
    margin-left: 0;
  }
  .material-search {
    flex-wrap: wrap;
  }
  .material-search .el-input {
    flex-basis: 100%;
  }
  .chosen-header,
  .chosen-row {
    grid-template-columns: minmax(0, 1fr) 52px 72px 30px;
    gap: 6px;
  }
  .chosen-row,
  .chosen-header {
    font-size: 12px;
  }
  .material-status {
    padding: 2px 4px;
  }
  .analysis-footer {
    align-items: stretch;
    flex-direction: column;
  }
  .analysis-footer > .el-button {
    width: 100%;
  }
}
</style>
