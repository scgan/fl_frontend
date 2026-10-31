<!-- 术语查找：按术语名 / 所属类别检索术语，点击“详细信息”查看完整出处与定义。 -->
<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Edit, Paperclip } from '@element-plus/icons-vue'
import request from '@/utils/request'
import { getUserInfoService } from '@/api/user'
import {
  TERM_MANAGE_API_READY,
  addEntryToList,
  createDefinitionEntry,
  createSourceMla,
  getTermCategoryOptions,
  getTermListService,
  moveEntryInList,
  normalizeTermEntries,
  removeEntryFromList,
  termDeleteService,
  updateTerm,
} from '@/api/terminology'

// 所属类别下拉：直接读取现有大类（与术语上传页同一份数据）
const categoryOptions = ref([])

const loading = ref(false)
const params = ref({
  page_num: 1,
  page_size: 10,
  name: '',
  category: '', // 所属类别筛选
})

const termList = ref([])
const total = ref(0)

/* ------------------------------------------------------------------ *
 * 列表里的「示例术语」：纯前端展示，不来自后端，也不参与任何请求，
 * 用来预览「一个术语有多条定义、每个条目有多条 MLA 与多个附件」的展示效果。
 * 目前整体注释掉（列表中不再出现示例术语）；需要恢复时取消下面三处注释：
 *   1) 本段 EXAMPLE_TERM；
 *   2) 下方 prependExampleTerm；
 *   3) loadTerms 里被注释的那两行赋值。
 * ------------------------------------------------------------------ */
// const EXAMPLE_TERM = {
//   id: 'example-term',
//   isExample: true,
//   name: '仁（示例术语）',
//   status: 1,
//   contributor: null,
//   // 术语出处：多条 MLA（附件在模块上，可多个）
//   sources: [
//     '王弼, 注. 老子道德经. 四部丛刊本, 中华书局, 1936. 中国哲学书电子化计划, ctext.org/dao-de-jing/zh.',
//     'Legge, James. The Chinese Classics. Vol. 1, Clarendon Press, 1893. Chinese Text Project, ctext.org/analects/xue-er/en.',
//   ],
//   source_attachments: [
//     { name: '老子道德经·四部丛刊本.pdf', url: '' },
//     { name: '老子道德经·校勘记.pdf', url: '' },
//   ],
//   // 中/英文定义：每个定义可写多条 MLA，可带多个附件
//   definitions_cn: [
//     {
//       text: '仁：儒家核心德目之一，指爱人、推己及人的道德自觉；《论语》中常与「礼」并举，强调内在德性与外在规范的统一。',
//       sources: [
//         '杨伯峻. 论语译注. 中华书局, 1980, pp. 12-15. 万方数据, https://doi.org/10.3969/j.issn.1000-0216.1980.02.005.',
//         '李泽厚. “孔子的仁学思想.” 哲学研究, vol. 3, no. 2, 1985, pp. 45-52. 万方数据, https://doi.org/10.3969/j.issn.1000-0216.1985.02.005.',
//       ],
//       attachments: [
//         { name: '论语译注·仁篇摘录.pdf', url: '' },
//         { name: '孔子的仁学思想.pdf', url: '' },
//       ],
//     },
//     {
//       text: '又：孟子以「仁」为人心，主张「仁者爱人」，并把它扩展为治国理政的根本原则。',
//       sources: [
//         '朱熹. 四书章句集注. 中华书局, 1983, pp. 201-205. 中国哲学书电子化计划, ctext.org/mengzi/liang-hui-wang-i/zh.',
//       ],
//       // 演示「附件后台识别中」的展示
//       process: { state: 'processing' },
//       attachments: [{ name: '四书章句集注·孟子卷.pdf', url: '' }],
//     },
//   ],
//   definitions_en: [
//     {
//       text: 'Ren (humaneness): the cardinal Confucian virtue of loving others and extending that care from oneself to others.',
//       sources: [
//         'Legge, James. The Chinese Classics. Vol. 1, Clarendon Press, 1893. Chinese Text Project, ctext.org/analects/li-ren/en.',
//         'Caldwell, Elizabeth F., et al. “Depicting Dementia.” Children’s Literature in Education, vol. 52, no. 1, 2021, pp. 106-31. SpringerLink, https://doi.org/10.1007/s10583-020-09405-w.',
//       ],
//       attachments: [
//         { name: 'The Chinese Classics Vol.1.pdf', url: '' },
//         { name: 'Analects Glossary.pdf', url: '' },
//       ],
//     },
//   ],
// }

// 只在第 1 页把示例术语插到最前面（并同步修正总数，避免分页对不上）——示例术语已注释，暂不使用
// const prependExampleTerm = (items, pageNum) =>
//   pageNum === 1 ? [EXAMPLE_TERM, ...items] : items

const loadTerms = async () => {
  loading.value = true
  try {
    const { data: resp } = await getTermListService({
      page_num: params.value.page_num,
      page_size: params.value.page_size,
      name: params.value.name || undefined,
      category: params.value.category || undefined,
    })
    if (resp.code === 200) {
      // 示例术语已注释：需要恢复时取消下面两行注释、并恢复 prependExampleTerm 与 EXAMPLE_TERM
      // termList.value = prependExampleTerm(resp.data.items || [], params.value.page_num)
      // total.value = (resp.data.total || 0) + (params.value.page_num === 1 ? 1 : 0)
      termList.value = resp.data.items || []
      total.value = resp.data.total || 0
    } else {
      ElMessage.error(resp.error || '术语查询失败')
    }
  } catch {
    ElMessage.error('术语查询失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    categoryOptions.value = await getTermCategoryOptions()
  } catch {
    categoryOptions.value = []
  }
  loadCurrentUser() // 不阻塞列表加载，拿到用户 id 后「操作」列按钮状态会自动更新
  await loadTerms()
})

// 类别的 id → 名称（列表与详情里展示用）
const categoryLabelOf = (category) =>
  categoryOptions.value.find((item) => item.value === category)?.label || '—'

// 示例术语不属于任何真实大类，单独标注
const categoryTextOf = (row) => (row?.isExample ? '示例（不参与筛选）' : categoryLabelOf(row?.category))


const onSearch = () => {
  params.value.page_num = 1
  loadTerms()
}

const reset = () => {
  params.value.name = ''
  params.value.category = ''
  params.value.page_num = 1
  loadTerms()
}

const onSizeChange = () => {
  params.value.page_num = 1
  loadTerms()
}

const onCurrentChange = () => {
  loadTerms()
}

// 详情弹框
const detailVisible = ref(false)
const currentTerm = ref(null)

const openDetail = async (row) => {
  currentTerm.value = row
  detailVisible.value = true
  // 列表行可能落后于后台进度：先查一次该术语的最新状态，再按需开启轮询
  await refreshTrackedRow()
  ensureProcessPolling()
}

const viewAttachment = async (url) => {
  if (!url) return
  try {
    // 附件文献多为待审核状态，公共文件接口不放行；
    // 改为带登录态取文件流，再以 blob 新标签页打开。
    // baseURL 已含 /api，这里剥掉 url 里重复的前缀
    const path = url.replace(/^\/api/, '')
    const resp = await request.get(path, { responseType: 'blob' })
    const blob = new Blob([resp.data], { type: 'application/pdf' })
    const blobUrl = URL.createObjectURL(blob)
    const win = window.open(blobUrl, '_blank')
    if (!win) {
      // 弹窗被拦截时退化为下载
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = '附件.pdf'
      link.click()
    }
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000)
  } catch {
    ElMessage.error('附件打开失败，请稍后重试')
  }
}

/* ---------------- 术语管理：编辑 / 删除 ---------------- */

// 当前登录用户 id：术语列表是全库公开的，这里限制只能管理自己提交的术语
const currentUserId = ref(null)

const loadCurrentUser = async () => {
  try {
    const res = await getUserInfoService()
    currentUserId.value = res?.data?.data?.id ?? null
  } catch {
    currentUserId.value = null // 取不到时不做归属限制，由后端校验
  }
}

// 已审核通过的术语不允许再改动（与文献管理的处理一致）；示例术语也不可管理
const canManage = (row) =>
  !row?.isExample &&
  row?.status !== 2 &&
  (currentUserId.value === null || row?.contributor === currentUserId.value)

const manageDisabledTip = (row) =>
  row?.isExample
    ? '示例术语仅用于预览展示效果，不能修改或删除'
    : row?.status === 2
      ? '该术语已审核通过，不能再修改或删除'
      : '只能管理自己提交的术语'

const manageVisible = ref(false)
const manageSaving = ref(false)
const manageFormRef = ref()
const manageForm = ref({})

const manageRules = {
  name: [{ required: true, message: '术语名不能为空', trigger: 'blur' }],
  category: [{ required: true, message: '所属类别不能为空', trigger: 'change' }],
}

// 单条目里的必填规则（配合 :prop="`sources.${index}.mla`" 使用）
const requiredRule = (message) => [{ required: true, message, trigger: 'blur' }]

/* ---------------- 多条目：新增 / 删除 / 排序（与术语上传页一致） ---------------- */

// 术语出处：每条就是一个 MLA 输入框（附件在模块上）
const addManageSource = () => addEntryToList(manageForm.value.sources, createSourceMla)
const removeManageSource = (index) => removeEntryFromList(manageForm.value.sources, index)
const moveManageSource = (index, offset) => moveEntryInList(manageForm.value.sources, index, offset)

// 中/英文定义：定义条目 + 每个定义里的多条 MLA
const manageDefinitionFactories = {
  definitions_cn: createDefinitionEntry,
  definitions_en: createDefinitionEntry,
}
const addManageDefinition = (listKey) =>
  addEntryToList(manageForm.value[listKey], manageDefinitionFactories[listKey])
const removeManageDefinition = (listKey, index) => removeEntryFromList(manageForm.value[listKey], index)
const moveManageDefinition = (listKey, index, offset) =>
  moveEntryInList(manageForm.value[listKey], index, offset)

const addManageDefinitionMla = (listKey, index) =>
  addEntryToList(manageForm.value[listKey][index].sources, createSourceMla)
const removeManageDefinitionMla = (listKey, index, mlaIndex) =>
  removeEntryFromList(manageForm.value[listKey][index].sources, mlaIndex)
const moveManageDefinitionMla = (listKey, index, mlaIndex, offset) =>
  moveEntryInList(manageForm.value[listKey][index].sources, mlaIndex, offset)

// 把后端返回的一条术语转成可编辑表单：
// existing = 已入库的附件（只展示，换新附件才会改绑定），attachments = 本次新选的文件
const toEditableDefinitions = (entries) =>
  entries.map((entry) => ({
    ...createDefinitionEntry(entry.text, ''),
    sources: entry.mlas.length ? [...entry.mlas] : [''],
    existing: entry.attachments || [],
    process: entry.process || null,
  }))

const onEditTerm = async (row) => {
  const detail = normalizeTermEntries(row)
  manageForm.value = {
    terminology_id: row.id,
    name: row.name || '',
    category: row.category ?? '',
    sources: detail.sourceMlas.length ? [...detail.sourceMlas] : [''],
    sourceAttachments: [],
    sourceExisting: detail.sourceAttachments,
    sourceProcess: detail.sourceProcess,
    definitions_cn: toEditableDefinitions(detail.definitionsCn),
    definitions_en: toEditableDefinitions(detail.definitionsEn),
  }
  manageVisible.value = true

  // 列表行可能是几秒前的数据：打开弹窗时先按 id 立刻查一次该术语的最新状态，
  // 再按需开启轮询（识别中 → 每 5 秒刷新，完成后自动显示附件）
  await refreshTrackedRow()
  ensureProcessPolling()
}

// 附件后台识别状态轮询：详情弹窗或编辑弹窗打开、且该术语还有附件在「识别中」时，
// 每 5 秒拉一次该术语最新状态；识别完成后自动更新弹窗与列表行的附件显示，避免一直显示「未上传」
let processTimer = null

// 详情弹窗按模块归一化后的结果
const detailEntries = computed(() => normalizeTermEntries(currentTerm.value || {}))

// 当前要跟踪的术语：编辑弹窗优先，其次详情弹窗
const trackedTermId = () =>
  (manageVisible.value && manageForm.value.terminology_id) ||
  (detailVisible.value && currentTerm.value?.id) ||
  null

const anyProcessing = (entries = []) => entries.some((entry) => entry?.process?.state === 'processing')
const isProcessing = (state) => state === 'processing'

const hasProcessingField = () => {
  if (manageVisible.value) {
    const form = manageForm.value
    return (
      isProcessing(form.sourceProcess?.state) ||
      anyProcessing(form.definitions_cn || []) ||
      anyProcessing(form.definitions_en || [])
    )
  }
  if (detailVisible.value) {
    const detail = detailEntries.value
    return (
      isProcessing(detail.sourceProcess?.state) ||
      anyProcessing(detail.definitionsCn) ||
      anyProcessing(detail.definitionsEn)
    )
  }
  return false
}

// 该条目是否正在后台识别（识别中就在原附件位置显示提示）
const isEntryProcessing = (entry) => isProcessing(entry?.process?.state)

// 轮询刷新时只更新「已入库附件 + 处理状态」，不动用户正在编辑的文字与新选文件
const syncTrackedProcess = (freshEntries) => {
  manageForm.value.sourceExisting = freshEntries.sourceAttachments || []
  manageForm.value.sourceProcess = freshEntries.sourceProcess || null

  const syncList = (list, freshList) => {
    ;(list || []).forEach((entry, index) => {
      const fresh = freshList?.[index]
      if (!fresh) return
      entry.existing = fresh.attachments
      entry.process = fresh.process
    })
  }
  syncList(manageForm.value.definitions_cn, freshEntries.definitionsCn)
  syncList(manageForm.value.definitions_en, freshEntries.definitionsEn)
}

const refreshTrackedRow = async () => {
  const id = trackedTermId()
  if (!id) return
  try {
    // 后端 /terminology/get 支持 terminology_id 精确查询
    const { data: resp } = await getTermListService({ terminology_id: id })
    if (resp.code !== 200) return
    const fresh = (resp.data.items || []).find((item) => item.id === id)
    if (!fresh) return
    // 同步列表里的该行，后续重新打开弹窗看到的就是最新数据
    const idx = termList.value.findIndex((item) => item.id === id)
    if (idx !== -1) termList.value.splice(idx, 1, fresh)
    // 编辑弹窗开着 → 按模块同步已入库附件与处理状态
    if (manageVisible.value && manageForm.value.terminology_id === id) {
      syncTrackedProcess(normalizeTermEntries(fresh))
    }
    // 详情弹窗开着 → 整行换成最新数据（附件状态、附件链接都会跟着更新）
    if (detailVisible.value && currentTerm.value?.id === id) {
      currentTerm.value = fresh
    }
    if (!hasProcessingField()) stopProcessPolling()
  } catch {
    // 静默失败，下个周期再试
  }
}

// 需要就开启轮询，不需要就停掉（弹窗关闭、识别完成时都会走到这里）
const ensureProcessPolling = () => {
  stopProcessPolling()
  if (hasProcessingField()) {
    processTimer = setInterval(refreshTrackedRow, 5000)
  }
}

const stopProcessPolling = () => {
  if (processTimer) {
    clearInterval(processTimer)
    processTimer = null
  }
}

const onSaveTerm = async () => {
  try {
    await manageFormRef.value?.validate()
  } catch {
    return
  }
  if (!TERM_MANAGE_API_READY) {
    ElMessage.info('术语编辑接口尚未接入，暂不能保存（后端待提供 /terminology/update）')
    return
  }
  manageSaving.value = true
  try {
    // 文本与各条目新选的附件一起提交；新附件由后端后台识别入库后绑定，原文献不受影响
    const result = await updateTerm(manageForm.value)
    if (result.ok === false) {
      ElMessage.error(result.message)
      return
    }
    if (result.reused?.length) {
      ElMessage.warning({
        message: `附件「${result.reused.map((item) => item.file).join('」、「')}」在文献库中已有同名文献，已直接关联已有文献`,
        duration: 10000,
        showClose: true,
      })
    }
    ElMessage.success('修改成功')
    manageVisible.value = false
    await loadTerms()
  } finally {
    manageSaving.value = false
  }
}

const onDeleteTerm = async (row) => {
  if (!TERM_MANAGE_API_READY) {
    ElMessage.info('术语删除接口尚未接入，暂不能删除（后端待提供 /terminology/delete）')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确定删除术语「${row.name}」吗？只删除该术语条目，已入库的文献与附件仍保留在文献库中。`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch {
    return // 用户取消
  }

  const res = await termDeleteService(row.id)
  if (res.data.code === 200) {
    ElMessage.success('删除成功')
    // 删掉当前页最后一条时回退一页，避免停在空页
    if (termList.value.length === 1 && params.value.page_num > 1) params.value.page_num -= 1
    await loadTerms()
  }
}
</script>

<template>
  <PageContainer title="术语查找">
    <!-- 筛选栏 -->
    <el-form :inline="true" label-width="80px">
      <el-form-item label="术语名称">
        <el-input
          v-model="params.name"
          placeholder="请输入术语名称"
          clearable
          style="width: 240px"
          @keyup.enter="onSearch"
        ></el-input>
      </el-form-item>
      <el-form-item label="所属类别">
        <el-select
          v-model="params.category"
          placeholder="全部类别"
          clearable
          style="width: 260px"
          @change="onSearch"
        >
          <el-option
            v-for="item in categoryOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="onSearch">搜索</el-button>
        <el-button @click="reset">重置</el-button>
      </el-form-item>
    </el-form>

    <!-- 展示列表 -->
    <el-table :data="termList" v-loading="loading" style="width: 100%">
      <el-table-column label="序号" width="70">
        <template #default="scope">
          <span>{{ (params.page_num - 1) * params.page_size + scope.$index + 1 }}</span>
        </template>
      </el-table-column>
      <el-table-column label="术语名" width="180" show-overflow-tooltip>
        <template #default="{ row }">
          <span>{{ row.name }}</span>
          <el-tag v-if="row.isExample" class="term-example-tag" type="info" effect="plain" size="small">
            示例
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="所属类别" min-width="190" show-overflow-tooltip>
        <template #default="{ row }">{{ categoryTextOf(row) }}</template>
      </el-table-column>
      <el-table-column prop="source_mla" label="术语出处" min-width="200" show-overflow-tooltip />
      <el-table-column prop="definition_cn" label="中文定义" min-width="200" show-overflow-tooltip />
      <el-table-column prop="definition_en" label="英文定义" min-width="200" show-overflow-tooltip />
      <el-table-column label="详细信息" width="110">
        <template #default="{ row }">
          <el-button type="primary" link @click="openDetail(row)">详细信息</el-button>
        </template>
      </el-table-column>
      <!-- 术语管理：编辑 / 删除（与文献管理的「操作」列一致） -->
      <el-table-column label="操作" width="130">
        <template #default="{ row }">
          <el-tooltip :disabled="canManage(row)" :content="manageDisabledTip(row)" placement="top">
            <span class="term-manage">
              <el-button
                :icon="Edit"
                circle
                plain
                type="primary"
                :disabled="!canManage(row)"
                @click="onEditTerm(row)"
              ></el-button>
              <el-button
                :icon="Delete"
                circle
                plain
                type="danger"
                :disabled="!canManage(row)"
                @click="onDeleteTerm(row)"
              ></el-button>
            </span>
          </el-tooltip>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty description="没有数据"></el-empty>
      </template>
    </el-table>

    <el-pagination
      v-model:current-page="params.page_num"
      v-model:page-size="params.page_size"
      :page-sizes="[10, 20, 50, 100]"
      layout="jumper, total, sizes, prev, pager, next"
      background
      :total="total"
      @size-change="onSizeChange"
      @current-change="onCurrentChange"
      style="margin-top: 20px; justify-content: flex-end"
    />

    <!-- 术语详细信息弹框 -->
    <el-dialog
      v-model="detailVisible"
      title="术语详细信息"
      width="680px"
      top="6vh"
      @closed="ensureProcessPolling"
    >
      <div v-if="currentTerm" class="term-detail">
        <h2 class="term-detail__name">{{ currentTerm.name }}</h2>
        <p class="term-detail__meta term-detail__meta--center">
          所属类别：{{ categoryTextOf(currentTerm) }}
        </p>

        <!-- 每个模块按「多条」展示，顺序与录入一致；附件识别中时在原来显示附件的位置给出提示 -->
        <div class="term-detail__section">
          <div class="term-detail__label">术语出处</div>
          <div class="term-detail__body">
            <div
              v-for="(mla, index) in detailEntries.sourceMlas"
              :key="`source-mla-${index}`"
              class="term-detail__source"
            >
              <span v-if="detailEntries.sourceMlas.length > 1" class="term-detail__source-label">
                出处 {{ index + 1 }}：
              </span>
              {{ mla }}
            </div>
            <p v-if="!detailEntries.sourceMlas.length" class="term-detail__text">—</p>

            <el-tag
              v-if="isProcessing(detailEntries.sourceProcess?.state)"
              type="warning"
              effect="plain"
              size="small"
            >
              附件后台识别中，完成后自动显示
            </el-tag>
            <div v-else-if="detailEntries.sourceAttachments.length" class="term-detail__links">
              <el-link
                v-for="(file, fileIndex) in detailEntries.sourceAttachments"
                :key="`source-file-${fileIndex}`"
                type="primary"
                :underline="false"
                @click="viewAttachment(file.url)"
              >
                <el-icon class="term-detail__link-icon"><Paperclip /></el-icon>
                {{ file.name }}
              </el-link>
            </div>
          </div>
        </div>

        <div class="term-detail__section">
          <div class="term-detail__label">术语定义（中文）</div>
          <div class="term-detail__body">
            <div
              v-for="(entry, index) in detailEntries.definitionsCn"
              :key="`cn-${index}`"
              class="term-detail__entry"
            >
              <div v-if="detailEntries.definitionsCn.length > 1" class="term-detail__entry-no">
                定义 {{ index + 1 }}
              </div>
              <p class="term-detail__text">{{ entry.text || '—' }}</p>
              <div
                v-for="(mla, mlaIndex) in entry.mlas"
                :key="`cn-mla-${index}-${mlaIndex}`"
                class="term-detail__source"
              >
                <span class="term-detail__source-label">
                  {{ entry.mlas.length > 1 ? `定义出处 ${mlaIndex + 1}：` : '定义出处：' }}
                </span>
                {{ mla }}
              </div>
              <el-tag v-if="isEntryProcessing(entry)" type="warning" effect="plain" size="small">
                附件后台识别中，完成后自动显示
              </el-tag>
              <div v-else-if="entry.attachments.length" class="term-detail__links">
                <el-link
                  v-for="(file, fileIndex) in entry.attachments"
                  :key="`cn-file-${index}-${fileIndex}`"
                  type="primary"
                  :underline="false"
                  @click="viewAttachment(file.url)"
                >
                  <el-icon class="term-detail__link-icon"><Paperclip /></el-icon>
                  {{ file.name }}
                </el-link>
              </div>
            </div>
          </div>
        </div>

        <div class="term-detail__section">
          <div class="term-detail__label">Definition（英文）</div>
          <div class="term-detail__body">
            <div
              v-for="(entry, index) in detailEntries.definitionsEn"
              :key="`en-${index}`"
              class="term-detail__entry"
            >
              <div v-if="detailEntries.definitionsEn.length > 1" class="term-detail__entry-no">
                定义 {{ index + 1 }}
              </div>
              <p class="term-detail__text">{{ entry.text || '—' }}</p>
              <div
                v-for="(mla, mlaIndex) in entry.mlas"
                :key="`en-mla-${index}-${mlaIndex}`"
                class="term-detail__source"
              >
                <span class="term-detail__source-label">
                  {{ entry.mlas.length > 1 ? `定义出处 ${mlaIndex + 1}：` : '定义出处：' }}
                </span>
                {{ mla }}
              </div>
              <el-tag v-if="isEntryProcessing(entry)" type="warning" effect="plain" size="small">
                附件后台识别中，完成后自动显示
              </el-tag>
              <div v-else-if="entry.attachments.length" class="term-detail__links">
                <el-link
                  v-for="(file, fileIndex) in entry.attachments"
                  :key="`en-file-${index}-${fileIndex}`"
                  type="primary"
                  :underline="false"
                  @click="viewAttachment(file.url)"
                >
                  <el-icon class="term-detail__link-icon"><Paperclip /></el-icon>
                  {{ file.name }}
                </el-link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>
    <!-- 术语编辑弹框 -->
    <el-dialog
      v-model="manageVisible"
      title="修改术语"
      width="680px"
      top="6vh"
      @closed="ensureProcessPolling"
    >
      <el-form
        ref="manageFormRef"
        :model="manageForm"
        :rules="manageRules"
        label-width="160px"
        class="term-manage-form"
      >
        <el-form-item label="术语名" prop="name">
          <el-input v-model="manageForm.name" placeholder="请输入术语名" clearable />
        </el-form-item>
        <el-form-item label="所属类别" prop="category">
          <el-select
            v-model="manageForm.category"
            placeholder="请选择该术语所属的大类"
            style="width: 100%"
          >
            <el-option
              v-for="item in categoryOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>

        <div class="term-edit-attachment__tip">
          三个模块都可以新增多条；中/英文定义的每个定义都可以写多条 MLA 出处，也可以上传多个附件。
          新附件保存后由系统在后台识别入库并绑定到本术语（所属类别与术语一致）；
          <b>原来的文献与附件仍保留在文献库中</b>，不会被删除。
        </div>

        <!-- 模块一：术语出处（多条 MLA，附件在模块上、可多个） -->
        <div class="term-module">
          <div class="term-module__head">
            <span class="term-module__title">术语出处</span>
            <el-button type="primary" plain size="small" @click="addManageSource">
              + 新增出处
            </el-button>
          </div>

          <el-form-item
            v-for="(mla, index) in manageForm.sources"
            :key="`manage-source-${index}`"
            :label="`出处 ${index + 1}`"
            :prop="`sources.${index}`"
            :rules="requiredRule('术语出处不能为空')"
          >
            <div class="mla-row">
              <el-input
                v-model="manageForm.sources[index]"
                type="textarea"
                :rows="2"
                placeholder="按照MLA格式"
              />
              <div class="mla-row__ops">
                <el-button link size="small" :disabled="index === 0" @click="moveManageSource(index, -1)">
                  上移
                </el-button>
                <el-button
                  link
                  size="small"
                  :disabled="index === manageForm.sources.length - 1"
                  @click="moveManageSource(index, 1)"
                >
                  下移
                </el-button>
                <el-button
                  link
                  size="small"
                  type="danger"
                  :disabled="manageForm.sources.length === 1"
                  @click="removeManageSource(index)"
                >
                  删除
                </el-button>
              </div>
            </div>
          </el-form-item>

          <el-form-item label="术语出处附件">
            <div class="term-edit-attachment">
              <div class="term-edit-attachment__current">
                <el-tag
                  v-if="isProcessing(manageForm.sourceProcess?.state)"
                  type="warning"
                  effect="plain"
                  size="small"
                >
                  后台识别中，完成后自动显示
                </el-tag>
                <el-tag
                  v-else-if="manageForm.sourceProcess?.state === 'failed'"
                  type="danger"
                  effect="plain"
                  size="small"
                >
                  后台识别失败，请重新上传附件
                </el-tag>
                <template v-else-if="manageForm.sourceExisting?.length">
                  当前：
                  <span class="term-edit-attachment__links">
                    <el-link
                      v-for="(file, fileIndex) in manageForm.sourceExisting"
                      :key="fileIndex"
                      type="primary"
                      :underline="false"
                      @click="viewAttachment(file.url)"
                    >
                      {{ file.name }}
                    </el-link>
                  </span>
                </template>
                <span v-else>未上传</span>
              </div>
              <el-upload
                v-model:file-list="manageForm.sourceAttachments"
                :auto-upload="false"
                :show-file-list="true"
                multiple
                accept=".pdf"
              >
                <el-button>上传新附件（选填，可多选）</el-button>
              </el-upload>
            </div>
          </el-form-item>
        </div>

        <!-- 模块二：术语定义（中文）：每个定义可写多条 MLA 出处，附件可多个 -->
        <div class="term-module">
          <div class="term-module__head">
            <span class="term-module__title">术语定义（中文）</span>
            <el-button
              type="primary"
              plain
              size="small"
              @click="addManageDefinition('definitions_cn')"
            >
              + 新增定义
            </el-button>
          </div>

          <div
            v-for="(entry, index) in manageForm.definitions_cn"
            :key="entry._uid"
            class="term-entry"
          >
            <div class="term-entry__head">
              <span class="term-entry__no">定义 {{ index + 1 }}</span>
              <div class="term-entry__ops">
                <el-button
                  size="small"
                  :disabled="index === 0"
                  @click="moveManageDefinition('definitions_cn', index, -1)"
                >
                  上移
                </el-button>
                <el-button
                  size="small"
                  :disabled="index === manageForm.definitions_cn.length - 1"
                  @click="moveManageDefinition('definitions_cn', index, 1)"
                >
                  下移
                </el-button>
                <el-button
                  size="small"
                  type="danger"
                  plain
                  :disabled="manageForm.definitions_cn.length === 1"
                  @click="removeManageDefinition('definitions_cn', index)"
                >
                  删除
                </el-button>
              </div>
            </div>

            <el-form-item
              label="术语定义（中文）"
              :prop="`definitions_cn.${index}.text`"
              :rules="requiredRule('术语定义（中文）不能为空')"
            >
              <el-input v-model="entry.text" type="textarea" :rows="3" />
            </el-form-item>

            <el-form-item
              v-for="(mla, mlaIndex) in entry.sources"
              :key="`manage-cn-mla-${index}-${mlaIndex}`"
              :label="`定义出处 ${mlaIndex + 1}`"
            >
              <div class="mla-row">
                <el-input v-model="entry.sources[mlaIndex]" type="textarea" :rows="2" />
                <div class="mla-row__ops">
                  <el-button
                    link
                    size="small"
                    :disabled="mlaIndex === 0"
                    @click="moveManageDefinitionMla('definitions_cn', index, mlaIndex, -1)"
                  >
                    上移
                  </el-button>
                  <el-button
                    link
                    size="small"
                    :disabled="mlaIndex === entry.sources.length - 1"
                    @click="moveManageDefinitionMla('definitions_cn', index, mlaIndex, 1)"
                  >
                    下移
                  </el-button>
                  <el-button
                    link
                    size="small"
                    type="danger"
                    :disabled="entry.sources.length === 1"
                    @click="removeManageDefinitionMla('definitions_cn', index, mlaIndex)"
                  >
                    删除
                  </el-button>
                </div>
              </div>
            </el-form-item>

            <div class="mla-add-row">
              <el-button
                type="primary"
                plain
                size="small"
                @click="addManageDefinitionMla('definitions_cn', index)"
              >
                + 添加出处
              </el-button>
            </div>

            <el-form-item label="术语定义（中文）附件">
              <div class="term-edit-attachment">
                <div class="term-edit-attachment__current">
                  <el-tag v-if="isEntryProcessing(entry)" type="warning" effect="plain" size="small">
                    后台识别中，完成后自动显示
                  </el-tag>
                  <el-tag
                    v-else-if="entry.process?.state === 'failed'"
                    type="danger"
                    effect="plain"
                    size="small"
                  >
                    后台识别失败，请重新上传附件
                  </el-tag>
                  <template v-else-if="entry.existing.length">
                    当前：
                    <span class="term-edit-attachment__links">
                      <el-link
                        v-for="(file, fileIndex) in entry.existing"
                        :key="fileIndex"
                        type="primary"
                        :underline="false"
                        @click="viewAttachment(file.url)"
                      >
                        {{ file.name }}
                      </el-link>
                    </span>
                    <el-tag
                      v-if="entry.process?.state === 'editing'"
                      type="warning"
                      effect="plain"
                      size="small"
                    >
                      识别未成功，已入库为「待补全」文献
                    </el-tag>
                  </template>
                  <span v-else>未上传</span>
                </div>
                <el-upload
                  v-model:file-list="entry.attachments"
                  :auto-upload="false"
                  :show-file-list="true"
                  multiple
                  accept=".pdf"
                >
                  <el-button>上传新附件（选填，可多选）</el-button>
                </el-upload>
              </div>
            </el-form-item>
          </div>
        </div>

        <!-- 模块三：术语定义（英文）：每个定义可写多条 MLA 出处，附件可多个 -->
        <div class="term-module">
          <div class="term-module__head">
            <span class="term-module__title">术语定义（英文）</span>
            <el-button
              type="primary"
              plain
              size="small"
              @click="addManageDefinition('definitions_en')"
            >
              + 新增定义
            </el-button>
          </div>

          <div
            v-for="(entry, index) in manageForm.definitions_en"
            :key="entry._uid"
            class="term-entry"
          >
            <div class="term-entry__head">
              <span class="term-entry__no">定义 {{ index + 1 }}</span>
              <div class="term-entry__ops">
                <el-button
                  size="small"
                  :disabled="index === 0"
                  @click="moveManageDefinition('definitions_en', index, -1)"
                >
                  上移
                </el-button>
                <el-button
                  size="small"
                  :disabled="index === manageForm.definitions_en.length - 1"
                  @click="moveManageDefinition('definitions_en', index, 1)"
                >
                  下移
                </el-button>
                <el-button
                  size="small"
                  type="danger"
                  plain
                  :disabled="manageForm.definitions_en.length === 1"
                  @click="removeManageDefinition('definitions_en', index)"
                >
                  删除
                </el-button>
              </div>
            </div>

            <el-form-item
              label="术语定义（英文）"
              :prop="`definitions_en.${index}.text`"
              :rules="requiredRule('术语定义（英文）不能为空')"
            >
              <el-input v-model="entry.text" type="textarea" :rows="3" />
            </el-form-item>

            <el-form-item
              v-for="(mla, mlaIndex) in entry.sources"
              :key="`manage-en-mla-${index}-${mlaIndex}`"
              :label="`定义出处 ${mlaIndex + 1}`"
            >
              <div class="mla-row">
                <el-input v-model="entry.sources[mlaIndex]" type="textarea" :rows="2" />
                <div class="mla-row__ops">
                  <el-button
                    link
                    size="small"
                    :disabled="mlaIndex === 0"
                    @click="moveManageDefinitionMla('definitions_en', index, mlaIndex, -1)"
                  >
                    上移
                  </el-button>
                  <el-button
                    link
                    size="small"
                    :disabled="mlaIndex === entry.sources.length - 1"
                    @click="moveManageDefinitionMla('definitions_en', index, mlaIndex, 1)"
                  >
                    下移
                  </el-button>
                  <el-button
                    link
                    size="small"
                    type="danger"
                    :disabled="entry.sources.length === 1"
                    @click="removeManageDefinitionMla('definitions_en', index, mlaIndex)"
                  >
                    删除
                  </el-button>
                </div>
              </div>
            </el-form-item>

            <div class="mla-add-row">
              <el-button
                type="primary"
                plain
                size="small"
                @click="addManageDefinitionMla('definitions_en', index)"
              >
                + 添加出处
              </el-button>
            </div>

            <el-form-item label="术语定义（英文）附件">
              <div class="term-edit-attachment">
                <div class="term-edit-attachment__current">
                  <el-tag v-if="isEntryProcessing(entry)" type="warning" effect="plain" size="small">
                    后台识别中，完成后自动显示
                  </el-tag>
                  <el-tag
                    v-else-if="entry.process?.state === 'failed'"
                    type="danger"
                    effect="plain"
                    size="small"
                  >
                    后台识别失败，请重新上传附件
                  </el-tag>
                  <template v-else-if="entry.existing.length">
                    当前：
                    <span class="term-edit-attachment__links">
                      <el-link
                        v-for="(file, fileIndex) in entry.existing"
                        :key="fileIndex"
                        type="primary"
                        :underline="false"
                        @click="viewAttachment(file.url)"
                      >
                        {{ file.name }}
                      </el-link>
                    </span>
                    <el-tag
                      v-if="entry.process?.state === 'editing'"
                      type="warning"
                      effect="plain"
                      size="small"
                    >
                      识别未成功，已入库为「待补全」文献
                    </el-tag>
                  </template>
                  <span v-else>未上传</span>
                </div>
                <el-upload
                  v-model:file-list="entry.attachments"
                  :auto-upload="false"
                  :show-file-list="true"
                  multiple
                  accept=".pdf"
                >
                  <el-button>上传新附件（选填，可多选）</el-button>
                </el-upload>
              </div>
            </el-form-item>
          </div>
        </div>
      </el-form>

      <template #footer>
        <el-button @click="manageVisible = false">取消</el-button>
        <el-button type="primary" :loading="manageSaving" @click="onSaveTerm">保存</el-button>
      </template>
    </el-dialog>
  </PageContainer>
</template>

<style scoped>
/* 「操作」列的两个图标按钮 */
.term-manage {
  display: inline-flex;
  align-items: center;
}

/* 编辑弹窗内容较长时可滚动 */
.term-manage-form {
  max-height: 62vh;
  padding-right: 8px;
  overflow-y: auto;
}

/* 编辑弹窗里的附件区 */
.term-edit-attachment {
  width: 100%;
}

.term-edit-attachment__current {
  margin-bottom: 6px;
  font-size: 13px;
  color: #606266;
}

/* 「当前：」后面的多个附件链接之间留出空隙 */
.term-edit-attachment__links {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-left: 4px;
  vertical-align: bottom;
}

.term-edit-attachment__tip {
  margin-bottom: 12px;
  font-size: 12px;
  line-height: 1.7;
  color: #909399;
}

/* 附件文件名过长时用省略号 */
:deep(.el-upload-list__item-name) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 附件识别失败时显示的原因 */
.term-edit-attachment__error {
  margin-left: 6px;
  color: #f56c6c;
  word-break: break-all;
}

/* 编辑弹窗里的模块与条目（与术语上传页同一套样式） */
.term-module {
  margin-bottom: 8px;
  padding: 12px 14px 2px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  background: #fafcff;
}

.term-module__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.term-module__title {
  padding-left: 8px;
  font-size: 16px;
  font-weight: 700;
  color: #005767;
  border-left: 3px solid var(--el-color-primary, #005767);
}

.term-entry {
  padding: 10px 12px 2px;
  margin-bottom: 12px;
  border: 1px dashed #dcdfe6;
  border-radius: 6px;
  background: #fff;
}

.term-entry__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.term-entry__no {
  padding: 2px 10px;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  background: #eef1f6;
  border-radius: 10px;
}

.term-entry__ops {
  display: flex;
  gap: 6px;
}

/* MLA 输入框 + 右侧的上移/下移/删除；定义里「出处输入框」后面的新增按钮 */
.mla-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
}

.mla-row__ops {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 2px;
  padding-top: 4px;
}

.mla-add-row {
  display: flex;
  justify-content: flex-end;
  margin: -8px 0 14px;
}

/* 编辑弹窗里的标签也更清晰一些 */
:deep(.el-form-item__label) {
  font-weight: 600;
  color: #303133;
}

/* 详情弹窗里的多条条目 */
.term-detail__entry {
  margin-bottom: 12px;
}

/* 每条出处（多条 MLA 时逐行展示，标签加粗一点便于区分） */
.term-detail__source {
  margin: 0 0 6px;
  color: #526779;
  line-height: 1.7;
  word-break: break-word;
}

.term-detail__source-label {
  font-weight: 600;
  color: #334e68;
}

/* 多个附件链接之间留出空隙 */
.term-detail__links {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  margin-top: 2px;
}

/* 「示例」标签 */
.term-example-tag {
  margin-left: 6px;
}

.term-detail__entry:last-child {
  margin-bottom: 0;
}

.term-detail__entry-no {
  display: inline-block;
  padding: 2px 10px;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #303133;
  background: #eef1f6;
  border-radius: 10px;
}

.term-detail__name {
  margin: 0 0 16px;
  font-size: 24px;
  font-weight: 700;
  color: #005767;
  text-align: center;
}

.term-detail__section {
  padding: 14px 0;
  border-bottom: 1px dashed #e4e7ed;
}

.term-detail__section:last-child {
  border-bottom: none;
}

.term-detail__label {
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 700;
  color: #334e68;
}

/* 术语定义正文：加粗显示，与下面的出处区分开 */
.term-detail__text {
  margin: 0 0 6px;
  font-weight: 700;
  color: #303133;
  line-height: 1.7;
}

.term-detail__meta {
  margin: 0 0 6px;
  font-size: 13px;
  color: #8a5a16;
}

/* 详情标题下方的所属类别 */
.term-detail__meta--center {
  margin: -8px 0 16px;
  text-align: center;
}

.term-detail__link-icon {
  margin-right: 4px;
  vertical-align: -2px;
}
</style>
