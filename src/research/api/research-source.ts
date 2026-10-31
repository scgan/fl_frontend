/** 统一研究入口的范围适配：全库、数据库和本人知识库共用 RESEARCH，资源键保留类型。 */
import { http } from '@/research/api/http'
import { fetchForeignKnowledgeBases } from '@/research/api/foreign-resources'
import type { ApiEnvelope } from '@/research/types/api'

/** DATABASE 仅兼容旧调用方，所有网络请求统一使用 RESEARCH。 */
export type ResearchSource = 'RESEARCH' | 'DATABASE'
export type ResearchResourceKind = 'GLOBAL' | 'DATABASE' | 'KNOWLEDGE_BASE'

/** 后端真实绑定；前端带类型的选项键不能替代真实业务 ID。 */
export interface SourceBinding {
  /** 真实知识库主键；数据库和全库范围为空。 */
  knowledge_base_id?: string | number | null
  /** 真实根数据库主键；知识库和全库范围为空。 */
  database_id?: string | number | null
  /** 业务入口，统一研究固定为 RESEARCH。 */
  entry_source?: string
}

/** 统一范围选择项，数据库和知识库同号时也拥有不同的键。 */
export interface ResearchResource {
  /** 展示选择键：global、db:<id> 或 kb:<id>，不直接作为业务主键提交。 */
  id: string
  /** 检索范围类型，用于下拉分组与历史来源标签。 */
  kind: ResearchResourceKind
  name: string
  description: string | null
  corpus_count: number
}

/**
 * 将带类型的选择值还原为互斥绑定；无资源 ID 表示全库范围。
 * @throws {Error} 选择键没有有效的正整数业务 ID。
 */
export function researchPayload<T extends { knowledge_base_id: string }>(payload: T, source: ResearchSource) {
  const { knowledge_base_id: key, ...body } = payload
  if (key === 'global' || (source === 'DATABASE' && key === '0')) return { ...body, entry_source: 'RESEARCH' }
  const matched = /^(db|kb):(\d+)$/.exec(key)
  const id = Number(matched ? matched[2] : key)
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('请选择有效的研究范围')
  const database = matched ? matched[1] === 'db' : source === 'DATABASE'
  return { ...body, entry_source: 'RESEARCH', ...(database ? { database_id: id } : { knowledge_base_id: id }) }
}

/** 根据真实绑定恢复选择键，入口来源不再决定资源类型。 */
export function researchResourceId(record: SourceBinding, _source?: ResearchSource): string {
  if (record.knowledge_base_id != null) return `kb:${record.knowledge_base_id}`
  if (record.database_id != null) return `db:${record.database_id}`
  return 'global'
}

/** 历史列表明确展示来源类型，避免同名资源无法区分。 */
export function researchResourceLabel(resource?: ResearchResource): string | null {
  if (!resource) return null
  return resource.kind === 'GLOBAL' ? resource.name
    : `${resource.kind === 'DATABASE' ? '数据库' : '知识库'} · ${resource.name}`
}

/**
 * 读取全部本人知识库，避免合并后的选择器和历史恢复只识别第一页。
 * @throws {Error} 分页范围变化导致列表不完整，要求刷新后再选择。
 */
async function allKnowledgeBases() {
  const first = await fetchForeignKnowledgeBases(1, 100)
  const items = [...first.items]
  for (let page = 2; items.length < first.total; page += 1) {
    const next = await fetchForeignKnowledgeBases(page, 100)
    if (!next.items.length) throw new Error('知识库列表发生变化，请刷新研究范围')
    items.push(...next.items)
  }
  return items
}

/** 合并两类资源后统一分页；全库始终作为默认首项。 */
export async function fetchResearchResources(page: number, pageSize: number, _source?: ResearchSource) {
  const [databases, bases] = await Promise.all([fetchRootDatabases(), allKnowledgeBases()])
  const records: ResearchResource[] = [
    { id: 'global', kind: 'GLOBAL', name: '全库文献', description: null, corpus_count: 0 },
    ...databases.map((item): ResearchResource => ({
      id: `db:${item.id}`, kind: 'DATABASE', name: item.database_name, description: null, corpus_count: 0,
    })),
    ...bases.map((item): ResearchResource => ({ ...item, id: `kb:${item.id}`, kind: 'KNOWLEDGE_BASE' })),
  ]
  return { items: records.slice((page - 1) * pageSize, page * pageSize), total: records.length }
}

/** 读取有效根数据库；仅展示真实业务资源。 */
export async function fetchRootDatabases() {
  const response = await http.get<ApiEnvelope<{ items: { id: number; database_name: string }[] }>>('/research-databases')
  return response.data.data.items
}

/**
 * 兼容显式要求固定数据库的旧调用；新工作台恢复各会话自身的绑定。
 * @throws {Error} 详情的真实数据库与显式要求的范围不一致。
 */
export function assertResearchBinding(record: SourceBinding, databaseId?: number): void {
  if (databaseId !== undefined && Number(record.database_id) !== databaseId) throw new Error('该会话不属于当前智能体')
}

/** 由后端对统一来源排序分页，禁止前端分别分页后拼接两类历史。 */
export async function fetchResearchHistory<T extends SourceBinding>(
  path: string, params: Record<string, string | number>, page: number, pageSize: number,
  databaseId?: number,
): Promise<{ items: T[]; total: number; page: number; page_size: number }> {
  const response = await http.get<ApiEnvelope<{ items: T[]; total?: number }>>(path, {
    params: { ...params, entry_source: 'RESEARCH', page, page_size: pageSize,
      ...(databaseId === undefined ? {} : { database_id: databaseId }) },
  })
  const data = response.data.data
  return { ...data, page, page_size: pageSize,
    total: data.total ?? (page - 1) * pageSize + data.items.length + (data.items.length === pageSize ? 1 : 0) }
}
