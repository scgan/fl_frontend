<template>
  <el-row class="login-page">
    <!-- 左侧背景图片 -->
    <el-col :span="12" class="bg">
      <div class="bg-inner">
        <div class="bg-title">
          <h2>
            <span class="bg-title-logo">
              <span class="bg-title-logo-mark" role="img" aria-label="文昌"></span>
            </span>
            <i class="bg-title-sep">·</i>中国教育国际传播智慧平台
          </h2>
          <p class="bg-title-en">Wenchang · China Education International Communication Smart Platform</p>
        </div>

        <!-- 平台简介：普通正文段落，小标题作为段首引导词，保留金色 -->
        <div class="bg-intro">
          <p>
            <span class="intro-key">平台构成</span>文昌•中国教育国际传播智慧平台由“知识库资源底座”与“智能体应用核心”两大部分构成。
          </p>
          <p>
            <span class="intro-key">文昌知识库</span>由三大主题数据库和一个术语库构成，分别是：中国教育政策、中国教育思想、中国外语教育国际传播数据库和中国教育核心术语库。全库收录中、英、俄、日、法、韩、西等7个语种的18万余条文献，包括教育政策、教育思想、外语教育等著作、论文、报告、政府文件等8大类型的中外文文献，以及中国教育政策、思想等在国外译介、接受与研究的相关文献。
          </p>
          <p>
            <span class="intro-key">文昌智能体</span>覆盖文献检索、深度阅读、研究分析、学术写作、文献翻译全流程，内置八大功能精准适配科研全场景。
          </p>
        </div>
      </div>

      <div class="bg-slogan">
        <span>版权所有：华中师范大学外国语学院</span>
      </div>
    </el-col>
    <!-- 右侧表单 -->
    <el-col :span="6" :offset="3" class="form">
      <!-- 登录模块上方的品牌标识 -->
      <div class="login-brand">
        <img class="login-brand-logo" src="@/assets/logo-wenchang.png" alt="文昌" />
        <div class="login-brand-text">
          <strong>世界因教育而昌明</strong>
          <small>Civilizing the World through Education</small>
        </div>
      </div>
      <el-form
        ref="form"
        size="large"
        autocomplete="off"
        :model="formModel"
        :rules="rules"
        v-if="isRegister"
      >
        <el-form-item style="margin-bottom: 10px">
          <h1>注册</h1>
        </el-form-item>
        <!-- 注册选择用户性质 -->
        <el-form-item style="margin-bottom: 17px" prop="role">
          <el-select v-model="formModel.role" placeholder="请选择角色性质">
            <el-option label="二级管理员" :value="1"></el-option>
            <el-option label="语料上传者" :value="2"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item prop="reviewer_id" style="margin-bottom: 17px" v-show="formModel.role === 2">
          <el-select
            v-model="formModel.reviewer_id"
            placeholder="请选择组长（二级管理员）"
            filterable
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
        <el-form-item prop="username" style="margin-bottom: 17px">
          <el-input
            :prefix-icon="UserFilled"
            v-model="formModel.username"
            placeholder="请输入教工号"
          ></el-input>
        </el-form-item>
        <el-form-item prop="name" style="margin-bottom: 17px">
          <el-input
            :prefix-icon="User"
            v-model="formModel.name"
            placeholder="请输入姓名"
          ></el-input>
        </el-form-item>
        <el-form-item prop="phone" style="margin-bottom: 17px">
          <el-input
            :prefix-icon="Bell"
            v-model="formModel.phone"
            placeholder="请输入电话号码"
            type="number"
          ></el-input>
        </el-form-item>
        <el-form-item prop="email" style="margin-bottom: 17px">
          <el-input
            :prefix-icon="Message"
            v-model="formModel.email"
            placeholder="请输入邮箱地址"
          ></el-input>
        </el-form-item>
        <el-form-item prop="password" style="margin-bottom: 17px">
          <el-input
            :prefix-icon="Lock"
            type="password"
            show-password
            v-model="formModel.password"
            placeholder="请输入密码"
          ></el-input>
        </el-form-item>
        <el-form-item prop="repassword" style="margin-bottom: 17px">
          <el-input
            :prefix-icon="Lock"
            type="password"
            show-password
            v-model="formModel.repassword"
            placeholder="请再次输入密码"
          ></el-input>
        </el-form-item>

        <!-- 要不点击注册后先弹个框进行上传图片？ -->
        <el-form-item style="margin-bottom: 10px">
          <el-upload
            v-model:file-list="formModel.picture"
            class="upload-demo"
            :auto-upload="false"
            :show-file-list="true"
          >
            <el-button type="primary">上传教工卡图片</el-button>
            <!-- <template #tip>
              <div class="el-upload__tip">
                jpg/png files with a size less than 500KB.
              </div>
            </template> -->
          </el-upload>
        </el-form-item>

        <el-form-item style="margin-bottom: 10px">
          <div class="form-item-flex" style="margin-bottom: 10px">
            <el-input
              placeholder="请输入验证码"
              v-model="sidentifyMode"
              clearable
              class="input-with-code"
            ></el-input>
            <div class="code" @click="userGetCaptcha()">
              <!-- <SIdentify :identifyCode="identifyCode"></SIdentify> -->
              <img :src="imgSrc" alt="" style="max-height: 40px" />
            </div>
          </div>
        </el-form-item>
        <el-form-item style="margin-bottom: 10px">
          <el-button class="button" type="primary" auto-insert-space @click="onFinish()">
            注册
          </el-button>
        </el-form-item>
        <el-form-item class="flex" style="margin-bottom: 10px">
          <el-link type="info" :underline="false" @click="isRegister = false"> ← 返回 </el-link>
        </el-form-item>
      </el-form>
      <el-form ref="form" size="large" :model="formModel" :rules="rules" autocomplete="off" v-else>
        <el-form-item>
          <h1>登录</h1>
        </el-form-item>

        <!-- 测试用 -->
        <!-- <el-form-item>
          <el-select v-model="userRole" placeholder="请选择用户性质">
            <el-option label="超级管理员" value="super"></el-option>
            <el-option label="二级管理员" value="admin"></el-option>
            <el-option label="语料上传者" value="user"></el-option>
          </el-select>
        </el-form-item> -->
        <el-form-item prop="username">
          <el-input
            :prefix-icon="User"
            v-model="formModel.username"
            placeholder="请输入教工号"
          ></el-input>
        </el-form-item>
        <el-form-item>
          <el-input
            name="password"
            :prefix-icon="Lock"
            v-model="formModel.password"
            type="password"
            show-password
            placeholder="请输入密码"
          ></el-input>
        </el-form-item>
        <el-form>
          <div class="form-item-flex">
            <el-input
              placeholder="请输入验证码"
              v-model="sidentifyMode"
              clearable
              class="input-with-code"
            ></el-input>
            <div class="code" @click="userGetCaptcha()">
              <!-- <SIdentify :identifyCode="identifyCode"></SIdentify> -->
              <img :src="imgSrc" alt="" style="max-height: 40px" />
            </div>
          </div>
        </el-form>
        <!-- <el-form-item class="flex">
          <div class="flex">
            <el-checkbox>记住我</el-checkbox>
            <el-link type="primary" :underline="false">忘记密码？</el-link>
          </div>
        </el-form-item> -->
        <el-form-item>
          <el-button class="button" type="primary" auto-insert-space @click="onFinish()"
            >登录</el-button
          >
        </el-form-item>
        <el-form-item class="flex">
          <div class="flex">
            <el-link type="info" :underline="false" @click="isRegister = true"> 注册 → </el-link>
            <el-link
              type="primary"
              :underline="false"
              @click="router.push({ path: '/email_findpw' })"
              >忘记密码？</el-link
            >
          </div>
        </el-form-item>
      </el-form>
    </el-col>
    <!-- 角色选择 -->
    <el-dialog
      v-model="roleDialogVisible"
      title="角色选择"
      width="500"
      center
      style="text-align: center"
    >
      <div style="display: flex; justify-content: center">
        <el-select v-model="roles" placeholder="请选择" style="width: 240px; text-align: center">
          <el-option
            v-for="item in options"
            :key="item.value"
            :label="item.label"
            :value="item.value"
            :disabled="item.disabled"
          />
        </el-select>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="roleDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="Roleselected(roles)"> 确定 </el-button>
        </div>
      </template>
    </el-dialog>
  </el-row>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { computed } from 'vue'
import router from '@/router'
import { User, Lock, Message, Bell, UserFilled } from '@element-plus/icons-vue'
import { getUserLeader } from '@/api/collector'
import {
  userLoginService,
  userRoleSelect,
  userRegisterService,
  userGetCaptchaService,
} from '@/api/login.js'
import { getRoleOptions } from '@/utils/utils.js'
// import { userLoginService } from '@/api/loginApi/index'
import SIdentify from '@/components/Sidentify.vue'

// 获取二级管理员列表
const leaderList = ref([])
const getLeaderList = async () => {
  const res = await getUserLeader()
  console.log(res)
  leaderList.value = res.data.data
}
getLeaderList()

let sidentifyMode = ref('') //输入框验证码
let identifyCode = ref('') //图形验证码
let identifyCodes = ref('1234567890abcdefjhijklinopqrsduvwxyz') //验证码出现的数字和字母

//组件挂载
onMounted(() => {
  identifyCode.value = ''
  // makeCode(identifyCodes.value, 4)
  userGetCaptcha()
})

// 生成随机数
const randomNum = (min, max) => {
  return Math.floor(Math.random() * (max - min) + min)
}
// 随机生成验证码字符串
const makeCode = (o, l) => {
  for (let i = 0; i < l; i++) {
    identifyCode.value += o[randomNum(0, o.length)]
  }
}
// 更新验证码
const refreshCode = () => {
  identifyCode.value = ''
  makeCode(identifyCodes.value, 4)
}

const imgSrc = ref('')
const captcha_id = ref('')
const userGetCaptcha = async () => {
  const res = await userGetCaptchaService()
  // if (res.data.code === 200) {
  imgSrc.value = 'data:image/png;base64,' + res.data.captcha_image
  // console.log(res.data)
  captcha_id.value = res.data.captcha_id
  // }
}

// const router = useRouter()
// 切换登录注册表单
const isRegister = ref(false)

const form = ref(null)
const formModel = ref({
  username: '',
  password: '',
  role: null,
})

// 定义角色映射关系
const roleMap = {
  0: '未知人员',
  1: '二级管理员',
  2: '语料收集者',
}
//角色的值
const roles = ref(null)
const options = ref([])
//角色选择弹框
const roleDialogVisible = ref(false)

// form表单检验规则
const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    {
      min: 8,
      message: '密码长度不能小于8位',
      trigger: 'blur',
    },
    {
      validator: (rule, value, callback) => {
        const passwordRegex =
          /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#\$%\^&\*\(\)\-_=+\[\]{};':"\\|,.<>\/?`~])[A-Za-z\d!@#\$%\^&\*\(\)\-_=+\[\]{};':"\\|,.<>\/?`~]{8,}$/
        if (!passwordRegex.test(value)) {
          callback(new Error('密码必须包含大小写字母、数字和特殊字符'))
        } else {
          callback()
        }
      },
      trigger: 'blur',
    },
  ],
}
const Roleselected = async (data) => {
  const Newdata = await userRoleSelect({ role: data })
  const token = Newdata.data.data
  localStorage.setItem('userRole', data)
  localStorage.setItem('token', token)
  switch (data) {
    case 0:
    case 1:
      router.push('/admin')
      break
    case 2:
      router.push('/user')
      break
  }
  roleDialogVisible.value = false
}
const onFinish = async () => {
  // 提交前进行测验
  await form.value.validate()
  if (!sidentifyMode.value) {
    ElMessage({ type: 'error', message: '验证码不能为空！' })
    return
  }
  //验证验证码是否正确
  // if (sidentifyMode.value != identifyCode.value) {
  //   ElMessage({ type: 'error', message: '验证码错误' })
  //   refreshCode()
  //   return
  // } else {
  if (!isRegister.value) {
    // ElMessage.success('登录成功')
    const res = await userLoginService({
      ...formModel.value,
      captcha_id: captcha_id.value,
      captcha: sidentifyMode.value,
    })
    console.log(res)
    if (res.data.code === 200) {
      localStorage.setItem('token', res.data.data.token)
      localStorage.setItem('roles', JSON.stringify(res.data.data.role))
      ElMessage.success('登录成功')
      if (res.data.data.role.length === 1) {
        console.log('I am here')
        Roleselected(res.data.data.role[0])
      } else {
        options.value = getRoleOptions()
        roleDialogVisible.value = true
      }
      // router.push({ path: '/' })
    }
  } else {
    // 后续添加表单非空校验
    // console.log(formModel.value)
    // formModel.value.picture = formModel.value.file[0]
    if (formModel.value.role === null) {
      ElMessage({ type: 'error', message: '请选择角色' })
      return
    }
    const res = await userRegisterService({
      ...formModel.value,
      captcha_id: captcha_id.value,
      captcha: sidentifyMode.value,
    })
    console.log(res)
    if (res.data.code === 200) {
      ElMessage.success('注册成功')
      isRegister.value = false
      // 同时清空表单,重置验证码
      formModel.value = {}
      userGetCaptcha()
      sidentifyMode.value = ''
    }
  }
  // 根据后端返回的角色性质进行跳转
  // }
}
</script>

<style lang="scss" scoped>
.login-page {
  height: 100vh;
  background-color: #fff;
  /* 与平台一致的深青主题：按钮、链接、输入框聚焦色都跟随这组变量 */
  --el-color-primary: #005767;
  --el-color-primary-light-3: #33798a;
  --el-color-primary-light-5: #66a0ac;
  --el-color-primary-light-7: #99c1c8;
  --el-color-primary-light-8: #cce0e4;
  --el-color-primary-light-9: #eef4f5;
  --el-color-primary-dark-2: #004a56;
  --el-border-radius-base: 8px;
  --el-component-size-large: 44px;
  .bg {
    position: relative;
    overflow: hidden;
    background:
      // url('@/assets/login_title.png') no-repeat 50% center / 240px auto,
      linear-gradient(115deg, rgb(0 60 71 / 42%), rgb(0 87 103 / 20)),
      url('@/assets/login_bg.jpg') no-repeat center / cover;
    border-radius: 0 20px 20px 0;
  }

  /* 左侧底部版权行，压在背景图底部居中 */
  .bg-slogan {
    text-align: center;
    align-items: center;
    position: absolute;
    left: 50%;
    bottom: 32px;
    width: min(78%, 560px);
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    text-align: center;
    pointer-events: none;
  }

  /* 登录模块上方：logo 在上，中文标语与英文排在其下（上下结构、统一居中） */
  .login-brand {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    width: 100%;
    /* 底部留白 = 标语与「登录」表单之间的间距；外层居中，加大它等于 logo 上移、表单下移 */
    padding: 0 0 70px;
    text-align: center;
  }

  .login-brand-logo {
    width: 150px;
    height: auto;
    object-fit: contain;
  }

  .login-brand-text {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    text-align: center;
  }

  /* 中文标语：加粗（宋体缺少粗体字形时允许浏览器合成，避免看起来还是常规体） */
  .login-brand-text strong {
    color: #005767;
    font-family: 'Songti SC', 'STSong', 'Source Han Serif SC', serif;
    font-size: 21px;
    font-weight: 900;
    font-synthesis: weight;
    letter-spacing: 2px;
    white-space: nowrap;
  }

  /* 英文小字：同样加粗，颜色压深一档，让粗体看得出来 */
  .login-brand-text small {
    color: #42646a;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 11px;
    font-weight: 700;
    font-synthesis: weight;
    letter-spacing: 0.4px;
    white-space: nowrap;
  }

  .bg-slogan span {
    color: rgb(255 255 255 / 80%);
    font-family: 'Songti SC', 'STSong', 'Source Han Serif SC', 'Noto Serif SC', serif;
    font-size: 12.5px;
    font-weight: 500;
    letter-spacing: 1.2px;
    text-shadow: 0 4px 16px rgb(0 40 47 / 45%);
  }

  /* 左侧内容区：标题 + 简介正文整体在背景图上垂直居中，版权行压在最底 */
  .bg-inner {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    /* gap 拉开 = 标题上移、简介下移；左右收窄，正文行宽更长 */
    gap: 72px;
    padding: 110px 28px 72px 24px;
    text-align: center;
  }

  /* 左侧主标题：中文衬线 + 英文副标题，压在背景图上 */
  .bg-title {
    flex: 0 0 auto;
    /* 盒子宽度由中文那行撑开（max-content），中英两行共用同一条中轴：
       英文不会再贴着中文左缘，也不会换行把宽度撑乱 */
    width: max-content;
    max-width: 100%;
    text-align: center;
    color: #fff;
    text-shadow: 0 6px 24px rgb(0 40 47 / 45%);
  }

  .bg-title h2 {
    margin: 0 0 12px;
    font-family: 'Songti SC', 'STSong', 'Source Han Serif SC', 'Noto Serif SC', serif;
    /* 字号跟着视口收：中文字数变多后，原来的 2.6vw 会顶到左图边缘 */
    font-size: clamp(24px, 2.28vw, 40px);
    font-weight: 700;
    letter-spacing: 2px;
    line-height: 1.4;
    white-space: nowrap;
  }

  /* 中圆点分隔符：原为 62% 白光，压在深青底图上看不清，提亮到 92% */
  .bg-title .bg-title-sep {
    margin: 0 4px;
    color: rgb(255 255 255 / 92%);
    font-style: normal;
    font-weight: 500;
    letter-spacing: 0;
  }

  /* 「文昌」改用 logo：裁掉底部英文，染成金色；比中文字面略大，底边与文字齐平 */
  .bg-title .bg-title-logo {
    display: inline-block;
    height: 1.05em;
    overflow: hidden;
    vertical-align: -0.2em;
  }

  /* 白色 logo 用自身 alpha 当遮罩、底色填金色：比 filter 调色更准 */
  .bg-title .bg-title-logo-mark {
    display: block;
    /* 1.05 / 0.768 ≈ 1.37：按原图完整高度铺，下方 23%（空白 + 英文）被父级裁掉 */
    height: 1.37em;
    /* 原图 1651×827，宽高比 1.996× */
    width: 2.735em;
    background-color: #ffd04b;
    -webkit-mask: url('@/assets/logo-wenchang-white.png') no-repeat 0 0 / 100% 100%;
    mask: url('@/assets/logo-wenchang-white.png') no-repeat 0 0 / 100% 100%;
  }

  .bg-title .bg-title-en {
    margin: 0;
    white-space: nowrap;
    color: rgb(255 255 255 / 86%);
    font-family: Georgia, 'Times New Roman', serif;
    font-size: clamp(10px, 0.72vw, 12.5px);
    letter-spacing: 1.2px;
    line-height: 1.7;
  }

  /* 简介：普通正文段落 + 段首缩进，段首引导词保留金色，其余一律不抢色 */
  .bg-intro {
    width: 100%;
    max-width: 820px;
    text-align: justify;
  }

  .bg-intro p {
    margin: 0 0 10px;
    color: rgb(255 255 255 / 82%);
    /* 楷体系列更柔和，缺字时回落到宋体，避免落到黑体 */
    font-family: 'Kaiti SC', 'STKaiti', 'KaiTi', 'Songti SC', 'STSong', 'Source Han Serif SC', serif;
    font-size: 13.5px;
    line-height: 2;
    letter-spacing: 0.5px;
    text-indent: 2em;
    text-shadow: 0 1px 10px rgb(0 32 38 / 55%);
  }

  .bg-intro p:last-child {
    margin-bottom: 0;
  }

  /* 段首引导词：沿用标题的金色，不加粗不放大 */
  .bg-intro .intro-key {
    color: #ffd04b;
    font-weight: 600;
  }

  .form {
    /* 顶部留白把「品牌行 + 登录模块」整体往下推一点，和左侧标语错开 */
    padding-top: 96px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    /* 登录控件比默认 large 收一档，整体更小巧 */
    --el-component-size-large: 40px;
    user-select: none;

    /* 登录区块整体收窄，视觉上比左侧标题更安静 */
    > * {
      width: 100%;
      max-width: 340px;
      margin-right: auto;
      margin-left: auto;
    }
    .title {
      margin: 0 auto;
    }
    /* 主按钮：深青实心、圆角、字距拉开，和侧栏/顶栏统一 */
    .button {
      width: 100%;
      height: 42px;
      margin-top: 6px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 4px;
      box-shadow: 0 6px 16px rgb(0 87 103 / 22%);
    }
    .flex {
      width: 100%;
      display: flex;
      justify-content: space-between;
    }
    /* 表单标题：与页面标题同一套配色 */
    h1 {
      margin: 0;
      padding-left: 10px;
      border-left: 3px solid #005767;
      color: #143437;
      font-size: 19px;
      font-weight: 700;
      letter-spacing: 1px;
      line-height: 1.3;
    }
    /* 链接：信息类灰字改为青灰，主链接统一深青 */
    :deep(.el-link) {
      font-size: 13px;
    }
    :deep(.el-link.el-link--info) {
      color: #5b7074;
    }
    :deep(.el-link.el-link--info:hover) {
      color: #005767;
    }
    :deep(.el-link.el-link--primary) {
      color: #005767;
      font-weight: 600;
    }
    /* 输入框与选择器：圆角、浅青聚焦边 */
    :deep(.el-input__wrapper),
    :deep(.el-select__wrapper) {
      border-radius: 10px;
      box-shadow: 0 0 0 1px #dde5e7 inset;
    }
    :deep(.el-input__wrapper.is-focus),
    :deep(.el-select__wrapper.is-focused) {
      box-shadow: 0 0 0 1px #005767 inset;
    }
  }

  /* 窄屏（含浏览器缩放）：标题再收一档，保证两行都不顶到左图边缘 */
  @media (max-width: 980px) {
    .bg-title h2 {
      font-size: 20px;
      letter-spacing: 1px;
    }

    .bg-title .bg-title-en {
      font-size: 9.5px;
      letter-spacing: 0.6px;
    }
  }
}
.form-item-flex {
  display: flex;
  align-items: center; /* 垂直居中对齐 */
}

.input-with-code {
  flex: 1; /* 输入框占据剩余空间 */
  margin-right: 10px; /* 输入框和图片之间的间距 */
}

.code {
  cursor: pointer; /* 当鼠标悬停时显示为可点击状态 */
  /* 你可以在这里添加更多的样式来调整验证码图片的大小和外观 */
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
