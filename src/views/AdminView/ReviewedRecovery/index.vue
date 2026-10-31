<template>
  <div class="box">
    <el-tabs v-model="activeStatus" class="status-tabs" @tab-change="handleStatusChange">
      <el-tab-pane label="审核通过" :name="2" />
      <el-tab-pane label="审核不通过" :name="3" />
    </el-tabs>
    <div class="handle-box">
      <el-select v-model="selectCategory" class="handle-select mr10" placeholder="搜索类型">
        <el-option key="1" label="原文标题" value="title_cn"></el-option>
        <el-option key="2" label="译文标题" value="title_en"></el-option>
        <el-option key="3" label="作者" value="author"></el-option>
        <el-option key="4" label="语言" value="language"></el-option>
      </el-select>
      <el-input v-model="content" placeholder="请输入搜索内容" class="handle-input mr10"></el-input>
      <el-button @click="searchCorpus" type="primary" icon="el-icon-search">搜索</el-button>
      <el-button type="success" @click="refresh">刷新</el-button>
    </div>

    <!-- 数据展示 -->
    <div class="container">
      <el-table
        v-loading="loading"
        :data="corpusList"
        @selection-change="handleSelectionChange"
        stripe
        style="width: 100%"
      >
        <el-table-column type="index" label="序号" width="60" align="center">
          <template #default="scope">
            {{ (currentPage - 1) * pageSize + scope.$index + 1 }}
          </template>
        </el-table-column>

        <el-table-column
          label="原文标题"
          prop="title_cn"
          show-overflow-tooltip
          align="center"
        ></el-table-column>

        <el-table-column
          label="译文标题"
          prop="title_en"
          show-overflow-tooltip
        ></el-table-column>

        <el-table-column
          label="语料类名"
          show-overflow-tooltip
          prop="category_name"
        ></el-table-column>

        <el-table-column
          label="语言"
          show-overflow-tooltip
          prop="language"
        ></el-table-column>

        <el-table-column
          label="作者"
          show-overflow-tooltip
          prop="author"
        ></el-table-column>

        <!-- <el-table-column
          label="审核状态"
          width="100"
          prop="status"
          align="center"
        >
          <template #default="scope">
            <el-tag :type="scope.row.status === 1 ? 'success' : 'warning'">
              {{ scope.row.status === 1 ? '已通过' : '已驳回' }}
            </el-tag>
          </template>
        </el-table-column> -->

        <el-table-column label="操作" align="center" width="100">
          <template #default="scope">
            <el-button
              type="text"
              icon="el-icon-view"
              @click="handleDetail(scope.$index, scope.row)"
            >查看详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 分页导航区 -->
    <div class="footer">
      <el-pagination
        @size-change="handleSizeChange"
        background
        layout="total, sizes, prev, pager, next, jumper"
        v-model:current-page="currentPage"
        :page-sizes="[10, 20, 50, 100]"
        :page-size="pageSize"
        @current-change="pageChange"
        :hide-on-single-page="false"
        :total="total"
      >
      </el-pagination>
    </div>

    <!-- 详情抽屉 -->
    <el-drawer
      title="语料详情"
      :model-value="dialogVisible"
      @update:model-value="dialogVisible = $event"
      size="60%"
    >
      <el-form :model="detailData" label-width="100px">
        <el-form-item label="原文标题">
          <el-input v-model="detailData.title_cn" disabled></el-input>
        </el-form-item>
        <el-form-item label="译文标题">
          <el-input v-model="detailData.title_en" disabled></el-input>
        </el-form-item>
        <el-row>
          <el-form-item label="语言">
            <el-input v-model="detailData.language" disabled style="width: 200px"></el-input>
          </el-form-item>
          <el-form-item label="译者">
            <el-input v-model="detailData.translator" disabled style="width: 200px"></el-input>
          </el-form-item>
          <el-form-item label="作者">
            <el-input v-model="detailData.author" disabled style="width: 200px"></el-input>
          </el-form-item>
          <el-form-item label="编者">
            <el-input v-model="detailData.editor" disabled style="width: 200px"></el-input>
          </el-form-item>
          <el-form-item label="ISBN">
            <el-input v-model="detailData.ISSN" disabled style="width: 200px"></el-input>
          </el-form-item>
          <el-form-item label="文献类型">
            <el-input v-model="detailData.category_name" disabled style="width: 200px"></el-input>
          </el-form-item>
          <el-form-item label="出版时间">
            <el-input v-model="detailData.publish_time" disabled style="width: 200px"></el-input>
          </el-form-item>
          <el-form-item label="卷号">
            <el-input v-model="detailData.volume" disabled style="width: 200px"></el-input>
          </el-form-item>
          <el-form-item label="期号">
            <el-input v-model="detailData.issue" disabled style="width: 200px"></el-input>
          </el-form-item>
        </el-row>
        <el-form-item label="来源">
          <el-input v-model="detailData.source" disabled></el-input>
        </el-form-item>
        <el-form-item label="所属数据库">
          <database-select v-model="detailData.database_id" disabled/>
        </el-form-item>
        <el-form-item label="中文关键词">
          <el-input v-model="detailData.keyword_cn" disabled></el-input>
        </el-form-item>
        <el-form-item label="英文关键词">
          <el-input v-model="detailData.keyword_en" disabled></el-input>
        </el-form-item>
        <el-form-item label="中文摘要">
          <el-input
            type="textarea"
            v-model="detailData.abstract_cn"
            disabled
            :autosize="{ minRows: 6, maxRows: 12 }"
          ></el-input>
        </el-form-item>
        <el-form-item label="外文摘要">
          <el-input
            type="textarea"
            v-model="detailData.abstract_en"
            disabled
            :autosize="{ minRows: 6, maxRows: 12 }"
          ></el-input>
        </el-form-item>
        <!-- 如果是翻译文献（译者不为空）显示原文信息 -->
        <div v-if="detailData.translator">
          <el-form-item label="原文文档名">
            <el-input v-model="detailData.original_name" disabled></el-input>
          </el-form-item>
          <el-row>
            <el-form-item label="原文语言">
              <el-input v-model="detailData.original_language" disabled style="width: 200px"></el-input>
            </el-form-item>
            <el-form-item label="原文出版时间">
              <el-input v-model="detailData.original_time" disabled style="width: 200px"></el-input>
            </el-form-item>
            <el-form-item label="原文来源">
              <el-input v-model="detailData.original_source" disabled style="width: 200px"></el-input>
            </el-form-item>
          </el-row>
        </div>
        <el-form-item label="附件">
          <div v-if="detailData.attachment && detailData.attachment.length > 0">
            <el-link
              class="linkCss"
              v-for="(attachmentPath, index) in detailData.attachment"
              :key="index"
              @click="openFile(attachmentPath)"
            >
              {{ attachmentPath }}
            </el-link>
          </div>
          <div v-else>
            <span>无附件</span>
          </div>
        </el-form-item>
        <el-form-item v-if="detailData.comment" label="审核意见">
          <el-input
            type="textarea"
            v-model="detailData.comment"
            disabled
            :autosize="{ minRows: 3, maxRows: 6 }"
          ></el-input>
        </el-form-item>
      </el-form>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { getExamineRecoveryReviewedService, getExamineRecoveryDecisionService } from '@/api/admin.js'
import { corpusDetailService, getCorpusFileService } from '@/api/collector.js'
import { ElMessage } from 'element-plus'

// 响应式数据
const loading = ref(false)
const corpusList = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)
const selectCategory = ref('')
const content = ref('')
const dialogVisible = ref(false)
const detailData = ref({})
const filename = ref('')  // 与 HistoryVerify 保持一致
const activeStatus = ref(2) // 2 审核通过 / 3 审核不通过

// 搜索表单数据
const searchForm = reactive({
  page_size: 10,
  page_num: 1
})

// 获取已审核恢复语料列表
const getCorpusList = async (params = {}) => {
  loading.value = true
  try {
    const res = await getExamineRecoveryReviewedService({
      ...searchForm,
      status: Number(activeStatus.value),
      ...params
    })

    if (res.data && res.data.code === 200) {
      corpusList.value = res.data.data.data || []
      total.value = res.data.data.total || 0
    } else {
      ElMessage.error(res.data?.message || '获取数据失败')
    }
  } catch (error) {
    console.error('获取已审核恢复语料失败', error)
    ElMessage.error('获取数据失败，请重试！')
  } finally {
    loading.value = false
  }
}

const handleStatusChange = () => {
  searchForm.page_num = 1
  currentPage.value = 1
  getCorpusList()
}

// 页大小改变
const handleSizeChange = (val) => {
  pageSize.value = val
  searchForm.page_size = val
  searchForm.page_num = 1
  currentPage.value = 1
  getCorpusList()
}

// 页码改变
const pageChange = (val) => {
  currentPage.value = val
  searchForm.page_num = val
  getCorpusList()
}

// 刷新数据
const refresh = () => {
  content.value = ''
  selectCategory.value = ''
  searchForm.page_num = 1
  currentPage.value = 1
  getCorpusList()
}

// 搜索语料
const searchCorpus = () => {
  const params = {}
  if (selectCategory.value && content.value) {
    params[selectCategory.value] = content.value
  }
  searchForm.page_num = 1
  currentPage.value = 1
  getCorpusList(params)
}

// 查看详情 - 修正数据处理逻辑，使用 attachment 字段
const handleDetail = async (index, row) => {
  try {
    dialogVisible.value = true
    detailData.value = { ...row }

    // 获取完整的语料详情
    const res = await corpusDetailService({
      corpus_id: row.id || row.corpus_id,
    })

    if (res.data && res.data.code === 200) {
      // 合并数据
      detailData.value = { ...row, ...res.data.data }

      // 处理数据库ID数组 - 与 HistoryVerify 保持一致
      if (detailData.value.database && Array.isArray(detailData.value.database)) {
        detailData.value.database_id = detailData.value.database.map(item => parseInt(item.database_id));
      }

      // 设置 filename - 使用 attachment 数组的第一个文件路径
      if (detailData.value.attachment && detailData.value.attachment.length > 0) {
        filename.value = detailData.value.attachment[0];
      }
    }
  } catch (error) {
    console.error('获取语料详情失败', error)
    ElMessage.error('获取语料详情失败，请重试！')
  }
}

// 表格选择改变
const handleSelectionChange = (val) => {
  // 可以在这里处理多选逻辑
}

// 文件预览 - 与接口返回数据结构保持一致
const openFile = async (filePath) => {
  try {
    const res = await getCorpusFileService({
      corpus_id: detailData.value.id || detailData.value.corpus_id,
      attachment_path: filePath,  // 现在 filePath 就是 attachment_path
    });

    // 处理 Blob 数据
    const blob = new Blob([res.data], { type: res.headers['content-type'] });
    const fileUrl = URL.createObjectURL(blob);

    // 使用 filename 变量
    const a = document.createElement('a');
    a.href = fileUrl;
    a.download = filename.value;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // 清理 URL 对象
    setTimeout(() => URL.revokeObjectURL(fileUrl), 100);
  } catch (error) {
    console.error('文件预览失败', error);
    ElMessage.error('文件预览失败，请重试！');
  }
}

// 获取文件名字函数已移除，改用 filename 变量 - 与 HistoryVerify 保持一致

// 组件挂载时获取数据
onMounted(() => {
  getCorpusList()
})
</script>

<style scoped>
.box {
  padding: 10px;
  background: linear-gradient(to bottom, #005767, white);
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.status-tabs {
  margin-bottom: 10px;
}
.status-tabs :deep(.el-tabs__item) {
  color: rgba(255, 255, 255, 0.85);
}
.status-tabs :deep(.el-tabs__item.is-active) {
  color: #fff;
  font-weight: 600;
}
.status-tabs :deep(.el-tabs__nav-wrap::after) {
  background-color: rgba(255, 255, 255, 0.25);
}
.status-tabs :deep(.el-tabs__active-bar) {
  background-color: #fff;
}

.handle-box {
  margin-bottom: 10px;
  line-height: 50px;
  float: right;
  padding-right: 10px;
}

.handle-select {
  width: 120px;
}

.handle-input {
  width: 300px;
  display: inline-block;
}

.mr10 {
  margin-right: 10px;
}

.container {
  clear: both;
  padding: 20px;
  background-color: white;
  border-radius: 4px;
  margin-bottom: 20px;
}

.footer {
  text-align: center;
  margin-top: 20px;
  display: flex;
  justify-content: center;
}

::v-deep .el-table th {
  background-color: #f5f7fa;
}

.linkCss {
  cursor: pointer;
  display: block;
  margin-bottom: 5px;
  color: #005767;
}

.linkCss:hover {
  color: #66b1ff;
  text-decoration: underline;
}

/* 增加摘要文本域的默认高度 */
::v-deep .el-textarea__inner {
  min-height: 120px !important;
}
</style>
