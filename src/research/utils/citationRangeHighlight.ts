/** 用 chunk 的首尾和中间内容确定连续范围；绘制范围不等同于逐字匹配统计。 */
import { matchCitationItems } from './citationHighlight'
import type { CitationItemRange, CitationMatchResult, CitationTextPage } from './citationHighlight'

export interface CitationRangeResult extends CitationMatchResult {
  rangesByPage: Map<number, Map<number, CitationItemRange>>
  rangeLocated: boolean
  approximate: boolean
}
const normalize = (text: string) => text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
interface RawCharacter { value: string; page: number; item: number; offset: number; end: number }

/** 按页、栏、行读取。栏间隙须在多行重复，不能仅凭两项之间的距离判断。 */
function readingItems(page: CitationTextPage, target: string): number[] {
  const ordered = page.items.map((item, index) => ({ item, index, x: item.transform[4]!, y: item.transform[5]!,
    height: Math.hypot(item.transform[2]!, item.transform[3]!) })).sort((a, b) => a.y - b.y || a.x - b.x)
  const rows: Array<typeof ordered> = []
  for (const item of ordered) {
    const row = rows[rows.length - 1]
    if (row && Math.abs(row[0]!.y - item.y) <= Math.min(row[0]!.height, item.height) * .45) row.push(item)
    else rows.push([item])
  }
  const events: Array<{ x: number; delta: number }> = []
  const heights = ordered.map(i => i.height).sort((a, b) => a - b)
  const bodyHeight = heights[Math.floor(heights.length / 2)] || 12
  const isMargin = (row: typeof ordered) => {
    const text = row.map(i => i.item.str).join('')
    const index = rows.indexOf(row)
    const isolated = (row[0]!.y < (page.height || 0) * .08
      ? (rows[index + 1]?.[0]?.y ?? row[0]!.y) - row[0]!.y
      : row[0]!.y - (rows[index - 1]?.[0]?.y ?? row[0]!.y)) > bodyHeight * 2.5
    return page.height && (row[0]!.y < page.height * .08 || row[0]!.y > page.height * .92)
      && (isolated || row.every(i => i.height < bodyHeight * .85) || /^(?:\s*\d+\s*|[A-Z][A-Z\s-]{2,})$/.test(text))
  }
  const bodyRows = rows.filter(row => {
    const text = normalize(row.map(i => i.item.str).join(''))
    return !isMargin(row) || (!!text && target.includes(text))
  })
  for (const row of bodyRows) {
    row.sort((a, b) => a.x - b.x)
    for (let i = 1; i < row.length; i++) {
      const left = row[i - 1]!, right = row[i]!
      const start = left.x + left.item.width, end = right.x
      if (end - start > bodyHeight * .8 && normalize(row.slice(0, i).map(v => v.item.str).join('')).length >= 6
        && normalize(row.slice(i).map(v => v.item.str).join('')).length >= 6)
        events.push({ x: start, delta: 1 }, { x: end, delta: -1 })
    }
  }
  let count = 0, previous = 0, best = 0, gutter: number | undefined
  for (const event of events.sort((a, b) => a.x - b.x)) {
    if (count >= Math.max(3, bodyRows.length * .2) && event.x - previous > bodyHeight * .2 && count > best) {
      best = count; gutter = (event.x + previous) / 2
    }
    count += event.delta; previous = event.x
  }
  if (gutter === undefined) return bodyRows.flatMap(row => row.map(i => i.index))
  // 跨栏标题把页面分成上下阅读区，不能把标题后右栏排到整页左栏之后。
  const result: number[] = [], band: typeof bodyRows = []
  const flush = () => {
    for (const right of [false, true]) for (const row of band)
      for (const item of row) if ((item.x >= gutter!) === right) result.push(item.index)
    band.length = 0
  }
  for (const row of bodyRows) {
    if (isMargin(row) || row.some(i => i.x < gutter! && i.x + i.item.width > gutter!)) {
      flush(); result.push(...row.map(i => i.index))
    } else band.push(row)
  }
  flush()
  return result
}

/** 半全局编辑距离：页面前后自由，chunk 内的少量错字、漏字、数字移位允许有代价地对齐。 */
export function locateCitationHighlights(pages: CitationTextPage[], sourceText: string): CitationRangeResult {
  const exact = matchCitationItems(pages, sourceText)
  const fallback: CitationRangeResult = { ...exact, rangesByPage: new Map(), rangeLocated: false, approximate: false }
  const query = [...normalize(sourceText)]
  if (!query.length) return fallback
  const raw: RawCharacter[] = []
  for (const page of [...pages].sort((a, b) => a.pageNumber - b.pageNumber)) {
    for (const index of readingItems(page, query.join(''))) {
      const item = page.items[index]!
      let offset = 0
      for (const value of item.str) {
        raw.push({ value, page: page.pageNumber, item: index, offset, end: offset + value.length })
        offset += value.length
      }
    }
  }
  const characters = raw.flatMap((item, index) => [...normalize(item.value)].map(value => ({ value, raw: index })))
  const m = query.length, n = characters.length
  // 过大的异常页码范围保留部分匹配，不分配无上限的回溯矩阵。
  if (!n || m * n > 16_000_000) return fallback
  const trace = new Uint8Array((m + 1) * (n + 1))
  let previous = new Uint32Array(n + 1), current = new Uint32Array(n + 1)
  for (let i = 1; i <= m; i++) {
    current[0] = i
    for (let j = 1; j <= n; j++) {
      const diagonal = previous[j - 1]! + Number(query[i - 1] !== characters[j - 1]!.value)
      const deletion = previous[j]! + 1, insertion = current[j - 1]! + 1
      const cost = Math.min(diagonal, deletion, insertion)
      current[j] = cost
      trace[i * (n + 1) + j] = cost === diagonal ? 1 : cost === deletion ? 2 : 3
    }
    ;[previous, current] = [current, previous]
  }
  let cost = Infinity, end = 0
  for (let j = 1; j <= n; j++) {
    if (previous[j]! < cost || (previous[j] === cost && trace[m * (n + 1) + end] === 2
      && trace[m * (n + 1) + j] === 1)) { cost = previous[j]!; end = j }
  }
  if (cost > Math.floor(m * .2) || (m < 24 && cost !== 0)) return fallback
  // 两处相距较远的同等候选无法消歧时，不把它们连接成一个大范围。
  for (let j = 1; j <= n; j++)
    if (previous[j] === cost && Math.abs(j - end) >= m * .8) return fallback
  let i = m, j = end, matched = 0, run = 0, longest = 0
  const matches: Array<{ query: number; position: number }> = []
  while (i > 0 && j > 0) {
    const direction = trace[i * (n + 1) + j]
    if (direction === 1) {
      if (query[i - 1] === characters[j - 1]!.value) {
        matched++; run++; longest = Math.max(longest, run)
        matches.push({ query: i - 1, position: j - 1 })
      } else run = 0
      i--; j--
    } else if (direction === 2) { i--; run = 0 }
    else { j--; run = 0 }
  }
  const start = j
  matches.reverse()
  const boundaryTolerance = Math.min(12, Math.floor(m * .08))
  if (!matches.length || matched < m * .75 || longest < Math.min(12, m)
    || matches[0]!.query > boundaryTolerance || m - 1 - matches[matches.length - 1]!.query > boundaryTolerance)
    return fallback
  let rawStart = characters[start]!.raw, rawEnd = characters[end - 1]!.raw
  // 只补 chunk 自身的首尾标点，不把相邻句子的标点或文字带进来。
  const sourceChars = [...sourceText.trim()]
  const leading = sourceChars.slice(0, sourceChars.findIndex(c => !!normalize(c))).filter(c => c.trim())
  let lastLetter = sourceChars.length - 1
  while (lastLetter >= 0 && !normalize(sourceChars[lastLetter]!)) lastLetter--
  const trailing = sourceChars.slice(lastLetter + 1).filter(c => c.trim())
  for (const value of [...leading].reverse()) {
    let pos = rawStart - 1
    while (pos >= 0 && !raw[pos]!.value.trim()) pos--
    if (pos < 0 || raw[pos]!.value.normalize('NFKC') !== value.normalize('NFKC')) break
    rawStart = pos
  }
  for (const value of trailing) {
    let pos = rawEnd + 1
    while (pos < raw.length && !raw[pos]!.value.trim()) pos++
    if (pos >= raw.length || raw[pos]!.value.normalize('NFKC') !== value.normalize('NFKC')) break
    rawEnd = pos
  }
  const rangesByPage = new Map<number, Map<number, CitationItemRange>>()
  const indexesByPage = new Map<number, Set<number>>()
  for (const character of raw.slice(rawStart, rawEnd + 1)) {
    const ranges = rangesByPage.get(character.page) ?? new Map<number, CitationItemRange>()
    const range = ranges.get(character.item)
    ranges.set(character.item, { start: Math.min(range?.start ?? Infinity, character.offset),
      end: Math.max(range?.end ?? 0, character.end) })
    rangesByPage.set(character.page, ranges)
    const indexes = indexesByPage.get(character.page) ?? new Set<number>()
    indexes.add(character.item); indexesByPage.set(character.page, indexes)
  }
  return { ...exact, indexesByPage, rangesByPage, rangeLocated: true, approximate: cost > 0 }
}
