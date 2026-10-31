/** 统一研究工作台路由与来源；旧数据库路径仅提供新会话的初始范围。
 *
 * 嵌入主界面时（路由 meta.embed = true，如 /user/agent/*），页面内的历史对话、
 * 任务详情等跳转必须留在主界面内，因此 rootPath 与路由名需要跟随当前挂载位置。
 */
import { useRoute } from 'vue-router'
import type { ResearchSource } from '@/research/api/research-source'

/** 返回统一模块入口；兼容旧路径的数据库 ID 仅用于新会话初始选择。 */
export function useResearchSource() {
  const route = useRoute()
  const source: ResearchSource = 'RESEARCH'
  const id = Number(route.params.databaseId)
  const initialDatabaseId = Number.isSafeInteger(id) && id > 0 ? `db:${id}` : undefined
  // 不向历史及详情 API 传数据库过滤；真实运行范围始终由会话/Run 自身的绑定恢复。
  const databaseId: number | undefined = undefined

  // 是否运行在主界面内的嵌套路由（/user/agent/*）
  const embedded = route.meta?.embed === true || route.path.startsWith('/user/agent')
  const rootPath = embedded ? '/user/agent' : '/database-research'
  const conversationRouteName = embedded
    ? 'userAgentQimingConversation'
    : 'database-research-conversation-detail'

  return {
    source,
    databaseId,
    initialDatabaseId,
    rootPath,
    conversationRouteName,
    resourceLabel: '研究范围',
    embedded,
  }
}
