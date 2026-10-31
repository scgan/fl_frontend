<script setup>
import { ref, computed, watch } from 'vue'
// import { Plus, Minus } from '@element-plus/icons-vue'
import {
  corpusDetailService,
  corpusUpdateService,
  getCorpusFileService,
  getUserLeader,
} from '@/api/collector'
import { getCorpusDetailService } from '@/api/public'
import { ElMessage } from 'element-plus'
// import { convertDateFormat } from '@/utils/utils'

const formRef = ref(null)
const formModel = ref({
  ISSN: '',
  title_cn: '',
  language: '',
  responsibility: '',
  documentType: '',
  publishDate: '',
  volumeOrIsbn: '',
  source: '',
  corpusType: '',
  keyword_cn: [],
  summary: '',
  file: [],
  database_id: [],
  // 其他字段...
})

defineProps({
  title: {
    type: [Number, String],
  },
})

// const title = ref('修改文献')
const ban = ref(false)
const visibleDrawer = ref(false)

const emit = defineEmits(['success'])

// // 重置表单
// onMounted(() => {
//   console.log(formRef.value)
//   formRef.value.resetFields()
//   formRef.value.resetFields()
// })
const open = async (row) => {
  // console.log(row)
  visibleDrawer.value = true
  if (row.ban === true) ban.value = true
  else ban.value = false
  // 判断是公共端打开还是语料收集者
  let res
  if (row.judgeFlag) res = await getCorpusDetailService({ corpus_id: row.corpus_id })
  else res = await corpusDetailService({ corpus_id: row.corpus_id })
  console.log(res)
  if (res.data.code === 200) {
    formModel.value = res.data.data
    // formModel.value.database_id = formModel.value.database
    formModel.value.database_id = []
    for (let i = 0; i < formModel.value.database.length; i++) {
      formModel.value.database_id.push(formModel.value.database[i].database_id)
    }
    // keyword为空则赋值为空数组
    if (formModel.value.keyword_cn === null) formModel.value.keyword_cn = []
    formModel.value.file = []
    // if (formModel.value.publish_time)
    //   formModel.value.publish_time = convertDateFormat(formModel.value.publish_time)
    // 如果有原文时间，则将原文时间转换为日期格式
    // if (formModel.value.original_time)
    //   formModel.value.original_time = convertDateFormat(formModel.value.original_time)
    // 处理原有文件
    if (formModel.value.attachment)
      for (let i = 0; i < formModel.value.attachment.length; i++) {
        //formModel.value.user_ids.push(formModel.value.temporary_workers[i].worker_id)
        formModel.value.file.push({
          corpus_id: formModel.value.id,
          path: formModel.value.attachment[i],
          name: formModel.value.attachment[i].split('/').pop(),
        })
      }
    // formModel.value.publish_time += '-01-01'
    // console.log(formModel.value)
  }
}

defineExpose({ open })

const onSubmit = async () => {
  await formRef.value.validate()
  // let formModel2 = {}
  console.log(formModel.value)
  formModel.value.attachment = []
  for (let i = 0; i < formModel.value.file.length; i++) {
    if (!Object.prototype.hasOwnProperty.call(formModel.value.file[i], 'raw'))
      formModel.value.attachment.push(formModel.value.file[i].path)
  }
  formModel.value.corpus_id = formModel.value.id
  visibleDrawer.value = false
  const res = await corpusUpdateService(formModel.value)
  console.log(res)
  if (res.data.code === 200) {
    ElMessage.success('修改成功')
  }
  emit('success')
}

// const addKeyword = () => {
//   formModel.value.keyword_cn.push('')
// }

// const removeKeyword = () => {
//   formModel.value.keyword_cn.pop()
// }
// const file_url = ref('')

const file_url = ref('')
const handlePreview = async (file) => {
  let filename = formModel.value.files[0].filename
  console.log(filename)
  var objectURL
  // 新上传的文献的文件与修改时原有的文件的查看方法
  if (!Object.prototype.hasOwnProperty.call(file, 'corpus_id')) {
    console.log('running')
    objectURL = URL.createObjectURL(file.raw)
    file.url = objectURL
    fetch(file.url)
      .then((response) => response.blob()) // 获取 Blob 对象
      .then((blob) => {
        // 创建一个 URL 对象，用于表示 Blob 对象
        const url = URL.createObjectURL(blob)
        // const a = document.createElement('a')
        // a.href = url
        // a.download = filename
        // console.log(a)
        // // console.log(formModel.value.files[0].filename)
        // // console.log(formModel.value)
        // document.body.appendChild(a)
        // a.click()
        // 打开新窗口并显示 PDF 文件
        window.open(url)
      })
      .catch((error) => {
        console.error('Error fetchingfile:', error)
      })
    return
  }
  const res = await getCorpusFileService({ corpus_id: file.corpus_id, attachment_path: file.path })
  if (res.data) {
    if (file_url.value) {
      URL.revokeObjectURL(file_url.value) // 撤销旧的 Blob URL
    }
    file_url.value = URL.createObjectURL(res.data)
    console.log(file_url.value)
    // if (file.type === 'application/pdf') {
      // 使用 PDF.js 渲染 PDF
      // this.renderPDF(file_url.value)
       const a = document.createElement('a')
        a.href = file_url.value
        a.download = filename
        console.log(a)
        // console.log(formModel.value.files[0].filename)
        // console.log(formModel.value)
        document.body.appendChild(a)
        a.click()
    // } else {
    //   // 展示图片
    //   window.open(file_url.value)
    // }
  } else {
    console.error('Blob object is null or undefined')
  }
}

const chinese = ref(0)
const english = ref(1)

// 校验
const validateContributor = (rule, value, callback) => {
  const { category_id, translator, author, editor } = formModel.value
  const requiredTypes = [1, 3, 'thesis']
  // console.log(category_id)
  if (requiredTypes.includes(category_id)) {
    if (!translator && !author && !editor) {
      callback(new Error('译者、作者、编者中至少填写一个'))
    } else {
      callback()
    }
  } else {
    callback()
  }
}

const validateISSN = (rule, value, callback) => {
  const { category_id, ISSN } = formModel.value
  const requiredTypes = [3, '3']
  console.log(category_id)
  if (requiredTypes.includes(category_id)) {
    if (!ISSN) {
      callback(new Error('学术论文请填写期刊号'))
    } else {
      callback()
    }
  } else {
    callback()
  }
}

// 表单校验规则
const rules = ref({
  category_id: [{ required: true, message: '文献类型不能为空', trigger: 'change' }],
  database_id: [{ required: true, message: '所属数据库不能为空', trigger: 'change' }],
  translator: [{ validator: validateContributor, trigger: 'blur' }],
  author: [{ validator: validateContributor, trigger: 'blur' }],
  editor: [{ validator: validateContributor, trigger: 'blur' }],
  ISSN: [{ validator: validateISSN, trigger: 'blur' }],
})

// 使用 computed 处理绑定值
const pickerValue = computed({
  get() {
    return formModel.value.publish_time ? `${formModel.value.publish_time}-01-01` : null
  },
  set(value) {
    formModel.value.publish_time = value ? value.split('-')[0] : null
  },
})

const pickerValue2 = computed({
  get() {
    return formModel.value.original_time ? `${formModel.value.original_time}-01-01` : null
  },
  set(value) {
    formModel.value.original_time = value ? value.split('-')[0] : null
  },
})

const resetForm = () => {
  // console.log('running')
  formRef.value.resetFields()
}

watch(visibleDrawer, (newVal) => {
  if (!newVal) {
    // 当抽屉关闭时
    resetForm()
  }
})

// 获取二级管理员列表
const leaderList = ref([])
const getLeaderList = async () => {
  const res = await getUserLeader()
  console.log(res)
  leaderList.value = res.data.data
}
getLeaderList()
</script>

<template>
  <el-drawer
    v-model="visibleDrawer"
    :title="title"
    direction="rtl"
    size="60%"
    @before-close="resetForm()"
  >
    <el-form :model="formModel" ref="formRef" label-width="100px" :rules="rules">
      <el-form-item label="驳回原因" v-if="formModel.comment && formModel.status === 3">
        {{ formModel.comment }}
      </el-form-item>
      <el-form-item label="原文标题">
        <el-input
          v-model="formModel.title_cn"
          placeholder="请输入原文标题"
          :disabled="ban"
        ></el-input>
      </el-form-item>
      <el-form-item label="译文标题">
        <el-input
          v-model="formModel.title_en"
          placeholder="请输入译文标题"
          :disabled="ban"
        ></el-input>
      </el-form-item>
      <el-row>
        <el-form-item label="语言">
          <!-- <el-select
          v-model="formModel.language"
          placeholder="请选择语言"
          allow-create
          clearable
          :disabled="ban"
        >
          <el-option label="中文" value="zh"></el-option>
          <el-option label="英文" value="en"></el-option>
        </el-select> -->
          <el-select
            v-model="formModel.language"
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
            v-model="formModel.language"
            placeholder="请输入语言"
            :disabled="ban"
            style="width: 200px"
          ></el-input> -->
        </el-form-item>
        <el-form-item label="译者" prop="translator">
          <el-input
            v-model="formModel.translator"
            placeholder="请输入译者"
            :disabled="ban"
            style="width: 200px"
          ></el-input>
        </el-form-item>
        <el-form-item label="作者" prop="author">
          <el-input
            v-model="formModel.author"
            placeholder="请输入作者"
            :disabled="ban"
            style="width: 200px"
          ></el-input>
        </el-form-item>
        <el-form-item label="编者" prop="editor">
          <el-input
            v-model="formModel.editor"
            placeholder="请输入编者"
            :disabled="ban"
            style="width: 200px"
          ></el-input>
        </el-form-item>
        <el-form-item label="ISBN" prop="ISSN">
          <el-input
            v-model="formModel.ISSN"
            placeholder="请输入文献编号"
            :disabled="ban"
            style="width: 200px"
          ></el-input>
        </el-form-item>
        <el-form-item label="文献类型" prop="category_id">
          <category-select2 v-model="formModel.category_id" :disabled="ban"></category-select2>
          <!-- <el-select v-model="formModel.documentType" placeholder="请选择">
          <el-option label="图书" value="book"></el-option>
          <el-option label="期刊论文" value="journal"></el-option>
          <el-option label="学位论文" value="thesis"></el-option>
        </el-select> -->
        </el-form-item>
        <el-form-item label="出版时间">
          <el-date-picker
            v-model="pickerValue"
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
            v-model="formModel.volume"
            placeholder="请输入卷号"
            style="width: 200px"
            :disabled="ban"
          ></el-input>
        </el-form-item>
        <el-form-item label="期号" prop="issue">
          <el-input
            v-model="formModel.issue"
            placeholder="请输入编者"
            style="width: 200px"
            :disabled="ban"
          ></el-input>
        </el-form-item>
        <el-form-item label="审核人" prop="reviewer_id">
          <el-select
            v-model="formModel.reviewer_id"
            placeholder="请选择审核人"
            filterable
            style="width: 200px"
            :disabled="ban"
          >
            <el-option
              v-for="item in leaderList"
              :key="item.id"
              :label="item.username"
              :value="item.id"
            >
            </el-option>
          </el-select>
        </el-form-item>
        <!-- <el-form-item label="卷期号/ISBN">
        <el-input v-model="formModel.volumeOrIsbn"></el-input>
      </el-form-item> -->
      </el-row>
      <el-form-item label="来源">
        <el-input
          v-model="formModel.source"
          placeholder="请输入出版社、期刊名称或url"
          :disabled="ban"
        ></el-input>
      </el-form-item>
      <el-form-item label="所属数据库" prop="database_id">
        <database-select v-model="formModel.database_id" :disabled="ban"></database-select>
        <!-- <el-input v-model="formModel.database_id"></el-input> -->
      </el-form-item>
      <el-form-item label="中文关键词">
        <keyword-select
          v-model="formModel.keyword_cn"
          style="padding-right: 10px"
          :language="chinese"
          :disabled="ban"
        ></keyword-select>
      </el-form-item>
      <el-form-item label="英文关键词">
        <keyword-select
          v-model="formModel.keyword_en"
          style="padding-right: 10px"
          :language="english"
          :disabled="ban"
        ></keyword-select>
      </el-form-item>
      <el-form-item label="中文摘要">
        <el-input
          type="textarea"
          v-model="formModel.abstract_cn"
          placeholder="请输入中文摘要"
          :disabled="ban"
        ></el-input>
      </el-form-item>
      <el-form-item label="外文摘要">
        <el-input
          type="textarea"
          v-model="formModel.abstract_en"
          placeholder="请输入外文摘要"
          :disabled="ban"
        ></el-input>
      </el-form-item>
      <!-- 如果是翻译文献（译者不为空？）录入原文信息 -->
      <div v-if="formModel.translator">
        <el-form-item label="原文文档名">
          <el-input v-model="formModel.original_name" :disabled="ban"></el-input>
        </el-form-item>
        <!-- <el-form-item label="原文标题">
          <el-input v-model="formModel.original_title" :disabled="ban"></el-input>
        </el-form-item> -->
        <el-row>
          <el-form-item label="原文语言">
            <!-- <el-select
              v-model="formModel.original_language"
              placeholder="请选择语言"
              allow-create
              clearable
              :disabled="ban"
            >
              <el-option label="中文" value="zh"></el-option>
              <el-option label="英文" value="en"></el-option>
              <el-option label="日文" value="ja"></el-option>
            </el-select> -->
            <el-input v-model="formModel.original_language" :disabled="ban"></el-input>
          </el-form-item>
          <el-form-item label="原文出版时间">
            <el-date-picker
              v-model="pickerValue2"
              type="year"
              placeholder="请选择年份"
              format="YYYY"
              value-format="YYYY"
              style="width: 200px"
              :disabled="ban"
            ></el-date-picker>
          </el-form-item>
          <el-form-item label="原文来源">
            <el-input v-model="formModel.original_source" :disabled="ban"></el-input>
          </el-form-item>
        </el-row>
        <!-- <el-form-item label="原文出版社">
          <el-input v-model="formModel.publisher"></el-input>
        </el-form-item>
        <el-form-item label="原文期刊名称">
          <el-input v-model="formModel.journalName"></el-input>
        </el-form-item>
        <el-form-item label="原文URL">
          <el-input v-model="formModel.url"></el-input>
        </el-form-item>
        <el-form-item label="原文字数">
          <el-input-number
            v-model="formModel.word_number"
            :min="0"
            label="描述文字"
          ></el-input-number>
        </el-form-item> -->
      </div>
      <el-form-item>
        <el-upload
          v-model:file-list="formModel.file"
          :class="{ 'upload-demo': ban }"
          :auto-upload="false"
          :show-file-list="true"
          :on-preview="handlePreview"
          multiple
        >
          <el-button type="primary" v-if="!ban">上传附件</el-button>
          <!-- <template #tip>
              <div class="el-upload__tip">
                jpg/png files with a size less than 500KB.
              </div>
            </template> -->
        </el-upload>
      </el-form-item>
      <el-form-item>
        <el-button type="success" @click="onSubmit()" v-if="!ban">提交</el-button>
      </el-form-item>
    </el-form>
    <template #footer>
      <slot name="extra"></slot>
    </template>
  </el-drawer>
</template>

<style lang="scss" scoped>
.avatar-uploader {
  :deep() {
    .avatar {
      width: 178px;
      height: 178px;
      display: block;
    }
    .el-upload {
      border: 1px dashed var(--el-border-color);
      border-radius: 6px;
      cursor: pointer;
      position: relative;
      overflow: hidden;
      transition: var(--el-transition-duration-fast);
    }
    .el-upload:hover {
      border-color: var(--el-color-primary);
    }
    .el-icon.avatar-uploader-icon {
      font-size: 28px;
      color: #8c939d;
      width: 178px;
      height: 178px;
      text-align: center;
    }
  }
}
.upload-demo :deep(.el-upload-list__item .el-icon--close) {
  display: none;
}
</style>
