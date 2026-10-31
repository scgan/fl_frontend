<!-- 四个研究模块共用的范围选择器：按全库、数据库、本人知识库分组展示带类型的资源。 -->
<script setup lang="ts">
import { computed } from 'vue'
import { Check, Coin, Collection, FolderOpened } from '@element-plus/icons-vue'
import type { KnowledgeBaseRecord } from '@/research/types/knowledge-bases'

const props = defineProps<{
  /** 带类型的范围键，数据库和知识库同号时也能区分。 */
  modelValue: string
  /** 当前身份可见的范围选项。 */
  options: Pick<KnowledgeBaseRecord, 'id' | 'name' | 'kind'>[]
  /** 运行中或查看已绑定的历史会话时锁定范围。 */
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
/** 图标提示资源类型，范围键仍由原有选择逻辑处理。 */
const scopeIcons = { GLOBAL: Collection, DATABASE: Coin, KNOWLEDGE_BASE: FolderOpened }
const selectedKind = computed(
  () => props.options.find((item) => item.id === props.modelValue)?.kind || 'GLOBAL',
)
const groups = computed(() =>
  [
    { kind: 'GLOBAL', label: '全库' },
    { kind: 'DATABASE', label: '数据库' },
    { kind: 'KNOWLEDGE_BASE', label: '我的知识库' },
  ]
    .map((group) => ({ ...group, items: props.options.filter((item) => item.kind === group.kind) }))
    .filter((group) => group.items.length),
)
</script>

<template>
  <el-select
    class="research-scope-select"
    popper-class="research-scope-menu"
    :popper-options="{ modifiers: [{ name: 'preventOverflow', options: { padding: 16 } }] }"
    :model-value="modelValue"
    :disabled="disabled"
    placeholder="选择研究范围"
    aria-label="研究范围"
    filterable
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #prefix>
      <el-icon class="research-scope-prefix" aria-hidden="true"
        ><component :is="scopeIcons[selectedKind]"
      /></el-icon>
    </template>
    <el-option-group v-for="group in groups" :key="group.kind" :label="group.label">
      <el-option v-for="item in group.items" :key="item.id" :value="item.id" :label="item.name">
        <el-icon class="research-scope-option-icon" aria-hidden="true"
          ><component :is="scopeIcons[item.kind || 'GLOBAL']"
        /></el-icon>
        <span class="research-scope-option-name">{{ item.name }}</span>
        <el-icon v-if="item.id === modelValue" class="research-scope-check" aria-hidden="true"
          ><Check
        /></el-icon>
      </el-option>
    </el-option-group>
  </el-select>
</template>

<style>
/* 将焦点提示统一放在选择框外层，避免全局输入框样式产生双层边框。 */
body.research-active .research-command-knowledge .research-scope-select .el-select__wrapper {
  min-height: 46px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f7f9fa;
  box-shadow: 0 0 0 1px #dce4ee inset;
  transition:
    box-shadow 0.16s,
    background 0.16s;
}
body.research-active .research-scope-select .el-select__wrapper.is-hovering:not(.is-disabled) {
  background: #fff;
  box-shadow: 0 0 0 1px #a9bbd4 inset;
}
body.research-active .research-scope-select .el-select__wrapper.is-focused:not(.is-disabled) {
  background: #fff;
  box-shadow:
    0 0 0 1px #005767 inset,
    0 0 0 3px rgb(0 87 103 / 9%);
}
body.research-active .research-scope-select .el-select__input:focus-visible {
  outline: none;
  box-shadow: none;
}
body.research-active .research-scope-select .el-select__selected-item {
  color: #263c58;
}
body.research-active .research-scope-select .el-select__wrapper.is-disabled {
  opacity: 0.65;
}
body.research-active .research-scope-prefix {
  color: #55749e;
  font-size: 18px;
  margin-right: 2px;
}

/* 弹层挂载到 body，使用专属类限定样式；长名称换行，手机上不超出视口。 */
.research-scope-menu.el-popper {
  width: min(420px, calc(100vw - 32px));
  max-width: calc(100vw - 32px);
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow:
    0 8px 30px rgb(25 47 79 / 12%),
    0 2px 6px rgb(25 47 79 / 4%);
  overflow: hidden;
}
.research-scope-menu .el-popper__arrow {
  display: none;
}
.research-scope-menu .el-select-dropdown__wrap {
  max-height: min(440px, 60vh);
}
.research-scope-menu .el-select-dropdown__list {
  padding: 8px;
}
.research-scope-menu .el-select-group__wrap:not(:last-of-type) {
  padding-bottom: 10px;
  margin-bottom: 4px;
}
.research-scope-menu .el-select-group__wrap:not(:last-of-type)::after {
  content: '';
  position: absolute;
  height: 1px;
  left: 12px;
  right: 12px;
  bottom: 2px;
  background: #edf1f6;
}
.research-scope-menu .el-select-group__title {
  height: 30px;
  line-height: 30px;
  padding: 0 12px;
  color: #8390a3;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.04em;
}
.research-scope-menu .el-select-dropdown__item {
  display: flex;
  align-items: center;
  gap: 10px;
  height: auto;
  min-height: 44px;
  margin: 2px 0;
  padding: 10px 12px;
  border-radius: 7px;
  color: #35465f;
  line-height: 1.5;
  white-space: normal;
}
.research-scope-menu .el-select-dropdown__item.is-hovering {
  background: #f3f6fa;
}
.research-scope-menu .el-select-dropdown__item.is-selected {
  color: #005767;
  background: #edf3ff;
  font-weight: 600;
}
.research-scope-menu .research-scope-option-icon {
  flex-shrink: 0;
  color: #8b9cb2;
  font-size: 17px;
}
.research-scope-menu .is-selected .research-scope-option-icon {
  color: #005767;
}
.research-scope-menu .research-scope-option-name {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.research-scope-menu .research-scope-check {
  flex-shrink: 0;
  font-size: 16px;
}
</style>
