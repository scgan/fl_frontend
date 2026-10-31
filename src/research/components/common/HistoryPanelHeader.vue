<!-- 统一智能研究工作台左侧历史栏的标题与贴边收起、恢复按钮。 -->
<script setup lang="ts">
import { DArrowLeft, DArrowRight } from '@element-plus/icons-vue'
import { computed } from 'vue'

interface HistoryPanelHeaderProps {
  /** 左栏是否处于仅保留恢复按钮的收起状态。 */
  collapsed?: boolean
  /** 当前研究模块显示在左栏顶部的标题。 */
  title?: string
}

const props = withDefaults(defineProps<HistoryPanelHeaderProps>(), {
  collapsed: false,
  title: '历史会话',
})

const emit = defineEmits<{
  toggle: []
}>()

/** 根据左栏状态提供明确的无障碍操作名称。 */
const actionLabel = computed(() => props.collapsed ? '显示研究历史栏' : '隐藏研究历史栏')
</script>

<template>
  <header class="history-panel-heading" :class="{ collapsed }">
    <div v-if="!collapsed">
      <p>RESEARCH HISTORY</p>
      <h2>{{ title }}</h2>
    </div>
    <button
      type="button"
      :aria-label="actionLabel"
      :title="actionLabel"
      :aria-expanded="!collapsed"
      @click="emit('toggle')"
    >
      <el-icon><component :is="collapsed ? DArrowRight : DArrowLeft" /></el-icon>
    </button>
  </header>
</template>

<style scoped>
.history-panel-heading { min-height: 72px; display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: -16px -11px 16px; padding: 13px 11px; border-bottom: 1px solid #d8e1ea; background: #f4f7fa; }
.history-panel-heading p { margin: 0 0 5px; color: #005767; font-size: 9px; font-weight: 800; letter-spacing: .12em; }
.history-panel-heading h2 { margin: 0; color: #102a43; font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; font-size: 18px; }
.history-panel-heading button { width: 30px; height: 30px; flex: 0 0 auto; display: grid; place-items: center; padding: 0; border: 1px solid #bfd0df; border-radius: 6px; background: #fff; color: #005767; cursor: pointer; }
.history-panel-heading button:hover { border-color: #005767; background: #eef5f6; }
.history-panel-heading button:focus-visible { outline: 2px solid #005767; outline-offset: 2px; }
.history-panel-heading.collapsed { height: 100%; min-height: 0; align-items: flex-start; justify-content: center; margin: 0; padding: 14px 6px; border-bottom: 0; }
</style>
