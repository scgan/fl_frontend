<template>
  <div class="box">
    <el-tabs v-model="activeStatus" class="status-tabs" @tab-change="handleStatusChange">
      <el-tab-pane label="审核通过" :name="2" />
      <el-tab-pane label="审核不通过" :name="3" />
    </el-tabs>
    <!-- 数据展示 -->
    <div class="container">
      <el-table
        :data="adminList"
        @selection-change="handleSelectionChange"
      >
        <!--<el-table-column
          type="selection"
          width="60"
          align="center"
        ></el-table-column>-->
        <el-table-column
          label="原文标题"
          prop="title_cn"
          show-overflow-tooltip
          align="center"
        ></el-table-column>

        <el-table-column label="译文标题" prop="title_en" show-overflow-tooltip> </el-table-column>
        <el-table-column
          label="语料类名"
          show-overflow-tooltip
          prop="category_name"
        ></el-table-column>
        <el-table-column label="语言" show-overflow-tooltip prop="language"></el-table-column>
        <el-table-column label="收集人" show-overflow-tooltip prop="name"></el-table-column>
        <!-- <el-table-column label="审核状态" width="100" prop="check" align="center">
          <template v-slot="scope">
            <span class="message-title">
              <el-tag :type="scope.row.check == '0' ? 'warning' : 'success'">{{ scope.row.status == "0" ? "未审核" : "已审核" }}</el-tag>
            </span>
          </template>
        </el-table-column> -->
        <el-table-column label="操作" align="center" width="100">
          <template v-slot="scope">
            <el-button type="text" icon="el-icon-remove" @click="toShow(scope.row)">查看</el-button>
            <!-- handleDetail(scope.$index, scope.row) -->
            <!--<el-button
              type="text"
              icon="el-icon-delete"
              class="red"
              @click="handleDelete(scope.$index, scope.row)"
              >删除</el-button
            >-->
          </template>
        </el-table-column>
      </el-table>
    </div>
    <!-- 导航区 -->
    <div class="footer">
      <el-pagination
        @size-change="handleSizeChange"
        background
        layout="total,sizes,prev,pager,next, jumper"
        :current-page.sync="currentPage"
        :page-sizes="[10, 20, 50, 100]"
        :page-size="pageSize"
        @current-change="pageChange"
        @next-click="currentPage"
        @prev-click="currentPage"
        :hide-on-single-page="false"
        :total="total"
      >
      </el-pagination>
    </div>

    <el-dialog
      title="语料详情"
      :model-value="dialogVisiblePerson"
      @update:model-value="dialogVisiblePerson = $event"
      width="50%"
    >
      <el-form label-width="80px" :model="msgDetail">
        <el-form-item>
          <el-col :span="8">
            <el-form-item label="作者">
              <span class="text">{{ msgDetail.author }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="原文标题">
              <span class="text">{{ msgDetail.title_cn }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="译文标题">
              <span class="text">{{ msgDetail.title_en }}</span>
            </el-form-item>
          </el-col>
        </el-form-item>
        <el-form-item>
          <el-col :span="8">
            <el-form-item label="编者">
              <span class="text">{{ msgDetail.editor }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="中文摘要">
              <span class="text">{{ msgDetail.abstract_cn }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="外文摘要">
              <span class="text">{{ msgDetail.abstract_en }}</span>
            </el-form-item>
          </el-col>
        </el-form-item>
        <el-form-item>
          <el-col :span="8">
            <el-form-item label="附件">
              <a
                class="linkCss"
                v-for="(item, index) in msgDetail.attachment"
                @click="openFile(item)"
                target="_blank"
                >{{ getFileName(item) }}</a
              >
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="来源">
              <span class="text">{{ msgDetail.original_source }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="出版时间">
              <span class="text">{{ msgDetail.original_time }}</span>
            </el-form-item>
          </el-col>
        </el-form-item>
        <el-form-item>
          <el-col :span="8">
            <el-form-item label="类型">
              <span class="text">{{ msgDetail.category_name }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="语言">
              <span class="text">{{ msgDetail.language }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="译者">
              <span class="text">{{ msgDetail.translator }}</span>
            </el-form-item>
          </el-col>
        </el-form-item>
      </el-form>
      <div class="buttons">
        <el-button type="success" role="button" tabindex="0" @click="dialogVisiblePerson = false"
          >确定</el-button
        >
      </div>
      <el-dialog v-model="innerVisible" width="500" modal="false" title="驳回理由" append-to-body>
        <el-mention
          v-model="reason"
          type="textarea"
          :options="options"
          style="width: 100%; height: 200px"
          placeholder="请输入驳回理由"
        />
        <div class="tips">
          <el-button
            v-for="(item, index) in predefinedReasons"
            :key="index"
            type="info"
            plain
            size="small"
            @click="reason = item"
          >
            {{ item }}
          </el-button>
        </div>
        <div class="buttons">
          <el-button
            type="success"
            role="button"
            tabindex="0"
            @click="((innerVisible = false), (reason = ''))"
            >取消</el-button
          >
          <el-button type="danger" role="button" tabindex="0" @click="rejectVerifyPer()"
            >驳回</el-button
          >
        </div>
      </el-dialog>
    </el-dialog>
    <file-edit ref="fileEditRef" :title="'查看详情'"></file-edit>
  </div>
</template>

<script setup>
import FileEdit from '@/views/UploadView/FileManage/components/FileEdit.vue'
import { ref } from 'vue'

const toShow = (row) => {
  // console.log(row)
  row.judgeFlag = false
  row.ban = true
  fileEditRef.value.open(row)
}

const fileEditRef = ref()
</script>

<script>
import { getVerifyCor, passVerifyCor, rejectVerifyCor, getCorList } from '@/api/admin.js'
import { corpusDetailService, getCorpusFileService } from '@/api/collector.js'
import { getUserAvatar } from '@/api/user'
export default {
  name: 'VerifyPeople',
  data() {
    return {
      currentPage: 1,
      total: 100,
      pageSize: 10,
      reason: '',
      predefinedReasons: ['信息不完整', '与要求不符', '请补充材料', '其他'],

      msgHistoryWithPic: [],
      selectCategory: 'name',
      content: '',
      innerVisible: false,
      dialogVisiblePerson: false,
      attachment: [
        'uploaded_files/corpus/collector/2025/02/06/20/23/54/gray_image.png',
        'uploaded_files/corpus/collector/2025/02/06/20/23/54/gray_image.png',
      ],
      msgDetail: {},
      imgUrl: '',
      formModel: {}, //条件选择
      selectedArr: [],
      adminList: [],
      currentPage: 1,
      totalPage: 0,
      filename: '',
      activeStatus: 2, // 2 审核通过 / 3 审核不通过
    }
  },
  methods: {
    async getList(data = {}) {
      const props = {
        status: Number(this.activeStatus),
        page_num: this.currentPage,
        page_size: this.pageSize,
        ...this.formModel,
        ...data,
      }
      const res = await getVerifyCor(props)
      this.total = res.data.data.total
      this.adminList = res.data.data.data
    },
    handleStatusChange() {
      this.currentPage = 1
      this.formModel.page_num = 1
      this.getList()
    },
    //页大小改变的时候
    handleSizeChange(pageSize) {
      this.pageSize = pageSize
      this.formModel.page_size = pageSize
      this.currentPage = 1
      this.formModel.page_num = 1
      this.getList()
    },
    //页数改变时候
    pageChange(page) {
      this.currentPage = page
      this.formModel.page_num = page
      this.getList()
    },
    //输入框刷新
    reFresh() {
      this.content = ''
      this.getList()
    },
    //条件查询语料
    serachPeople() {
      if (this.selectCategory) {
        this.formModel = {}
        this.formModel[this.selectCategory] = this.content
      }
      console.log(this.formModel)
      this.getList(this.formModel)
    },
    //获取语料具体信息
    async handleDetail(index, msg) {
      this.dialogVisiblePerson = true
      this.msgDetail = msg
      const res = await corpusDetailService({
        corpus_id: msg.corpus_id,
      })
      this.msgDetail = { ...msg, ...res.data.data }
      console.log(this.msgDetail)
      this.filename = res.data.data.files[0].filename
    },
    //通过语料审核
    async VerifyPer() {
      try {
        // 等待删除请求完成
        await passVerifyCor({
          corpus_id: this.msgDetail.id,
        })
        // 关闭弹窗
        this.dialogVisiblePerson = false
        // 获取最新数据
        await this.getList()
        // 强制刷新数组，确保 Vue 监听到变化
        this.adminList = [...this.adminList]
        console.log('审核通过')
      } catch (error) {
        console.error('删除失败', error)
        ElMessage.error('审核失败，请重试！')
      }
    },
    //驳回语料审核
    async rejectVerifyPer() {
      try {
        // 等待删除请求完成
        await rejectVerifyCor({
          corpus_id: this.msgDetail.id,
          comment: this.reason,
        })

        // 关闭弹窗
        this.innerVisible = false
        this.dialogVisiblePerson = false
        // 获取最新数据
        await this.getList()
        // 强制刷新数组，确保 Vue 监听到变化
        this.adminList = [...this.adminList]
        console.log('数据已更新')
      } catch (error) {
        console.error('删除失败', error)
        ElMessage.error('驳回失败，请重试！')
      }
    },
    //文件预览
    async openFile(filePath) {
      try {
        // 立即打开新页面
        // const newWindow = window.open('', '_blank')

        // 在新页面中显示加载状态
        // newWindow.document.write('Loading...')
        const res = await getCorpusFileService({
          corpus_id: this.msgDetail.id,
          attachment_path: filePath,
        })

        // 处理 Blob 数据
        const blob = new Blob([res.data], { type: res.headers['content-type'] })
        const fileUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = fileUrl
        a.download = this.filename
        console.log(this.filename)
        document.body.appendChild(a)
        a.click()
        // 在新页面中打开文件
        // newWindow.location.href = fileUrl
        // // 在新窗口打开文件
        // window.open(fileUrl, "_blank");
      } catch (error) {
        console.error('文件预览失败', error)
        // 在新页面中显示错误信息
        // newWindow.document.write('文件加载失败，请重试。')
      }
    },
    //获取文件名字
    getFileName(filePath) {
      const formattedPath = filePath.replace(/\\/g, '/') // 将反斜杠替换为斜杠
      return formattedPath.split('/').pop() // 提取文件名
    },
    //表单多选删除使用
    handleSelectionChange() {},
  },
  computed: {},
  mounted() {
    // this.getMessageList(1);
    this.getList()
  },
}
</script>

<style scoped>
.linkCss {
  cursor: pointer;
  display: block;
  margin-bottom: 9px;
}
.box {
  padding: 10px;
  /* background-color: #D3D3D3; */
  color: white;
  background: linear-gradient(to bottom, #005767, white);
  /* c2e6ec  */
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
.tips {
  margin-bottom: 50px;
}
.title {
  float: left;
  width: 400px;
  line-height: 50px;
  font-weight: bold;
  margin-left: 10px;
  font-size: 24px;
}
.handle-box {
  margin-bottom: 10px;
  line-height: 50px;
  float: right;
  padding-right: 10px;
}
.red {
  color: #ff0000;
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
.footer {
  text-align: center;
  margin-top: 20px;
  display: flex;
  justify-content: center;
}
.buttons {
  width: 80%;
  margin: auto;
  display: flex;
  justify-content: space-evenly;
}
/deep/.el-textarea__inner {
  min-height: 200px !important;
}
</style>
