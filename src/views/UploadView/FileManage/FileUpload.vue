<script setup>
import { ref, onMounted, onUnmounted, onActivated, onDeactivated } from 'vue'
import { Plus, Minus, Edit, Microphone } from '@element-plus/icons-vue'
import {
  corpusUploadService,
  getCorpusAbstractService,
  translateAbstractService,
} from '@/api/collector'
import { ElMessage } from 'element-plus'
import { parsingReference } from '@/utils/utils'
import { useRoute } from 'vue-router'
import {
  getCategoryService,
  getUserDraft,
  getUserLeader,
  getCorpusFileService,
  checkTitleService,
  aiExtractService,
  translateKeywordService,
} from '@/api/collector'
import { getUserInfoService } from '@/api/user'
import { computed } from 'vue'
import { useFileStore } from '@/stores/file'

const route = useRoute()

const documentTypeOptions = ref([])

const aiLoading = ref(false)
onMounted(async () => {
  await getCategoryList()
  const reference = route.query.reference
  if (reference) {
    handleParsingReference(reference)
  }
  const fileStore = useFileStore()
  const fileInfo = computed(() => fileStore.uploadedFile)
  if (fileInfo.value) {
    aiLoading.value = true
    try {
      // ElMessage.info('提取中，请稍后')
      ElMessage.warning({
        message: '提取中，请稍后',
        duration: 10000, // 10秒（单位：毫秒）
        showClose: true,
      })
      const res = await aiExtractService({
        file: fileInfo.value,
      })
      console.log(res)
      const reviewer_id =  formModel.value.reviewer_id
      formModel.value = res.data.data
      formModel.value.reviewer_id = reviewer_id
      let tmp = formModel.value.title_cn
      formModel.value.title_cn = formModel.value.title_en
      formModel.value.title_en = tmp
      formModel.value.ISSN = formModel.value.ISBN
      formModel.value.ISBN = undefined
      formModel.value.file = fileInfo.value
      const option = documentTypeOptions.value.find(
        (item) => item.category_name === formModel.value.category,
      )
      if (option) {
        formModel.value.category_id = option.category_id
      }
      fileStore.clearUploadedFile()
      // 成功消息 - 10秒后消失，显示关闭按钮
      ElMessage.success({
        message: '提取成功',
        duration: 10000, // 10秒（单位：毫秒）
        showClose: true,
      })

      // 警告消息 - 10秒后消失，显示关闭按钮
      ElMessage.warning({
        message: '大模型提取的信息存在一定误差，请老师们务必审核校对',
        duration: 10000, // 10秒（单位：毫秒）
        showClose: true,
      })
      handleBlur()
    } finally {
      aiLoading.value = false
    }
  }
})

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
  keyword_cn: null,
  summary: '',
  file: [],
  database_id: [],
  // 其他字段...
})

const ban = ref(false)

const open = (row) => {}

defineExpose({ open })

const submitLoading = ref(false)
const onSubmit = async () => {
  if (formModel.value.file === undefined || formModel.value.file.length === 0) {
    ElMessage.error('附件不能为空，请选择上传的文件')
    return
  }
  submitLoading.value = true
  try {
    await formRef.value.validate()
    ElMessage.info('上传中请稍候')
    formModel.value.status = 0
    const res = await corpusUploadService(formModel.value)
    if (res.data.code === 200) {
      ElMessage.success('上传成功')
      formModel.value = {}
    }
  } finally {
    submitLoading.value = false
  }
}

const formRef = ref()
const validateContributor = (rule, value, callback) => {
  const { category_id, translator, author, editor } = formModel.value
  const requiredTypes = [1, 3, 'thesis']
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
  keyword_cn: [{ required: true, message: '关键字不能为空', trigger: 'change' }],
  keyword_en: [{ required: true, message: '关键字不能为空', trigger: 'change' }],
  // reviewer_id: [{ required: true, message: '关键字不能为空', trigger: 'change' }],
  translator: [{ validator: validateContributor, trigger: 'blur' }],
  author: [{ validator: validateContributor, trigger: 'blur' }],
  editor: [{ validator: validateContributor, trigger: 'blur' }],
  ISSN: [{ validator: validateISSN, trigger: 'blur' }],
})

// const addKeyword = () => {
//   formModel.value.keyword_cn.push('')
// }

// const removeKeyword = () => {
//   formModel.value.keyword_cn.pop()
// }
// const file_url = ref('')

const handlePreview = async (file) => {
  // 使用 Element Plus 的 ElMessageBox 弹框
  try {
    const result = await ElMessageBox.confirm('您想要预览文件还是获取文件摘要？', '请选择操作', {
      confirmButtonText: '获取摘要',
      cancelButtonText: '预览文件',
      distinguishCancelAndClose: true, // 区分取消和关闭
    })

    // 用户点击“获取摘要”
    if (result === 'confirm') {
      // 第二步：让用户输入摘要字数和关键字数量
      // const inputResult = await ElMessageBox.prompt(
      //   '请输入摘要字数和关键字数量（用逗号分隔，例如：100,5）',
      //   '获取摘要设置',
      //   {
      //     confirmButtonText: '确认',
      //     cancelButtonText: '取消',
      //     inputPlaceholder: '例如：100,5',
      //     inputValidator: (value) => {
      //       // 校验输入格式
      //       if (!value || !/^\d+,\d+$/.test(value)) {
      //         return '请输入有效的字数和数量，例如：100,5'
      //       }
      //       return true
      //     },
      //   },
      // )

      // // 解析用户输入
      // const [summaryLength, keywordCount] = inputResult.value.split(',').map(Number)

      ElMessage.info('获取中请稍候')
      const res = await getCorpusAbstractService({
        file: file.raw,
        // abstract_words_num: summaryLength,
        // keywords_num: keywordCount,
      })
      formModel.value.abstract_cn = res.data.data.abstract
      if (formModel.value.keyword_cn !== null)
        formModel.value.keyword_cn = [...formModel.value.keyword_cn, ...res.data.data.keywords]
      else formModel.value.keyword_cn = res.data.data.keywords
      ElMessage.success('获取成功')
    }
  } catch (error) {
    // 用户点击“预览文件”或关闭弹框
    if (error === 'cancel') {
      if (!Object.prototype.hasOwnProperty.call(file, 'mission_id')) {
        ElMessage.info('获取中请稍候')
        const objectURL = URL.createObjectURL(file.raw)
        file.url = objectURL
        fetch(file.url)
          .then((response) => response.blob())
          .then((blob) => {
            const url = URL.createObjectURL(blob)
            window.open(url)
            ElMessage.success('获取成功')
          })
          .catch((error) => {
            console.error('Error fetching file:', error)
          })
      }
    } else {
      console.error('Error:', error)
    }
  }
}

// 语言
const chinese = ref(0)
const english = ref(1)

const dialogVisible2 = ref(false)
const source = ref('')
const target = ref('')
// 判断那个文本是要翻译的
const textNum = ref(0)
// 翻译
const onTranslate = async (data) => {
  // let source = ''
  // let target = ''
  let text = ''
  switch (data) {
    // case 0:
    //   source = 'zh'
    //   target = 'en'
    //   text = formModel.value.title_cn
    //   break
    case 2:
      // source.value = 'zh'
      // target.value = 'en'
      text = formModel.value.abstract_cn.replace(/[\r\n]/g, '')
      break
    // case 1:
    //   source = 'en'
    //   target = 'zh'
    //   text = formModel.value.title_en
    //   break
    case 3:
      // source.value = 'en'
      // target.value = 'zh'
      text = formModel.value.abstract_en.replace(/[\r\n]/g, '')
      break
    case 4:
      // source.value = 'zh'
      // target.value = 'en'
      if (!formModel.value.keyword_cn) formModel.value.keyword_cn = []
      if (!formModel.value.keyword_en) formModel.value.keyword_en = []
      text = formModel.value.keyword_cn.join()
      break
    case 5:
      // source.value = 'en'
      // target.value = 'zh'
      if (!formModel.value.keyword_en) formModel.value.keyword_en = []
      if (!formModel.value.keyword_cn) formModel.value.keyword_cn = []
      text = formModel.value.keyword_en.join()
      break
    default:
      text = formModel.value.title_cn
      break
  }

  // 根据翻译类型决定使用哪个服务
  let res;
  if(data === 4 || data === 5) {
    res = await translateKeywordService({
      text: text,
      source_language: source.value,
      target_language: target.value,
    })
  } else {
    res = await translateAbstractService({
      text: text,
      source_language: source.value,
      target_language: target.value,
    })
  }
  console.log(res)
  switch (data) {
    // case 0:
    //   formModel.value.title_en = res.data.data.译文
    //   break
    case 2:
      formModel.value.abstract_en = res.data.data.译文
      break
    // case 1:
    //   formModel.value.title_cn = res.data.data.译文
    //   break
    case 3:
      formModel.value.abstract_cn = res.data.data.译文
      break
    case 1:
      formModel.value.title_en = res.data.data.译文
      break
    case 4:
      formModel.value.keyword_en = res.data.data.译文
      break
    case 5:
      formModel.value.keyword_cn = res.data.data.译文
      break
  }
  dialogVisible2.value = false
  source.value = ''
  target.value = ''
  // console.log(res.data)

  ElMessage.success('翻译成功')
}
// const updateNow = (value) => {
//   formModel.value.database_id = value
// }

// const citeValue = ref('')
// const onAnalyse = () => {
//   const text = citeValue.value.trim();

//   // 兼容中文标点、空格、全角括号等情况
//   const pattern = /^(.+?)\s*[．.]\s*(.+?)\s*［([A-Z])］\s*[．.]\s*(.+?)\s*[，,]\s*(\d{4})\s*[，,]\s*(\d+)\s*[（(] *(\d+) *[)）]\s*[：:]\s*([\d\-–~至到]+)\s*[．.]?$/i;

//   const match = text.match(pattern);

//   if (match) {
//     const [, authors, title, docTypeCode, source, publishYear, volume, issue, pages] = match;

//     const docTypeMap = {
//       J: '期刊文章',
//       M: '专著',
//       N: '报纸文章',
//       D: '学位论文',
//       C: '会议论文',
//       R: '报告',
//       S: '标准',
//       P: '专利'
//     };

//     formModel.value.author = authors.trim().replace(/[，、]/g, ', ');
//     formModel.value.title_cn = title.trim();
//     formModel.value.docType = docTypeMap[docTypeCode.toUpperCase()] || docTypeCode;
//     formModel.value.source = source.trim();
//     formModel.value.publish_time = publishYear;
//     formModel.value.volume = volume || '';
//     formModel.value.issue = issue || '';
//     formModel.value.pages = pages || '';

//     console.log('解析成功:', formModel.value);
//   } else {
//     console.warn('未能识别该参考文献格式');
//   }
// };

const categoryIdDict = ref({})

const handleParsingReference = (reference) => {
  try {
    var {
      documentType,
      author,
      enTitle,
      zhTitle,
      source,
      publish_time,
      issue,
      volume,
      translator,
    } = parsingReference(reference)
  } catch (error) {
    ElMessage.error('参考文献内容或格式有误，解析失败！')
    return
  }

  formModel.value['author'] = author
  formModel.value['title_cn'] = zhTitle
  formModel.value['title_en'] = enTitle
  formModel.value['category_id'] = categoryIdDict.value[documentType]
  formModel.value['source'] = source
  formModel.value['publish_time'] = publish_time + ''
  formModel.value['issue'] = issue
  formModel.value['volume'] = volume
  formModel.value['translator'] = translator
}

const getCategoryList = async () => {
  const res2 = await getCategoryService()
  documentTypeOptions.value = res2.data.data
  for (let dict of documentTypeOptions.value) {
    categoryIdDict.value[dict['code']] = dict['category_id']
  }
}

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
const transcript = ref('') // 用于存储识别结果
const recognition = new SpeechRecognition() // 创建语音识别实例

// 设置语音识别属性
recognition.lang = 'zh-CN' // 设置语言为中文
recognition.interimResults = true // 是否返回临时结果
recognition.continuous = true // 允许持续识别

// 处理识别结果
recognition.onresult = (event) => {
  let interimTranscript = ''
  for (let i = event.resultIndex; i < event.results.length; ++i) {
    if (event.results[i].isFinal) {
      transcript.value += event.results[i][0].transcript // 将最终结果添加到 transcript
    } else {
      interimTranscript += event.results[i][0].transcript // 处理临时结果
    }
  }
}

// 处理识别错误
recognition.onerror = (event) => {
  console.log(event)
  ElMessage.error('语音识别出错' + event.error)
}

// 处理识别结束
recognition.onend = () => {
  console.log('语音识别结束')
}

// 启动语音识别
function startRecognition() {
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        // 初始化语音识别
        recognition.start()
      })
      .catch((error) => {
        console.error('麦克风权限请求失败:', error)
        ElMessage.error('麦克风权限请求失败')
      })
  } else {
    alert('您的浏览器不支持获取麦克风权限')
  }
}

// 停止语音识别
function stopRecognition() {
  recognition.stop()
}

const options = [
  {
    value: 'title_cn',
    label: '原文标题',
  },
  {
    value: 'title_en',
    label: '译文标题',
  },
  {
    label: '作者',
    value: 'author',
  },
  {
    label: '编者',
    value: 'editor',
  },
  {
    label: '译者',
    value: 'translator',
  },
  {
    label: '中文摘要',
    value: 'abstract_cn',
  },
  {
    label: '外文摘要',
    value: 'abstract_en',
  },
]
const dialogVisible = ref(false)
const selectedElement = ref(null)
const selectedLanguage = ref('')

const openDialog = () => {
  selectedLanguage.value = 'zh-CN'
  transcript.value = ''
  selectedElement.value = null
  dialogVisible.value = true
  recognition.lang = selectedLanguage.value
}
const addRecognitionResult = () => {
  if (selectedElement.value == null) {
    ElMessage.error('请选择要输入的字段')
    return
  }
  // switch(selectedElement.value) {
  //   case '中文标题':
  //     formModel.value.title_cn = transcript.value
  //     break
  //   case '英文标题':
  //     formModel.value.title_en = transcript.value
  //     break
  //   case 'Option3':
  // }
  stopRecognition()
  formModel.value[selectedElement.value] = transcript.value
  dialogVisible.value = false
}

const updateLanguage = () => {
  transcript.value = ''
  recognition.lang = selectedLanguage.value
}

const languages = [
  { name: '自动检测', code: 'auto' },
  { name: '粤语', code: 'yue' },
  { name: '韩语', code: 'kor' },
  { name: '泰语', code: 'th' },
  { name: '葡萄牙语', code: 'pt' },
  { name: '希腊语', code: 'el' },
  { name: '保加利亚语', code: 'bul' },
  { name: '芬兰语', code: 'fin' },
  { name: '斯洛文尼亚语', code: 'slo' },
  { name: '繁体中文', code: 'cht' },
  { name: '中文', code: 'zh' },
  { name: '文言文', code: 'wyw' },
  { name: '法语', code: 'fra' },
  { name: '阿拉伯语', code: 'ara' },
  { name: '德语', code: 'de' },
  { name: '荷兰语', code: 'nl' },
  { name: '爱沙尼亚语', code: 'est' },
  { name: '捷克语', code: 'cs' },
  { name: '瑞典语', code: 'swe' },
  { name: '越南语', code: 'vie' },
  { name: '英语', code: 'en' },
  { name: '日语', code: 'jp' },
  { name: '西班牙语', code: 'spa' },
  { name: '俄语', code: 'ru' },
  { name: '意大利语', code: 'it' },
  { name: '波兰语', code: 'pl' },
  { name: '丹麦语', code: 'dan' },
  { name: '罗马尼亚语', code: 'rom' },
  { name: '匈牙利语', code: 'hu' },
]

// 给上传的文件重命名
// const handleChange = (uploadFile, uploadFiles) => {
//   console.log(uploadFiles)
//   if (
//     formModel.value.title_cn !== '' &&
//     formModel.value.title_cn !== null &&
//     formModel.value.title_cn !== undefined
//   ) {
//     const lastName = uploadFile.name.substring(uploadFile.name.lastIndexOf('.'))
//     uploadFile.name = formModel.value.title_cn + uploadFiles.length + lastName
//   }
// }

// 获取二级管理员列表
const leaderList = ref([])
const getLeaderList = async () => {
  const res = await getUserLeader()
  // console.log(res)
  leaderList.value = res.data.data
  formModel.value.reviewer_id = leaderList.value.filter((item) => item.is_default === true)[0]?.id
}
getLeaderList()

// 获取保存的草稿
const getDraft = async () => {
  ElMessage.info('获取草稿中请稍候')
  const res = await getUserDraft()
  if (res.data.code === 200 && res.data.data !== null) {
    formModel.value = res.data.data
    formModel.value.database_id = formModel.value.database_ids
    // for (let i = 0; i < formModel.value.database.length; i++) {
    //   formModel.value.database_id.push(formModel.value.database[i].database_id)
    // }
    // keyword为空则赋值为空数组
    if (formModel.value.keyword_cn === null) formModel.value.keyword_cn = []
    if (!formModel.value.translator) formModel.value.translator = null
    if (formModel.value.publish_time !== null) formModel.value.publish_time += '-01-01'
    if (formModel.value.original_time !== null) formModel.value.original_time += '-01-01'
    formModel.value.file = []
    // 处理原有文件
    if (formModel.value.attachment)
      for (let i = 0; i < formModel.value.attachment.length; i++) {
        const res = await getCorpusFileService({
          corpus_id: formModel.value.id,
          attachment_path: formModel.value.attachment[i],
        })
        const file = new File([res.data], formModel.value.attachment[i].split('/').pop(), {
          type: res.data.type,
        })
        formModel.value.file.push({
          corpus_id: formModel.value.id,
          path: formModel.value.attachment[i],
          name: formModel.value.attachment[i].split('/').pop(),
          raw: file,
        })
      }
    ElMessage.success('获取草稿成功')
  } else if (res.data.code === 200) {
    ElMessage.success('获取草稿成功')
  }
}
// getDraft()

const saveLoading = ref(false)
/**
 * 保存草稿。
 * 手动点「保存」时会给出提示；后台定时保存走 silent，避免每 30 秒弹一次提示。
 */
const onSave = async ({ silent = false } = {}) => {
  saveLoading.value = true
  // await formRef.value.validate()
  // ElMessage.info('保存草稿不能保存您上传的文件')
  try {
    if (!silent) ElMessage.info('保存草稿中')
    formModel.value.status = -1
    const res = await corpusUploadService(formModel.value)
    if (res.data.code === 200 && !silent) {
      ElMessage.success('保存成功')
      // formModel.value = {}
    }
  } finally {
    saveLoading.value = false
  }
}

// 定时保存：没有填写标题时不保存，避免生成空草稿；提示保持静默
const AUTO_SAVE_INTERVAL = 30000
const hasDraftContent = () =>
  Boolean(formModel.value?.title_cn?.trim?.() || formModel.value?.title_en?.trim?.())

let timer = null
const startAutoSave = () => {
  if (timer) return
  timer = setInterval(() => {
    if (hasDraftContent()) onSave({ silent: true })
  }, AUTO_SAVE_INTERVAL)
}
const stopAutoSave = () => {
  if (!timer) return
  clearInterval(timer)
  timer = null
}

onMounted(startAutoSave)
// 页面被 keep-alive 缓存时也要暂停计时器，回到本页再恢复
onActivated(startAutoSave)
onDeactivated(stopAutoSave)
onUnmounted(stopAutoSave)

const handleBlur = async () => {
  try {
    const res = await checkTitleService({ title_cn: formModel.value.title_cn })
    console.log(res)
  } catch (error) {
    // 原文标题重复：清空全部表单，避免只改标题后带着提取信息继续提交
    formModel.value = {}
  }
}

const leader_name = ref()
const getUserInfo = async () => {
  const res = await getUserInfoService()
  // console.log(res)
  if (res.data.code === 200) {
    // formModel.value = res.data.data
    leader_name.value = res.data.data.leader_name
  }
}
getUserInfo()
</script>

<template>
  <PageContainer title="文献上传">
    <template #extra>
      <el-button type="primary" @click="getDraft">导入草稿</el-button>
      <el-button type="primary" @click="openDialog()">语音输入</el-button>
    </template>
    <div class="form-container">
      <!--  -->
      <el-form
        :model="formModel"
        ref="formRef"
        label-width="100px"
        style="width: 70%"
        :rules="rules"
        v-loading="aiLoading"
      >
        <!-- <el-form-item label="一键填写">
          <el-input
            v-model="citeValue"
            placeholder="请输入参考文献的引用格式"
            @blur="onAnalyse()"
            type="textarea"
          ></el-input>
        </el-form-item> -->
        <el-form-item label="原文标题">
          <el-input
            v-model="formModel.title_cn"
            placeholder="请输入原文标题"
            @blur="handleBlur"
          ></el-input
          ><el-link type="primary" @click="((dialogVisible2 = true), (textNum = 1))"
            >翻译标题</el-link
          >
        </el-form-item>
        <el-form-item label="译文标题">
          <el-input v-model="formModel.title_en" placeholder="请输入译文标题"></el-input>
          <!-- <el-link type="primary" @click="onOpen(1)">翻译标题</el-link> -->
        </el-form-item>
        <el-row>
          <el-form-item label="文献类型" prop="category_id">
            <category-select
              v-model="formModel.category_id"
              :options="documentTypeOptions"
            ></category-select>
            <!-- <el-select v-model="formModel.documentType" placeholder="请选择">
            <el-option label="图书" value="book"></el-option>
            <el-option label="期刊论文" value="journal"></el-option>
            <el-option label="学位论文" value="thesis"></el-option>
          </el-select> -->
          </el-form-item>
          <el-form-item label="语言">
            <el-select
              v-model="formModel.language"
              placeholder="请选择语言"
              allow-create
              filterable
              clearable
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
              style="width: 200px"
            ></el-input> -->
          </el-form-item>
          <el-form-item label="ISBN" prop="ISSN">
            <el-input
              v-model="formModel.ISSN"
              placeholder="请输入文献编号"
              style="width: 200px"
            ></el-input>
          </el-form-item>
          <el-form-item label="作者" prop="author">
            <el-input
              v-model="formModel.author"
              placeholder="请输入作者"
              style="width: 200px"
            ></el-input>
          </el-form-item>
          <el-form-item label="译者" prop="translator">
            <el-input
              v-model="formModel.translator"
              placeholder="请输入译者"
              style="width: 200px"
            ></el-input>
          </el-form-item>
          <el-form-item label="编者" prop="editor">
            <el-input
              v-model="formModel.editor"
              placeholder="请输入编者"
              style="width: 200px"
            ></el-input>
          </el-form-item>
          <!-- <el-form-item label="卷期号/ISBN">
          <el-input v-model="formModel.volumeOrIsbn"></el-input>
        </el-form-item> -->

          <el-form-item label="出版时间">
            <el-date-picker
              v-model="formModel.publish_time"
              type="year"
              placeholder="请选择年份"
              format="YYYY"
              value-format="YYYY"
              style="width: 200px"
            ></el-date-picker>
            <!-- <el-date-picker
              v-model="formModel.publish_time"
              type="datetime"
              placeholder="请选择出版时间"
              format="YYYY/MM/DD HH:mm:ss"
              value-format="YYYY-MM-DD HH:mm:ss"
              style="width: 200px"
            ></el-date-picker> -->
          </el-form-item>
          <el-form-item label="卷号" prop="volume">
            <el-input
              v-model="formModel.volume"
              placeholder="请输入卷号"
              style="width: 200px"
            ></el-input>
          </el-form-item>
          <el-form-item label="期号" prop="issue">
            <el-input
              v-model="formModel.issue"
              placeholder="请输入期号"
              style="width: 200px"
            ></el-input>
          </el-form-item>
          <el-form-item label="审核人" prop="reviewer_id">
            <!-- {{ leader_name }} -->
            <el-select v-model="formModel.reviewer_id" placeholder="请选择审核人" filterable>
              <el-option
                v-for="item in leaderList"
                :key="item.id"
                :label="item.username"
                :value="item.id"
              >
              </el-option>
            </el-select>
          </el-form-item>
        </el-row>
        <el-form-item label="来源">
          <el-input v-model="formModel.source" placeholder="请输入出版社、期刊名称或url"></el-input>
        </el-form-item>
        <el-form-item label="所属数据库" prop="database_id">
          <database-select v-model="formModel.database_id"></database-select>
          <!-- <el-input v-model="formModel.database_id"></el-input> -->
        </el-form-item>
        <el-form-item label="中文关键词" prop="keyword_cn">
          <!-- <el-input v-model="formModel.keywords"></el-input> -->
          <!-- <el-input
            v-for="(keyword, index) in formModel.keyword_cn"
            :key="index"
            v-model="formModel.keyword_cn[index]"
            placeholder="请输入主题词"
            style="width: 150px; padding-right: 10px"
          >
          </el-input> -->
          <keyword-select
            v-model="formModel.keyword_cn"
            style="padding-right: 10px"
            :language="chinese"
          ></keyword-select>
          <el-link
            type="primary"
            @click="((dialogVisible2 = true), (textNum = 4), (source = 'zh'), (target = 'en'))"
            >翻译为外文关键词</el-link
          >
          <!-- <div>
            <el-button type="primary" @click="addKeyword" :icon="Plus" circle></el-button>
            <el-button type="primary" @click="removeKeyword" :icon="Minus" circle></el-button>
          </div> -->
        </el-form-item>
        <el-form-item label="英文关键词" prop="keyword_en">
          <keyword-select
            v-model="formModel.keyword_en"
            style="padding-right: 10px"
            :language="english"
          ></keyword-select>
          <el-link
            type="primary"
            @click="((dialogVisible2 = true), (textNum = 5), (source = 'en'), (target = 'zh'))"
            >翻译为中文关键词</el-link
          >
        </el-form-item>
        <el-form-item label="中文摘要">
          <el-input
            type="textarea"
            v-model="formModel.abstract_cn"
            placeholder="请输入中文摘要"
            :rows="6"
          ></el-input>
          <el-link type="primary" @click="((dialogVisible2 = true), (textNum = 2), (source = 'zh'))"
            >翻译为外文摘要</el-link
          >
        </el-form-item>
        <el-form-item label="外文摘要">
          <el-input
            type="textarea"
            v-model="formModel.abstract_en"
            placeholder="请输入外文摘要"
            :rows="6"
          ></el-input>
          <el-link type="primary" @click="((dialogVisible2 = true), (textNum = 3), (target = 'zh'))"
            >翻译为中文摘要</el-link
          >
        </el-form-item>
        <!-- 如果是翻译文献（译者不为空？）录入原文信息 -->
        <div v-if="formModel.translator">
          <el-form-item label="原文文档名">
            <el-input v-model="formModel.original_name" placeholder="请输入原文文档名"></el-input>
          </el-form-item>
          <!-- <el-form-item label="原文标题">
            <el-input v-model="formModel.original_title"></el-input>
          </el-form-item> -->
          <el-row>
            <el-form-item label="原文语言">
              <!-- <el-input
                v-model="formModel.original_language"
                :disabled="ban"
                style="width: 200px"
              ></el-input> -->
              <el-select
                v-model="formModel.original_language"
                placeholder="请选择语言"
                allow-create
                filterable
                clearable
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
            </el-form-item>
            <el-form-item label="原文出版时间">
              <el-date-picker
                v-model="formModel.original_time"
                type="year"
                placeholder="请选择年份"
                format="YYYY"
                value-format="YYYY"
                style="width: 200px"
              ></el-date-picker>
            </el-form-item>
          </el-row>
          <el-form-item label="原文来源">
            <el-input
              v-model="formModel.original_source"
              :disabled="ban"
              placeholder="请输入原文来源"
            ></el-input>
          </el-form-item>
        </div>
        <el-form-item>
          <el-upload
            v-model:file-list="formModel.file"
            class="upload-demo"
            :auto-upload="false"
            :show-file-list="true"
            :on-preview="handlePreview"
            multiple
          >
            <!-- :on-change="handleChange" -->
            <el-button type="primary" :disabled="ban">上传附件</el-button>
            <!-- <template #tip>
              <div class="el-upload__tip">
                jpg/png files with a size less than 500KB.
              </div>
            </template> -->
          </el-upload>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" plain @click="onSave()" :loading="saveLoading">保存</el-button>
          <el-button type="primary" @click="onSubmit()" :disabled="ban" :loading="submitLoading"
            >提交</el-button
          >
        </el-form-item>
      </el-form>
    </div>
    <el-dialog v-model="dialogVisible" title="语音输入" width="500">
      <el-form>
        <el-form-item label="填写字段">
          <el-select v-model="selectedElement" placeholder="请选择您想要填写的字段">
            <el-option
              v-for="item in options"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            ></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="语言选择">
          <el-select
            v-model="selectedLanguage"
            placeholder="请选择您希望识别的语言"
            filterable
            @change="updateLanguage"
          >
            <!-- 主流语言 -->
            <el-option label="中文" value="zh-CN"></el-option>
            <el-option label="英文" value="en-US"></el-option>

            <!-- 高考热门小语种 -->
            <el-option label="日语" value="ja-JP"></el-option>
            <el-option label="德语" value="de-DE"></el-option>
            <el-option label="法语" value="fr-FR"></el-option>
            <el-option label="西班牙语" value="es-ES"></el-option>
            <el-option label="俄语" value="ru-RU"></el-option>

            <!-- 新兴热门小语种 -->
            <el-option label="韩语" value="ko-KR"></el-option>
            <el-option label="意大利语" value="it-IT"></el-option>
            <el-option label="阿拉伯语" value="ar-SA"></el-option>
            <el-option label="葡萄牙语" value="pt-PT"></el-option>
            <el-option label="泰语" value="th-TH"></el-option>

            <!-- 潜力小语种 -->
            <el-option label="越南语" value="vi-VN"></el-option>
            <el-option label="荷兰语" value="nl-NL"></el-option>
            <el-option label="瑞典语" value="sv-SE"></el-option>
            <el-option label="波斯语" value="fa-IR"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="识别结果">
          <el-input
            type="textarea"
            v-model="transcript"
            placeholder="识别结果将显示在这里"
            :rows="4"
          ></el-input>
        </el-form-item>
      </el-form>

      <div style="text-align: center; margin-top: 10px">
        <el-button type="primary" @click="startRecognition">开始录音</el-button>
        <el-button type="primary" @click="stopRecognition">停止录音</el-button>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="addRecognitionResult()"> 确定 </el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="dialogVisible2" title="语言选择" width="500">
      <el-form label-width="100">
        <el-form-item label="源语言">
          <el-select v-model="source" placeholder="请选择语言" filterable>
            <el-option
              v-for="item in languages"
              :key="item.code"
              :label="item.name"
              :value="item.code"
            >
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="目标语言">
          <el-select v-model="target" placeholder="请选择语言" filterable>
            <el-option
              v-for="item in languages"
              :key="item.code"
              :label="item.name"
              :value="item.code"
            >
            </el-option>
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="onTranslate(textNum)"> 确认 </el-button>
        </div>
      </template>
    </el-dialog>
  </PageContainer>
</template>

<style scoped>
.form-container {
  display: flex;
  justify-content: center; /* 水平居中 */
}
.el-dialog .el-dialog__body {
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
