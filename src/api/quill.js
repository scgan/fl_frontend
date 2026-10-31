import axios from 'axios'
import router from '@/router'

// 研究智能体（research-agent）独立服务的请求封装。
// 开发环境由 vite 代理 /research-api -> Agent /api/v1；
// 生产环境由 nginx 的 /research-api/ location 转发。
const researchBaseURL = '/research-api'

const instance = axios.create({
  baseURL: researchBaseURL,
  // Quill运行包含检索与模型生成，耗时明显高于普通接口
  timeout: 10000 * 6 * 5,
})

// 请求拦截器：携带 Foreign 登录凭证，与研究页面共用同一 token
instance.interceptors.request.use(
  (config) => {
    if (localStorage.getItem('token')) {
      config.headers.Authorization = 'Bearer ' + localStorage.getItem('token')
    }
    return config
  },
  (err) => Promise.reject(err),
)

// 响应拦截器：Agent 接口使用 { code, message, data } 信封，直接透传给调用方判断
instance.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      router.push('/login')
      localStorage.removeItem('token')
      localStorage.removeItem('userRole')
    }
    return Promise.reject(err)
  },
)

// 创建一次Quill运行（幂等），返回 { run_id, conversation_id, status, stream_url }
// 创建运行：默认 Quill；自由问答复用 QIMING（知识库问答智能体）
export const createQuillRunService = (payload, agentCode = 'QUILL') => {
  return instance.post(`/agents/${agentCode}/runs`, { ...payload, entry_source: 'WRITING' })
}

// 读取运行状态与最终结果；轮询直至 SUCCESS / FAILED / CANCELLED
export const getQuillRunService = (runId) => {
  return instance.get(`/agent-runs/${runId}`)
}

// 轮询读取运行中节点的实时思维链（后端内存缓冲，思考流式增量；节点完成后并入步骤）
export const getQuillRunReasoningService = (runId) => {
  return instance.get(`/agent-runs/${runId}/reasoning`)
}

// 停止生成：把运行标记为 CANCELLED 并取消服务端协程（幂等，已结束则原样返回状态）
export const cancelQuillRunService = (runId) => {
  if (typeof runId !== 'string' || !runId) {
    return Promise.reject(new Error('停止生成需要 runId'))
  }
  return instance.post(`/agent-runs/${runId}/cancel`)
}

// 读取运行证据面板：原文快照、来源可用状态与带页码锚点的 file_url
export const getQuillRunEvidenceService = (runId) => {
  return instance.get(`/agent-runs/${runId}/evidence`)
}

// 读取会话消息（写作历史恢复）
export const getQuillConversationService = (conversationId) => {
  return instance.get(`/conversations/${conversationId}`, { params: { entry_source: 'WRITING' } })
}

// 分页列出当前用户的写作会话，包含写作入口中的启明问答
export const getQuillConversationListService = (page = 1) => {
  return instance.get('/conversations', { params: { page, page_size: 20, entry_source: 'WRITING' } })
}

// 会话内 Quill 阶段产物列表（RQ/PLAN/DRAFT/REVISE）
export const getQuillArtifactsService = (conversationId) => {
  // 防御：误传 ref 对象/undefined 时直接报错，避免拼出
  // /writing-artifacts/object object} 这类 URL（后端必然 404，难以定位）
  if (typeof conversationId !== 'string' && typeof conversationId !== 'number') {
    return Promise.reject(new Error('产物历史需要会话 id（传 ref 的 .value）'))
  }
  return instance.get(`/writing-artifacts/${conversationId}`)
}

// 导出 Word 文档：{ conversation_id } 整篇或 { artifact_id } 单产物
export const exportQuillDocxService = (params) => {
  return instance.post('/quill/export-docx', params, { responseType: 'blob' })
}
