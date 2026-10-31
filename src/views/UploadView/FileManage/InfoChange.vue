<script setup>
import { ref } from 'vue'
import { getUserInfoService, userUpdateService, getUserAvatar } from '@/api/user'
import { User, Lock, Message, Bell, Plus } from '@element-plus/icons-vue'

const formModel = ref({})
const rules = {}
const getUserInfo = async () => {
    const res = await getUserInfoService()
    console.log(res)
    if(res.data.code === 200){
        formModel.value = res.data.data
        // imgUrl.value = formModel.value.picture
        const res2 = await getUserAvatar(formModel.value.id)
        console.log(res2)
        if (imgUrl.value) {
            URL.revokeObjectURL(imgUrl.value);  // 撤销旧的 Blob URL
        }
        // if(res2.data.code === 200){
        // console.log(res2.data instanceof File)
        // 需要在api中明确声明要求返回blob
        const url = URL.createObjectURL(res2.data)
        imgUrl.value = url
        // imgUrl.value = res2.data
        // }
    }
}
getUserInfo()

const imgUrl = ref('')
const onUploadFile = (uploadFile) => {
  // console.log(formModel.value.file)
  imgUrl.value = URL.createObjectURL(uploadFile.raw)
  formModel.value.picture = uploadFile.raw
  // console.log(uploadFile)
  // console.log(formModel.value.file)
}
const onSubmit = async () => {
    const res = await userUpdateService(formModel.value)
    console.log(res)
    if(res.data.code === 200){
        ElMessage.success('修改成功')
        getUserInfo()
    }
        
}
</script>
<template>
    <PageContainer title="修改信息">
        <el-form
            ref="form"
            size="large"
            autocomplete="off"
            :model="formModel"
            :rules="rules"
            label-width="100px"
        >
            <el-form-item prop="username" label="姓名">
                <el-input
                    :prefix-icon="User"
                    v-model="formModel.username"
                    placeholder="请输入姓名"
                ></el-input>
            </el-form-item>
            <el-form-item prop="phone" label="电话号码">
                <el-input
                    :prefix-icon="Bell"
                    v-model="formModel.phone"
                    placeholder="请输入电话号码"
                    type="number"
                ></el-input>
            </el-form-item>
            <el-form-item prop="email" label="邮箱地址">
                <el-input
                    :prefix-icon="Message"
                    v-model="formModel.email"
                    placeholder="请输入邮箱地址"
                ></el-input>
            </el-form-item>
            <el-form-item prop="old_password" label="原密码">
                <el-input
                    :prefix-icon="Lock"
                    type="password"
                    show-password
                    v-model="formModel.old_password"
                    placeholder="请输入密码"
                ></el-input>
            </el-form-item>
            <el-form-item prop="new_password" label="新密码">
                <el-input
                    :prefix-icon="Lock"
                    type="password"
                    show-password
                    v-model="formModel.new_password"
                    placeholder="请再次输入密码"
                ></el-input>
            </el-form-item>

            <el-form-item label="一卡通">
                <el-upload
                    class="avatar-uploader"
                    :auto-upload="false"
                    :show-file-list="false"
                    :on-change="onUploadFile"
                >
                    <img v-if="imgUrl" :src="imgUrl" class="avatar" />
                    <el-icon v-else class="avatar-uploader-icon"><Plus /></el-icon>
                </el-upload>
            </el-form-item>

            <el-form-item>
                <el-button class="button" type="primary" auto-insert-space @click="onSubmit()">
                    提交
                </el-button>
            </el-form-item>
        </el-form>
    </PageContainer>
</template>

<style lang="scss" scoped>
/* 输入框宽度收到原来的四成，避免整行过长 */
:deep(.el-form-item .el-input) {
  width: 40%;
}

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
</style>