<template>
  <el-container class="layout-container">
    <el-aside>
      <div class="el-aside__logo"></div>
      <el-menu
        active-text-color="#ffd04b"
        background-color="#005767"
        :default-active="$route.path"
        text-color="#fff"
        router
      >
        <!-- <el-menu-item index="/admin/perlist">
          <el-icon><Management /></el-icon>
          <span>人员列表（已审核）</span>
        </el-menu-item>
        <el-menu-item index="/admin/verifyper">
          <el-icon><EditPen /></el-icon>
          <span>审核列表（未审核）</span>
        </el-menu-item> -->
        <!-- <el-menu-item index="/user/change">
          <el-icon><Refresh /></el-icon>
          <span>修改信息</span>
        </el-menu-item> -->
        <!-- 新增部分上限 -->
        <el-menu-item index="/admin/rank" v-if="roleName === '超级管理员'">
          <el-icon><Management /></el-icon>
          <span>上传排名</span>
        </el-menu-item>

        <el-sub-menu index="/" v-if="roleName === '超级管理员'">
          <template #title>
            <el-icon><UserFilled /></el-icon>
            <span>人员管理</span>
          </template>
          <el-menu-item index="/admin/perlist">
            <el-icon><CircleCheck /></el-icon>
            <span>人员列表（已通过）</span>
          </el-menu-item>
          <el-menu-item index="/admin/peopleNo">
            <el-icon><EditPen /></el-icon>
            <span>人员列表（未通过）</span>
          </el-menu-item>
          <el-menu-item index="/admin/verifyper">
            <el-icon><Connection /></el-icon>
            <span>审核列表（未审核）</span>
          </el-menu-item>
        </el-sub-menu>
        <el-sub-menu index="/admin/corpusList">
          <template #title>
            <el-icon><UserFilled /></el-icon>
            <span>语料库</span>
          </template>
          <!-- <el-menu-item index="/admin/corpusList">
				    <el-icon><CircleCheck /></el-icon>
				    <span>语料（已通过）</span>
				  </el-menu-item>
				  <el-menu-item index="/admin/corpusListNo">
				    <el-icon><EditPen /></el-icon>
				    <span>语料（未通过）</span>
				  </el-menu-item> -->
          <el-menu-item index="/admin/verifyCor" v-if="roleName === '二级管理员'">
            <el-icon><Connection /></el-icon>
            <span>语料（未审核）</span>
          </el-menu-item>
          <el-menu-item index="/admin/corpusList" v-if="roleName === '二级管理员'">
            <el-icon><Connection /></el-icon>
            <span>语料（已审核）</span>
          </el-menu-item>
          <el-menu-item index="/admin/databaseImg" v-if="roleName === '超级管理员'">
            <el-icon><Connection /></el-icon>
            <span>数据库图</span>
          </el-menu-item>
          <!-- 新增：历史数据审核 -->
          <el-menu-item index="/admin/historyVerify" v-if="roleName === '二级管理员'">
            <el-icon><Timer /></el-icon>
            <span>历史数据审核</span>
          </el-menu-item>
          <!-- 新增：已审核恢复语料 -->
          <el-menu-item index="/admin/reviewedRecovery" v-if="roleName === '二级管理员'">
            <el-icon><Timer /></el-icon>
            <span>已审核恢复语料</span>
          </el-menu-item>
        </el-sub-menu>
        <el-sub-menu index="/admin/databaseTree" v-if="roleName === '超级管理员'">
          <template #title>
            <el-icon><Operation /></el-icon>
            <span>数据设置</span>
          </template>
          <el-menu-item index="/admin/databaseTree">
            <el-icon><CircleCheck /></el-icon>
            <span>数据库设置</span>
          </el-menu-item>
          <el-menu-item index="/admin/keyWords">
            <el-icon><EditPen /></el-icon>
            <span>关键词设置</span>
          </el-menu-item>
          <el-menu-item index="/admin/corpusSet">
            <el-icon><EditPen /></el-icon>
            <span>语料库设置</span>
          </el-menu-item>
        </el-sub-menu>
        <!-- 新增：工作量统计菜单项 -->
        <el-menu-item index="/admin/workloadStats" v-if="roleName === '二级管理员'">
          <el-icon><EditPen /></el-icon>
          <span>工作量统计</span>
        </el-menu-item>
        <el-menu-item index="/admin/resetPassword" v-if="roleName === '超级管理员'">
            <el-icon><EditPen /></el-icon>
            <span>重置密码</span>
          </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header>
        <div>
          用户名：<strong>{{ roleName }}</strong>
        </div>
        <div>
          <el-button
            type="success"
            @click="roleDialogVisible = true"
            v-show="roles != 0"
            class="choiceRole"
            >切换角色</el-button
          >
          <el-dropdown placement="bottom-end" @command="handleCommand">
            <span class="el-dropdown__box">
              <el-avatar :src="avatar" />
              <el-icon><CaretBottom /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <!-- <el-dropdown-item command="profile" :icon="User">基本资料</el-dropdown-item>
					      <el-dropdown-item command="avatar" :icon="Crop">更换头像</el-dropdown-item> -->
                <!-- <el-dropdown-item command="password" :icon="EditPen">重置密码</el-dropdown-item> -->
                <el-dropdown-item command="logout" :icon="SwitchButton">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
      <el-main>
        <router-view></router-view>
        <el-dialog
          v-model="roleDialogVisible"
          title="角色选择"
          width="500"
          center
          style="text-align: center"
        >
          <div style="display: flex; justify-content: center">
            <el-select
              v-model="roles"
              placeholder="请选择"
              style="width: 240px; text-align: center"
            >
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
              <el-button @click="handleCancle">取消</el-button>
              <el-button type="primary" @click="reSelectRole(roles)"> 确定 </el-button>
            </div>
          </template>
        </el-dialog>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { onMounted, ref } from 'vue'
import { getRoleOptions } from '@/utils/utils.js'
import {
  Management,
  CaretBottom,
  UserFilled,
  EditPen,
  SwitchButton,
  CircleCheck,
  Operation,
  Connection,
  Refresh,
  Timer,
} from '@element-plus/icons-vue'
import avatar from '@/assets/default.png'
import { userRoleSelect } from '@/api/login.js'
const router = useRouter()
//角色选择弹框
const roleDialogVisible = ref(false)
//角色的值
let roles = ref(null)
const options = ref([])

let roleName = ref('')
onMounted(() => {
  options.value = getRoleOptions()
  options.value = options.value.filter((item) => item.label !== '未知人员')
  roles.value = parseInt(localStorage.getItem('userRole'))
  if (localStorage.getItem('userRole') === '0') {
    roleName.value = '超级管理员'
  } else {
    roleName.value = '二级管理员'
    router.push('/admin/verifyCor')
  }

  // 这里可以执行获取数据等操作
})
//角色选择取消按钮
const handleCancle = () => {
  roleDialogVisible.value = false
  roles.value = parseInt(localStorage.getItem('userRole'))
}
//角色选择确认按钮事件
const reSelectRole = async (roles) => {
  console.log(roles) //1
  if (localStorage.getItem('userRole') == roles) {
    ElMessage.info('跳转角色与当前角色相同，无需切换')
    console.log('角色相同')
  } else {
    console.log(roles)
    const Newdata = await userRoleSelect({ role: roles })
    const token = Newdata.data.data
    localStorage.setItem('userRole', roles)
    localStorage.setItem('token', token)
    if (roles == 1) {
      router.push('/admin')
    } else {
      router.push('/user')
    }
    // roleDialogVisible.value = false
  }
}
// 根据右上角用户图标点击项进行跳转
const handleCommand = (key) => {
  if (key === 'logout') {
    router.push('/login')
    localStorage.removeItem('token')
    localStorage.removeItem('userRole')
    localStorage.removeItem('role')
    localStorage.removeItem('roles')
  }
  // if (key !== 'logout') {
  //   router.push(`/${key}`)
  // }
}
</script>

<style lang="scss" scoped>
.layout-container {
  height: 100vh;
  .el-aside {
    width: 270px;
    background-color: #005767;
    // &为引用父选择器
    &__logo {
      height: 120px;
      background: url('@/assets/logo4.png') no-repeat center / 240px auto;
    }
    .el-menu {
      border-right: none;
    }
  }
  .el-header {
    background-color: #fff;
    height: 70px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    .el-dropdown__box {
      display: flex;
      align-items: center;
      .el-icon {
        color: #999;
        margin-left: 10px;
      }

      &:active,
      &:focus {
        outline: none;
      }
    }
  }
  .el-main {
    background-color: #eeeeee;
  }
  .choiceRole {
    margin-right: 20px;
    margin-top: 5px;
  }
}
</style>
