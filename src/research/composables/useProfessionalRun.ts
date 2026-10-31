/**
 * 专业工作台运行状态：立即选择历史、恢复活动 Run 的 SSE，并隔离切换前的异步回调。
 * 三个专业页面共享同一生命周期，前端断开订阅不会取消后端任务。
 */
import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { fetchAgentEvidence, fetchAgentRun, fetchAgentSteps, streamAgentRun } from '@/research/api/agents'
import { useResearchSource } from '@/research/composables/useResearchSource'
import type {
  AgentEvidenceItem, AgentRun, AgentRunAccepted, AgentRunHistoryItem, AgentStep, AgentStreamEvent,
} from '@/research/types/agents'

/** 工作台负责表单和提示，共用状态负责详情与订阅的生命周期。 */
interface ProfessionalRunOptions {
  /** 实际执行模块，用于拒绝打开其他模块的结果。 */
  executor: 'ZHIJIAN' | 'SUZHI' | 'RONGTONG'
  /** 页面已有的轻量历史，提供加载期间的运行状态。 */
  history: Ref<AgentRunHistoryItem[]>
  /** 创建和完成运行后刷新历史。 */
  refreshHistory: () => Promise<void>
  /** 把当前详情同步到页面表单，不得启动新的运行。 */
  onLoaded: (run: AgentRun) => void
  /** 仅在活动订阅到达终态后通知页面，可展示专业结果提示。 */
  onFinished?: (run: AgentRun) => void
  /** 当前页面才可显示的错误。 */
  onError: (error: unknown) => void
}

/**
 * 创建按当前选择隔离的专业运行状态。
 * @param options 模块、历史与页面回调。
 * @returns 详情、即时选中状态及加载、提交、清空操作。
 */
export function useProfessionalRun(options: ProfessionalRunOptions) {
  const route = useRoute()
  const router = useRouter()
  const { rootPath, source, databaseId } = useResearchSource()
  const basePath = `${rootPath}/${options.executor.toLowerCase()}`
  // 选中项独立于详情对象，点击后无需等待三个接口返回即可高亮。
  const selectedRunId = ref(typeof route.params.runId === 'string' ? route.params.runId : '')
  const run = ref<AgentRun | null>(null)
  const evidence = ref<AgentEvidenceItem[]>([])
  const steps = ref<AgentStep[]>([])
  const running = ref(false)
  const runLoading = ref(Boolean(selectedRunId.value))
  // 断流只是前端订阅结束；只有成功且对应正文快照存在，才允许发布证据。
  const evidencePending = computed(() => running.value || runLoading.value || Boolean(
    selectedRunId.value && (!run.value || run.value.status !== 'SUCCESS' || !(
      options.executor === 'ZHIJIAN' ? run.value.zhijian_result
        : options.executor === 'SUZHI' ? run.value.suzhi_result : run.value.rongtong_result
    )),
  ))
  // 每次切换递增代次；已发出的 HTTP 请求和 SSE 回调只能写入所属代次。
  let generation = 0
  let streamController: AbortController | null = null

  /** 清空视图并使此前所有未完成请求失效，不取消后端运行。 */
  function reset(): void {
    generation += 1
    streamController?.abort()
    streamController = null
    selectedRunId.value = ''
    run.value = null
    evidence.value = []
    steps.value = []
    running.value = false
    runLoading.value = false
  }

  /**
   * 判断请求是否仍属于当前展示的会话。
   * @param token 发起请求时的代次。
   * @param id 目标运行 ID。
   * @returns 是否允许写入当前视图。
   */
  function isCurrent(token: number, id: string): boolean {
    return token === generation && selectedRunId.value === id
  }

  /**
   * 读取同一运行的详情、证据与步骤快照，晚到的旧响应直接丢弃。
   * @param id 运行 ID。
   * @param token 当前选择代次。
   */
  async function readSnapshot(id: string, token: number): Promise<void> {
    const [detail, sources, records] = await Promise.all([
      fetchAgentRun(id, source, databaseId), fetchAgentEvidence(id), fetchAgentSteps(id),
    ])
    if (!isCurrent(token, id)) return
    if (detail.executor_agent_code !== options.executor) throw new Error('该运行不属于当前工作台')
    run.value = detail
    evidence.value = sources
    steps.value = records
    running.value = ['PENDING', 'RUNNING'].includes(detail.status)
    const item = options.history.value.find((candidate) => candidate.id === id)
    if (item) item.status = detail.status
    options.onLoaded(detail)
  }

  /**
   * 合并可重放的节点事件，按 sequence 去重，避免重连后回退到早期步骤。
   * @param event 后端 SSE 事件。
   * @param id 所属运行 ID。
   * @param token 所属选择代次。
   */
  function handleEvent(event: AgentStreamEvent, id: string, token: number): void {
    if (!isCurrent(token, id)) return
    if (event.event === 'evidence.ready') {
      void fetchAgentEvidence(id).then((items) => {
        if (isCurrent(token, id)) evidence.value = items
      }).catch((error) => { if (isCurrent(token, id)) options.onError(error) })
    }
    if (!['node.started', 'node.completed', 'node.failed'].includes(event.event)) return
    // completed/failed 的载荷没有 sequence，稳定事件 ID 为 step.<sequence>.<status>。
    const sequence = Number(event.data.sequence ?? event.id.match(/^step\.(\d+)\./)?.[1])
    if (!Number.isInteger(sequence) || sequence < 1) return
    let step = steps.value.find((item) => item.sequence === sequence)
    if (!step) {
      step = {
        id: `${id}-${sequence}`, node_name: String(event.data.node), sequence,
        status: 'RUNNING', started_at: new Date().toISOString(), finished_at: null,
        input_summary: {}, output_summary: {}, retry_count: 0, error_message: null,
      }
      steps.value.push(step)
      steps.value.sort((left, right) => left.sequence - right.sequence)
    }
    if (event.event !== 'node.started') {
      step.status = event.event === 'node.failed' ? 'FAILED' : 'SUCCESS'
      step.output_summary = (event.data.output ?? {}) as Record<string, unknown>
      step.error_message = typeof event.data.error === 'string' ? event.data.error : null
    }
  }

  /**
   * 恢复当前活动运行的订阅，终态再读取持久化结果。
   * @param id 运行 ID。
   * @param token 当前选择代次。
   */
  async function followRun(id: string, token: number): Promise<void> {
    const controller = new AbortController()
    streamController = controller
    try {
      await streamAgentRun(id, (event) => handleEvent(event, id, token), controller.signal)
      if (!isCurrent(token, id) || controller.signal.aborted) return
      // 终态结果读取完再关闭运行遮罩，避免先闪现空状态。
      await readSnapshot(id, token)
      if (isCurrent(token, id) && run.value) {
        options.onFinished?.(run.value)
        await options.refreshHistory()
      }
    } catch (error) {
      if (isCurrent(token, id) && !controller.signal.aborted) {
        running.value = false
        options.onError(error)
      }
    }
  }

  /**
   * 立即选中历史并加载详情；活动 Run 在快照读取后自动恢复 SSE。
   * @param id 运行 ID。
   * @param updateRoute 是否写入浏览器历史。
   */
  async function loadRun(id: string, updateRoute = true): Promise<void> {
    const item = options.history.value.find((candidate) => candidate.id === id)
    // 1. 先切换选择并使旧请求失效，界面反馈不依赖网络速度。
    reset()
    const token = generation
    selectedRunId.value = id
    runLoading.value = true
    running.value = Boolean(item && ['PENDING', 'RUNNING'].includes(item.status))
    try {
      if (updateRoute && route.params.runId !== id) await router.push(`${basePath}/runs/${id}`)
      // 2. 原子恢复快照；离开再回来只恢复订阅，不重新创建任务。
      if (!isCurrent(token, id)) return
      await readSnapshot(id, token)
      if (isCurrent(token, id) && running.value) void followRun(id, token)
    } catch (error) {
      if (isCurrent(token, id)) { running.value = false; options.onError(error) }
    } finally {
      if (isCurrent(token, id)) runLoading.value = false
    }
  }

  /**
   * 创建任务后立即保存选中 ID 和可恢复路由，再读取快照并订阅。
   * @param create 已由页面冻结好参数的创建请求。
   */
  async function startRun(create: () => Promise<AgentRunAccepted>): Promise<void> {
    reset()
    const token = generation
    running.value = true
    try {
      // 1. 请求期间允许切换历史；新任务仍由后端执行，但迟到响应不能抢回页面。
      const accepted = await create()
      void options.refreshHistory().catch(options.onError)
      if (token !== generation) return
      selectedRunId.value = accepted.run_id
      await router.push(`${basePath}/runs/${accepted.run_id}`)
      // 2. 选中 ID 已设置，路由监听不会重复加载或取消此订阅。
      if (!isCurrent(token, accepted.run_id)) return
      await readSnapshot(accepted.run_id, token)
      if (isCurrent(token, accepted.run_id) && running.value) {
        void followRun(accepted.run_id, token)
      }
    } catch (error) {
      if (token === generation) { running.value = false; options.onError(error) }
    }
  }

  // 浏览器前进、后退以及模块基础路由使用相同的选择生命周期。
  watch(() => route.params.runId, (id) => {
    if (typeof id === 'string' && id !== selectedRunId.value) void loadRun(id, false)
    else if (!id) reset()
  })
  onBeforeUnmount(reset)

  return { selectedRunId, run, evidence, steps, running, runLoading, evidencePending, loadRun, startRun, reset }
}
