<!-- 统一四个智能研究模块的 Evidence 标题和右上角图标开关。 -->
<script setup lang="ts">
import { DArrowLeft, DArrowRight } from '@element-plus/icons-vue'
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  collapsed?: boolean
}>(), {
  collapsed: false,
})

const emit = defineEmits<{
  toggle: []
}>()

/** 根据面板状态提供明确的无障碍操作名称。 */
const actionLabel = computed(() => props.collapsed ? '显示证据栏' : '隐藏证据栏')
</script>

<template>
  <header class="evidence-panel-heading" :class="{ collapsed }">
    <div v-if="!collapsed">
      <p>EVIDENCE PANEL</p>
      <h2>证据与引用</h2>
    </div>
    <button
      type="button"
      :aria-label="actionLabel"
      :title="actionLabel"
      :aria-expanded="!collapsed"
      @click="emit('toggle')"
    >
      <el-icon><component :is="collapsed ? DArrowLeft : DArrowRight" /></el-icon>
    </button>
  </header>
</template>

<style scoped>
.evidence-panel-heading {
  min-height: 72px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 16px;
  border-bottom: 1px solid #d8e1ea;
  background: #fff;
}

.evidence-panel-heading p {
  margin: 0 0 5px;
  color: #005767;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .12em;
}

.evidence-panel-heading h2 {
  margin: 0;
  color: #102a43;
  font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 18px;
}

.evidence-panel-heading button {
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  padding: 0;
  border: 1px solid #bfd0df;
  border-radius: 6px;
  background: #fff;
  color: #005767;
  cursor: pointer;
}

.evidence-panel-heading button:hover {
  border-color: #005767;
  background: #eef5f6;
}

.evidence-panel-heading button:focus-visible {
  outline: 2px solid #005767;
  outline-offset: 2px;
}

.evidence-panel-heading.collapsed {
  height: 100%;
  min-height: 0;
  align-items: flex-start;
  justify-content: center;
  padding: 14px 6px;
  border-bottom: 0;
}
</style>
