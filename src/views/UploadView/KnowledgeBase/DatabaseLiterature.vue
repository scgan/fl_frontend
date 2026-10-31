<!-- 知识库 · 数据库：某个主题库（含各级子库）下的文献展示，支持子库级联选择与多维条件筛选。 -->
<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { View } from '@element-plus/icons-vue'
import { getDatabaseCorpusService, getDatabaseRootsService } from '@/api/public'
import { getCategoryService } from '@/api/collector'
import FileEdit from '../FileManage/components/FileEdit.vue'

const route = useRoute()

// 上传时语言按中文标签落库（可 allow-create 自由输入），筛选值必须与之保持一致
const LANGUAGES = [
  '中文', '英文', '日语', '德语', '法语', '西班牙语', '俄语',
  '韩语', '意大利语', '阿拉伯语', '葡萄牙语', '泰语',
]

const databaseId = computed(() => Number(route.params.databaseId) || null)
const rootNodes = ref([])
const currentRoot = computed(() => rootNodes.value.find((item) => item.database_id === databaseId.value) || null)

/* 子库支持多级：级联选择器的数据就是当前库的下一级子树 */
const subTree = computed(() => currentRoot.value?.children || [])
const subProps = {
  value: 'database_id',
  label: 'database_name',
  children: 'children',
  checkStrictly: true,
  emitPath: false,
}

const categoryOptions = ref([])
const loading = ref(false)
const rows = ref([])
const total = ref(0)

const params = ref({
  sub_database_id: null,
  title: '',
  author: '',
  language: '',
  category_id: null,
  year: null,
  page_num: 1,
  page_size: 10,
})

const currentYear = new Date().getFullYear()
const yearOptions = Array.from({ length: 40 }, (_, index) => currentYear - index)

const loadRoots = async () => {
  try {
    const res = await getDatabaseRootsService()
    const list = res?.data?.data || []
    rootNodes.value = Array.isArray(list) ? list : []
  } catch {
    rootNodes.value = []
  }
}

const loadCategories = async () => {
  try {
    const res = await getCategoryService()
    // 后端 to_dict() 返回 category_id / category_name / code
    const list = res?.data?.data || []
    categoryOptions.value = Array.isArray(list)
      ? list.map((item) => ({
          label: item.category_name || item.code || '未命名类型',
          value: item.category_id ?? item.id,
        }))
      : []
  } catch {
    categoryOptions.value = []
  }
}

const loadList = async () => {
  if (!databaseId.value) return
  loading.value = true
  try {
    const query = {
      database_id: databaseId.value,
      page_num: params.value.page_num,
      page_size: params.value.page_size,
    }
    if (params.value.sub_database_id) query.sub_database_id = params.value.sub_database_id
    if (params.value.title) query.title = params.value.title
    if (params.value.author) query.author = params.value.author
    if (params.value.language) query.language = params.value.language
    if (params.value.category_id) query.category_id = params.value.category_id
    if (params.value.year) query.year = params.value.year

    const res = await getDatabaseCorpusService(query)
    const data = res?.data?.data || {}
    rows.value = data.data || []
    total.value = data.total || 0
  } catch {
    rows.value = []
    total.value = 0
    ElMessage.error('文献加载失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

const onSearch = () => {
  params.value.page_num = 1
  loadList()
}

const onReset = () => {
  params.value = {
    sub_database_id: null,
    title: '',
    author: '',
    language: '',
    category_id: null,
    year: null,
    page_num: 1,
    page_size: params.value.page_size,
  }
  loadList()
}

const onSizeChange = (val) => {
  params.value.page_size = val
  params.value.page_num = 1
  loadList()
}

const onCurrentChange = (val) => {
  params.value.page_num = val
  loadList()
}


/* 查看：复用文献管理的「查看详情」抽屉，公共端只读 */
const fileEditRef = ref()
const dialogTitle = ref('查看详情')
const viewDetail = (row) => {
  dialogTitle.value = '查看详情'
  fileEditRef.value.open({ corpus_id: row.corpus_id, judgeFlag: true, ban: true })
}

const languageText = (value) => value || '—'

const keywordText = (value) => (Array.isArray(value) ? value.filter(Boolean).join('、') : value || '—')

watch(databaseId, () => {
  params.value.sub_database_id = null
  params.value.page_num = 1
  loadList()
})

onMounted(async () => {
  await Promise.all([loadRoots(), loadCategories()])
  loadList()
})
</script>

<template>
  <div class="db-page" v-loading="loading">
    <header class="db-head">
      <div class="db-title">
        <h2>{{ currentRoot?.database_name || '主题数据库' }}</h2>
        <p>该库及其各级子库中已审核通过的文献，可用下方条件进一步筛选</p>
      </div>
      <el-tag type="info" effect="plain" round>共 {{ total }} 篇</el-tag>
    </header>

    <section class="filter-bar">
      <!-- 选择类条件：选完即检索（含清空），无需再点按钮 -->
      <el-cascader
        v-model="params.sub_database_id"
        :options="subTree"
        :props="subProps"
        placeholder="全部子库（可选择任意层级）"
        clearable
        filterable
        class="filter-item filter-item--sub"
        @change="onSearch"
      />
      <el-select
        v-model="params.language"
        placeholder="语种"
        clearable
        filterable
        allow-create
        class="filter-item filter-item--sm"
        @change="onSearch"
      >
        <el-option v-for="item in LANGUAGES" :key="item" :label="item" :value="item" />
      </el-select>
      <el-select
        v-model="params.category_id"
        placeholder="文献类型"
        clearable
        class="filter-item filter-item--sm"
        @change="onSearch"
      >
        <el-option v-for="item in categoryOptions" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <el-select
        v-model="params.year"
        placeholder="出版年份"
        clearable
        filterable
        class="filter-item filter-item--sm"
        @change="onSearch"
      >
        <el-option v-for="year in yearOptions" :key="year" :label="String(year)" :value="year" />
      </el-select>
      <!-- 文本类条件放在最后，回车或点检索生效 -->
      <el-input
        v-model="params.title"
        placeholder="标题关键词"
        clearable
        class="filter-item filter-item--text"
        @keyup.enter="onSearch"
        @clear="onSearch"
      />
      <el-input
        v-model="params.author"
        placeholder="作者 / 译者 / 编者"
        clearable
        class="filter-item filter-item--text"
        @keyup.enter="onSearch"
        @clear="onSearch"
      />
      <div class="filter-actions">
        <el-button type="primary" @click="onSearch">检索</el-button>
        <el-button @click="onReset">重置</el-button>
      </div>
    </section>

    <el-table :data="rows" size="default" stripe class="db-table" empty-text="该条件下暂无文献">
      <el-table-column type="index" label="序号" width="64" />
      <el-table-column label="标题" min-width="260">
        <template #default="{ row }">
          <div class="cell-title">
            <span>{{ row.title_cn || row.title_en || '—' }}</span>
            <small v-if="row.title_cn && row.title_en">{{ row.title_en }}</small>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="作者" width="120" show-overflow-tooltip>
        <template #default="{ row }">{{ row.author || '—' }}</template>
      </el-table-column>
      <el-table-column label="语种" width="88" align="center">
        <template #default="{ row }">{{ languageText(row.language) }}</template>
      </el-table-column>
      <el-table-column label="类型" width="120" show-overflow-tooltip>
        <template #default="{ row }">{{ row.category_name || '—' }}</template>
      </el-table-column>
      <el-table-column label="年份" width="84" align="center">
        <template #default="{ row }">{{ row.publish_time || '—' }}</template>
      </el-table-column>
      <el-table-column label="关键词" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">{{ keywordText(row.keyword_cn || row.keyword_en) }}</template>
      </el-table-column>
      <el-table-column label="字数" width="88" align="right">
        <template #default="{ row }">{{ row.word_number ?? '—' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="110" align="center">
        <template #default="{ row }">
          <el-link type="primary" :underline="false" @click="viewDetail(row)">
            <el-icon><View /></el-icon> 查看
          </el-link>
        </template>
      </el-table-column>
    </el-table>

    <div class="db-pager">
      <el-pagination
        background
        layout="total, sizes, prev, pager, next, jumper"
        :total="total"
        :current-page="params.page_num"
        :page-size="params.page_size"
        :page-sizes="[10, 20, 50]"
        @size-change="onSizeChange"
        @current-change="onCurrentChange"
      />
    </div>

    <!-- 与文献管理一致的查看详情抽屉（公共端只读） -->
    <FileEdit ref="fileEditRef" :title="dialogTitle" />
  </div>
</template>

<style scoped>
.db-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 2px 18px;
  color: #143437;
}

.db-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  border: 1px solid #e8ebef;
  border-radius: 12px;
  background: linear-gradient(120deg, #f7fbfb 0%, #ffffff 70%);
}

.db-title h2 {
  margin: 0 0 4px;
  padding-left: 9px;
  border-left: 3px solid #005767;
  font-size: 17px;
  font-weight: 700;
}

.db-title p {
  margin: 0;
  padding-left: 12px;
  color: #5b7074;
  font-size: 12.5px;
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid #e8ebef;
  border-radius: 12px;
  background: #fff;
}

.filter-item {
  width: 190px;
}

.filter-item--text {
  width: 200px;
}

/* 点击筛选项时只保留 Element 的内描边，去掉额外的 outline 细线 */
.filter-bar :deep(.el-input__wrapper),
.filter-bar :deep(.el-select__wrapper),
.filter-bar :deep(.el-cascader .el-input__wrapper) {
  border-radius: 8px;
  outline: none;
  box-shadow: 0 0 0 1px #dde5e7 inset;
}

.filter-bar :deep(.el-input__wrapper.is-focus),
.filter-bar :deep(.el-select__wrapper.is-focused),
.filter-bar :deep(.el-input__wrapper:hover),
.filter-bar :deep(.el-select__wrapper:hover) {
  outline: none;
  box-shadow: 0 0 0 1px #005767 inset;
}

.filter-bar :deep(.el-select__wrapper.is-focused) {
  border-color: transparent;
}

.filter-item--sub {
  width: 250px;
}

.filter-item--sm {
  width: 130px;
}

.filter-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

.db-table {
  border: 1px solid #e8ebef;
  border-radius: 12px;
  overflow: hidden;
}

.cell-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cell-title small {
  color: #93a3a6;
  font-size: 11.5px;
}

.db-pager {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 1100px) {
  .filter-item,
  .filter-item--sm {
    width: calc(50% - 4px);
  }

  .filter-item--sub {
    width: 100%;
  }

  .filter-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
