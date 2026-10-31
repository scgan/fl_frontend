/** 格式化智鉴结果的字段级引用，防止把整行来源误附到证据不足提示或其他单元格。 */
import type { ComparisonMatrixRow } from '@/research/types/agents'

/** 为明确支持当前字段的已发布引用补编号，纯“证据不足”占位不附引用。 */
export function formatCitedText(text: string = '', indices: number[] = [], published: number[] = []): string {
  const content = text.trim()
  const plain = content.replace(/\[\d+\]/g, '').replace(/[\s。.!！;；]+/g, '')
  if (plain === '证据不足') return '证据不足'
  const allowed = new Set(published)
  const citations = [...new Set(indices)].filter((index) => allowed.has(index) && !content.includes(`[${index}]`))
  return [content, citations.map((index) => `[${index}]`).join(' ')].filter(Boolean).join(' ')
}

/** 按矩阵字段选择来源；差异沿用正文引用，不能把整行 citation_ids 当作差异的来源。 */
export function matrixCellText(
  row: ComparisonMatrixRow,
  field: 'object_a' | 'object_b' | 'similarity' | 'difference',
  published: number[],
): string {
  const indices = field === 'object_a' ? row.object_a_citation_ids
    : field === 'object_b' ? row.object_b_citation_ids
      : field === 'similarity' ? row.shared_citation_ids : []
  return formatCitedText(row[field], indices, published)
}
