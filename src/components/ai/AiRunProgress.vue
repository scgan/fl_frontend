<!-- 展示 AI 任务的真实执行阶段、等待动画和自任务创建起的累计用时，恢复会话不重置计时。 -->
<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { assistantElapsedSeconds, assistantProgressLabel } from '@/research/utils/assistant-progress'

const props = defineProps({ run: { type: Object, required: true } })
// 页面只刷新当前时刻；计时起点来自同一 Run 的创建时间，离开和重新挂载不改变起点。
const now = ref(Date.now())
const label = computed(() => assistantProgressLabel(props.run))
const elapsed = computed(() => assistantElapsedSeconds(props.run, now.value))
let timer

/** 更新当前时刻；浏览器后台节流后按实际时间追平，不依赖定时器触发次数累加。 */
function refreshClock() {
  now.value = Date.now()
}
/** 结束、断线或离开页面时释放刷新定时器，避免隐藏组件继续轮询。 */
function stopClock() {
  clearInterval(timer)
  timer = undefined
}
/** 切换运行或恢复连接时重新同步当前时刻，终态与断线期间停止刷新。 */
function syncClock() {
  stopClock()
  refreshClock()
  if (['PENDING', 'RUNNING'].includes(props.run.status) && !props.run.progressDisconnected)
    timer = setInterval(refreshClock, 1000)
}
watch(
  () => [props.run.id, props.run.status, props.run.created_at, props.run.progressDisconnected],
  syncClock,
)
onMounted(syncClock)
onBeforeUnmount(stopClock)
</script>

<template>
  <div
    v-if="label"
    class="run-progress"
    :class="{ disconnected: run.progressDisconnected }"
    role="status"
    aria-live="polite"
  >
    <span class="progress-spinner" aria-hidden="true"></span>
    <div class="progress-copy">
      <Transition name="progress-stage" mode="out-in">
        <span :key="label" class="progress-label">{{ label }}</span>
      </Transition>
      <span v-if="!run.progressDisconnected && elapsed !== null" class="progress-time" aria-hidden="true"
        >已用时 {{ elapsed }} 秒</span
      >
    </div>
  </div>
</template>

<style scoped>
.run-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 7px 0 15px;
}
.progress-spinner {
  flex: 0 0 auto;
  width: 17px;
  height: 17px;
  border: 2px solid #e0eeeb;
  border-top-color: #167977;
  border-right-color: #78b6ac;
  border-radius: 50%;
  animation: progress-spin 0.9s linear infinite;
}
.progress-copy {
  display: grid;
  gap: 5px;
  min-width: 0;
}
.progress-label {
  color: #53787a;
  font-size: 14px;
  line-height: 1.6;
}
.progress-time {
  color: #92a5a7;
  font-size: 12px;
  line-height: 1.5;
  font-variant-numeric: tabular-nums;
}
.disconnected .progress-spinner {
  animation: none;
  border-color: #becdce;
}
.progress-stage-enter-active,
.progress-stage-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}
.progress-stage-enter-from {
  opacity: 0;
  transform: translateY(3px);
}
.progress-stage-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}
@keyframes progress-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .progress-spinner {
    animation: none;
  }
  .progress-stage-enter-active,
  .progress-stage-leave-active {
    transition: none;
  }
}
</style>
