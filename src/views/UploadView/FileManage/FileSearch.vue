<!-- 全局文献检索：保留多维和 AI 搜索，并将选文追加到文献问答的材料草稿。 -->
<script setup>
import { useRouter, useRoute } from 'vue-router'
import { Edit, Delete, View, Plus, Minus, Download } from '@element-plus/icons-vue'
import { ref, computed, nextTick, watch, onMounted } from 'vue'
import { useLiteratureSelectionStore } from '@/stores/literatureSelection' // 导入store
import { mergeReadingMaterialIds } from '@/research/utils/reading-selection'
import FileEdit from './components/FileEdit.vue'
import {
  getCorpusListService,
  corpusDeleteService,
  corpusExamineService,
  corpusWithdrawService,
  corpusDetailService,
  aiChatService,
} from '@/api/collector'
import {
  publicSearchService,
  publicGetFileService,
  smartSearchService,
  getCorpusDetailService,
} from '@/api/public'
import { ElMessage } from 'element-plus'
import {
  addKnowledgeBaseDocuments,
  listKnowledgeBases,
  previewKnowledgeBaseDocuments,
} from '@/api/knowledgeBase'

// const router = useRouter()
const literatureSelectionStore = useLiteratureSelectionStore() // 使用store

const loading = ref(false)
const fileList = ref([])
// 绑定要进行搜索的数据
const params = ref({
  title: '',
  author: '',
  page_num: 1,
  page_size: 10,
  // status: null,
})

// 计算属性：当前页面已选中的行
const selectedCurrentPageRows = computed(() => {
  return fileList.value.filter(item =>
    literatureSelectionStore.isItemSelected(item.corpus_id || item.id)
  )
})

// 表格引用
const tableRef = ref()
const selectingAll = ref(false)
const allResultIds = ref([])
const allResultsSelected = computed(() =>
  allResultIds.value.length > 0 &&
  allResultIds.value.every(id => literatureSelectionStore.isItemSelected(id))
)
const toggleAllResults = () => allResultsSelected.value ? reset() : selectAllResults()
// 保存已展示结果对应的查询，避免尚未提交的输入影响全选范围。
const resultQuery = ref(null)
// AI 检索的搜索标识：首次调用由后端生成并缓存 SQL，之后翻页/全选复用它，避免每页都调用大模型
const aiSearchId = ref('')
// AI 检索结果本地分页：一次取回全部结果，换页与全选都在本地完成
const aiAllRows = ref([])
// 结果过多时不再一次性取回，避免单个响应过大（超过则退回服务端分页）
const AI_LOCAL_PAGE_LIMIT = 600

/** 按当前页码/每页条数从本地全量结果中切片渲染。 */
const applyAiPage = () => {
  const start = (params.value.page_num - 1) * params.value.page_size
  fileList.value = aiAllRows.value.slice(start, start + params.value.page_size)
  total.value = aiAllRows.value.length
  nextTick(() => {
    updateTableSelection()
  })
}
let searchRequestId = 0
const rowKey = (row) => String(row.corpus_id || row.id)

// 获取文献列表后更新表格选中状态
const getCorpusList = async (data) => {
  const requestId = ++searchRequestId
  const query = JSON.parse(JSON.stringify(data))
  loading.value = true
  try {
    const res = await publicSearchService(query)
    if (requestId !== searchRequestId) return
    if (res.data.code === 200) {
      resultQuery.value = { mode: '1', params: query }
      fileList.value = res.data.data.data
      total.value = res.data.data.total

      // 延迟更新表格选中状态，确保DOM渲染完成
      nextTick(() => {
        updateTableSelection()
      })
    }
  } finally {
    if (requestId === searchRequestId) loading.value = false
  }
}
/** 调整页容量时回到首页；AI 检索已取回全部结果时只做本地切片。 */
const onSizeChange = (val) => {
  params.value.page_size = val
  // 改变页面大小时应当返回第一页
  params.value.page_num = 1
  // getStaffList(params.value)
  if (radio1.value === '1') return getCorpusList(params.value)
  if (aiAllRows.value.length) return applyAiPage()
  return doSmartSearch()
}
/** 切换页码；AI 检索已取回全部结果时不再请求后端。 */
const onCurrentChange = (val) => {
  params.value.page_num = val
  // getStaffList(params.value)
  if (radio1.value === '1') return getCorpusList(params.value)
  if (aiAllRows.value.length) return applyAiPage()
  return doSmartSearch()
}
const total = ref(0)

const onSearch = () => {
  reset()
  loading.value = true
  params.value.page_num = 1
  // console.log(searchList.value)
  params.value.title_cn = []
  params.value.title_en = []
  params.value.category_id = []
  params.value.language = []
  params.value.author = []
  params.value.keyword_cn = []
  params.value.keyword_en = []
  for (let i = 0; i < searchList.value.length; i++) {
    switch (searchList.value[i].searchs) {
      case 'title_cn':
        // console.log(1)
        params.value.title_cn.push(searchList.value[i].searchValue)
        break
      case 'title_en':
        // console.log(2)
        params.value.title_en.push(searchList.value[i].searchValue)
        break
      case 'author':
        // console.log(3)
        params.value.author.push(searchList.value[i].searchValue)
        break
      case 'category_id':
        // console.log(4)
        params.value.category_id.push(searchList.value[i].searchValue)
        break
      case 'language':
        // console.log(5)
        params.value.language.push(searchList.value[i].searchValue)
        break
      case 'keyword_cn':
        // console.log(6)
        params.value.keyword_cn.push(...searchList.value[i].searchValue)
        break
      case 'keyword_en':
        // console.log(7)
        params.value.keyword_en.push(...searchList.value[i].searchValue)
        break
      default:
        break
    }
    console.log(params.value)
  }
  return getCorpusList({ ...params.value })
}

const reset = () => {
  allResultIds.value = []
  searchRequestId += 1
  loading.value = false
  literatureSelectionStore.clearSelection() // 清除选中状态
  updateTableSelection()
}

const selectAllResults = async () => {
  if (loading.value || selectingAll.value || !fileList.value.length) return
  const query = resultQuery.value
  if (!query && total.value > fileList.value.length) {
    ElMessage.warning('请先执行检索，再全选完整搜索结果')
    return
  }
  const requestId = searchRequestId
  selectingAll.value = true
  try {
    let rows = [...fileList.value]
    // 当前页已包含全部结果时直接勾选，避免重复检索（尤其是再次调用 AI）。
    if (query && total.value > rows.length) {
      if (query.mode === '2' && aiAllRows.value.length >= total.value) {
        // AI 检索已一次性取回全部结果：全选直接用本地缓存，不再发请求
        rows = [...aiAllRows.value]
      } else {
        rows = []
        let expectedTotal = total.value
        // AI 检索兜底：只按 search_id 复用缓存的 SQL，不再重新生成
        const pageSize = query.mode === '2' ? expectedTotal : 100
        for (let page = 1; rows.length < expectedTotal; page += 1) {
          const res = query.mode === '1'
            ? await publicSearchService({ ...query.params, page_num: page, page_size: pageSize })
            : await aiChatService({
                ...(query.searchId
                  ? { search_id: query.searchId }
                  : { question: query.params.question }),
                page_num: page,
                page_size: pageSize,
              })
          if (requestId !== searchRequestId) return
          if (res.data.code !== 200) throw new Error('搜索结果加载失败')
          const data = res.data.data
          const batch = query.mode === '1' ? data.data : data.result
          expectedTotal = query.mode === '1' ? data.total : data.pagination.total
          if (!Array.isArray(batch) || (!batch.length && rows.length < expectedTotal)) {
            throw new Error('搜索结果不完整，请重新检索后重试')
          }
          rows.push(...batch)
        }
      }
    }
    if (requestId !== searchRequestId) return
    literatureSelectionStore.addMultipleSelection(rows)
    allResultIds.value = [...new Set(rows.map(rowKey))]
    updateTableSelection()
    ElMessage.success(`已全选搜索结果，共 ${new Set(rows.map(rowKey)).size} 项`)
  } catch (error) {
    ElMessage.error(error.message || '全选失败，请重试')
  } finally {
    selectingAll.value = false
  }
}

const toShow = (row) => {
  // console.log(row)
  row.ban = true
  row.judgeFlag = true
  if (!row.corpus_id) row.corpus_id = row.id
  fileEditRef.value.open(row)
}

const fileEditRef = ref()

const onSuccess = () => {
  params.value.page = 1
  params.value.pageSize = 10
  getCorpusList(params.value)
}

const optionschoice_1 = ref([
  { label: '原文标题', value: 'title_cn' },
  { label: '译文标题', value: 'title_en' },
  { label: '作者/编者/译者', value: 'author' },
  { label: '语言', value: 'language' },
  { label: '语料类型', value: 'category_id' },
  { label: '中文关键字', value: 'keyword_cn' },
  { label: '英文关键字', value: 'keyword_en' },
])
const searchwhich1 = ref([])
const searchList = ref([
  {
    searchs: '',
    searchValue: '',
  },
])

const addSearchOption = () => {
  searchList.value.push({ searchs: '', searchValue: '' })
  //searchwhich1.push('')
}
const delSearchOption = (i) => {
  searchList.value.splice(i, 1)
  //searchwhich1.splice(i,1)
}

const router = useRouter()
const route = useRoute()
// 从文献问答进入时仅携带草稿 ID；题录与权限在返回材料页后重新读取。
const readingPicker = computed(() => route.query?.reading === '1')
const existingReadingIds = computed(() => readingPicker.value
  ? String(route.query?.materials || '').split(',').filter(Boolean) : [])
/** 不添加选文也可返回原草稿，不丢失之前选择的本地文件。 */
function returnToReading() {
  return router.push({ name: 'literatureDetail', query: { draft: existingReadingIds.value.join(',') || undefined } })
}
const clear = () => {
  literatureSelectionStore.clearSelection() // 清除选中状态
  router.go(0)
}

const changeSearchValue1 = (i) => {
  searchList.value[i].searchValue = ''
  if (searchList.value[i].searchs === 'language') searchwhich1.value[i] = 'language'
  // else if(searchList.value[i].searchs === 'status')
  //   searchwhich1.value = 'status'
  else if (searchList.value[i].searchs === 'category_id') searchwhich1.value[i] = 'category_id'
  else if (searchList.value[i].searchs === 'keyword_cn') searchwhich1.value[i] = 'keyword_cn'
  else if (searchList.value[i].searchs === 'keyword_en') searchwhich1.value[i] = 'keyword_en'
  else searchwhich1.value[i] = ''
}
const chinese = ref(0)
const english = ref(1)
const radio1 = ref('1')

// 添加批量下载功能
const multipleSelection1 = computed(() => literatureSelectionStore.selectedIds)
const multipleSelection2 = computed(() => literatureSelectionStore.selectedAttachments)

const addToBaseVisible = ref(false)
const baseOptions = ref([])
const baseLoading = ref(false)
const selectedBaseId = ref(null)
const selectedBaseName = ref('')
const selectedCorpusIds = ref([])
const addPreview = ref(null)
const previewLoading = ref(false)
const addingToBase = ref(false)
let previewRequestId = 0

const loadBaseOptions = async () => {
  baseLoading.value = true
  try {
    const first = await listKnowledgeBases({ page_num: 1, page_size: 100 })
    const rows = [...first.data.data]
    const pages = Math.ceil(first.data.pagination.total / 100)
    for (let page = 2; page <= pages; page += 1) {
      const response = await listKnowledgeBases({ page_num: page, page_size: 100 })
      rows.push(...response.data.data)
    }
    baseOptions.value = [...new Map(rows.map(base => [base.id, base])).values()]
  } finally {
    baseLoading.value = false
  }
}

const openAddToBase = async () => {
  const ids = [...new Set(multipleSelection1.value.map(Number))]
  if (ids.some(id => !Number.isSafeInteger(id) || id < 1)) {
    ElMessage.warning('选中文献的 ID 无效，请重新勾选')
    return
  }
  if (ids.length > 100) {
    ElMessage.warning('一次最多添加 100 篇文献，请减少勾选数量')
    return
  }
  selectedCorpusIds.value = ids
  selectedBaseId.value = null
  selectedBaseName.value = ''
  addPreview.value = null
  previewRequestId += 1
  baseOptions.value = []
  addToBaseVisible.value = true
  await loadBaseOptions()
}

const selectBase = async (id) => {
  selectedBaseName.value = baseOptions.value.find(base => base.id === id)?.name || ''
  addPreview.value = null
  const requestId = ++previewRequestId
  if (!id) {
    previewLoading.value = false
    return
  }
  previewLoading.value = true
  try {
    const response = await previewKnowledgeBaseDocuments(id, selectedCorpusIds.value)
    if (addToBaseVisible.value && selectedBaseId.value === id && requestId === previewRequestId) {
      addPreview.value = response.data.data
    }
  } finally {
    if (requestId === previewRequestId) previewLoading.value = false
  }
}

const confirmAddToBase = async () => {
  if (!selectedBaseId.value || !addPreview.value?.addable_ids.length) return
  addingToBase.value = true
  try {
    const response = await addKnowledgeBaseDocuments(selectedBaseId.value, addPreview.value.addable_ids)
    ElMessage.success(`已加入“${selectedBaseName.value}” ${response.data.data.added_count} 篇文献`)
    addToBaseVisible.value = false
  } finally {
    addingToBase.value = false
  }
}

// 选择表格行时触发
const handleSelectionChange = (val) => {
  // 获取当前页面的所有数据
  const currentPageIds = fileList.value.map(item => item.corpus_id || item.id)

  // 处理选中变化
  const selectedIds = val.map(row => row.corpus_id || row.id)

  // 添加新选中的项
  val.forEach(row => {
    literatureSelectionStore.addSelection(row)
  })

  // 移除取消选中的项（仅在当前页面的范围内）
  currentPageIds.forEach(id => {
    if (!selectedIds.includes(id)) {
      literatureSelectionStore.removeSelection(id)
    }
  })
}

/** 将搜索选文加入统一草稿；确认开始分析之前不创建研究任务。 */
const onAiChat = async () => {
  if (multipleSelection1.value.length === 0) {
    ElMessage.warning('请先选择要进行问答的文献')
    return
  }

  try {
    const materials = mergeReadingMaterialIds(existingReadingIds.value, multipleSelection1.value)
    const failure = await router.push({
      name: 'literatureDetail', query: { draft: materials.join(',') },
    })
    if (!failure) literatureSelectionStore.clearSelection()
  } catch (error) {
    ElMessage.warning(error.message || '无法添加所选材料，请重试')
  }
}

// 批量下载文件
const onBatchDownload = async () => {
  console.log(multipleSelection1.value)
  if (multipleSelection1.value.length === 0) {
    ElMessage.warning('请先选择要下载的文件')
    return
  }

  ElMessage.info(`开始下载，请稍后`)

  publicGetFileService({
    corpus_id: multipleSelection1.value,
    attachment_paths: multipleSelection2.value.flat(), // 展平附件数组
  })
    .then(async (res2) => {
      console.log(res2)
      if (res2.status === 200) {
        // console.log(URL.createObjectURL(res2.data))
        const res3 = await res2.data.text()
        const temp = JSON.parse(res3)
        console.log(temp)
        const downloadPromises = temp.data.files.map(async (item) => {
          try {
            const response = await fetch('/api' + item.download_url)
            if (!response.ok) {
              throw new Error(`下载失败：${response.status}`)
            }

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = item.display_name
            document.body.appendChild(a)
            a.click()

            // 延迟清理，确保下载完成
            setTimeout(() => {
              window.URL.revokeObjectURL(url)
              document.body.removeChild(a)
            }, 100)

            return { success: true, file: item.display_name }
          } catch (error) {
            console.error('下载失败:', error)
            ElMessage.error(`${item.display_name} 下载失败`)
            return { success: false, file: item.display_name, error }
          }
        })

        // 等待所有下载完成
        const results = await Promise.allSettled(downloadPromises)
        console.log('所有下载任务完成:', results)
        ElMessage.success('批量下载完成')
        // window.open(URL.createObjectURL(res2.data))
      } else {
        ElMessage.error(res2.error)
        return
      }
      // ElMessage.success('下载成功')
    })
    .catch((error) => {
      ElMessage.error('下载失败')
    })
}

// 跳转到文献详情页面
const toLiteratureDetail = (row) => {
  router.push({
    name: 'literatureDetail',
    query: { id: row.corpus_id ? row.corpus_id : row.id },
    state: { literature: row }, // 传递文献数据
  })
}

const onDownloadFile = async (row) => {
  const res = await getCorpusDetailService({ corpus_id: row.corpus_id ? row.corpus_id : row.id })
  // console.log(res)
  let filename = res.data.data.files[0].filename
  if (res.data.code === 200) {
    // console.log(res.data.data)
    if (res.data.data.attachment !== null) {
      ElMessage.info('下载中请稍后')
      res.data.data.attachment.forEach((item) => {
        publicGetFileService({
          corpus_id: row.corpus_id ? row.corpus_id : row.id,
          attachment_path: item,
        })
          .then((res2) => {
            // console.log(typeof res2.data)
            if (res2.status === 200) {
              // console.log(URL.createObjectURL(res2.data))
              // window.open(URL.createObjectURL(res2.data))
              const url = window.URL.createObjectURL(res2.data)
              const a = document.createElement('a')
              a.href = url
              a.download = filename
              document.body.appendChild(a)
              a.click()
            } else {
              return
            }
            ElMessage.success('下载成功一个文件')
          })
          .catch((error) => {
            ElMessage.error('下载失败')
          })
      })
    } else {
      ElMessage.info('该文献没有附件')
    }
  }
}

// 拼接关键字
const joinKeyword = (keyword) => {
  // console.log(keyword)
  if (keyword === undefined || keyword === null) return ''

  // 如果你需要将数组重新转换为字符串，并且不包含方括号和双引号，可以手动拼接
  let cleanStr = keyword.join(';')
  return cleanStr
}

const smartSearch = ref('')

// 从 store 中恢复 AI 搜索内容
smartSearch.value = literatureSelectionStore.aiSearchContent || ''

// 监听 smartSearch 变化，自动保存到 store
watch(smartSearch, (newValue) => {
  literatureSelectionStore.saveAiSearchContent(newValue)
})

/** 显式搜索创建新的检索：清空旧结果与标识，回到第一页。 */
const onSmart = async () => {
  reset()
  aiSearchId.value = ''
  aiAllRows.value = []
  resultQuery.value = null
  fileList.value = []
  total.value = 0
  params.value.page_num = 1
  return doSmartSearch(true)
}

/**
 * 发起 AI 检索。
 * 新检索带 question 让后端生成 SQL 并返回 search_id；结果不多时用同一 search_id 一次取回全部，
 * 之后换页、改每页条数、全选都在本地完成，不再请求后端。
 */
const doSmartSearch = async (newSearch = false) => {
  // 没有已完成的检索时不提交：翻页不会隐式地重新生成 SQL
  if (!newSearch && !aiSearchId.value) return
  const requestId = ++searchRequestId
  const question = smartSearch.value
  const payload = newSearch ? { question } : { search_id: aiSearchId.value }
  loading.value = true
  aiAllRows.value = []
  try {
    const res = await aiChatService({
      ...payload,
      page_size: params.value.page_size,
      page_num: params.value.page_num,
    })
    if (requestId !== searchRequestId) return
    if (res.data.code !== 200) return

    aiSearchId.value = res.data.data.search_id || aiSearchId.value
    resultQuery.value = {
      mode: '2',
      params: { question },
      searchId: aiSearchId.value,
    }
    const totalCount = res.data.data.pagination.total
    let rows = res.data.data.result || []

    // 结果超出当前页且规模可控时，用同一 search_id 一次取回全部，供本地分页与全选使用
    if (rows.length < totalCount && totalCount <= AI_LOCAL_PAGE_LIMIT && aiSearchId.value) {
      const all = await aiChatService({
        search_id: aiSearchId.value,
        page_num: 1,
        page_size: totalCount,
      })
      if (requestId !== searchRequestId) return
      if (all.data.code === 200) {
        rows = all.data.data.result || rows
      }
    }

    // 只有真正取回全部结果时才启用本地分页；否则（结果过大或取全量失败）退回服务端分页
    if (rows.length >= totalCount) {
      aiAllRows.value = rows
      total.value = totalCount
      applyAiPage()
    } else {
      aiAllRows.value = []
      total.value = totalCount
      fileList.value = rows
      nextTick(() => {
        updateTableSelection()
      })
    }
  } catch (error) {
    // 搜索标识过期（后端 15 分钟后回收）：清空结果与选择并提示重新搜索，不自动重新生成 SQL
    const expired =
      error?.response?.status === 410 || error?.response?.data?.code === 410
    if (!expired) throw error
    aiSearchId.value = ''
    aiAllRows.value = []
    resultQuery.value = null
    fileList.value = []
    total.value = 0
    literatureSelectionStore.clearSelection()
    updateTableSelection()
    ElMessage.warning('搜索已过期，请重新搜索')
  } finally {
    if (requestId === searchRequestId) loading.value = false
  }
}

// 搜索模式变化
const onChange = () => {
  reset()
  aiSearchId.value = ''
  aiAllRows.value = []
  resultQuery.value = null
  total.value = 0
  params.value.page_num = 1
  params.value.page_size = 10
  fileList.value = []
}

const dialogVisible = ref(false)
const paragraphs = ref([])
// 显示匹配详情
const toShow2 = (row) => {
  paragraphs.value = row.paragraphs
  dialogVisible.value = true
}

// 更新表格选中状态
const updateTableSelection = () => {
  if (!tableRef.value) return

  // 只监听用户选择事件，程序恢复勾选不会反向删除 store 中的记录。
  tableRef.value.clearSelection()

  // 重新设置当前页面的选中项
  selectedCurrentPageRows.value.forEach(row => {
    tableRef.value.toggleRowSelection(row, true)
  })
}

// 转换关键字的格式
// const convertKeyword = (keyword) => {
//   // console.log(keyword)
//   if (keyword === undefined) return
//   // 使用JSON.parse将字符串转换为数组，这将自动去除双引号
//   let arr = JSON.parse(keyword)

//   // 如果你需要将数组重新转换为字符串，并且不包含方括号和双引号，可以手动拼接
//   let cleanStr = arr.join(';')
//   return cleanStr
// }

// 新增方法：跳转至可视化分析页面
const onVisualizeAnalysis = () => {
  if (multipleSelection1.value.length === 0) {
    ElMessage.warning('请先选择要分析的文献')
    return
  }

  // 获取选中的文献 ID
  const selectedIds = multipleSelection1.value

  // 跳转前清除 Pinia store 中的选中数据
  literatureSelectionStore.clearSelection()

  // 跳转到可视化分析页面并传递参数
  router.push({
    name: 'visualizeAnalysis',
    query: { ids: selectedIds.join(',') },
    state: { selectedIds }
  })
}

// 页面加载时检查是否有从LiteratureDetail页面传递过来的搜索结果
onMounted(() => {
  // 结果列表属于本次页面会话，不能沿用上次页面留下的全局选择。
  reset()
  console.log('FileSearch onMounted 被调用')
  console.log('检查Pinia store中的AI跳转数据')
  console.log('aiJumpSearchResults:', literatureSelectionStore.aiJumpSearchResults)
  console.log('aiJumpTotal:', literatureSelectionStore.aiJumpTotal)

  // 从 Pinia store 中获取数据（更可靠的方式）
  const searchResults = literatureSelectionStore.aiJumpSearchResults
  const totalName = literatureSelectionStore.aiJumpTotal

  // 检查是否有searchResults数据
  if (searchResults && Array.isArray(searchResults) && searchResults.length > 0) {
    console.log('接收到从AI问答页面传递的搜索结果，数量:', searchResults.length)

    // 直接使用传递的数据填充列表
    fileList.value = searchResults
    total.value = totalName || searchResults.length
    nextTick(updateTableSelection)

    // 显示提示消息
    ElMessage.success(`已加载AI推荐的${total.value}条搜索结果`)

    // 清除store中的AI跳转数据，防止刷新后重复加载
    literatureSelectionStore.clearAiJumpSearchResults()
    console.log('已清除store中的AI跳转数据')
  } else {
    console.log('未检测到AI跳转数据，将执行默认加载逻辑')
  }
})

</script>
<template>
  <PageContainer title="文献检索">
    <template #extra>
      <div class="search-header-actions">
      <el-button v-if="readingPicker" @click="returnToReading">返回材料清单</el-button>
      <el-radio-group v-model="radio1" @change="onChange()">
        <el-radio value="1">多维度搜索</el-radio>
        <el-radio value="2">AI增强搜索</el-radio>
      </el-radio-group>
      <el-button
        type="primary"
        :disabled="multipleSelection1.length === 0"
        @click="onBatchDownload"
      >
        批量下载
      </el-button>
      <el-button
        type="primary"
        :disabled="multipleSelection1.length === 0"
        @click="onAiChat"
      >
        <el-tooltip
          :content="'请先检索文献，选择文献以后才能使用该功能'"
          placement="top"
          :disabled="multipleSelection1.length > 0"
        >
          <span>{{ readingPicker ? `添加并返回（${multipleSelection1.length} 篇）` : '文献问答' }}</span>
        </el-tooltip>
      </el-button>
      <el-button
        type="primary"
        :disabled="multipleSelection1.length === 0"
        @click="onVisualizeAnalysis"
      >
        可视化分析
      </el-button>
      <el-button type="primary" :disabled="multipleSelection1.length === 0" @click="openAddToBase">
        加入知识库
      </el-button>
      <div class="selected-count" :title="`已选中 ${multipleSelection1.length} 项`">
        <span>已选中</span>
        <span class="selected-count-number">{{ multipleSelection1.length }}</span>
        <span>项</span>
      </div>
      </div>
    </template>
    <!-- <el-form :inline="false" label-width="130px">
      <el-row :gutter="20">
        <el-col :span="6">
          <el-form-item label="原文标题：">
            <el-input v-model="params.title_cn"></el-input>
          </el-form-item>
        </el-col>
        <el-col :span="6">
          <el-form-item label="译文标题：">
            <el-input v-model="params.title_en"></el-input>
          </el-form-item>
        </el-col>
        <el-col :span="6">
          <el-form-item label="作者/编者/译者：">
            <el-input v-model="params.author"></el-input>
          </el-form-item>
        </el-col>
        <el-col :span="6">
          <el-form-item label="语言：">
            <el-input v-model="params.language"></el-input>
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="20">
        <el-col :span="6">
          <el-form-item label="语料类型：">
            <category-select v-model="params.category_id" style="width: 100%"></category-select>
          </el-form-item>
        </el-col>
        <el-col :span="6">
          <el-form-item label="状态：">
            <el-select
              style="width: 100%"
              v-model="params.status"
              placeholder="请选择语料状态"
              @change="onSearch"
            >
              <el-option label="编辑中" :value="0"></el-option>
              <el-option label="待审核" :value="1"></el-option>
              <el-option label="审核通过" :value="2"></el-option>
              <el-option label="审核驳回" :value="3"></el-option>
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="6">
          <el-form-item>
            <el-button type="primary" @click="onSearch()">搜索</el-button>
            <el-button @click="reset()">重置</el-button>
          </el-form-item>
        </el-col>
      </el-row>
    </el-form> -->

    <div class="formContainer" v-if="radio1 === '1'">
      <el-form>
        <div v-for="(v, i) in searchList" :key="v.searchs">
          <el-row>
            <el-col :span="1">
              <el-form-item>
                <span v-if="i != 0">AND</span>
              </el-form-item>
            </el-col>
            <el-col :span="4">
              <el-form-item>
                <el-select
                  v-model="searchList[i].searchs"
                  clearable
                  filterable
                  placeholder="搜索条件"
                  @change="changeSearchValue1(i)"
                >
                  <el-option
                    v-for="item in optionschoice_1"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item>
                <category-select2
                  v-if="searchwhich1[i] === 'category_id'"
                  v-model="searchList[i].searchValue"
                  style="width: 100%"
                ></category-select2>
                <el-select
                  v-else-if="searchwhich1[i] === 'language'"
                  v-model="searchList[i].searchValue"
                  placeholder="请选择语言"
                  allow-create
                  filterable
                  clearable
                >
                  <!-- 主流语言 -->
                  <el-option label="中文" value="中文"></el-option>
                  <el-option label="英文" value="英文"></el-option>

                  <!-- 高考热门小语种（依据搜索结果） -->
                  <el-option label="日语" value="日语"></el-option>
                  <el-option label="德语" value="德语"></el-option>
                  <el-option label="法语" value="法语"></el-option>
                  <el-option label="西班牙语" value="西班牙语"></el-option>
                  <el-option label="俄语" value="俄语"></el-option>

                  <!-- 新兴热门小语种（依据搜索结果） -->
                  <el-option label="韩语" value="韩语"></el-option>
                  <el-option label="意大利语" value="意大利语"></el-option>
                  <el-option label="阿拉伯语" value="阿拉伯语"></el-option>
                  <el-option label="葡萄牙语" value="葡萄牙语"></el-option>
                  <el-option label="泰语" value="泰语"></el-option>

                  <!-- 潜力小语种（依据搜索结果） -->
                  <el-option label="越南语" value="越南语"></el-option>
                  <el-option label="荷兰语" value="荷兰语"></el-option>
                  <el-option label="瑞典语" value="瑞典语"></el-option>
                  <el-option label="波斯语" value="波斯语"></el-option>
                </el-select>
                <keyword-select
                  v-else-if="searchList[i].searchs === 'keyword_cn'"
                  v-model="searchList[i].searchValue"
                  style="width: 100%"
                  :language="chinese"
                ></keyword-select>
                <keyword-select
                  v-else-if="searchList[i].searchs === 'keyword_en'"
                  v-model="searchList[i].searchValue"
                  style="width: 100%"
                  :language="english"
                ></keyword-select>
                <el-input
                  v-else
                  v-model="searchList[i].searchValue"
                  placeholder="请输入内容"
                  prefix-icon="el-icon-search"
                  class="search"
                />
                <!-- <el-select
                  v-else-if="searchwhich1[i] === 'G'"
                  v-model="searchList[i].searchValue"
                  clearable
                  filterable
                  placeholder="请选择性别"
                >
                  <el-option v-for="item in Goptions" :key="item" :label="item" :value="item" />
                </el-select>
                <el-select
                  v-else-if="searchwhich1[i] === 'S'"
                  v-model="searchList[i].searchValue"
                  clearable
                  filterable
                  placeholder="请选择状态"
                >
                  <el-option v-for="item in Soptions" :key="item" :label="item" :value="item" />
                </el-select>
                <el-select
                  v-else-if="searchwhich1[i] === 'T'"
                  v-model="searchList[i].searchValue"
                  clearable
                  filterable
                  placeholder="请选择专业职称"
                >
                  <el-option v-for="item in Toptions" :key="item" :label="item" :value="item" />
                </el-select>
                <el-select
                  v-else-if="searchwhich1[i] === 'R'"
                  v-model="searchList[i].searchValue"
                  clearable
                  filterable
                  placeholder="请选择研究方向"
                >
                  <el-option v-for="item in Roptions" :key="item" :label="item" :value="item" />
                </el-select>
                <el-select
                  v-else-if="searchwhich1[i] === 'P'"
                  v-model="searchList[i].searchValue"
                  clearable
                  filterable
                  placeholder="请选择省份"
                >
                  <el-option v-for="item in Poptions" :key="item" :label="item" :value="item" />
                </el-select>
                <el-select
                  v-else-if="searchwhich1[i] === 'Y'"
                  v-model="searchList[i].searchValue"
                  clearable
                  filterable
                  placeholder="请选择青年班"
                >
                  <el-option v-for="item in Yoptions" :key="item" :label="item" :value="item" />
                </el-select> -->
              </el-form-item>
            </el-col>
            <el-col :span="1">
              <el-form-item>
                <el-button
                  style="margin-left: 15px"
                  v-if="i != 0"
                  type="primary"
                  @click="delSearchOption(i)"
                  :icon="Minus"
                  circle
                ></el-button>
              </el-form-item>
            </el-col>
            <el-col :span="1">
              <el-form-item>
                <el-button
                  type="primary"
                  style="margin-left: 15px"
                  v-if="i === searchList.length - 1"
                  @click="addSearchOption"
                  :icon="Plus"
                  circle
                ></el-button>
              </el-form-item>
            </el-col>
          </el-row>
        </div>

        <!-- 按钮 -->
        <el-row>
          <el-col :span="1">
            <el-form-item></el-form-item>
          </el-col>
          <el-col :span="10">
            <el-form-item>
              <el-button type="primary" @click="onSearch">检索</el-button>&nbsp;&nbsp;&nbsp;&nbsp;
              <el-button type="primary" plain @click="clear">重置</el-button>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </div>

    <div class="search-container" v-else>
      <el-form>
        <el-row>
          <el-col :span="21">
            <el-form-item label="AI增强搜索">
              <el-input
                placeholder="请输入搜索内容"
                v-model="smartSearch"
                type="textarea"
                :rows="3"
              ></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="1"></el-col>
          <el-col :span="2">
            <el-button type="primary" @click="onSmart()">搜索</el-button>
          </el-col>
        </el-row>
      </el-form>
    </div>

    <div class="selection-actions">
      <span v-if="readingPicker" class="reading-picker-hint">为文献问答添加材料 · 已有 {{ existingReadingIds.length }} 篇，选好后添加并返回</span>
      <el-button type="primary" plain size="small" :loading="selectingAll" :disabled="loading || !fileList.length" @click="toggleAllResults">
        {{ allResultsSelected ? '清空全选' : '全选搜索结果' }}
      </el-button>
    </div>
    <el-table
      ref="tableRef"
      :data="fileList"
      v-loading="loading || selectingAll"
      :row-key="rowKey"
      style="width: 100%"
      @select="handleSelectionChange"
      @select-all="handleSelectionChange"
    >
      <el-table-column type="selection" width="55" />
      <el-table-column label="序号" width="70">
        <template v-slot:default="scope">
          <span>{{ (params.page_num - 1) * params.page_size + scope.$index + 1 }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="title_cn" label="标题" show-overflow-tooltip />
      <el-table-column prop="language" label="语言" width="70" />
      <el-table-column prop="author" label="作者" width="70" show-overflow-tooltip />
      <el-table-column prop="category_name" label="语料类型" width="100" />
      <el-table-column prop="publish_time" label="出版时间" width="80">
        <template #default="{ row }">
          {{ row.publish_time }}
        </template>
      </el-table-column>
      <el-table-column label="中文关键字" prop="keyword_cn" show-overflow-tooltip>
        <!-- <template #default="{ row }">
          {{
            joinKeyword(row.keyword_cn).length > 10
              ? joinKeyword(row.keyword_cn).slice(0, 10) + '...'
              : joinKeyword(row.keyword_cn)
          }}
        </template> -->
      </el-table-column>
      <el-table-column label="英文关键字" prop="keyword_en" show-overflow-tooltip>
        <!-- <template #default="{ row }">
          {{
            joinKeyword(row.keyword_en).length > 10
              ? joinKeyword(row.keyword_en).slice(0, 10) + '...'
              : joinKeyword(row.keyword_en)
          }}
        </template> -->
      </el-table-column>
      <el-table-column prop="word_number" label="文献字数" width="80"></el-table-column>
      <el-table-column label="查看详情">
        <template #default="{ row }">
          <el-link type="primary" @click="toShow(row)">
            <el-icon><View /></el-icon> 点击查看</el-link
          >
        </template>
      </el-table-column>
      <!-- <el-table-column label="文献详情">
        <template #default="{ row }">
          <el-link type="primary" @click="toLiteratureDetail(row)">
            <el-icon><View /></el-icon> 详情问答</el-link
          >
        </template>
      </el-table-column> -->
      <!-- <el-table-column label="匹配详情">
        <template #default="{ row }">
          <el-link type="primary" @click="toShow2(row)">
            <el-icon><View /></el-icon> 点击查看</el-link
          >
        </template>
      </el-table-column> -->
      <el-table-column label="操作" width="150">
        <template #default="{ row }">
          <el-button
            :icon="Download"
            circle
            plain
            type="success"
            @click="onDownloadFile(row)"
          ></el-button>
        </template>
      </el-table-column>
      <!-- 没有数据时显示此处 -->
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
    <file-edit ref="fileEditRef" @success="onSuccess"></file-edit>
    <el-dialog title="匹配段落详情" v-model="dialogVisible" width="80%">
      <el-table :data="paragraphs" style="width: 100%">
        <!-- <el-table-column prop="position" label="页码" width="180">
        </el-table-column> -->
        <el-table-column prop="score" label="相似度" width="180"> </el-table-column>
        <el-table-column prop="text" label="匹配段落"> </el-table-column>
      </el-table>
    </el-dialog>
    <el-dialog
      v-model="addToBaseVisible"
      title="加入知识库"
      class="add-to-base-dialog"
      width="500px"
      :style="{ maxWidth: 'calc(100vw - 32px)' }"
    >
      <p class="base-intro">已勾选 {{ selectedCorpusIds.length }} 篇文献</p>
      <div class="base-picker">
        <div class="base-picker-label">目标知识库</div>
        <el-select
          v-model="selectedBaseId"
          filterable
          clearable
          :loading="baseLoading"
          :disabled="baseLoading || !baseOptions.length"
          placeholder="请选择知识库"
          style="width: 100%"
          @change="selectBase"
        >
          <el-option
            v-for="base in baseOptions"
            :key="base.id"
            :label="`${base.name}（${base.corpus_count} 篇）`"
            :value="base.id"
          />
        </el-select>
      </div>
      <div v-loading="previewLoading" class="base-preview">
        <template v-if="addPreview">
          <div>可新增 <strong>{{ addPreview.addable_ids.length }}</strong> 篇</div>
          <div class="base-preview-detail">
            已在库中 {{ addPreview.already_added_ids.length }} 篇（自动跳过）
            <template v-if="addPreview.unavailable_ids.length">，不可添加 {{ addPreview.unavailable_ids.length }} 篇</template>
          </div>
        </template>
        <span v-else class="base-preview-placeholder">
          {{ !baseLoading && !baseOptions.length ? '暂无知识库，请先在知识库页面新建' : '选择知识库后查看可新增数量' }}
        </span>
      </div>
      <template #footer>
        <el-button @click="addToBaseVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="addingToBase"
          :disabled="previewLoading || !addPreview?.addable_ids.length"
          @click="confirmAddToBase"
        >
          添加 {{ addPreview?.addable_ids.length || 0 }} 篇
        </el-button>
      </template>
    </el-dialog>
  </PageContainer>
</template>

<style scoped>
.search-header-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
}
.selection-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.selection-actions :deep(.el-button + .el-button) { margin-left: 0; }
.reading-picker-hint { flex: 1 1 100%; font-size: 13px; color: #637580; }
.search-header-actions :deep(.el-button + .el-button) { margin-left: 0; }
.selected-count {
  box-sizing: border-box;
  flex: 0 0 160px;
  width: 160px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 6px;
  background: #f5f7fa;
  color: #909399;
  font-size: 14px;
  white-space: nowrap;
}
.selected-count-number {
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: #606266;
}
.base-intro { margin: 4px 0 18px; color: #606266; }
.base-picker-label { margin-bottom: 8px; color: #303133; }
.base-preview {
  box-sizing: border-box;
  height: 84px;
  margin-top: 18px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  border-radius: 8px;
  background: #f5f7fa;
}
.base-preview-detail, .base-preview-placeholder { color: #909399; font-size: 13px; }
.infocontainer {
  width: 95%;
  height: 95%;
  background: white;
  overflow: hidden;
  margin: auto;
  margin-top: 10px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  border-radius: 10px;
}
/* .formContainer {
  width: 95%;
  margin: 50px auto 0;
  margin-top: 20px;
  position: relative;
} */
</style>

<style>
.add-to-base-dialog {
  display: flex;
  flex-direction: column;
  height: 340px;
  max-height: calc(100vh - 32px);
}
.add-to-base-dialog .el-dialog__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-top: 8px;
}
</style>
