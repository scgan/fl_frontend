<template>
  <div class="file-translate-container">
    <!-- 顶部：翻译按钮在右上角（页面标题已移到顶栏） -->
    <div class="translate-header">
      <el-button
        class="translate-submit"
        type="primary"
        @click="submitTranslate"
        :disabled="!uploadedFile || isTranslating"
        :loading="submitting"
      >
        {{ isTranslating ? '翻译中…' : '翻译' }}
      </el-button>
    </div>

    <!-- 语言选择 -->
    <div class="translate-toolbar">
      <el-select v-model="form.source_language" placeholder="请选择源语言" class="translate-select">
        <el-option label="自动检测" value="auto"></el-option>
        <el-option label="中文" value="zh"></el-option>
        <el-option label="英文" value="en"></el-option>
        <el-option label="日语" value="jp"></el-option>
        <el-option label="韩语" value="kor"></el-option>
        <el-option label="法语" value="fra"></el-option>
        <el-option label="德语" value="de"></el-option>
        <el-option label="俄语" value="ru"></el-option>
        <el-option label="西班牙语" value="spa"></el-option>
        <el-option label="意大利语" value="it"></el-option>
        <el-option label="泰语" value="th"></el-option>
        <el-option label="土耳其语" value="tr"></el-option>
        <el-option label="越南语" value="vie"></el-option>
      </el-select>
      <span class="translate-arrow">→</span>
      <el-select v-model="form.target_language" placeholder="请选择目标语言" class="translate-select">
        <el-option label="中文" value="zh"></el-option>
        <el-option label="英文" value="en"></el-option>
        <el-option label="日语" value="jp"></el-option>
        <el-option label="韩语" value="kor"></el-option>
        <el-option label="法语" value="fra"></el-option>
        <el-option label="德语" value="de"></el-option>
        <el-option label="俄语" value="ru"></el-option>
        <el-option label="西班牙语" value="spa"></el-option>
        <el-option label="意大利语" value="it"></el-option>
        <el-option label="泰语" value="th"></el-option>
        <el-option label="土耳其语" value="tr"></el-option>
        <el-option label="越南语" value="vie"></el-option>
      </el-select>
    </div>

    <el-row :gutter="20">
      <el-col :span="12">
        <!-- 左侧区域 -->
        <div class="upload-area">
          <div v-if="!uploadedFile" class="upload-prompt">
            <el-upload
              action=""
              :auto-upload="false"
              :on-change="handleFileChange"
              accept=".doc,.docx,.pdf,.pptx,.xlsx,.txt"
              :limit="1"
              :file-list="fileList"
              drag
            >
              <el-icon class="upload-icon"><UploadFilled /></el-icon>
              <div class="el-upload__text">拖拽文件到这里，或点击添加文件</div>
              <template #tip>
                <div class="el-upload__tip">
                  文件限制：Word / PDF / PPT / EXCEL / TXT, 大小≤50MB
                </div>
              </template>
            </el-upload>
          </div>

          <div v-else class="file-preview">
            <div class="preview-header">
              <span>{{ uploadedFile.name }}</span>
              <el-button @click="removeFile" type="danger" size="small" plain>移除</el-button>
            </div>

            <div class="preview-content">
              <div v-if="filePreviewUrl && uploadedFile.type.includes('pdf')" class="pdf-preview">
                <iframe
                  :src="filePreviewUrl"
                  width="100%"
                  height="100%"
                  style="border: none"
                  type="application/pdf"
                ></iframe>
              </div>

              <div v-else-if="uploadedFile.type.includes('word')" class="document-preview">
                <div class="file-info">
                  <p><strong>文件名:</strong> {{ uploadedFile.name }}</p>
                  <p><strong>大小:</strong> {{ formatFileSize(uploadedFile.size) }}</p>
                  <p><strong>类型:</strong> Microsoft Word 文档</p>
                  <div class="file-preview-placeholder">
                    <p>Word 文档预览</p>
                    <p>上传的 Word 文档将在翻译完成后显示在右侧</p>
                  </div>
                </div>
              </div>

              <div v-else class="unknown-file-type">
                <p>不支持的文件类型预览</p>
                <p>文件类型: {{ uploadedFile.type }}</p>
              </div>
            </div>
          </div>
        </div>
      </el-col>
      <el-col :span="12">
        <!-- 右侧区域 -->
        <div class="translated-content">
          <h3>翻译结果</h3>
          
          <!-- 翻译完成，显示文件预览 -->
          <div v-if="translatedFileUrl" class="file-preview-container">
            <div class="preview-header">
              <span>翻译后的文件</span>
              <el-button 
                type="primary" 
                @click="downloadTranslatedFile"
                size="small"
              >
                下载文件
              </el-button>
            </div>
            <div class="preview-content">
              <!-- 使用 Microsoft Office Online Viewer 预览 Word 文件 -->
              <iframe
                :src="`https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(translatedFileUrl)}`"
                width="100%"
                height="100%"
                style="border: none"
                frameborder="0"
              >
              </iframe>
            </div>
          </div>
          
          <!-- 翻译中或未完成 -->
          <div v-else-if="isTranslating" class="translating-prompt">
            <el-icon class="is-loading" style="font-size: 48px; color: #005767">
              <Loading />
            </el-icon>
            <p>
              翻译进行中，请稍候...
              <span v-if="typeof progress === 'number' && progress > 0">（{{ progress }}%）</span>
            </p>
            <p class="translating-tip">可以离开本页面，任务会在后台继续，回来即可看到结果</p>
          </div>

          <!-- 翻译失败 -->
          <div v-else-if="status === 'failed'" class="empty-prompt">
            <p>翻译失败：{{ errorMsg || '未知错误' }}</p>
            <p class="translating-tip">可重新上传文件后再试</p>
          </div>
          
          <!-- 未开始翻译 -->
          <div v-else class="empty-prompt">
            <p>请上传文件进行翻译</p>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import { ref } from 'vue'

/*
 * 页面状态提升到模块作用域（模块级单例）：
 * 离开本页面再回来时沿用同一份状态、同一个轮询定时器和同一份文件预览，
 * 只有手动刷新浏览器才会重置。
 */
const pageState = {
  form: ref({
    source_language: 'en',
    target_language: 'zh',
  }),
  fileList: ref([]),
  uploadedFile: ref(null),
  filePreviewUrl: ref(null),
  translatedContent: ref(''),
  translatedFileUrl: ref(''), // 翻译后的文件 URL
  requestId: ref(''),
  status: ref(''),
  progress: ref(null),
  errorMsg: ref(''),
  isTranslating: ref(false), // 任务进行中：右侧面板持续显示加载
  submitting: ref(false), // 仅提交请求期间：按钮 loading
}

// 定时器与页面激活标记也放在模块作用域，离开页面后轮询继续推进
const runtime = { timer: null, active: false }

// 真正关闭页面时释放预览用的 object URL（路由切换时不释放，回来还能继续预览）
window.addEventListener('beforeunload', () => {
  const url = pageState.filePreviewUrl.value
  if (url) URL.revokeObjectURL(url)
})
</script>

<script setup>
import { onBeforeUnmount, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { UploadFilled, Loading } from '@element-plus/icons-vue'
import { translateDocumentService, getTranslationStatusService } from '@/api/collector'

const {
  form,
  fileList,
  uploadedFile,
  filePreviewUrl,
  translatedContent,
  translatedFileUrl,
  requestId,
  status,
  progress,
  errorMsg,
  isTranslating,
  submitting,
} = pageState

/** 清空翻译任务与结果（保留语言选择）。 */
const clearTask = () => {
  translatedFileUrl.value = ''
  translatedContent.value = ''
  requestId.value = ''
  status.value = ''
  progress.value = null
  errorMsg.value = ''
  isTranslating.value = false
  stopPolling()
}

const handleFileChange = (file) => {
  // 移除之前的文件预览URL
  if (filePreviewUrl.value) {
    URL.revokeObjectURL(filePreviewUrl.value)
  }

  // 换文件时清掉上一份文件的翻译任务与结果
  clearTask()

  uploadedFile.value = file.raw
  fileList.value = [file]

  // 为PDF文件创建预览URL
  if (file.raw.type.includes('pdf')) {
    filePreviewUrl.value = URL.createObjectURL(file.raw)
  }
}

const removeFile = () => {
  ElMessageBox.confirm('移除后当前文件与翻译结果将被清空，确定移除吗？', '移除文件', {
    confirmButtonText: '移除',
    cancelButtonText: '取消',
    customClass: 'translate-confirm',
    confirmButtonClass: 'translate-confirm-danger',
    cancelButtonClass: 'translate-confirm-cancel',
    distinguishCancelAndClose: true,
  })
    .then(() => {
      if (filePreviewUrl.value) {
        URL.revokeObjectURL(filePreviewUrl.value)
        filePreviewUrl.value = null
      }
      // 一并清空翻译任务与结果，避免右侧残留上一份文件的进度/结果
      resetForm()
    })
    .catch(() => {
      // 用户取消操作
    })
}

const formatFileSize = (sizeInBytes) => {
  if (sizeInBytes < 1024) {
    return sizeInBytes + ' B'
  } else if (sizeInBytes < 1024 * 1024) {
    return (sizeInBytes / 1024).toFixed(2) + ' KB'
  } else {
    return (sizeInBytes / (1024 * 1024)).toFixed(2) + ' MB'
  }
}

const submitTranslate = async () => {
  if (!uploadedFile.value) {
    ElMessage.error('请先选择要翻译的文件')
    return
  }

  submitting.value = true
  // 点击后立即进入“翻译中”状态：右侧马上显示加载，不必等上传接口返回
  isTranslating.value = true
  errorMsg.value = ''
  translatedFileUrl.value = ''
  progress.value = 0
  try {
    // 提交翻译任务
    const res = await translateDocumentService({
      file: uploadedFile.value,
      source_language: form.value.source_language,
      target_language: form.value.target_language,
    })

    if (res.data.code === 200) {
      requestId.value = res.data.data.requestId
      status.value = 'processing'
      progress.value = 0
      errorMsg.value = ''
      translatedFileUrl.value = ''
      startPolling()
      ElMessage.success('翻译任务已提交')
    } else {
      // 接口返回非 200：退出“翻译中”，避免右侧一直转圈
      isTranslating.value = false
      status.value = 'failed'
      errorMsg.value = res.data?.error || res.data?.msg || '提交失败'
      ElMessage.error(`提交失败：${errorMsg.value}`)
    }
  } catch (error) {
    console.error('提交翻译任务失败:', error)
    isTranslating.value = false
    status.value = 'failed'
    errorMsg.value = '请检查网络或文件格式'
    ElMessage.error('提交失败，请检查网络或文件格式')
  } finally {
    submitting.value = false
  }
}

/** 轮询一次任务状态：进行中只更新右侧面板，不再弹出“翻译进行中”的提示。 */
const pollOnce = async () => {
  if (!requestId.value) {
    stopPolling()
    return
  }
  try {
    const res = await getTranslationStatusService(requestId.value)

    // 处理 200 和 202 状态码
    if (res.data.code === 200 || res.data.code === 202) {
      const data = res.data.data || {}
      if (typeof data.progress === 'number') progress.value = data.progress

      // 翻译完成：直接检查是否返回了 file_url
      if (data.file_url) {
        stopPolling()
        status.value = 'success'
        isTranslating.value = false
        progress.value = 100
        translatedFileUrl.value = data.file_url
        // 只有停留在本页面时才主动弹提示与打开下载，避免在其他页面被打扰
        if (runtime.active) {
          ElMessage.success('翻译完成！')
          window.open(data.file_url, '_blank')
          ElMessage.info('文件正在下载，请查看浏览器下载')
        }
      }
      // 翻译失败：检查是否有错误信息
      else if (data.status === 'error' || data.status === 'failed' || data.error_msg) {
        stopPolling()
        status.value = 'failed'
        isTranslating.value = false
        errorMsg.value = data.error_msg || '未知错误'
        if (runtime.active) ElMessage.error(`翻译失败：${errorMsg.value}`)
      }
      // 翻译进行中：继续轮询
      else {
        status.value = 'processing'
        isTranslating.value = true
      }
    }
  } catch (error) {
    // 单次查询失败不终止任务，保留面板上的“翻译进行中”，下一轮继续查询
    console.error('查询状态失败:', error)
  }
}

const startPolling = () => {
  // 已有定时器（例如离开页面后又回来）时不重复创建
  if (runtime.timer) return
  runtime.timer = setInterval(pollOnce, 3000)
}

const stopPolling = () => {
  if (runtime.timer) {
    clearInterval(runtime.timer)
    runtime.timer = null
  }
}

const downloadTranslatedFile = async () => {
  if (!translatedFileUrl.value) {
    ElMessage.error('没有可下载的文件')
    return
  }
  
  // 直接打开下载链接
  window.open(translatedFileUrl.value, '_blank')
}

/** 清空当前任务与文件（换文件、移除文件时调用）。 */
const resetForm = () => {
  form.value = {
    source_language: 'en',
    target_language: 'zh',
  }
  fileList.value = []
  uploadedFile.value = null
  submitting.value = false
  clearTask()
}

onMounted(() => {
  runtime.active = true
  // 回到本页面时，如果任务仍在进行则继续轮询（定时器若已存在则不会重复创建）
  if (isTranslating.value && requestId.value) startPolling()
})

onBeforeUnmount(() => {
  runtime.active = false
  // 不停止轮询：离开页面期间任务继续在后台推进，回来即可直接看到最新状态
})
</script>

<style scoped>
/* 与主界面统一的主题色与圆角：页面内的按钮、下拉、弹窗都跟随这套变量 */
.file-translate-container {
  --el-color-primary: #005767;
  --el-color-primary-light-3: #33798a;
  --el-color-primary-light-5: #66a0ac;
  --el-color-primary-light-7: #99c1c8;
  --el-color-primary-light-8: #cce0e4;
  --el-color-primary-light-9: #eef4f5;
  --el-color-primary-dark-2: #004a56;
  --el-border-radius-base: 6px;
  padding: 20px;
  border: 1px solid #e8ebef;
  border-radius: 10px;
  background-color: #fff;
}

/* 顶部：标题在左，翻译按钮在右上角 */
.translate-header {
  display: flex;
  align-items: center;
  /* 标题已在顶栏，这里只把翻译按钮靠右；这一行比原来矮一点 */
  justify-content: flex-end;
  gap: 16px;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid #eef1f4;
}

.translate-submit {
  min-width: 96px;
  height: 36px;
  border-radius: 8px;
  font-weight: 600;
}

/* 语言选择 */
.translate-toolbar {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
}

.translate-select {
  width: 180px;
}

.translate-arrow {
  color: #8ba0a2;
  font-size: 15px;
}

.upload-area,
.translated-content {
  height: calc(100vh - 260px); /* 调整高度以适应页面 */
  overflow-y: auto; /* 添加垂直滚动条 */
  border: 1px solid #e4e8ee;
  border-radius: 10px;
  padding: 20px;
  box-sizing: border-box;
  background: #fff;
}

.translated-content h3 {
  margin: 0 0 14px;
  color: #143437;
  font-size: 15px;
  font-weight: 700;
}

.upload-prompt {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
}

.preview-content {
  height: 700px;
}

.pdf-preview {
  height: 100%;
  width: 100%;
}

.document-preview {
  height: 100%;
  padding: 20px;
}

.file-info p {
  margin: 10px 0;
}

.file-preview-placeholder {
  margin-top: 40px;
  text-align: center;
  color: #999;
}

.file-preview-placeholder p {
  margin: 10px 0;
  font-size: 16px;
}

.upload-icon {
  font-size: 90px;
  color: #c0c4cc;
  margin-bottom: 15px;
}

.file-preview-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.file-preview-container .preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
}

.file-preview-container .preview-content {
  flex: 1;
  min-height: 600px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.translating-prompt,
.empty-prompt {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #999;
}

.translating-prompt p,
.empty-prompt p {
  margin-top: 20px;
  font-size: 16px;
}

.translating-prompt .translating-tip,
.empty-prompt .translating-tip {
  margin-top: 8px;
  color: #909399;
  font-size: 12px;
}
</style>

<style>
/* 移除文件的确认弹窗：与主界面同一套深青配色（弹窗挂在 body 上，故用非 scoped 样式） */
.translate-confirm.el-message-box {
  width: min(430px, calc(100vw - 40px));
  padding: 22px 24px 18px;
  border: 1px solid #e4e8ee;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 18px 48px rgb(16 45 45 / 14%);
}
.translate-confirm .el-message-box__header {
  padding: 0 0 10px;
}
.translate-confirm .el-message-box__title {
  color: #143437;
  font-size: 16px;
  font-weight: 700;
}
.translate-confirm .el-message-box__content {
  padding: 0;
  color: #33595b;
  font-size: 14px;
  line-height: 1.75;
}
.translate-confirm .el-message-box__btns {
  gap: 10px;
  padding: 18px 0 0;
}
.translate-confirm .el-message-box__btns .el-button {
  height: 36px;
  margin: 0;
  padding: 0 18px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
}
.translate-confirm .el-button.translate-confirm-cancel {
  color: #33595b;
  border: 1px solid #d5dde0;
  background: #fff;
}
.translate-confirm .el-button.translate-confirm-cancel:hover {
  color: #005767;
  border-color: #a9c6cb;
  background: #f2f8f8;
}
.translate-confirm .el-button.translate-confirm-danger {
  color: #fff;
  border-color: #005767;
  background: #005767;
}
.translate-confirm .el-button.translate-confirm-danger:hover {
  border-color: #004a56;
  background: #004a56;
}
.translate-confirm .el-message-box__headerbtn {
  top: 14px;
  right: 14px;
}
.translate-confirm .el-message-box__headerbtn .el-message-box__close {
  color: #8ba0a2;
}
.translate-confirm .el-message-box__headerbtn:hover .el-message-box__close {
  color: #005767;
}
</style>
