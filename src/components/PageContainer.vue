<script setup>
// 页面标题统一显示在顶部栏（见 UploadView/index.vue 的 pageTitle），这里只保留页面卡片容器与右侧操作槽位
defineProps({
  // 仍保留 title 用于无障碍说明与后续扩展，不再渲染到页面内
  title: {
    required: true,
    type: String,
  },
  // 少数页面确实不需要顶部条时可置为 true
  hideHeader: {
    type: Boolean,
    default: false,
  },
})
</script>

<template>
  <el-card class="page-container" :aria-label="title">
    <!-- 只有传入 extra 插槽（页面操作按钮）时才渲染顶部条，且不再显示标题 -->
    <template v-if="!hideHeader && $slots.extra" #header>
      <div class="header">
        <div class="extra">
          <slot name="extra"></slot>
        </div>
      </div>
    </template>
    <slot></slot>
  </el-card>
</template>

<style lang="scss" scoped>
.page-container {
  min-height: 100%;
  box-sizing: border-box;

  /* 顶部条仅承载页面操作按钮（标题已上移到顶栏） */
  :deep(.el-card__header) {
    padding: 9px 16px;
    border-bottom: 1px solid #eef1f4;
    background: #fafbfc;
  }

  :deep(.el-card__body) {
    padding: 14px 16px 16px;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    min-height: 24px;
  }
}
</style>
