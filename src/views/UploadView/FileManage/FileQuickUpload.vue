<template>
  <PageContainer title="快速录入">
    <template #extra>
      <el-button type="primary" @click="downloadExample()">下载文献示例</el-button>
    </template>
    <div class="form-container">
      <el-form :model="formModel" ref="formRef" label-width="100px" style="width: 70%">
        <el-form-item label="参考文献解析">
          <el-input
            type="textarea"
            v-model="formModel.reference"
            placeholder="录入文献须符合国标GB/T7714-2015规范，具体参考“文献示例”"
            :rows="6"
          ></el-input>
          <el-button @click="handleParsingReference" style="margin-top: 10px">解析</el-button>
        </el-form-item>
      </el-form>
    </div>
  </PageContainer>
</template>

<script setup>
import { reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

const router = useRouter()

const formModel = reactive({
  reference: '',
})

const handleParsingReference = () => {
  if (!formModel.reference.trim()) ElMessage.error('参考文献内容为空！')
  else
    router.push({
      name: 'upload',
      query: {
        reference: formModel.reference.trim(),
      },
    })
}

const downloadExample = () => {
  const link = document.createElement('a')
  link.href = '/国标GBT 7714-2015文献示例.docx' // 路径相对于 public 目录
  link.download = '文献示例.docx' // 下载时的文件名
  link.click()
}
</script>

<style scoped>
.form-container {
  display: flex;
  justify-content: center; /* 水平居中 */
}
</style>
