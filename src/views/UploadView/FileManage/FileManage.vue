<script setup>
import { Edit, Delete, View } from '@element-plus/icons-vue'
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import FileEdit from './components/FileEdit.vue'
import {
  getCorpusListService,
  corpusDeleteService,
  corpusExamineService,
  corpusWithdrawService,
} from '@/api/collector'
// import { convertDateFormat } from '@/utils/utils'

const route = useRoute()
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

const getCorpusList = async (data) => {
  const res = await getCorpusListService(data)
  // console.log(res)
  if (res.data.code === 200) {
    fileList.value = res.data.data.data
    total.value = res.data.data.total
  }
}

// 页面加载时检查是否有 query 参数
onMounted(() => {
  // 如果有 query 参数，自动填充并搜索
  if (route.query.status !== undefined) {
    params.value.status = parseInt(route.query.status)
    params.value.page_num = 1
    getCorpusList(params.value)
  } else {
    getCorpusList(params.value)
  }
})

const onSizeChange = (val) => {
  params.value.page_size = val
  // 改变页面大小时应当返回第一页
  params.value.page_num = 1
  // getStaffList(params.value)
  getCorpusList(params.value)
}
const onCurrentChange = (val) => {
  params.value.page_num = val
  // getStaffList(params.value)
  getCorpusList(params.value)
}
const total = ref(0)

const onSearch = () => {
  params.value.page_num = 1
  getCorpusList(params.value)
}

const reset = () => {
  params.value = {
    page_num: 1,
    page_size: 10,
    // title: '',
    // author: '',
    // status: null,
    // keyword: '',
  }
}

const title = ref('')
const toShow = (row) => {
  // console.log(row)
  row.judgeFlag = false
  row.ban = true
  title.value = '查看详情'
  fileEditRef.value.open(row)
}

const fileEditRef = ref()
const onEditFile = (row) => {
  row.ban = false
  // console.log(row)
  title.value = '修改文献'
  fileEditRef.value.open(row)
}

const onDelFile = async (row) => {
  // console.log(row)
  const res = await corpusDeleteService({ corpus_id: row.corpus_id })
  if (res.data.code === 200) {
    getCorpusList(params.value)
    ElMessage.success('删除成功')
  }
}

const submitReview = async (row) => {
  // console.log(row)
  const res = await corpusExamineService(row.corpus_id)
  if (res.data.code === 200) {
    getCorpusList(params.value)
    ElMessage.success('提交审核成功')
    params.value.page = 1
    params.value.pageSize = 10
    getCorpusList(params.value)
  }
}

const withdrawReview = async (row) => {
  // console.log(row)
  const res = await corpusWithdrawService(row.corpus_id)
  if (res.data.code === 200) {
    getCorpusList(params.value)
    ElMessage.success('撤回审核成功')
    params.value.page = 1
    params.value.pageSize = 10
    getCorpusList(params.value)
  }
}

const onSuccess = () => {
  params.value.page = 1
  params.value.pageSize = 10
  getCorpusList(params.value)
}

// 拼接关键字
const joinKeyword = (keyword) => {
  // console.log(keyword)
  if (keyword === undefined || keyword === null) return ''

  // 如果你需要将数组重新转换为字符串，并且不包含方括号和双引号，可以手动拼接
  let cleanStr = keyword.join(';')
  return cleanStr
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
</script>
<template>
  <PageContainer title="文献管理">
    <el-form :inline="false" label-width="130px">
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
            <!-- <el-input v-model="params.language"></el-input> -->
            <el-select
              v-model="params.language"
              placeholder="请选择语言"
              allow-create
              filterable
              @change="onSearch"
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
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="20">
        <el-col :span="6">
          <el-form-item label="语料类型：">
            <category-select2
              @change="onSearch"
              v-model="params.category_id"
              style="width: 100%"
            ></category-select2>
          </el-form-item>
        </el-col>
        <el-col :span="6">
          <el-form-item label="状态：">
            <el-select
              style="width: 100%"
              v-model="params.status"
              placeholder="请选择语料状态"
              @change="onSearch"
              clearable
            >
              <el-option label="草稿" :value="-1"></el-option>
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
        <!-- 按钮放在最后一行的最后 -->
      </el-row>
    </el-form>

    <el-table :data="fileList" v-loading="loading" style="width: 100%">
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
      <el-table-column prop="keyword_cn" label="中文关键字" width="100" show-overflow-tooltip />
      <el-table-column prop="keyword_en" label="英文关键字" width="100" show-overflow-tooltip />
      <!-- <el-table-column label="中文关键字">
        <template #default="{ row }">
          {{
            joinKeyword(row.keyword_cn).length > 10
              ? joinKeyword(row.keyword_cn).slice(0, 10) + '...'
              : joinKeyword(row.keyword_cn)
          }}
        </template>
      </el-table-column>
      <el-table-column label="英文关键字">
        <template #default="{ row }">
          {{
            joinKeyword(row.keyword_en).length > 10
              ? joinKeyword(row.keyword_en).slice(0, 20) + '...'
              : joinKeyword(row.keyword_en)
          }}
        </template>
      </el-table-column> -->
      <el-table-column prop="word_number" label="文献字数" width="90"></el-table-column>
      <el-table-column label="审核状态">
        <template v-slot:default="scope">
          <span v-if="scope.row.status === -1">
            <a href="#" @click.prevent="onEditFile(scope.row)">编辑</a>
          </span>
          <span v-if="scope.row.status === 0">
            <a href="#" @click.prevent="submitReview(scope.row)">提交审核</a>
          </span>
          <span v-else-if="scope.row.status === 1">
            <a href="#" @click.prevent="withdrawReview(scope.row)">撤回审核</a>
          </span>
          <span v-else-if="scope.row.status === 2"> 审核通过 </span>
          <span v-else-if="scope.row.status === 3">
            <a href="#" @click.prevent="submitReview(scope.row)">重新提交</a>
          </span>
        </template>
      </el-table-column>
      <el-table-column label="查看详情">
        <!-- 插槽写法可以获取到此行的数据 -->
        <template #default="{ row }">
          <el-link type="primary" @click="toShow(row)">
            <el-icon><View /></el-icon> 点击查看</el-link
          >
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150">
        <!-- 插槽写法可以获取到此行的数据 -->
        <template #default="{ row }">
          <el-button
            :icon="Edit"
            circle
            plain
            type="primary"
            @click="onEditFile(row)"
            :disabled="row.status === 2"
          ></el-button>
          <el-button
            :icon="Delete"
            circle
            plain
            type="danger"
            @click="onDelFile(row)"
            :disabled="row.status === 2"
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
    <file-edit ref="fileEditRef" @success="onSuccess" :title="title"></file-edit>
  </PageContainer>
</template>
