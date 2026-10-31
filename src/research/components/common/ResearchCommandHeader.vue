<!--
  智能研究模块的共享顶部栏：统一模块身份、知识库、主操作和运行状态的布局、高度与响应式规则。
-->
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

interface ResearchCommandHeaderProps {
  /** 模块在顶部栏展示的中文名称。 */
  title: string
  /** 模块名称下方的能力说明或英文副标题。 */
  subtitle: string
  /** 模块强调色，用于图标框和运行中状态。 */
  accent?: string
  /** 最右侧展示的当前运行状态；为空时不渲染状态区。 */
  statusLabel?: string
  /** 当前模块是否正在运行。 */
  statusActive?: boolean
}

withDefaults(defineProps<ResearchCommandHeaderProps>(), {
  accent: '#005767',
  statusLabel: '',
  statusActive: false,
})

// 嵌入主界面时（route.meta.embed）：不显示模块图标与标题，控件整体左移并压低顶部栏高度
const route = useRoute()
const embedded = computed(() => route.meta?.embed === true)
</script>

<template>
  <header
    class="research-command-header"
    :class="{ 'is-embedded': embedded }"
    :style="{ '--research-command-accent': accent }"
  >
    <div v-if="!embedded" class="research-command-identity">
      <span class="research-command-mark"><slot name="icon" /></span>
      <div>
        <h1>{{ title }}</h1>
        <p>{{ subtitle }}</p>
      </div>
    </div>
    <div class="research-command-knowledge">
      <slot name="knowledge" />
    </div>
    <div class="research-command-primary">
      <slot name="primary" />
    </div>
    <div v-if="statusLabel" class="research-command-status">
      <i :class="{ active: statusActive }" />
      <span>{{ statusLabel }}</span>
    </div>
  </header>
</template>

<style scoped>
.research-command-header {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  height: 96px;
  min-height: 96px;
  display: grid;
  grid-template-columns: 240px 220px minmax(360px, 1fr) auto;
  gap: 16px;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 1px solid #d8e1ea;
  background: #fff;
}

/* 嵌入主界面：去掉模块身份区后控件左移，并压缩高度，让下方输入区完整露出 */
.research-command-header.is-embedded {
  height: 68px;
  min-height: 68px;
  padding: 8px 20px;
  grid-template-columns: 220px minmax(320px, 1fr) auto;
  gap: 12px;
}

.research-command-header > * {
  min-width: 0;
}

.research-command-identity {
  display: flex;
  align-items: center;
  gap: 12px;
}

.research-command-mark {
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border: 1px solid var(--research-command-accent);
  color: var(--research-command-accent);
  font-size: 22px;
}

.research-command-identity h1 {
  margin: 0;
  color: #102a43;
  font: 600 20px/1.1 -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
}

.research-command-identity p {
  margin: 5px 0 0;
  overflow: hidden;
  color: #7c8da1;
  font-size: 9px;
  line-height: 1.25;
  letter-spacing: .06em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.research-command-knowledge,
.research-command-primary {
  min-width: 0;
}

.research-command-knowledge :deep(.el-select),
.research-command-primary :deep(.el-select) {
  width: 100%;
}

.research-command-knowledge :deep(.el-select__wrapper),
.research-command-primary :deep(.el-select__wrapper) {
  min-height: 46px;
  border-radius: 2px;
}

.research-command-status {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  color: #60758a;
  font-size: 11px;
  white-space: nowrap;
}

.research-command-status i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #94a3b1;
}

.research-command-status i.active {
  background: var(--research-command-accent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--research-command-accent) 12%, transparent);
}

@container (max-width: 1000px) {
  .research-command-header {
    height: auto;
    grid-template-columns: 220px minmax(180px, 1fr) auto;
    gap: 12px;
    padding-inline: 16px;
  }

  .research-command-primary {
    grid-column: 1 / -1;
  }

  .research-command-status {
    grid-column: 3;
    grid-row: 1;
  }
}

@container (max-width: 620px) {
  .research-command-header {
    grid-template-columns: minmax(0, 1fr);
    padding: 14px;
  }

  .research-command-primary,
  .research-command-status {
    grid-column: 1;
    grid-row: auto;
  }

  .research-command-status {
    justify-content: flex-start;
  }
}
</style>
