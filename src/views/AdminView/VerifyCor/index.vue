<template>
  <div class="box">
    <div class="title">&nbsp;</div>
    <div class="handle-box">
      <!-- <el-select v-model="selectCategory" class="handle-select mr10">
        <el-option key="1" label="姓名" value="name"></el-option>
				<el-option key="2" label="教职工号" value="username"></el-option>
				<el-option key="3" label="电话" value="phone"></el-option>
      </el-select> -->
      <!-- <el-input v-model="content" placeholder="请输入" class="handle-input mr10"></el-input> -->
      <!-- <el-button @click="serachPeople" type="primary" icon="el-icon-search">搜索</el-button> -->
      <!-- <el-button type="success" @click="reFresh">刷新</el-button> -->
      <!-- <el-button
        @click="dialogVisible = true"
        type="success"
        icon="el-icon-circle-plus-outline"
        >添加管理员</el-button
      > -->
      <!-- <el-button type="warning" @click="isPass" icon="el-icon-circle-check"
        >通过审核</el-button
      > -->
    </div>
    <!-- 数据展示 -->
    <div class="container">
      <el-table
        v-if="adminList.length > 0"
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
            <el-button
              type="text"
              icon="el-icon-remove"
              @click="handleDetail(scope.$index, scope.row)"
              >查看</el-button
            >
            <!-- toShow(scope.row) -->
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

    <el-drawer
      title="语料详情"
      :model-value="dialogVisiblePerson"
      @update:model-value="dialogVisiblePerson = $event"
      size="60%"
    >
      <el-form :model="msgDetail" ref="formRef" label-width="100px" :rules="rules">
        <el-form-item label="原文标题">
          <el-input
            v-model="msgDetail.title_cn"
            placeholder="请输入原文标题"
            :disabled="ban"
          ></el-input>
        </el-form-item>
        <el-form-item label="译文标题">
          <el-input
            v-model="msgDetail.title_en"
            placeholder="请输入译文标题"
            :disabled="ban"
          ></el-input>
        </el-form-item>
        <el-row>
          <el-form-item label="语言">
            <!-- <el-select
          v-model="msgDetail.language"
          placeholder="请选择语言"
          allow-create
          clearable
          :disabled="ban"
        >
          <el-option label="中文" value="zh"></el-option>
          <el-option label="英文" value="en"></el-option>
        </el-select> -->
            <el-select
              v-model="msgDetail.language"
              placeholder="请选择语言"
              allow-create
              filterable
              clearable
              :disabled="ban"
              style="width: 200px"
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
            <!-- <el-input
            v-model="msgDetail.language"
            placeholder="请输入语言"
            :disabled="ban"
            style="width: 200px"
          ></el-input> -->
          </el-form-item>
          <el-form-item label="译者" prop="translator">
            <el-input
              v-model="msgDetail.translator"
              placeholder="请输入译者"
              :disabled="ban"
              style="width: 200px"
            ></el-input>
          </el-form-item>
          <el-form-item label="作者" prop="author">
            <el-input
              v-model="msgDetail.author"
              placeholder="请输入作者"
              :disabled="ban"
              style="width: 200px"
            ></el-input>
          </el-form-item>
          <el-form-item label="编者" prop="editor">
            <el-input
              v-model="msgDetail.editor"
              placeholder="请输入编者"
              :disabled="ban"
              style="width: 200px"
            ></el-input>
          </el-form-item>
          <el-form-item label="ISBN" prop="ISSN">
            <el-input
              v-model="msgDetail.ISSN"
              placeholder="请输入文献编号"
              :disabled="ban"
              style="width: 200px"
            ></el-input>
          </el-form-item>
          <el-form-item label="文献类型" prop="category_id">
            <category-select2 v-model="msgDetail.category_id" :disabled="ban"></category-select2>
            <!-- <el-select v-model="msgDetail.documentType" placeholder="请选择">
          <el-option label="图书" value="book"></el-option>
          <el-option label="期刊论文" value="journal"></el-option>
          <el-option label="学位论文" value="thesis"></el-option>
        </el-select> -->
          </el-form-item>
          <el-form-item label="出版时间">
            <el-date-picker
              v-model="msgDetail.publish_time"
              type="year"
              placeholder="请选择年份"
              format="YYYY"
              value-format="YYYY"
              style="width: 200px"
              :disabled="ban"
            ></el-date-picker>
          </el-form-item>
          <el-form-item label="卷号" prop="volume">
            <el-input
              v-model="msgDetail.volume"
              placeholder="请输入卷号"
              style="width: 200px"
              :disabled="ban"
            ></el-input>
          </el-form-item>
          <el-form-item label="期号" prop="issue">
            <el-input
              v-model="msgDetail.issue"
              placeholder="请输入编者"
              style="width: 200px"
              :disabled="ban"
            ></el-input>
          </el-form-item>
          <!-- <el-form-item label="卷期号/ISBN">
        <el-input v-model="msgDetail.volumeOrIsbn"></el-input>
      </el-form-item> -->
        </el-row>
        <el-form-item label="来源">
          <el-input
            v-model="msgDetail.source"
            placeholder="请输入出版社、期刊名称或url"
            :disabled="ban"
          ></el-input>
        </el-form-item>
        <!-- <el-form-item label="所属数据库" prop="database_id">
          <database-select v-model="msgDetail.database_id" :disabled="ban"></database-select>
        </el-form-item> -->
        <el-form-item label="中文关键词">
          <keyword-select
            v-model="msgDetail.keyword_cn"
            style="padding-right: 10px"
            :language="chinese"
            :disabled="ban"
          ></keyword-select>
        </el-form-item>
        <el-form-item label="英文关键词">
          <keyword-select
            v-model="msgDetail.keyword_en"
            style="padding-right: 10px"
            :language="english"
            :disabled="ban"
          ></keyword-select>
        </el-form-item>
        <el-form-item label="中文摘要">
          <el-input
            type="textarea"
            v-model="msgDetail.abstract_cn"
            placeholder="请输入中文摘要"
            :disabled="ban"
          ></el-input>
        </el-form-item>
        <el-form-item label="外文摘要">
          <el-input
            type="textarea"
            v-model="msgDetail.abstract_en"
            placeholder="请输入外文摘要"
            :disabled="ban"
          ></el-input>
        </el-form-item>
        <!-- 如果是翻译文献（译者不为空？）录入原文信息 -->
        <div v-if="msgDetail.translator">
          <el-form-item label="原文文档名">
            <el-input v-model="msgDetail.original_name" :disabled="ban"></el-input>
          </el-form-item>
          <!-- <el-form-item label="原文标题">
          <el-input v-model="msgDetail.original_title" :disabled="ban"></el-input>
        </el-form-item> -->
          <el-row>
            <el-form-item label="原文语言">
              <!-- <el-select
              v-model="msgDetail.original_language"
              placeholder="请选择语言"
              allow-create
              clearable
              :disabled="ban"
            >
              <el-option label="中文" value="zh"></el-option>
              <el-option label="英文" value="en"></el-option>
              <el-option label="日文" value="ja"></el-option>
            </el-select> -->
              <el-input v-model="msgDetail.original_language" :disabled="ban"></el-input>
            </el-form-item>
            <el-form-item label="原文出版时间">
              <el-date-picker
                v-model="msgDetail.original_time"
                type="year"
                placeholder="请选择年份"
                format="YYYY"
                value-format="YYYY"
                style="width: 200px"
                :disabled="ban"
              ></el-date-picker>
            </el-form-item>
            <el-form-item label="原文来源">
              <el-input v-model="msgDetail.original_source" :disabled="ban"></el-input>
            </el-form-item>
          </el-row>
          <!-- <el-form-item label="原文出版社">
          <el-input v-model="msgDetail.publisher"></el-input>
        </el-form-item>
        <el-form-item label="原文期刊名称">
          <el-input v-model="msgDetail.journalName"></el-input>
        </el-form-item>
        <el-form-item label="原文URL">
          <el-input v-model="msgDetail.url"></el-input>
        </el-form-item>
        <el-form-item label="原文字数">
          <el-input-number
            v-model="msgDetail.word_number"
            :min="0"
            label="描述文字"
          ></el-input-number>
        </el-form-item> -->
        </div>

        <el-form-item label="附件">
          <el-link
            class="linkCss"
            v-for="(item, index) in msgDetail.attachment"
            @click="openFile(item)"
            >{{ getFileName(item) }}</el-link
          >
        </el-form-item>
        <!-- <el-upload
            v-model:file-list="msgDetail.file"
            class="upload-demo"
            :auto-upload="false"
            :show-file-list="true"
            :on-preview="handlePreview"
            multiple
          >
            <el-button type="primary" v-if="!ban">上传附件</el-button>
          </el-upload> -->
        <!-- <el-form-item>
          <el-button type="success" @click="onSubmit()" v-if="!ban">提交</el-button>
        </el-form-item> -->
      </el-form>
      <!-- <el-form label-width="80px" :model="msgDetail">
        <el-form-item>
          <el-col :span="8">
            <el-form-item label="作者">
              <span class="text">{{ msgDetail.author }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="中文标题">
              <span class="text">{{ msgDetail.title_cn }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="英文标题">
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
            <el-form-item label="英文摘要">
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
      </el-form> -->
      <div class="buttons">
        <el-button type="success" role="button" tabindex="0" @click="VerifyPer()">通过</el-button>
        <el-button type="danger" role="button" tabindex="0" @click="innerVisible = true"
          >驳回</el-button
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
    </el-drawer>
    <file-edit ref="fileEditRef" :title="'查看详情'">
      <template #extra>
        <div class="buttons2">
          <el-button type="success" role="button" tabindex="0" @click="VerifyPer()">通过</el-button>
          <el-button type="danger" role="button" tabindex="0" @click="innerVisible = true"
            >驳回</el-button
          >
        </div>
        <!-- <el-button type="primary" @click="openDialog()">语音输入</el-button> -->
      </template>
    </file-edit>
  </div>
</template>

<script setup>
import FileEdit from '@/views/UploadView/FileManage/components/FileEdit.vue'
import { ref } from 'vue'

const ban = ref(true)
const toShow = (row) => {
  // console.log(row)
  row.judgeFlag = false
  row.ban = true
  fileEditRef.value.open(row)
}

const fileEditRef = ref()
</script>

<script>
import { getVerifyCor, passVerifyCor, rejectVerifyCor } from '@/api/admin.js'
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
    }
  },
  methods: {
    async getList(data) {
      const res = await getVerifyCor({ ...data, status: 1 })
      this.total = res.data.data.total
      this.adminList = res.data.data.data
    },
    //页大小改变的时候
    handleSizeChange(pageSize) {
      this.pageSize = pageSize
      this.formModel.page_size = pageSize
      this.getList(this.formModel)
    },
    //页数改变时候
    pageChange(page) {
      this.currentPage = page
      this.formModel.page_num = page
      this.getList(this.formModel)
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
      this.msgDetail.publish_time += '-01-01'
      this.msgDetail.original_time += '-01-01'
      // console.log(res.data.data.files[0].filename)
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

        // // 在新页面中显示加载状态
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
      console.log(formattedPath.split('/').pop())
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
.buttons2 {
  display: flex;
  justify-content: center; /* 水平居中 */
}
/deep/.el-textarea__inner {
  min-height: 200px !important;
}
</style>
