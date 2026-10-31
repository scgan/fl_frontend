/** 智能研究独立布局路由；仅数据收集者可访问，不嵌套 Foreign 业务侧栏。 */
import { RONGTONG_UI_ENABLED } from './features'

const modules = [
  ['qiming', '库源智答', () => import('./views/qiming/QimingView.vue')],
  ['zhijian', '智鉴·比对分析', () => import('./views/zhijian/ZhijianView.vue')],
  ['suzhi', '溯知·文献综述', () => import('./views/suzhi/SuzhiView.vue')],
  ['rongtong', '融通·国际传播', () => import('./views/rongtong/RongtongView.vue')],
]

/** 统一研究路由；旧知识库路径重定向到相同模块及历史详情。 */
function createResearchRoutes(basePath, source) {
  const prefix = source === 'DATABASE' ? 'database-research' : 'research'
  /** 转发旧路径，保留历史 ID、查询参数及页内锚点。 */
  const forward = (suffix) => (to) => ({ name: `database-research-${suffix}`, params: to.params, query: to.query, hash: to.hash })
  const legacy = source === 'RESEARCH'
  return {
  path: basePath,
  component: () => import('./ResearchLayout.vue'),
  meta: { research: true, researchSource: 'RESEARCH' },
  children: [
    { path: '', redirect: to => ({ name: `${prefix}-qiming`, params: to.params }) },
    ...modules.flatMap(([code, title, component]) => {
      // 隐藏模块的旧链接和历史详情统一回到启明，不挂载暂未开放的页面。
      const unavailable = code === 'rongtong' && !RONGTONG_UI_ENABLED ? {
        redirect: (to) => ({ name: 'database-research-qiming',
          params: to.params.databaseId ? { databaseId: to.params.databaseId } : {},
          query: to.query, hash: to.hash }),
      } : {}
      return [
        { path: code, name: `${prefix}-${code}`, component, meta: { title }, ...(legacy ? { redirect: forward(code) } : {}), ...unavailable },
        ...(code === 'qiming' ? [] : [{ path: `${code}/runs/:runId`, name: `${prefix}-${code}-run`, component, meta: { title }, ...(legacy ? { redirect: forward(`${code}-run`) } : {}), ...unavailable }]),
      ]
    }),
    { path: 'qiming/conversations/:id', name: `${prefix}-conversation-detail`, component: modules[0][2], meta: { title: '启明·智能问答' }, ...(legacy ? { redirect: forward('conversation-detail') } : {}) },
  ],
}
}

export const databaseResearchRoutes = createResearchRoutes('/database-research/:databaseId(\\d+)?', 'DATABASE')
export default createResearchRoutes('/research', 'RESEARCH')
