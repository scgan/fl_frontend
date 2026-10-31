<script setup>
import { getDatabaseService } from '@/api/collector'
import { ref } from 'vue'

const props = defineProps({
  modelValue: {
    type: [Number, String, Array],
  },
})
const emit = defineEmits(['update:modelValue', 'updateNow'])

function transformData(data) {
  return data.map((department) => {
    return {
      label: department.database_name,
      value: department.id,
      children:
        Array.isArray(department.children) && department.children.length > 0
          ? transformData(department.children)
          : [],
    }
  })
}
const options = ref([])
const deepClone = (root) => {
  let children = root.children
  for (let child of children) {
    child.totalLabel = root.totalLabel + '|' + child.label
    deepClone(child)
  }
}

const getDatabase = async () => {
  const res2 = await getDatabaseService()
  options.value = transformData(res2.data.data)
  for (let i = 0; i < options.value.length; i++) {
    options.value[i].totalLabel = options.value[i].label
    deepClone(options.value[i])
  }
}
getDatabase()
const renderContent = (h, { data }) => {
  return h('span', data.label)
}

/* ---------------- 下拉面板高度：按选择框下方剩余空间动态计算 ---------------- */
const selectRef = ref(null)

/** 打开面板时计算可用高度，写入 CSS 变量，保证向下展开且不超出视口 */
const handleVisibleChange = (visible) => {
  if (!visible) return
  requestAnimationFrame(() => {
    const root = selectRef.value?.$el
    const rect = root?.getBoundingClientRect?.()
    const bottom = rect?.bottom ?? window.innerHeight / 2
    const available = window.innerHeight - bottom - 24 // 留 24px 底部余量
    const max = Math.max(200, Math.min(available, 620))
    document.documentElement.style.setProperty('--db-panel-max', `${Math.floor(max)}px`)
  })
}
</script>

<template>
  <el-tree-select
    ref="selectRef"
    :modelValue="modelValue"
    @update:modelValue="emit('update:modelValue', $event)"
    placeholder="请选择数据库"
    clearable
    :data="options"
    check-strictly
    :render-after-expand="false"
    :render-content="renderContent"
    :props="{ children: 'children', label: 'totalLabel', value: 'value' }"
    style="width: 100%"
    default-expand-all
    show-checkbox
    multiple
    popper-class="full-height-tree-dropdown"
    placement="bottom-start"
    :popper-options="{ modifiers: [{ name: 'flip', enabled: false }] }"
    @visible-change="handleVisibleChange"
  />
</template>

<style>
/*
 * 下拉面板：高度上限由选择框下方剩余空间决定（--db-panel-max 由 handleVisibleChange 计算），
 * 始终向下展开、不超出视口；内容超高时在面板内部滚动。
 */
.full-height-tree-dropdown {
  max-height: var(--db-panel-max, 420px) !important;
  overflow: hidden !important;
}

.full-height-tree-dropdown .el-select-dropdown__wrap,
.full-height-tree-dropdown .el-scrollbar,
.full-height-tree-dropdown .el-scrollbar__wrap {
  max-height: var(--db-panel-max, 400px) !important;
  overflow-y: auto !important;
}

.full-height-tree-dropdown .el-tree {
  height: auto !important;
  max-height: none !important;
  overflow: visible !important;
}

/* 滚动条样式优化 */
.full-height-tree-dropdown .el-scrollbar__bar {
  display: block !important;
}

.full-height-tree-dropdown .el-scrollbar__thumb {
  background-color: #c1c1c1 !important;
}

.full-height-tree-dropdown .el-scrollbar__thumb:hover {
  background-color: #a8a8a8 !important;
}
</style>
