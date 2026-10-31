<template>
  <PageContainer title="大模型提取">
    <!-- <template #extra>
      <el-button type="primary" @click="downloadExample()">下载文献示例</el-button>
    </template> -->
    <div class="form-container">
      <el-upload
        class="upload-area"
        drag
        :auto-upload="false"
        :on-change="handleSuccess"
        :file-list="file"
      >
        <el-icon class="upload-icon"><UploadFilled /></el-icon>
        <!-- <i class="el-icon-upload upload-icon"></i> -->
        <div class="el-upload__text" style="font-size: 25px">
          将文件拖到此处，或<em>点击上传</em>
        </div>
        <div class="upload-tip">大模型提取的信息存在一定误差，请老师们务必审核校对</div>
      </el-upload>
    </div>
  </PageContainer>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import { useFileStore } from '@/stores/file'

const fileStore = useFileStore()
const router = useRouter()
const file = ref()
const handleSuccess = (response, f) => {
  //   console.log(fileList)
  file.value = f
  fileStore.setUploadedFile(f)

  router.push({
    name: 'upload',
  })
}
</script>

<style scoped>
.form-container {
  display: flex;
  justify-content: center; /* 水平居中 */
}
.upload-area {
  width: 50%;
  border: 2px dashed #dcdfe6;
  border-radius: 8px;
  padding: 40px 20px;
  transition: all 0.3s;
  background-color: #fafafa;
  margin-bottom: 20px;
}

.upload-area:hover {
  border-color: #005767;
}

.upload-icon {
  font-size: 90px;
  color: #c0c4cc;
  margin-bottom: 15px;
}

.upload-button {
  margin-top: 15px;
}

.upload-tip {
  color: #909399;
  font-size: 25px;
  margin-top: 15px;
}
</style>
