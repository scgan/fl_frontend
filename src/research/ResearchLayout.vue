<!-- 智能研究全屏布局：复用 Foreign 会话，呈现已开放的研究模块和返回业务入口。 -->
<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  ChatDotSquare,
  Collection,
  DataAnalysis,
  Expand,
  Fold,
  Reading,
} from '@element-plus/icons-vue'
import { useAuthStore } from './stores/auth'
import { getAccessToken, expireSession } from './api/session'
import { RONGTONG_UI_ENABLED } from './features'
import './styles/research.css'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
// 各类资源共享同一工作台，历史与模块跳转不再按入口拆分。
// 嵌入主界面时（路线 meta.embed = true）不渲染独立侧栏，只保留工作区骨架与样式
const embedded = computed(() => route.meta?.embed === true)
const rootPath = computed(() => '/database-research')
const workspaceTitle = computed(() => '智能体')
const menus = computed(() => [
  { path: `${rootPath.value}/qiming`, label: '库源智答', icon: ChatDotSquare },
  { path: `${rootPath.value}/zhijian`, label: '智鉴·比对分析', icon: DataAnalysis },
  { path: `${rootPath.value}/suzhi`, label: '溯知·文献综述', icon: Reading },
  ...(RONGTONG_UI_ENABLED ? [{ path: `${rootPath.value}/rongtong`, label: '融通·国际传播', icon: Collection }] : []),
])

/* 侧边栏收起/展开：只影响布局与样式，状态记在本地，刷新后保持 */
const SIDEBAR_KEY = 'research.sidebarCollapsed'
const collapsed = ref(localStorage.getItem(SIDEBAR_KEY) === '1')
function toggleCollapsed(): void {
  collapsed.value = !collapsed.value
  localStorage.setItem(SIDEBAR_KEY, collapsed.value ? '1' : '0')
}

/** 返回：回到主界面，并停留在离开前所在的业务页（页面状态由主布局的 keep-alive 保留）。 */
function goBack(): void {
  const last = localStorage.getItem('layout.lastUserPath')
  router.push(last && last.startsWith('/user') ? last : '/user/count')
}

/** 其他标签退出或切换身份后卸载旧页面及 SSE，重新执行入口权限检查。 */
function sessionChanged(event: StorageEvent): void {
  if (!event.key || ['token', 'userRole'].includes(event.key)) window.location.reload()
}
/** 退出整个 Foreign 会话，不留下研究独立登录状态。 */
function logout(): void { expireSession(getAccessToken()) }
onMounted(() => {
  document.body.classList.add('research-active')
  window.addEventListener('storage', sessionChanged)
})
onBeforeUnmount(() => {
  document.body.classList.remove('research-active')
  window.removeEventListener('storage', sessionChanged)
})
</script>

<template>
  <div class="workspace-shell research-shell" :class="{ 'is-collapsed': collapsed, 'is-embedded': embedded }">
    <aside v-if="!embedded" class="workspace-sidebar">
      <!-- 标题行：品牌 + 收起/展开按钮（收起后只保留该按钮图标） -->
      <div class="workspace-brand">
        <RouterLink class="brand-link" :to="`${rootPath}/qiming`" :title="collapsed ? workspaceTitle : undefined">
          <el-icon :size="26"><Collection /></el-icon><span>{{ workspaceTitle }}</span>
        </RouterLink>
        <el-tooltip :content="collapsed ? '展开侧边栏' : '收起侧边栏'" placement="bottom" :show-after="300">
          <button type="button" class="collapse-btn" aria-label="切换侧边栏" @click="toggleCollapsed">
            <el-icon><Expand v-if="collapsed" /><Fold v-else /></el-icon>
          </button>
        </el-tooltip>
      </div>

      <nav class="sidebar-navigation" aria-label="智能体导航">
        <button type="button" class="sidebar-home" :title="collapsed ? '返回' : undefined" @click="goBack"><el-icon><ArrowLeft /></el-icon><span>返回</span></button>
        <section class="menu-group">
          <h2>{{ workspaceTitle }}</h2>
          <RouterLink
            v-for="menu in menus"
            :key="menu.path"
            :to="menu.path"
            class="sidebar-link"
            :class="{ active: route.path === menu.path || route.path.startsWith(menu.path + '/') }"
            :title="collapsed ? menu.label : undefined"
          >
            <el-icon><component :is="menu.icon" /></el-icon><span>{{ menu.label }}</span>
          </RouterLink>
        </section>
      </nav>
      <el-dropdown trigger="click" placement="top-start">
        <button class="user-menu" type="button" :title="collapsed ? auth.displayName : undefined"><span class="user-identity"><strong>{{ auth.displayName }}</strong><small>数据收集者</small></span></button>
        <template #dropdown><el-dropdown-menu><el-dropdown-item @click="logout">退出登录</el-dropdown-item></el-dropdown-menu></template>
      </el-dropdown>
    </aside>
    <main class="workspace-main">
      <RouterView :key="rootPath" />
    </main>
  </div>
</template>

<style scoped>
.menu-group h2 { line-height: 1.7; overflow-wrap: anywhere; }
</style>
