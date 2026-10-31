<!-- 提供三栏工作台共用的可拖拽、可键盘操作纵向分隔条，只负责输出水平位移。 -->
<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  label: string
}>()

const emit = defineEmits<{
  resize: [delta: number]
}>()

const dragging = ref(false)
let previousClientX = 0

/** 捕获指针并记录拖拽起点，保证移出窄分隔条后仍能连续调整。 */
function startResize(event: PointerEvent): void {
  dragging.value = true
  previousClientX = event.clientX
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

/** 把相邻两次指针位置之差交给父布局换算为面板宽度。 */
function continueResize(event: PointerEvent): void {
  if (!dragging.value) return
  const delta = event.clientX - previousClientX
  previousClientX = event.clientX
  if (delta) emit('resize', delta)
}

/** 结束当前拖拽，后续指针移动不再影响面板。 */
function stopResize(): void {
  dragging.value = false
}

/** 允许键盘用户用方向键按固定步长调整同一分隔位置。 */
function resizeWithKeyboard(event: KeyboardEvent): void {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  event.preventDefault()
  emit('resize', event.key === 'ArrowLeft' ? -16 : 16)
}
</script>

<template>
  <div
    class="pane-resize-handle"
    :class="{ dragging }"
    role="separator"
    aria-orientation="vertical"
    :aria-label="label"
    :title="`${label}；也可使用左右方向键`"
    tabindex="0"
    @pointerdown.prevent="startResize"
    @pointermove="continueResize"
    @pointerup="stopResize"
    @pointercancel="stopResize"
    @lostpointercapture="stopResize"
    @keydown="resizeWithKeyboard"
  >
    <span aria-hidden="true" />
  </div>
</template>

<style scoped>
.pane-resize-handle {
  position: relative;
  z-index: 4;
  min-width: 8px;
  cursor: col-resize;
  touch-action: none;
  background: #f7f9fa;
  outline: 0;
}

.pane-resize-handle::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 50%;
  width: 1px;
  background: #d8e1ea;
  transform: translateX(-50%);
}

.pane-resize-handle span {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 3px;
  height: 34px;
  border-radius: 6px;
  background: #9eb0c2;
  box-shadow: 0 0 0 3px #f7f9fa;
  opacity: .55;
  transform: translate(-50%, -50%);
  transition: background 120ms ease, opacity 120ms ease;
}

.pane-resize-handle:hover span,
.pane-resize-handle:focus-visible span,
.pane-resize-handle.dragging span {
  background: #005767;
  opacity: 1;
}

.pane-resize-handle:focus-visible {
  box-shadow: inset 0 0 0 2px rgb(0 87 103 / 25%);
}
</style>
