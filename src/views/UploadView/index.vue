<!-- 数据收集者业务布局及菜单；智能体统一进入工作台，在顶部选择数据库。 -->
<template>
  <el-container class="layout-container">
    <el-aside :width="collapsed ? '64px' : '270px'" :class="{ 'el-aside--collapsed': collapsed }">
      <div class="el-aside__logo">
        <!-- 折叠时只保留占位高度，不显示 logo -->
        <img
          v-if="!collapsed"
          class="logo-img"
          src="@/assets/logo-wenchang-white.png"
          alt="文昌 · 中国教育国际传播数据库"
        />
      </div>
      <el-menu
        :collapse="collapsed"
        :collapse-transition="false"
        active-text-color="#ffd04b"
        background-color="#0b6375"
        :default-active="activeMenu"
        :default-openeds="menuOpeneds"
        text-color="#d5e5e8"
        router
        @open="rememberOpenedMenu"
        @close="forgetOpenedMenu"
      >
                <el-menu-item index="/user/home">
          <el-icon><HomeFilled /></el-icon>
          <template #title><span>关于我们</span></template>
        </el-menu-item>
        <!-- 文献统计：暂时从菜单隐藏（路由 /user/count 仍可访问），后续需要时取消注释即可 -->
        <!-- <el-menu-item index="/user/count">
          <el-icon><Crop /></el-icon>
          <template #title><span>文献统计</span></template>
        </el-menu-item> -->

        <!-- 文昌 · 知识库：三个主题库 + 术语库 -->
        <el-sub-menu index="knowledge">
          <template #title>
            <el-icon><Collection /></el-icon>
            <span>文昌 · 知识库</span>
          </template>
          <el-menu-item v-for="db in databaseMenu" :key="db.database_id" :index="`/user/database/${db.database_id}`">
            <template #title>
              <span class="menu-name-ellipsis" :title="db.label">{{ db.label }}</span>
            </template>
          </el-menu-item>
          <el-menu-item v-if="!databaseMenu.length" index="/user/database/0" disabled>
            <template #title><span>暂无主题库</span></template>
          </el-menu-item>
          <el-sub-menu index="knowledge-term">
            <template #title><span>术语库</span></template>
            <el-menu-item index="/user/term-search">
              <template #title><span>术语查找</span></template>
            </el-menu-item>
            <el-menu-item index="/user/term-upload">
              <template #title><span>术语上传</span></template>
            </el-menu-item>
          </el-sub-menu>
        </el-sub-menu>

        <!-- 文昌 · 智能体：八个能力 -->
        <el-sub-menu index="agent">
          <template #title>
            <el-icon><Reading /></el-icon>
            <span>文昌 · 智能体</span>
          </template>
          <el-menu-item index="/agent">
            <template #title><span>通用智答</span></template>
          </el-menu-item>
          <el-menu-item index="/user/literature-detail">
            <template #title><span>文献智询</span></template>
          </el-menu-item>
          <el-menu-item index="/user/agent/qiming">
            <template #title><span>库源智答</span></template>
          </el-menu-item>
          <el-menu-item index="/user/agent/suzhi">
            <template #title><span>综览撰述</span></template>
          </el-menu-item>
          <el-menu-item index="/user/agent/zhijian">
            <template #title><span>文献比对</span></template>
          </el-menu-item>

          <el-menu-item index="/user/writing">
            <template #title><span>文稿辅撰</span></template>
          </el-menu-item>
          <el-menu-item index="/user/translate">
            <template #title><span>文献译介</span></template>
          </el-menu-item>          <el-menu-item index="/user/draw">
            <template #title><span>时序脉络</span></template>
          </el-menu-item>
        </el-sub-menu>

        <!-- 全局搜索 / 我的知识库：一级菜单 -->
        <el-menu-item index="/user/search">
          <el-icon><Search /></el-icon>
          <template #title><span>全局搜索</span></template>
        </el-menu-item>
        <el-menu-item index="/user/knowledge-bases">
          <el-icon><Files /></el-icon>
          <template #title><span>我的知识库</span></template>
        </el-menu-item>

        <!-- 管理工作台 -->
        <el-sub-menu index="workspace">
          <template #title>
            <el-icon><Management /></el-icon>
            <span>管理工作台</span>
          </template>
          <el-sub-menu index="upload">
            <template #title><span>数据上传</span></template>
            <el-menu-item index="/user/aiExtract">
              <template #title><span>大模型提取</span></template>
            </el-menu-item>
            <el-menu-item index="/user/quickUpload">
              <template #title><span>快速录入</span></template>
            </el-menu-item>
            <el-menu-item index="/user/upload">
              <template #title><span>文献上传</span></template>
            </el-menu-item>
          </el-sub-menu>
          <el-menu-item index="/user/paper">
            <template #title><span>文献管理</span></template>
          </el-menu-item>
          <el-menu-item index="/user/rank">
            <template #title><span>上传排名</span></template>
          </el-menu-item>
          <el-menu-item index="/user/change">
            <template #title><span>修改信息</span></template>
          </el-menu-item>
        </el-sub-menu>

        <!-- 新增部分上限 -->
        <!--

        <el-sub-menu index="/">
          <template #title>
            <el-icon><UserFilled /></el-icon>
            <span>人员管理</span>
          </template>
          <el-menu-item index="/approval">
            <el-icon><CircleCheck /></el-icon>
            <span>注册审批</span>
          </el-menu-item>
          <el-menu-item index="/staff">
              <span>员工管理</span>
          </el-menu-item>
          <el-menu-item index="/history">
            <el-icon><Connection /></el-icon>
            <span>历史分数</span>
          </el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="/card-info">
          <template #title>
            <el-icon><Clock /></el-icon>
            <span>打卡管理</span>
          </template>
          <el-menu-item index="/card-info">
              <span>打卡管理</span>
          </el-menu-item>
          <el-menu-item index="/count">
            <el-icon><Crop /></el-icon>
            <span>打卡统计</span>
          </el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="/reward">
          <template #title>
            <el-icon><Menu /></el-icon>
            <span>奖惩管理</span>
          </template>
          <el-menu-item index="/rapproval">
            <el-icon><Finished /></el-icon>
            <span>奖惩审核</span>
          </el-menu-item>
          <el-menu-item index="/reward">
            <el-icon><Star /></el-icon>
            <span>奖惩信息</span>
          </el-menu-item>
          <el-menu-item index="/complain">
            <el-icon><Service /></el-icon>
            <span>申诉信息</span>
          </el-menu-item>
          <el-menu-item index="/rcount">
            <el-icon><Operation /></el-icon>
            <span>奖惩统计</span>
          </el-menu-item>
          <el-menu-item index="/rule">
            <el-icon><Edit /></el-icon>
            <span>奖惩细则</span>
          </el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="/task">
          <template #title>
            <el-icon><Calendar /></el-icon>
            <span>勤务管理</span>
          </template>
          <el-menu-item index="/temp">
            <el-icon><Checked /></el-icon>
            <span>临时勤务</span>
          </el-menu-item>
          <el-menu-item index="/tcount">
            <el-icon><Compass /></el-icon>
            <span>勤务统计</span>
          </el-menu-item>
          <el-menu-item index="/task">
            <el-icon><List /></el-icon>
            <span>日常排班</span>
          </el-menu-item>
        </el-sub-menu>

        <el-menu-item index="/password">
          <el-icon><Refresh /></el-icon>
          <span>修改密码</span>
        </el-menu-item> -->
      </el-menu>
    </el-aside>
    <el-container :style="{ '--aside-width': collapsed ? '64px' : '270px' }">
      <!-- 顶部热区：鼠标移动到顶部时下拉显示顶栏 -->
      <div v-if="isDashboard" class="header-hotzone" @mouseenter="showHeader" />
      <el-header
        :class="{ 'is-visible': headerVisible || !isDashboard, 'el-header--static': !isDashboard }"
        @mouseenter="showHeader"
        @mouseleave="hideHeader"
      >
        <div class="header-left">
          <!-- 侧边栏折叠/展开 -->
          <el-tooltip
            :content="collapsed ? '展开侧边栏' : '收起侧边栏'"
            placement="bottom"
            :show-after="300"
          >
            <button type="button" class="collapse-btn" @click="toggleCollapse">
              <el-icon>
                <Expand v-if="collapsed" />
                <Fold v-else />
              </el-icon>
            </button>
          </el-tooltip>
          <!-- 当前页面的标题：跟随菜单切换 -->
          <span v-if="pageTitle" class="page-title">{{ pageTitle }}</span>
        </div>
        <div>
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
                <el-dropdown-item
                  v-if="roles != 0"
                  command="switchRole"
                  :icon="Refresh"
                  >切换角色</el-dropdown-item
                >
                <el-dropdown-item command="logout" :icon="SwitchButton">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
      <el-main>
        <!-- 缓存各业务页：从智能体 / ai问答 等外部页面返回时保留切换前的页面状态 -->
        <router-view v-slot="{ Component }">
          <keep-alive :max="10">
            <component :is="Component" />
          </keep-alive>
        </router-view>
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
import {
  Management,
  CaretBottom,
  // Promotion, // 菜单不再使用
  //   UserFilled,
  Search,
  // Crop, // 文献统计菜单暂时隐藏后不再使用
  // EditPen, // 菜单不再使用
  SwitchButton,
  //   CaretBottom,
  //   Clock,
  //   CircleCheck,
  //   Calendar,
  //   List,
  //   Checked,
  //   Service,
  //   Finished,
  //   Menu,
  //   Star,
  //   Operation,
  //   Connection,
  Refresh,
  Collection,
  //   Edit,
  //   Compass,
  Files,
  HomeFilled,
  Fold,
  Expand,
} from '@element-plus/icons-vue'
import { Reading } from '@element-plus/icons-vue'
import avatar from '@/assets/default.png'
import { userRoleSelect } from '@/api/login.js'
import { getRoleOptions } from '@/utils/utils.js'
import { getDatabaseRootsService } from '@/api/public'
import { useRoute, useRouter } from 'vue-router'
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

const route = useRoute()
// 子路径（如 AI 对话 /agent/c/:id、/user/agent/qiming/conversations/:id）也要高亮对应的一级菜单
/** 顶栏可隐藏：默认收起，鼠标移到顶部热区或顶栏上时下拉出现 */
const headerVisible = ref(false)
let headerTimer = null
function showHeader() {
  if (headerTimer) window.clearTimeout(headerTimer)
  headerTimer = null
  headerVisible.value = true
}
function hideHeader() {
  if (headerTimer) window.clearTimeout(headerTimer)
  headerTimer = window.setTimeout(() => {
    headerVisible.value = false
  }, 320)
}

/**
 * 首页（数据看板）按展示模式呈现：隐藏顶部栏，让图表占满整屏
 */
const isDashboard = computed(() => ['/user/home', '/user/home-realtime'].includes(route.path))

const activeMenu = computed(() => {
  const path = route.path
  if (path.startsWith('/agent')) return '/agent'
  if (path.startsWith('/user/knowledge-bases')) return '/user/knowledge-bases'
  if (path.startsWith('/user/database')) return path
  // 智能体子路径（会话详情 / 运行详情）回到对应的菜单项
  const agentHit = ['/user/agent/qiming', '/user/agent/suzhi', '/user/agent/zhijian'].find((item) =>
    path.startsWith(item),
  )
  if (agentHit) return agentHit
  return path
})

/* 各页面的标题统一放在顶部栏，切换菜单时跟随路由变化 */
const PAGE_TITLES = {
  '/user/home': '关于我们',
  '/user/home-realtime': '首页（实时数据）',
  '/user/count': '文献统计',
  '/user/upload': '文献上传',
  '/user/aiExtract': '大模型提取',
  '/user/quickUpload': '快速录入',
  '/user/term-search': '术语查找',
  '/user/term-upload': '术语上传',
  '/user/paper': '文献管理',
  '/user/search': '全局搜索',
  '/user/knowledge-bases': '我的知识库',
  '/user/database': '数据库文献',
  '/user/literature-detail': '文献智询',
  '/user/agent/qiming': '库源智答',
  '/user/agent/suzhi': '综览撰述',
  '/user/agent/zhijian': '文献比对',
  '/user/writing': '文稿辅撰',
  '/user/translate': '文献译介',
  '/user/draw': '时序脉络',
  '/user/rank': '上传排名',
  '/user/change': '修改信息',
  '/agent': '通用智答',
  '/visualizeAnalysis': '文献可视化分析',
}

/**
 * 侧边栏「知识库 · 数据库」的动态子项：取公开接口返回的根主题库。
 * 取不到时保持为空，菜单只显示"暂无主题库"，不影响其他菜单项。
 */
const rootDatabases = ref([])

/** 侧边栏三个固定命名的数据库入口（按名称关键词匹配，匹配不到时按顺序兜底） */
const DATABASE_MENU_NAMES = ['中外教育政策数据库', '中外教育思想数据库', '中国外语教育数据库']
/**
 * 侧边栏展示顺序（按真实库名关键词判定，与接口返回顺序、标签匹配结果都无关）：
 * 中外教育政策数据库 → 中外教育思想数据库 → 中国外语教育数据库
 */
const databaseRank = (rawName = '') => {
  if (rawName.includes('政策')) return 0
  if (rawName.includes('思想')) return 1
  if (rawName.includes('外语')) return 2
  return 9
}
const databaseMenu = computed(() =>
  rootDatabases.value
    .slice(0, 3)
    .map((db, index) => {
      const matched = DATABASE_MENU_NAMES.find((name) => {
        if (name.includes('政策')) return db.database_name.includes('政策')
        if (name.includes('思想')) return db.database_name.includes('思想')
        return db.database_name.includes('外语')
      })
      return {
        ...db,
        label: matched || DATABASE_MENU_NAMES[index] || db.database_name,
        rank: databaseRank(db.database_name),
      }
    })
    .sort((a, b) => a.rank - b.rank),
)
const loadRootDatabases = async () => {
  try {
    const res = await getDatabaseRootsService()
    const list = res?.data?.data || []
    rootDatabases.value = Array.isArray(list) ? list : []
  } catch {
    rootDatabases.value = []
  }
}

const pageTitle = computed(() => {
  const path = route.path
  if (path.startsWith('/user/knowledge-bases/')) return '知识库详情'
  if (PAGE_TITLES[path]) return PAGE_TITLES[path]
  // 兜底：按最长匹配的前缀取标题
  const hit = Object.keys(PAGE_TITLES)
    .filter((key) => path.startsWith(key))
    .sort((a, b) => b.length - a.length)[0]
  return hit ? PAGE_TITLES[hit] : ''
})

/* 记住主界面最后一次停留的业务页（含查询参数），供其他界面「返回」时精确回到原位置 */
const LAST_PATH_KEY = 'layout.lastUserPath'
watch(
  () => route.fullPath,
  (fullPath) => {
    if (fullPath.startsWith('/user')) localStorage.setItem(LAST_PATH_KEY, fullPath)
  },
  { immediate: true },
)

/* ---------------- 侧边栏折叠 / 展开 ---------------- */

// 记住折叠状态：刷新或切换页面后保持用户的选择
const SIDEBAR_KEY = 'layout.sidebarCollapsed'
const collapsed = ref(localStorage.getItem(SIDEBAR_KEY) === '1')

const toggleCollapse = () => {
  collapsed.value = !collapsed.value
  localStorage.setItem(SIDEBAR_KEY, collapsed.value ? '1' : '0')
}

/* 记住展开的分组菜单（数据上传 / 术语库），从其他页面返回时保持原样 */
const OPENED_KEY = 'layout.openedMenus'
function readOpenedMenus() {
  try {
    const saved = JSON.parse(localStorage.getItem(OPENED_KEY) || '[]')
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}
const openedMenus = ref(readOpenedMenus())

/** 当前路由所属的父级菜单：进入子页面时自动展开对应分组，避免"看不到自己在哪"。 */
const autoOpenedMenus = computed(() => {
  const path = route.path
  const parents = []
  if (path.startsWith('/user/database') || path.startsWith('/user/term-') || path.startsWith('/user/knowledge-bases')) {
    parents.push('knowledge')
    if (path.startsWith('/user/term-')) parents.push('knowledge-term')
  }
  if (path.startsWith('/user/agent') || path === '/agent' || path === '/user/literature-detail' || path === '/user/draw' || path === '/user/translate' || path === '/user/writing') {
    parents.push('agent')
  }
  if (path.startsWith('/user/aiExtract') || path.startsWith('/user/quickUpload') || path === '/user/upload') {
    parents.push('upload')
  }
  return parents
})

const menuOpeneds = computed(() => [...new Set([...openedMenus.value, ...autoOpenedMenus.value])])

function rememberOpenedMenu(index) {
  if (!openedMenus.value.includes(index)) {
    openedMenus.value = [...openedMenus.value, index]
    localStorage.setItem(OPENED_KEY, JSON.stringify(openedMenus.value))
  }
}

function forgetOpenedMenu(index) {
  openedMenus.value = openedMenus.value.filter((item) => item !== index)
  localStorage.setItem(OPENED_KEY, JSON.stringify(openedMenus.value))
}
//角色选择弹框
const roleDialogVisible = ref(null)
//角色的值
let roles = ref(null)
const options = ref([])

const router = useRouter()
onMounted(() => {
  loadRootDatabases()
  options.value = getRoleOptions()
  options.value = options.value.filter((item) => item.label !== '未知人员')
  console.log(options.value)
  // options.value.shift()
  roles.value = parseInt(localStorage.getItem('userRole'))
})
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
  // 切换角色：打开角色选择弹窗，不参与路由跳转
  if (key === 'switchRole') {
    roleDialogVisible.value = true
    return
  }
  if (key === 'logout') {
    router.push('/login')
    localStorage.removeItem('token')
    localStorage.removeItem('userRole')
    return
  }
  router.push(`/user/${key}`)
}
</script>

<style lang="scss" scoped>
.layout-container {
  height: 100vh;
  .el-aside {
    display: flex;
    flex-direction: column;
    /* 与智能体研究界面侧边栏同色（--nav-bg: #0b6375） */
    background-color: #0b6375;
    overflow: hidden; /* 只让菜单区滚动，logo 固定在顶部 */
    transition: width 0.2s ease;
    // &为引用父选择器
    &__logo {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0;
      height: auto;
      min-height: 96px;
      flex: 0 0 auto;
      /* 顶部留白多一点、下沿与菜单之间留出间距 */
      padding: 22px 10px 16px;
      margin-bottom: 14px;
      text-align: center;
      transition: height 0.2s ease;

      /* 中文主标题：宋体系衬线，学术气质，和深青底色更贴 */
      .logo-img {
        display: block;
        width: 100%;
        max-width: 150px;
        height: auto;
        object-fit: contain;
      }

      .logo-cn {
        display: block;
        color: #fff;
        font-family: 'Songti SC', 'STSong', 'Source Han Serif SC', 'Noto Serif SC', serif;
        font-size: 18px;
        font-weight: 700;
        letter-spacing: 1px;
        line-height: 1.6;
        /* 智能体页面会给 body 设 font-synthesis: none，这里显式恢复，避免字形变细变小 */
        font-synthesis: weight;
        -webkit-font-smoothing: antialiased;
        white-space: normal;
        word-break: keep-all;
      }

      .logo-cn b {
        color: #ffd04b;
        font-size: 1.45em;
        font-weight: 700;
        letter-spacing: 2px;
        font-synthesis: weight;
        vertical-align: -0.06em;
      }

      .logo-cn i {
        margin: 0 2px;
        color: rgba(255, 255, 255, 0.55);
        font-style: normal;
      }

}
    .el-menu {
      flex: 1 1 auto;
      min-height: 0;
      overflow-x: hidden;
      overflow-y: auto;
      border-right: none;
      --el-menu-hover-bg-color: rgba(255, 255, 255, 0.1);

      /* 与智能体研究侧边栏一致的悬停/选中底色（白色 10% / 12%） */
      :deep(.el-menu-item:hover),
      :deep(.el-sub-menu__title:hover) {
        background-color: rgba(255, 255, 255, 0.1);
      }

      :deep(.el-menu-item.is-active) {
        background-color: rgba(255, 255, 255, 0.12);
        font-weight: 600;
      }

      /* 层级缩进：以上级菜单「文字」起点为基准逐级右移，让上下级关系更明显
         一级文字起点 ≈ 20px(基础内边距) + 24px(图标宽度) = 44px */
      :deep(.el-menu--inline > .el-menu-item),
      :deep(.el-menu--inline > .el-sub-menu > .el-sub-menu__title) {
        padding-left: 58px !important;
      }

      /* 三级（例如 知识库 › 数据库 › 具体主题库） */
      :deep(.el-menu--inline > .el-sub-menu > .el-menu--inline > .el-menu-item) {
        padding-left: 78px !important;
      }

      /* 细滚动条：平时几乎透明，只在悬停菜单时略微显现 */
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, 0.18) transparent;

      &::-webkit-scrollbar {
        width: 6px;
      }

      &::-webkit-scrollbar-track {
        background: transparent;
      }

      &::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.14);
        border-radius: 999px;
      }

      &:hover::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.3);
      }

      &::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.45);
      }
    }

    /* 数据库名过长时以省略号收尾，悬停可看全称 */
    .menu-name-ellipsis {
      display: block;
      max-width: 158px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    /* 折叠态：只留「育」字标记，菜单只留图标（hover 出文字提示） */
    &--collapsed {
      .el-aside__logo {
        height: 64px;
        min-height: 64px;
        padding: 0;
        margin-bottom: 8px;
      }
    }
  }
  /* 顶部热区：贴着窗口顶部的一条透明区域 */
  .header-hotzone {
    position: absolute;
    top: 0;
    left: var(--aside-width, 270px);
    right: 0;
    height: 12px;
    z-index: 21;
  }

  /* 首页展开态：高度恢复，占据文档流高度把内容往下推 */
  .el-header.is-visible {
    height: 46px;
    min-height: 46px;
    padding: 0 18px;
    opacity: 1;
    border-bottom: 1px solid #eef1f4;
  }

  /* 非首页：常显顶栏 */
  .el-header--static {
    height: 46px;
    min-height: 46px;
    padding: 0 18px;
    opacity: 1;
    border-bottom: 1px solid #eef1f4;
  }

  .el-header {
    /* 可隐藏：仍在文档流中，通过高度 0 ↔ 46px 展开/收起，出现时挤压内容而不是遮挡 */
    position: relative;
    z-index: 20;
    overflow: hidden;
    height: 0;
    min-height: 0;
    padding: 0;
    opacity: 0;
    transition:
      height 0.22s ease,
      opacity 0.18s ease,
      padding 0.22s ease;
    background-color: #fff;
    display: flex;
    align-items: center;
    justify-content: space-between;


    .header-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    /* 顶部栏里的页面标题：与折叠按钮同一行，切换菜单时替换 */
    .page-title {
      display: inline-flex;
      align-items: center;
      padding-left: 14px;
      border-left: 1px solid #e4e8ee;
      color: #143437;
      font-size: 15px;
      font-weight: 600;
      line-height: 1;
      letter-spacing: 0.2px;
      white-space: nowrap;
    }
    .collapse-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      padding: 0;
      font-size: 18px;
      color: #005767;
      cursor: pointer;
      background: rgba(0, 87, 103, 0.08); /* 内部填色：淡一档的主题色 */
      border: 1px solid rgba(0, 87, 103, 0.35);
      border-radius: 8px;
      transition:
        background-color 0.2s,
        border-color 0.2s,
        transform 0.1s;

      &:hover {
        background: rgba(0, 87, 103, 0.16);
        border-color: #005767;
      }

      &:active {
        transform: scale(0.94);
      }

      &:focus-visible {
        outline: 2px solid rgba(0, 87, 103, 0.5);
        outline-offset: 2px;
      }
    }
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
    /* 内容区与顶栏、两侧的间距收窄（Element 默认 20px 偏大） */
    padding: 10px 12px 14px;
  }
}
</style>
