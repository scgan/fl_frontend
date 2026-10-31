/** 合并全局搜索与个人文件的阅读材料 ID，保持选择顺序并统一校验二十篇上限。 */

/** 将已有草稿与新增选文合并；无效 ID 或超过上限时整批拒绝，避免静默丢失材料。 */
export function mergeReadingMaterialIds(current: unknown[], incoming: unknown[]): number[] {
  const ids: number[] = []
  for (const value of [...current, ...incoming]) {
    const id = Number(value)
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('材料编号无效，请重新选择')
    if (!ids.includes(id)) ids.push(id)
  }
  if (ids.length > 20) throw new Error('一次最多分析 20 篇材料，请减少选择后再添加')
  return ids
}
