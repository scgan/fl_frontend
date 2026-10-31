<template>
  <div class="reset-password-container">
    <el-card>
      <!-- <div class="header-info" v-if="roleName">
        <h3>当前角色: {{ roleName }}</h3>
      </div> -->

      <!-- 搜索区域 -->
      <div class="search-box">
        <el-input
          v-model="searchName"
          placeholder="请输入用户姓名进行搜索"
          clearable
          style="width: 300px; margin-right: 15px;"
          @keyup.enter="handleSearch"
        />
        <el-button type="primary" @click="handleSearch">
          搜索
        </el-button>
        <el-button @click="handleReset">
          重置
        </el-button>
      </div>

      <div class="container">
        <el-table :data="userList" @selection-change="handleSelectionChange">
          <el-table-column label="序号" width="80" align="center">
            <template #default="{ $index }">
              {{ ($index + 1) + (pagination.currentPage - 1) * pagination.pageSize }}
            </template>
          </el-table-column>
          <el-table-column label="用户名" prop="username" show-overflow-tooltip align="center"></el-table-column>
          <el-table-column label="姓名" prop="name" show-overflow-tooltip align="center"></el-table-column>
          <el-table-column label="邮箱" prop="email" show-overflow-tooltip align="center"></el-table-column>
          <el-table-column label="手机号" prop="phone" show-overflow-tooltip align="center"></el-table-column>
          <el-table-column label="操作" align="center" width="200">
            <template #default="{ row }">
              <el-button
                type="text"
                icon="el-icon-refresh-left"
                @click="handleResetPassword(row)"
              >
                重置密码
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 分页 -->
      <div class="footer">
        <el-pagination
          @size-change="handleSizeChange"
          background
          layout="total,sizes,prev,pager,next, jumper"
          v-model:current-page="pagination.currentPage"
          :page-sizes="[10, 20, 50, 100]"
          :page-size="pagination.pageSize"
          @current-change="handleCurrentChange"
          :hide-on-single-page="false"
          :total="total">
        </el-pagination>
      </div>
    </el-card>

    <!-- 显示重置成功后的信息 -->
    <el-alert
      v-if="resetResult.message"
      :title="resetResult.message"
      :type="resetResult.success ? 'success' : 'error'"
      :closable="true"
      @close="resetResult.message = ''"
      show-icon
      style="margin-top: 20px;"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getAdminUserList, resetUserPassword,getSubUsersService } from '@/api/admin'
import { getUserLeader, } from '@/api/collector'

const roleName = ref('')
const searchName = ref('') // 添加搜索姓名的响应式数据
const selectCategory = ref('')
const content = ref('')
const userList = ref([])
const multipleSelection = ref([])
const total = ref(0)
const resetResult = ref({
  message: '',
  success: false
})

const pagination = reactive({
  currentPage: 1,
  pageSize: 20
})

// 搜索处理方法
const handleSearch = () => {
  pagination.currentPage = 1 // 搜索时重置到第一页
  loadUserList()
}

// 重置搜索
const handleReset = () => {
  searchName.value = ''
  pagination.currentPage = 1
  loadUserList()
}

// 搜索用户
const searchUsers = async () => {
  const params = {
    page: pagination.currentPage,
    size: pagination.pageSize
  }

  if (selectCategory.value && content.value) {
    params[selectCategory.value] = content.value
  }

  await loadUserList(params)
}

// 刷新用户列表
const refreshUserList = () => {
  selectCategory.value = ''
  content.value = ''
  pagination.currentPage = 1
  loadUserList()
}

// 加载用户列表
const loadUserList = async (params = {}) => {
  try {
    // 设置默认分页参数
    const requestParams = {
      page_num: pagination.currentPage,
      page_size: pagination.pageSize,
      ...params
    }

    // 如果有搜索姓名，则添加到请求参数中
    if (searchName.value) {
      requestParams.name = searchName.value
    }

    // 获取当前用户的角色
    const userRole = localStorage.getItem('userRole')

    // 如果是超级管理员，获取所有用户；如果是二级管理员，获取下属用户
    if (userRole === '0') {
      // 超级管理员使用新的管理员接口获取用户列表
      const response = await getAdminUserList(requestParams)
      // 修正：根据实际响应结构提取数据
      // 响应结构：{ code: 200, data: { pages: 2, total: 27, users: [...] } }
      userList.value = Array.isArray(response.data.data.users) ? response.data.data.users : []
      total.value = response.data.data.total || userList.value.length
    } else {
      // 二级管理员获取自己的下属用户
      try {
        const subUsersResponse = await getSubUsersService(requestParams)
        userList.value = Array.isArray(subUsersResponse.data.data.data) ? subUsersResponse.data.data.data : []
        total.value = subUsersResponse.data.data.total || userList.value.length
      } catch (error) {
        console.error('获取下属用户失败:', error)
        ElMessage.error('获取下属用户失败')
        userList.value = []
        total.value = 0
      }
    }
  } catch (error) {
    console.error('获取用户列表失败:', error)
    ElMessage.error('获取用户列表失败')
    userList.value = []
    total.value = 0
  }
}

// 选择变更
const handleSelectionChange = (val) => {
  multipleSelection.value = val
}

// 重置密码处理
const handleResetPassword = async (user) => {
  try {
    await ElMessageBox.confirm(
      `确定要重置用户 "${user.username}" 的密码吗？`,
      '确认操作',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const response = await resetUserPassword({ user_id: user.id || user.user_id })

    resetResult.value = {
      message: `用户 "${user.username}" 的密码已重置为：${response.data.default_password}`,
      success: true
    }

    ElMessage.success(resetResult.value.message)

    // 重新加载用户列表以反映最新更改
    loadUserList()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('重置密码失败:', error)
      const errorMsg = error.response?.data?.message || '重置密码失败'
      resetResult.value = {
        message: errorMsg,
        success: false
      }
      ElMessage.error(errorMsg)
    }
  }
}

// 分页处理
const handleSizeChange = (size) => {
  pagination.pageSize = size
  pagination.currentPage = 1
  searchUsers()
}

const handleCurrentChange = (page) => {
  pagination.currentPage = page
  searchUsers()
}

onMounted(() => {
  // 获取当前用户的角色名称
  const userRole = localStorage.getItem('userRole')
  roleName.value = userRole === '0' ? '超级管理员' : '二级管理员'

  loadUserList()
})
</script>

<style scoped>
.reset-password-container {
  padding: 20px;
}

.header-info {
  margin-bottom: 20px;
  padding: 10px;
  background-color: #f0f9ff;
  border-radius: 4px;
  border-left: 4px solid #005767;
}

.search-box {
  margin-bottom: 20px;
  display: flex;
  align-items: center;
}

.handle-box {
  margin-bottom: 20px;
}

.handle-select {
  width: 120px;
}

.handle-input {
  width: 300px;
}

.mr10 {
  margin-right: 10px;
}

.container {
  margin-bottom: 20px;
}

.footer {
  display: flex;
  justify-content: center;
}
</style>
