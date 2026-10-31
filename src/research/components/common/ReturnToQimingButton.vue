<!--
  专业研究结果返回启明会话的通用入口：统一处理会话可见性、同轮 Run 聚焦跳转与按钮样式。
-->
<script setup lang="ts">
import { ArrowLeft } from '@element-plus/icons-vue'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { useAuthStore } from '@/research/stores/auth'
import { useResearchSource } from '@/research/composables/useResearchSource'

interface ReturnToQimingButtonProps {
  /** 当前专业研究结果所属的启明会话主键。 */
  conversationId?: string | null
  /** 返回会话后需要聚焦的 Agent Run 主键。 */
  runId?: string | null
}

const props = defineProps<ReturnToQimingButtonProps>()
const router = useRouter()
const auth = useAuthStore()
const { conversationRouteName, databaseId } = useResearchSource()

const visible = computed(() => Boolean(
  props.conversationId
  && props.runId
  && auth.isAuthenticated,
))

/** 返回当前结果所属的启明会话，并聚焦触发本次专业研究的消息。 */
async function returnToQimingConversation(): Promise<void> {
  if (!visible.value || !props.conversationId || !props.runId) return
  await router.push({
    name: conversationRouteName,
    params: { id: props.conversationId, ...(databaseId === undefined ? {} : { databaseId }) },
    query: { focus_run: props.runId },
  })
}
</script>

<template>
  <button
    v-if="visible"
    type="button"
    class="qiming-return-button"
    @click="returnToQimingConversation"
  >
    <el-icon><ArrowLeft /></el-icon>
    返回启明问答
  </button>
</template>

<style scoped>
.qiming-return-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  margin: 0 0 20px;
  padding: 8px 12px;
  border: 1px solid #2463dc;
  border-radius: 6px;
  background: #fff;
  color: #1854c4;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 160ms ease, border-color 160ms ease;
}

.qiming-return-button:hover {
  background: #edf4ff;
}

.qiming-return-button:focus-visible {
  outline: 2px solid #2463dc;
  outline-offset: 2px;
}
</style>
