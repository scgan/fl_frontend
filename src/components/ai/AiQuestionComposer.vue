<!-- AI 提问输入区：统一空白页与持续对话的输入、中文输入法处理和键盘提交。 -->
<script setup>
import { ref, watch } from 'vue'
import { ArrowUp, Loading, Reading } from '@element-plus/icons-vue'

const props = defineProps({
  // 输入内容由父页面持有，切换会话或选用示例时可以同步恢复。
  modelValue: { type: String, default: '' },
  // 运行中禁用重复提交，由父页面负责轮询与错误恢复。
  busy: { type: Boolean, default: false },
  // 空白页和持续对话使用不同提示，实际检索范围仍由后端控制。
  placeholder: { type: String, default: '输入问题，例如：查询双减相关的文献' },
})
const emit = defineEmits(['update:modelValue', 'submit'])
const textarea = ref(null)

/** 将原生输入事件的内容同步给父页面，不在组件中复制会话状态。 */
function updateValue(event) {
  emit('update:modelValue', event.target.value)
}
/** 随内容增高，最多到初始高度的 1.5 倍，此后输入框内部滚动。 */
function resize() {
  const el = textarea.value
  if (!el) return
  el.style.height = 'auto'
  const max = Number.parseFloat(getComputedStyle(el).maxHeight) || Number.POSITIVE_INFINITY
  el.style.height = `${Math.min(el.scrollHeight, max)}px`
}
watch(
  () => props.modelValue,
  () => resize(),
  { flush: 'post' },
)
/** 仅在问题有效且没有在途任务时请求父页面提交。 */
function submit() {
  if (!props.busy && props.modelValue.trim().length >= 2) emit('submit')
}
/** Enter 提交、Shift+Enter 换行，中文输入法确认候选字时保留原生行为。 */
function onKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    submit()
  }
}
/** 选择示例后将焦点交给真实输入框，方便用户继续修改问题。 */
function focus() {
  textarea.value?.focus()
}
defineExpose({ focus })
</script>

<template>
  <form class="question-composer" @submit.prevent="submit">
    <textarea
      ref="textarea"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="busy"
      rows="3"
      maxlength="4000"
      aria-label="研究问题"
      @input="updateValue"
      @keydown="onKeydown"
    ></textarea>
    <div class="composer-toolbar">
      <span class="scope" aria-label="文献范围：全库文献"
        ><Reading aria-hidden="true" />全库文献
      </span>
      <div class="composer-controls">
        <span class="keyboard-hint">Enter 发送<span> · </span>Shift+Enter 换行</span>
        <button
          class="send-button"
          type="submit"
          :disabled="busy || modelValue.trim().length < 2"
          :aria-label="busy ? '正在处理问题' : '发送'"
          :title="busy ? '正在处理问题' : '发送问题'"
        >
          <Loading v-if="busy" class="is-loading" aria-hidden="true" />
          <ArrowUp v-else aria-hidden="true" />
        </button>
      </div>
    </div>
  </form>
</template>

<style scoped>
.question-composer {
  border: 1px solid #d4e1e1;
  border-radius: 16px;
  background: #fff;
  padding: 16px 18px 12px;
  box-shadow: 0 5px 24px rgb(25 65 65 / 4%);
  transition:
    border-color 0.18s,
    box-shadow 0.18s;
}
.question-composer:focus-within {
  border-color: #78a8a7;
  box-shadow:
    0 0 0 3px rgb(7 94 96 / 5%),
    0 5px 24px rgb(25 65 65 / 4%);
}
textarea {
  display: block;
  width: 100%;
  min-height: 92px;
  max-height: 138px; /* 约初始高度的 1.5 倍，超过后内部滚动 */
  overflow-y: auto;
  border: 0;
  padding: 2px 2px 12px;
  box-sizing: border-box;
  resize: none;
  outline: 0;
  background: transparent;
  color: #1c3436;
  font: inherit;
  font-size: 15px;
  line-height: 1.8;
}
textarea::placeholder {
  color: #7e9094;
}
textarea:disabled {
  cursor: progress;
}
.composer-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding-top: 11px;
  border-top: 1px solid #edf1f2;
}
.scope {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #426363;
  font-size: 13px;
  white-space: nowrap;
}
.scope svg {
  width: 18px;
  height: 18px;
  color: #075e60;
}
.composer-controls {
  display: flex;
  align-items: center;
  gap: 16px;
}
.keyboard-hint {
  color: #95a2a5;
  font-size: 11px;
  white-space: nowrap;
}
.keyboard-hint span {
  padding: 0 3px;
}
.send-button {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: #075e60;
  color: #fff;
  cursor: pointer;
  transition:
    background 0.18s,
    transform 0.18s;
}
.send-button svg {
  width: 21px;
  height: 21px;
}
.send-button:hover:not(:disabled) {
  background: #03494c;
  transform: translateY(-1px);
}
.send-button:disabled {
  background: #a3b9b9;
  cursor: not-allowed;
}
.send-button:focus-visible {
  outline: 3px solid #92c4c1;
  outline-offset: 3px;
}
.is-loading {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 600px) {
  .question-composer {
    border-radius: 13px;
    padding: 14px 14px 10px;
  }
  textarea {
    min-height: 86px;
    font-size: 14px;
  }
  .keyboard-hint {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .question-composer,
  .send-button {
    transition: none;
  }
  .is-loading {
    animation: none;
  }
}
</style>
