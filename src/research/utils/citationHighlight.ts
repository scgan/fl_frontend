/** 将真实证据映射到 PDF.js 文字项，兼容内容流与页面阅读顺序不一致的 PDF。 */

/** PDF.js 文字及其视口坐标；保留原始下标用于画高亮。 */
export interface CitationTextItem {
  /** 原始文本，用于生成规范化字符流。 */
  str: string
  /** 未缩放视口中的文字矩阵，y 从页面顶部向下增加。 */
  transform: number[]
  /** PDF.js 原始文字宽度，由调用方保留用于渲染。 */
  width: number
  /** PDF 字体相对字号的上升、下降范围，用于覆盖基线以下的文字。 */
  ascent?: number
  descent?: number
}

/** 引用页范围内的一页文字。 */
export interface CitationTextPage {
  /** 从 1 开始的真实 PDF 页码。 */
  pageNumber: number
  /** 保持 PDF.js 原始数组顺序的文字项。 */
  items: CitationTextItem[]
  width?: number
  height?: number
}

/** 原始文字项内的 UTF-16 半开区间，裁剪 chunk 首尾。 */
export interface CitationItemRange { start: number; end: number }

/** 字符在原始 PDF 文字项中的位置，两个阅读顺序共享同一个标识。 */
interface CharacterLocation {
  value: string
  pageNumber: number
  itemIndex: number
  /** 原始项与字符偏移组成的唯一位置，防止两种排序重复计数。 */
  key: string
}

export interface CitationHighlightRect {
  left: number
  top: number
  width: number
  height: number
}

/** 匹配结果以真实 PDF 文字项定位，字符覆盖量不重复计数。 */
export interface CitationMatchResult {
  /** 每页命中的原始文字项下标。 */
  indexesByPage: Map<number, Set<number>>
  /** 已匹配的规范化字符数量。 */
  matchedCharacterCount: number
  /** 全部证据的规范化字符数量。 */
  targetCharacterCount: number
}

/**
 * 移除排版空白和标点，统一兼容字符与大小写。
 * @param value 原始证据或 PDF 文字。
 * @returns 仅保留字母和数字的匹配文本。
 */
function normalizeForMatch(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

/**
 * 按视口基线分行、行内从左到右排列；不修改 PDF.js 原始文字项数组。
 * 容差仅吸收同一行字体基线的小幅差异，避免把相邻正文行合并。
 * @param items 已转为未缩放视口坐标的文字项。
 * @returns 从上到下、同行从左到右排列的原始下标。
 */
function visualOrder(items: CitationTextItem[]): number[] {
  // 小字号上标引用按相邻正文的基线分行，绘制高亮仍保留原始坐标。
  // 仅接受紧邻、字号明显更大且位于下方的水平正文，避免并入上一行或脚注。
  const baselines = items.map((item) => {
    const y = item.transform[5]!
    if (!/^[\d\s\[\]［］(),，、–—-]+$/u.test(item.str)) return y
    const height = Math.hypot(item.transform[2]!, item.transform[3]!)
    let nearest: { distance: number; y: number } | undefined
    for (const body of items) {
      const bodyHeight = Math.hypot(body.transform[2]!, body.transform[3]!)
      const rise = body.transform[5]! - y
      if (
        height >= bodyHeight * 0.85 ||
        rise < bodyHeight * 0.1 ||
        rise > bodyHeight * 0.7 ||
        Math.abs(body.transform[1]!) > bodyHeight * 0.1 ||
        !/\p{L}/u.test(body.str)
      )
        continue
      const distance = Math.max(
        0,
        body.transform[4]! - (item.transform[4]! + item.width),
        item.transform[4]! - (body.transform[4]! + body.width),
      )
      if (distance <= bodyHeight && (!nearest || distance < nearest.distance)) {
        nearest = { distance, y: body.transform[5]! }
      }
    }
    return nearest?.y ?? y
  })
  const sorted = items.map((_, index) => index).sort((a, b) => baselines[a]! - baselines[b]!)
  const rows: Array<{ y: number; tolerance: number; indexes: number[] }> = []
  for (const index of sorted) {
    const item = items[index]!
    const y = baselines[index]!
    const tolerance = Math.max(1, Math.hypot(item.transform[2]!, item.transform[3]!) * 0.25)
    const row = rows[rows.length - 1]
    if (row && Math.abs(row.y - y) <= Math.min(row.tolerance, tolerance)) row.indexes.push(index)
    else rows.push({ y, tolerance, indexes: [index] })
  }
  return rows.flatMap((row) =>
    row.indexes.sort((a, b) => items[a]!.transform[4]! - items[b]!.transform[4]!),
  )
}

/**
 * 优先整段匹配内容流或视觉阅读顺序，失败后匹配至少 24 字符的连续原文。
 * 各段独立定位，避免页尾 DOI 先命中后导致页首正文永远无法搜索。
 * 降级片段取最长匹配而非固定窗口，保留同一锚点后不足 24 字符的尾部。
 * OCR 将数字移到行尾时，按相邻、同栏的物理行补充实际字符匹配。
 * 每个 PDF 字符只能用于一次匹配，防止重复证据虚增覆盖率。
 * @param pages 按页码排列、坐标已转换到视口的引用页文字。
 * @param sourceText 未经模型改写的完整证据正文。
 * @returns 每页命中项与规范化字符覆盖量。
 */
export function matchCitationItems(
  pages: CitationTextPage[],
  sourceText: string,
): CitationMatchResult {
  /**
   * 构造一种阅读顺序的字符流，两个顺序使用相同的原始位置标识。
   * @param visual 是否按页面几何位置排序。
   * @returns 可回查原始文字项的字符数组。
   */
  const makeStream = (visual: boolean): CharacterLocation[] =>
    pages.flatMap(({ pageNumber, items }) => {
      const order = visual ? visualOrder(items) : items.map((_, index) => index)
      return order.flatMap((itemIndex) =>
        normalizeForMatch(items[itemIndex]!.str)
          .split('')
          .map((value, offset) => ({
            value,
            pageNumber,
            itemIndex,
            key: `${pageNumber}:${itemIndex}:${offset}`,
          })),
      )
    })
  const streams = [makeStream(false), makeStream(true)].map((characters) => ({
    characters,
    text: characters.map(({ value }) => value).join(''),
  }))
  const target = normalizeForMatch(sourceText)
  const indexesByPage = new Map<number, Set<number>>()
  const used = new Set<string>()
  const targetLocations = new Map<number, string>()

  /**
   * 将可靠字符区间投影回原始文字项，保留跨页映射。
   * @param characters 当前阅读顺序的字符位置。
   * @param start 匹配起点。
   * @param length 匹配长度。
   */
  const record = (
    characters: CharacterLocation[],
    start: number,
    length: number,
    targetStart: number,
  ): void => {
    for (const [offset, character] of characters.slice(start, start + length).entries()) {
      used.add(character.key)
      targetLocations.set(targetStart + offset, character.key)
      const indexes = indexesByPage.get(character.pageNumber) ?? new Set<number>()
      indexes.add(character.itemIndex)
      indexesByPage.set(character.pageNumber, indexes)
    }
  }

  if (target) {
    for (const stream of streams) {
      const start = stream.text.indexOf(target)
      if (start >= 0) {
        record(stream.characters, start, target.length, 0)
        return {
          indexesByPage,
          matchedCharacterCount: target.length,
          targetCharacterCount: target.length,
        }
      }
    }
  }

  for (let offset = 0; offset + 24 <= target.length;) {
    let best: { characters: CharacterLocation[]; start: number; length: number } | undefined
    for (const stream of streams) {
      /**
       * 查找尚未使用的连续字符区间，重复文本不会复用同一处命中。
       * @param length 当前证据起点需要连续匹配的长度。
       * @returns 命中起点，未找到时为 -1。
       */
      const find = (length: number): number => {
        const segment = target.slice(offset, offset + length)
        let start = stream.text.indexOf(segment)
        while (start >= 0) {
          if (!stream.characters.slice(start, start + length).some(({ key }) => used.has(key)))
            return start
          start = stream.text.indexOf(segment, start + 1)
        }
        return -1
      }
      let start = find(24)
      if (start < 0) continue
      let low = 24
      let high = target.length - offset
      while (low < high) {
        const middle = Math.ceil((low + high) / 2)
        const candidate = find(middle)
        if (candidate >= 0) {
          low = middle
          start = candidate
        } else high = middle - 1
      }
      if (!best || low > best.length) best = { characters: stream.characters, start, length: low }
    }
    if (best) {
      record(best.characters, best.start, best.length, offset)
      offset += best.length
    } else offset += 1
  }
  // OCR 常把百分比等独立文字移到行末。保留长锚点，再按物理行匹配正文与相邻数字行。
  // 不把整行染色：每个源字符仍须映射到实际存在的 PDF 字符，而且不能重复占用。
  const rows: Array<{ pageNumber: number; items: number[]; characters: CharacterLocation[] }> = []
  for (const page of pages) {
    let row: (typeof rows)[number] | undefined
    for (const index of visualOrder(page.items)) {
      const item = page.items[index]!
      const previous = row ? page.items[row.items[row.items.length - 1]!] : undefined
      const height = Math.hypot(item.transform[2]!, item.transform[3]!)
      if (
        !previous ||
        Math.abs(previous.transform[5]! - item.transform[5]!) > height * 0.4 ||
        item.transform[4]! - (previous.transform[4]! + previous.width) > height * 1.2
      ) {
        row = { pageNumber: page.pageNumber, items: [], characters: [] }
        rows.push(row)
      }
      row!.items.push(index)
      row!.characters.push(
        ...normalizeForMatch(item.str)
          .split('')
          .map((value, offset) => ({
            value,
            pageNumber: page.pageNumber,
            itemIndex: index,
            key: `${page.pageNumber}:${index}:${offset}`,
          })),
      )
    }
  }
  const lines = sourceText
    .split(/\r?\n/)
    .map((raw) => ({ raw, text: normalizeForMatch(raw), start: 0 }))
  let start = 0
  for (const line of lines) {
    line.start = start
    start += line.text.length
  }
  const assignedRows = new Map<number, number>()
  const compatible = (pairs: CharacterLocation[], lineStart: number): boolean =>
    pairs.every((character, n) => {
      const existing = targetLocations.get(lineStart + n)
      return existing ? existing === character.key : !used.has(character.key)
    })
  const savePairs = (pairs: CharacterLocation[], lineStart: number): void => {
    pairs.forEach((character, n) => {
      if (!targetLocations.has(lineStart + n)) record([character], 0, 1, lineStart + n)
    })
  }
  for (const [lineIndex, line] of lines.entries()) {
    if (line.text.length < 12) continue
    const candidates: Array<{ row: number; pairs: CharacterLocation[]; extra: number }> = []
    for (const [rowIndex, row] of rows.entries()) {
      for (let from = 0; from < row.characters.length; from++) {
        if (row.characters[from]!.value !== line.text[0]) continue
        const pairs: CharacterLocation[] = []
        let pos = from
        for (const value of line.text) {
          while (pos < row.characters.length && row.characters[pos]!.value !== value) pos++
          if (pos === row.characters.length) break
          pairs.push(row.characters[pos++]!)
        }
        const extra = pos - from - pairs.length
        if (
          pairs.length === line.text.length &&
          extra <= Math.max(6, line.text.length * 0.5) &&
          compatible(pairs, line.start)
        )
          candidates.push({ row: rowIndex, pairs, extra })
      }
    }
    candidates.sort((a, b) => a.extra - b.extra)
    if (candidates[0] && (!candidates[1] || candidates[0].extra < candidates[1].extra)) {
      savePairs(candidates[0].pairs, line.start)
      assignedRows.set(lineIndex, candidates[0].row)
    }
  }
  const tokens = (raw: string): Array<{ text: string; start: number }> => {
    const compact = raw
    return [...compact.matchAll(/\d+(?:[.,]\d+)*(?:[~～–—-]\d+(?:\.\d+)?)?%?/g)].map((match) => ({
      text: normalizeForMatch(match[0]),
      start: normalizeForMatch(compact.slice(0, match.index)).length,
    }))
  }
  for (const [lineIndex, line] of lines.entries()) {
    if (!line.text || line.text.length >= 12) continue
    const neighbors = [-2, -1, 1, 2].flatMap((delta) => {
      const row = assignedRows.get(lineIndex + delta)
      return row === undefined ? [] : [row]
    })
    const numeric = /^[\d\s.,%~～–—/／-]+$/.test(line.raw.trim())
    const candidates: Array<{ row: number; pairs: CharacterLocation[]; distance: number }> = []
    for (const [rowIndex, row] of rows.entries()) {
      const page = pages.find((page) => page.pageNumber === row.pageNumber)!
      const distance = Math.min(
        ...neighbors
          .filter((near) => {
            const neighbor = rows[near]!
            const item = page.items[row.items[0]!]!
            return (
              neighbor.pageNumber === row.pageNumber &&
              Math.abs(page.items[neighbor.items[0]!]!.transform[4]! - item.transform[4]!) <=
                Math.hypot(item.transform[2]!, item.transform[3]!) * 3
            )
          })
          .map((near) => Math.abs(near - rowIndex)),
      )
      if (distance > 1) continue
      let pairs: CharacterLocation[] = []
      if (numeric) {
        const rowTokens = tokens(row.items.map((index) => page.items[index]!.str).join(''))
        let cursor = 0
        for (const token of tokens(line.raw)) {
          const found = rowTokens.findIndex(
            (item, index) => index >= cursor && item.text === token.text,
          )
          if (found < 0) {
            pairs = []
            break
          }
          const item = rowTokens[found]!
          pairs.push(...row.characters.slice(item.start, item.start + item.text.length))
          cursor = found + 1
        }
      } else if (row.characters.map((c) => c.value).join('') === line.text) pairs = row.characters
      if (pairs.length === line.text.length && compatible(pairs, line.start))
        candidates.push({ row: rowIndex, pairs, distance })
    }
    candidates.sort((a, b) => a.distance - b.distance)
    if (candidates[0] && (!candidates[1] || candidates[0].distance < candidates[1].distance))
      savePairs(candidates[0].pairs, line.start)
  }
  return {
    indexesByPage,
    matchedCharacterCount: targetLocations.size,
    targetCharacterCount: target.length,
  }
}

/**
 * 将引用文字绘制成连续背景，连接行距并填满同栏引用内部的缩进与短行空白。
 * @param items PDF.js 原始文字及字体坐标。
 * @param matchedIndexes 当前页实际命中的文字项。
 * @param viewport 页面当前变换与缩放比例。
 * @param ranges 可选的字符级引用范围，用于裁剪首尾文字。
 * @returns 保留分栏及未引用正文边界的连续高亮矩形，不改变匹配统计。
 */
export function buildCitationHighlightRects(
  items: CitationTextItem[],
  matchedIndexes: Set<number>,
  viewport: { transform: number[]; scale: number },
  ranges?: Map<number, CitationItemRange>,
): CitationHighlightRect[] {
  // 1. 将实际引用的字符范围投影到当前视口，保留首尾裁剪和字体升降部。
  const a = viewport.transform
  const boxes = items
    .map((item, index) => {
      const b = item.transform
      const range = ranges?.get(index)
      const start = range ? range.start / item.str.length : 0
      const length = range ? (range.end - range.start) / item.str.length : 1
      const x = a[0]! * b[4]! + a[2]! * b[5]! + a[4]!
      const y = a[1]! * b[4]! + a[3]! * b[5]! + a[5]!
      const vx = a[0]! * b[2]! + a[2]! * b[3]!,
        vy = a[1]! * b[2]! + a[3]! * b[3]!
      const dx = a[0]! * b[0]! + a[2]! * b[1]!,
        dy = a[1]! * b[0]! + a[3]! * b[1]!
      const norm = Math.hypot(dx, dy) || 1,
        advance = item.width * viewport.scale * length
      const originX = x + item.width * viewport.scale * start * dx / norm
      const originY = y + item.width * viewport.scale * start * dy / norm
      const ascent = Number.isFinite(item.ascent) ? item.ascent! : 1,
        descent = Number.isFinite(item.descent) ? item.descent! : 0
      const corners = [
        [originX + vx * descent, originY + vy * descent],
        [originX + vx * ascent, originY + vy * ascent],
        [originX + vx * descent + (advance * dx) / norm, originY + vy * descent + (advance * dy) / norm],
        [originX + vx * ascent + (advance * dx) / norm, originY + vy * ascent + (advance * dy) / norm],
      ]
      const left = Math.min(...corners.map((p) => p[0]!)),
        top = Math.min(...corners.map((p) => p[1]!))
      return {
        left,
        top,
        width: Math.max(...corners.map((p) => p[0]!)) - left,
        height: Math.max(...corners.map((p) => p[1]!)) - top,
        baseline: y,
        matched: ranges ? !!range : matchedIndexes.has(index),
        meaningful: !!normalizeForMatch(item.str),
        horizontal: Math.abs(dy / norm) < 0.1,
        clippedStart: !!range && range.start > 0,
        clippedEnd: !!range && range.end < item.str.length,
      }
    })
    .filter((box) => box.width > 0 && box.height > 0)
  // 2. 按物理行归组，并识别多行重复的栏间空白。
  const lines: Array<typeof boxes> = []
  for (const box of boxes.sort((a, b) => a.baseline - b.baseline || a.left - b.left)) {
    const line = lines[lines.length - 1]
    if (
      box.horizontal &&
      line?.[0]?.horizontal &&
      Math.abs(line[0].baseline - box.baseline) <= Math.min(line[0].height, box.height) * 0.4
    )
      line.push(box)
    else lines.push([box])
  }
  const result: CitationHighlightRect[] = []
  const rowByRect = new Map<CitationHighlightRect, number>()
  // 跨多行重复出现的竖向空白是栏间隙，不能为连接词间空白而把左右两栏连起来。
  const gapEvents: Array<{ x: number; delta: number }> = []
  for (const line of lines) {
    const ordered = [...line].sort((a, b) => a.left - b.left)
    for (let index = 1; index < ordered.length; index++) {
      const previous = ordered[index - 1]!,
        current = ordered[index]!
      const left = previous.left + previous.width,
        right = current.left
      if (
        previous.horizontal &&
        current.horizontal &&
        right - left > Math.min(previous.height, current.height) * 0.8
      ) {
        gapEvents.push({ x: left, delta: 1 }, { x: right, delta: -1 })
      }
    }
  }
  const gutters: Array<[number, number]> = []
  const minimumRows = Math.max(3, Math.ceil(lines.length * 0.25))
  let gapCount = 0,
    previousX = 0
  for (const event of gapEvents.sort((a, b) => a.x - b.x)) {
    if (gapCount >= minimumRows && event.x > previousX) {
      // 短行尾部也会反复出现空白；真正栏间隙只能被极少数跨栏标题穿过。
      const crossingRows = lines.filter((line) => line.some((box) =>
        box.meaningful && box.left < event.x && box.left + box.width > previousX,
      )).length
      if (crossingRows <= Math.max(1, Math.floor(lines.length * 0.05))) {
        const previous = gutters[gutters.length - 1]
        if (previous && Math.abs(previous[1] - previousX) < 0.01) previous[1] = event.x
        else gutters.push([previousX, event.x])
      }
    }
    gapCount += event.delta
    previousX = event.x
  }
  // 3. 合并同一行的引用文字，栏间隙及较长未引用内容仍保留。
  for (const [rowIndex, line] of lines.entries()) {
    let active: CitationHighlightRect | undefined
    line.sort((a, b) => a.left - b.left)
    // 匹配时忽略的引号、括号、句号随相邻正文绘制，避免首尾标点露白。
    for (const direction of ranges ? [] : [1, -1]) {
      const ordered = direction === 1 ? line : [...line].reverse()
      for (let index = 1; index < ordered.length; index++) {
        const box = ordered[index]!, neighbor = ordered[index - 1]!
        const gap = direction === 1
          ? box.left - neighbor.left - neighbor.width
          : neighbor.left - box.left - box.width
        if (!box.meaningful && neighbor.matched && gap <= box.height * 0.4)
          box.matched = true
      }
    }
    for (const box of line) {
      if (!box.matched) continue
      const gap = active ? box.left - active.left - active.width : Infinity
      const crossesGutter =
        active &&
        gutters.some(
          ([left, right]) =>
            Math.min(box.left, right) - Math.max(active!.left + active!.width, left) >
            box.height * 0.15,
        )
      if (
        active &&
        box.horizontal &&
        !crossesGutter &&
        gap <= box.height * 3
      ) {
        const bottom = Math.max(active.top + active.height, box.top + box.height)
        active.width = Math.max(active.left + active.width, box.left + box.width) - active.left
        active.top = Math.min(active.top, box.top)
        active.height = bottom - active.top
      } else {
        active = { left: box.left, top: box.top, width: box.width, height: box.height }
        result.push(active)
        rowByRect.set(active, rowIndex)
      }
    }
  }
  // 4. 连接同栏相邻引用行的行距；用原始边界判断，避免扩展后再次累积范围。
  // 未引用的中间行会阻断连接，首尾行外侧及横向字符裁剪保持原样。
  const original = result.map((rect, index) => ({ ...rect, rect, index, row: rowByRect.get(rect)! }))
  const parents = original.map((_, index) => index)
  /** 查找色块所属的连续引用分组，路径压缩避免长引用反复遍历。 */
  const blockRoot = (index: number): number => {
    while (parents[index] !== index) {
      parents[index] = parents[parents[index]!]!
      index = parents[index]!
    }
    return index
  }
  for (const upper of original) {
    if (!lines[upper.row]![0]!.horizontal) continue
    for (const lower of original) {
      if (lower.row <= upper.row || !lines[lower.row]![0]!.horizontal) continue
      const gap = lower.top - (upper.top + upper.height)
      if (gap > Math.min(upper.height, lower.height) * 1.5) continue
      const left = Math.max(upper.left, lower.left)
      const right = Math.min(upper.left + upper.width, lower.left + lower.width)
      if (right <= left) continue
      const interrupted = lines.slice(upper.row + 1, lower.row).some((line) =>
        line.some((box) => box.meaningful && box.left < right && box.left + box.width > left),
      )
      if (interrupted) continue
      // 跨栏标题不得把左右正文并入同一个填充块；紧密重叠的字框也必须归组。
      const spansGutter = [upper, lower].some((rect) => gutters.some(([start, end]) =>
        Math.min(rect.left + rect.width, end) - Math.max(rect.left, start) > rect.height * 0.15,
      ))
      if (!spansGutter) parents[blockRoot(lower.index)] = blockRoot(upper.index)
      if (gap <= 0) continue
      const boundary = (upper.top + upper.height + lower.top) / 2
      // 半像素重叠消除缩放和子像素取整的白缝；绘制层统一透明度避免重叠变深。
      const bottom = Math.max(lower.rect.top + lower.rect.height, lower.top + lower.height)
      upper.rect.height = Math.max(upper.rect.height, boundary + 0.5 - upper.rect.top)
      lower.rect.top = Math.min(lower.rect.top, boundary - 0.5)
      lower.rect.height = bottom - lower.rect.top
    }
  }
  // 5. 对同栏连续引用统一背景宽度，填掉悬挂缩进及短行尾部的白洞。
  // 只扩入排版空白；真实的未引用文字及首尾字符裁剪仍作为硬边界。
  const blocks = new Map<number, typeof original>()
  for (const rect of original) {
    const root = blockRoot(rect.index)
    const block = blocks.get(root) ?? []
    block.push(rect)
    blocks.set(root, block)
  }
  for (const block of blocks.values()) {
    const left = Math.min(...block.map((rect) => rect.left))
    const right = Math.max(...block.map((rect) => rect.left + rect.width))
    for (const originalRect of block) {
      let start = left, end = right
      for (const box of lines[originalRect.row]!) {
        if (box.meaningful && !box.matched) {
          if (box.left + box.width <= originalRect.left) start = Math.max(start, box.left + box.width)
          if (box.left >= originalRect.left + originalRect.width) end = Math.min(end, box.left)
        }
        if (box.matched && box.left >= originalRect.left &&
          box.left + box.width <= originalRect.left + originalRect.width) {
          if (box.clippedStart) start = Math.max(start, box.left)
          if (box.clippedEnd) end = Math.min(end, box.left + box.width)
        }
      }
      originalRect.rect.left = start
      originalRect.rect.width = end - start
    }
  }
  return result
}
