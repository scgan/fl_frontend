/**
 * 辅助创作编辑器的纯逻辑工具：旧草稿清洗、文档 → 导出块。
 *
 * 抽成独立模块的原因：这两段逻辑是 Tiptap 迁移中风险最高的部分
 * （历史草稿可能被 schema 吃掉、导出可能丢格式），独立后可以脱离页面
 * 直接用 Node + jsdom 验证，不必依赖后端与登录态。
 */

const LEGACY_TAG_MAP = {
  B: 'strong',
  STRONG: 'strong',
  I: 'em',
  EM: 'em',
  U: 'u',
  S: 's',
  DEL: 's',
  SUP: 'sup',
  SUB: 'sub',
  P: 'p',
  // div 作为透明容器处理（不映射），否则旧草稿外层的 div 会生成 <p><p> 嵌套
  H1: 'h1',
  H2: 'h2',
  H3: 'h3',
  UL: 'ul',
  OL: 'ol',
  LI: 'li',
  BLOCKQUOTE: 'blockquote',
  BR: 'br',
  // 旧草稿的行内样式大多挂在这里（styleWithCSS 的产物），必须保留
  SPAN: 'span',
}

/** 这些标签整棵子树都要丢弃（脚本/样式/嵌入内容不应进入正文） */
const DROP_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META'])

/**
 * 把旧版 execCommand 草稿清洗成 Tiptap 能安全解析的 HTML。
 *
 * 只保留白名单标签与字体/字号/颜色三项行内样式；无法识别的标签会保留其
 * 子节点内容。清洗后若没有任何可读文字，退回纯文本分段，避免出现
 * 「打开就是空白」的数据事故。
 *
 * @param {string} raw 旧草稿 HTML。
 * @returns {string} 清洗后的 HTML；空输入返回 `<p></p>`。
 */
export function sanitizeDraftHtml(raw, parser = typeof DOMParser !== 'undefined' ? new DOMParser() : null) {
  if (!raw) return '<p></p>'
  if (!parser || typeof document === 'undefined') return raw
  try {
    const body = parser.parseFromString(`<div>${raw}</div>`, 'text/html').body
    const source = body.firstElementChild
    if (!source) return '<p></p>'
    const target = document.createElement('div')
    const walk = (node, parent) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          if (child.textContent) parent.appendChild(document.createTextNode(child.textContent))
          return
        }
        if (child.nodeType !== 1) return
        if (DROP_TAGS.has(child.tagName)) return
        const mapped = LEGACY_TAG_MAP[child.tagName]
        if (!mapped) {
          walk(child, parent)
          return
        }
        const element = document.createElement(mapped)
        const style = child.getAttribute('style') || ''
        const keep = []
        const fontMatch = style.match(/font-family:\s*([^;]+)/i)
        const sizeMatch = style.match(/font-size:\s*([^;]+)/i)
        const colorMatch = style.match(/color:\s*(rgb[^;]+|#[0-9a-fA-F]{3,8})/i)
        if (fontMatch) keep.push(`font-family:${fontMatch[1].trim()}`)
        if (sizeMatch) keep.push(`font-size:${sizeMatch[1].trim()}`)
        if (colorMatch) keep.push(`color:${colorMatch[1].trim()}`)
        // 没有任何可保留样式的 span 直接拍平，避免产出空标签
        if (mapped === 'span' && !keep.length) {
          walk(child, parent)
          return
        }
        if (keep.length) element.setAttribute('style', keep.join(';'))
        // 可点击引用上标：必须保留来源标记，否则刷新后点 [n] 打不开原文
        if (mapped === 'sup') {
          const runId = child.getAttribute('data-run')
          const citeIndexes = child.getAttribute('data-cite')
          if (runId) element.setAttribute('data-run', runId)
          if (citeIndexes) element.setAttribute('data-cite', citeIndexes)
          if (child.classList.contains('cite-mark')) element.classList.add('cite-mark')
        }
        parent.appendChild(element)
        walk(child, element)
      })
    }
    walk(source, target)
    if (!(target.textContent || '').trim()) {
      const lines = raw
        .replace(/<[^>]+>/g, '\n')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
      return lines.length ? lines.map((line) => `<p>${line}</p>`).join('') : '<p></p>'
    }
    return target.innerHTML
  } catch {
    return '<p></p>'
  }
}

const runFromNode = (node) => {
  const marks = (node.marks || []).map((mark) => mark.type)
  return {
    text: node.text || '',
    bold: marks.includes('bold'),
    italic: marks.includes('italic'),
    underline: marks.includes('underline'),
    strike: marks.includes('strike'),
    // citation 标记在 Word 里按上标还原
    superscript: marks.includes('superscript') || marks.includes('citation'),
    subscript: marks.includes('subscript'),
  }
}

const collectRuns = (node, runs) => {
  ;(node.content || []).forEach((child) => {
    if (child.type === 'text') {
      runs.push(runFromNode(child))
      return
    }
    if (child.type === 'hardBreak') {
      runs.push({ text: '\n' })
      return
    }
    if (child.content) collectRuns(child, runs)
  })
  return runs
}

const nodeText = (node) => {
  if (node.type === 'text') return node.text || ''
  if (!node.content) return ''
  return node.content.map(nodeText).join('')
}

/**
 * 把 Tiptap 文档 JSON 拍平成导出块（标题/段落/列表项 + 行内格式）。
 *
 * @param {object} docJson `editor.getJSON()` 的结果。
 * @returns {Array<{type: string, text: string, runs: Array}>} 导出块列表。
 */
export function blocksFromJson(docJson) {
  const blocks = []
  const push = (type, node) => {
    const text = nodeText(node)
    if (!text.trim()) return
    blocks.push({ type, text, runs: collectRuns(node, []) })
  }
  ;((docJson && docJson.content) || []).forEach((node) => {
    const name = node.type
    if (name === 'heading') {
      push(`h${(node.attrs && node.attrs.level) || 1}`, node)
      return
    }
    if (name === 'paragraph') {
      push('p', node)
      return
    }
    if (name === 'bulletList' || name === 'orderedList') {
      ;(node.content || []).forEach((item) => {
        ;(item.content || []).forEach((child) => push('li', child))
      })
      return
    }
    if (name === 'blockquote') {
      ;(node.content || []).forEach((child) => push('p', child))
    }
  })
  return blocks
}

/**
 * 把一段文字里的软换行合并：单个 \n 视为排版折行，不是新段落。
 *
 * 中英文边界处理不同：两侧都是 ASCII 字母/数字时补一个空格，其余（中文、
 * 标点）直接相接，避免出现「，从而…」这种被空格隔开或整段断开的观感。
 *
 * @param {string} block 空行分隔后的一段文字
 * @returns {string} 合并为单行的文字
 */
export function joinSoftLines(block) {
  return String(block || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce((acc, line) => {
      if (!acc) return line
      const prevChar = acc.slice(-1)
      const nextChar = line.slice(0, 1)
      const needSpace = /[A-Za-z0-9]/.test(prevChar) && /[A-Za-z0-9]/.test(nextChar)
      return acc + (needSpace ? ' ' : '') + line
    }, '')
}

/** 把行内文本转成 Tiptap 行内节点：支持 **加粗** 与 [n] 引用标记 */
function inlineContent(text, runId) {
  const source = String(text || '')
  const parts = []
  // 一次扫过「**加粗**」与「[1] / [1,3]」两类语法
  const pattern = /\*\*(.+?)\*\*|\[(\d+(?:\s*[,，]\s*\d+)*)\]/g
  let cursor = 0
  const pushText = (value) => {
    if (value) parts.push({ type: 'text', text: value })
  }
  let match = pattern.exec(source)
  while (match) {
    pushText(source.slice(cursor, match.index))
    if (match[1]) {
      parts.push({ type: 'text', text: match[1], marks: [{ type: 'bold' }] })
    } else {
      const indexes = match[2]
        .split(/[,，]/)
        .map((item) => item.trim())
        .filter(Boolean)
      const label = `[${indexes.join(',')}]`
      // 有 runId 时挂 citation 标记（可点击看原文），否则退化为普通上标
      const marks = runId
        ? [{ type: 'citation', attrs: { runId, indexes: indexes.join(',') } }]
        : [{ type: 'superscript' }]
      parts.push({ type: 'text', text: label, marks })
    }
    cursor = match.index + match[0].length
    match = pattern.exec(source)
  }
  pushText(source.slice(cursor))
  const merged = parts.filter((item) => item.text)
  return merged.length ? merged : [{ type: 'text', text: ' ' }]
}

const BULLET_PATTERN = /^[-*•]\s+/
const ORDERED_PATTERN = /^\d+[.、)]\s+/
const MD_HEADING_PATTERN = /^(#{1,6})\s+(.+)$/
const NUM_TITLE_PATTERN = /^(\d+(?:[.．]\d+)*)[\s、.．]+(.+)$/
const RULE_PATTERN = /^([-*_=])\1{2,}$/

/**
 * 判断一行是否是标题（Markdown 井号 / 整行加粗 / 编号标题）。
 *
 * @param {string} line 已 trim 的单行
 * @param {boolean} standalone 该行是否独占一个空行分隔块
 * @returns {{level: number, text: string} | null}
 */
function headingFromLine(line, standalone) {
  const markdown = line.match(MD_HEADING_PATTERN)
  if (markdown) {
    return { level: Math.min(markdown[1].length, 3), text: markdown[2].trim() }
  }
  // 只有独占一段时才把「**加粗整行**」「1 引言」当标题，避免误伤正文里的加粗句
  if (!standalone) return null
  const bold = line.match(/^\*\*(.+?)\*\*$/)
  if (bold && bold[1].trim().length <= 40) {
    return { level: 2, text: bold[1].trim() }
  }
  const numbered = line.match(NUM_TITLE_PATTERN)
  if (numbered) {
    const title = numbered[2].trim()
    if (title.length <= 30 && !/[。！？；，,：:]$/.test(title)) {
      return {
        level: Math.min(numbered[1].split(/[.．]/).length, 3),
        text: `${numbered[1]} ${title}`,
      }
    }
  }
  return null
}

const REFERENCE_HEADING_PATTERN =
  /^(?:\d+[.、]?\s*)?(?:建议|主要)?(?:参考文献|参考资料)$/
const REFERENCE_HEADING_EN = /^references?$/i

/**
 * 去掉文末的「参考文献 / 建议参考文献 / References」整段。
 *
 * 插入正文时不该把 AI 结果自带的参考文献清单也贴进去：正文的参考文献由
 * 「插入引用」统一生成并放在文末，重复插入会让编号和章节都乱掉。
 *
 * 只从**最后一个**这类小标题开始截断，且要求该行是独立短行（≤24 字），
 * 避免误伤正文里提到"参考文献"的长句子。
 *
 * @param {string} text AI 结果原文本
 * @returns {string} 去掉参考文献段后的文本
 */
export function stripReferenceSection(text) {
  const source = String(text || '')
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  let cutAt = -1
  lines.forEach((line, index) => {
    const plain = line
      .replace(/^[\s#*_>-]+/, '')
      .replace(/[\s#*_]+$/, '')
      .trim()
    if (!plain || plain.length > 24) return
    if (REFERENCE_HEADING_PATTERN.test(plain) || REFERENCE_HEADING_EN.test(plain)) {
      cutAt = index
    }
  })
  if (cutAt < 0) return source
  return lines
    .slice(0, cutAt)
    .join('\n')
    .replace(/\s+$/, '')
}

/**
 * 纯文本 / Markdown 片段 → 可插入编辑器的节点数组。
 *
 * 规则：**空行分段**（单个换行是软换行会被合并）；`# 标题`、独占一段的
 * `**整行加粗**`、短编号行会转成标题层级；连续的「- / *」「1.」行合成
 * 无序/有序列表；行内 `**加粗**` 转 bold；`[n]` 转上标（给了 runId 时
 * 转成可点击的 citation 标记）；`---` 分隔线忽略。
 *
 * @param {string} text AI 结果或用户粘贴的纯文本
 * @param {{runId?: string, stripReferences?: boolean}} [options] runId 用于把 [n] 绑定到具体运行；
 *   stripReferences 默认 true，插入正文时自动去掉文末参考文献段
 * @returns {Array<object>} Tiptap 节点数组（heading / paragraph / bulletList / orderedList）
 */
export function textToNodes(text, options = {}) {
  const runId = options.runId || null
  const source = options.stripReferences === false ? String(text || '') : stripReferenceSection(text)
  const blocks = source
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
  const nodes = []
  blocks.forEach((block) => {
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    if (!lines.length) return
    if (lines.every((line) => RULE_PATTERN.test(line))) return
    const isBullet = lines.every((line) => BULLET_PATTERN.test(line))
    const isOrdered = lines.every((line) => ORDERED_PATTERN.test(line))
    if (isBullet || isOrdered) {
      nodes.push({
        type: isBullet ? 'bulletList' : 'orderedList',
        content: lines.map((line) => ({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: inlineContent(
                line.replace(BULLET_PATTERN, '').replace(ORDERED_PATTERN, ''),
                runId,
              ),
            },
          ],
        })),
      })
      return
    }
    const standalone = lines.length === 1
    let buffer = []
    const flush = () => {
      if (!buffer.length) return
      nodes.push({
        type: 'paragraph',
        content: inlineContent(joinSoftLines(buffer.join('\n')), runId),
      })
      buffer = []
    }
    lines.forEach((line) => {
      const heading = headingFromLine(line, standalone)
      if (heading) {
        flush()
        nodes.push({
          type: 'heading',
          attrs: { level: heading.level },
          content: inlineContent(heading.text, runId),
        })
        return
      }
      buffer.push(line)
    })
    flush()
  })
  return nodes
}

/**
 * 从渲染后的 HTML 里取回纯文本，用于给缺少操作按钮的历史消息补「插入到正文」。
 *
 * 这是有损还原（标题层级、加粗会丢），只作为历史消息的兜底，新消息仍用原始文本。
 *
 * @param {string} html 消息 HTML
 * @returns {string} 纯文本（块级标签转成换行）
 */
export function plainTextFromHtml(html) {
  return String(html || '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|li|h[1-6]|tr|blockquote)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * 把 PDF 抽取出来的原文摘录整理成可读的段落数组。
 *
 * PDF 抽取的文本常见问题是「一行一句、没有段落」：整段挤在一起很难读。
 * 这里做三件事：合并软换行、按空行分段、过长的段落再按句末标点切成
 * 约 180 字的小段（中文阅读舒适区）。
 *
 * @param {string} text 原文摘录
 * @param {number} [maxChars=180] 单段最大字数
 * @returns {string[]} 段落数组
 */
export function splitExcerptParagraphs(text, maxChars = 180) {
  const source = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t\u00a0]+/g, ' ')
    // PDF 目录/页眉里的点线引导符对正文没有意义，直接折叠成一个省略号
    .replace(/\s*(?:\.{3,}|…{2,}|。\s*(?:\.{3,}))\s*/g, ' … ')
  const blocks = source.split(/\n\s*\n/)
  const paragraphs = []
  blocks.forEach((block) => {
    const merged = joinSoftLines(block).replace(/\s+/g, ' ').trim()
    if (!merged) return
    if (merged.length <= maxChars) {
      paragraphs.push(merged)
      return
    }
    const sentences = merged.match(/[^。！？；!?;]+[。！？；!?;]?/g) || [merged]
    let buffer = ''
    sentences.forEach((sentence) => {
      const piece = sentence.trim()
      if (!piece) return
      if (buffer && (buffer + piece).length > maxChars) {
        paragraphs.push(buffer)
        buffer = piece
        return
      }
      buffer += piece
    })
    if (buffer) paragraphs.push(buffer)
  })
  return paragraphs
}

/** 去掉标点与空白后的字符二元组，用于粗略的相似度比较（对中文改写容忍度高） */
function charBigrams(text) {
  const cleaned = String(text || '')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .toLowerCase()
  const grams = new Set()
  for (let index = 0; index < cleaned.length - 1; index += 1) {
    grams.add(cleaned.slice(index, index + 2))
  }
  return grams
}

function bigramOverlap(left, right) {
  if (!left.size || !right.size) return 0
  let shared = 0
  left.forEach((gram) => {
    if (right.has(gram)) shared += 1
  })
  return (2 * shared) / (left.size + right.size)
}

/**
 * 把原文摘录分成段落/句子，并标出与「引用语境」最贴近的句子。
 *
 * 证据接口没有返回"被引用的原句"（quote 存在 citation 表里，面板拿不到），
 * 这里用字符二元组相似度在你的正文那句话和摘录句子之间做匹配：
 * 命中的句子会被标记，前端据此高亮。
 *
 * @param {string} text 原文摘录
 * @param {string} context 点击 [n] 时所在的那句话/那一段
 * @param {{maxChars?: number, maxHits?: number}} [options]
 * @returns {{paragraphs: Array<{sentences: Array<{text: string, hit: boolean, score: number}>}>, hitCount: number, maxScore: number}}
 */
export function highlightExcerpt(text, context, options = {}) {
  const maxChars = options.maxChars || 180
  const maxHits = options.maxHits || 3
  const paragraphs = splitExcerptParagraphs(text, maxChars).map((paragraph) => {
    const sentences = (paragraph.match(/[^。！？；!?;]+[。！？；!?;]?/g) || [paragraph])
      .map((item) => item.trim())
      .filter(Boolean)
    return { sentences: sentences.map((sentence) => ({ text: sentence, hit: false, score: 0 })) }
  })
  const all = paragraphs.flatMap((paragraph) => paragraph.sentences)
  if (!all.length) return { paragraphs, hitCount: 0, maxScore: 0 }
  const contextGrams = charBigrams(context)
  if (!contextGrams.size) return { paragraphs, hitCount: 0, maxScore: 0 }
  all.forEach((sentence) => {
    sentence.score = bigramOverlap(contextGrams, charBigrams(sentence.text))
  })
  const maxScore = Math.max(...all.map((sentence) => sentence.score))
  const threshold = Math.max(0.2, maxScore * 0.5)
  all.forEach((sentence) => {
    if (sentence.score >= threshold) sentence.hit = true
  })
  // 最多高亮 maxHits 句，按分数取前几名，避免整段都亮
  const ranked = all
    .filter((sentence) => sentence.hit)
    .sort((left, right) => right.score - left.score)
  ranked.slice(maxHits).forEach((sentence) => {
    sentence.hit = false
  })
  return {
    paragraphs,
    hitCount: ranked.slice(0, maxHits).length,
    maxScore,
  }
}

/**
 * 用正文首个非列表块作为导出文件名，去掉文件系统非法字符。
 *
 * @param {Array<{type: string, text: string}>} blocks 导出块。
 * @returns {string} 40 字以内的标题。
 */
export function editorExportTitle(blocks) {
  const first = (blocks || []).find((block) => block.type !== 'li')
  const raw = String((first && first.text) || 'Quill 创作稿')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .trim()
  return (raw || 'Quill 创作稿').slice(0, 40)
}

/**
 * 把证据条目格式化为参考文献行。
 *
 * 只使用证据里真实存在的字段，缺失项留空，不猜测作者或年份。
 *
 * @param {object} item 证据条目（author/title_cn/title_en/source/publish_time/page_start/page_end）。
 * @param {number} index 引用序号（与正文上标一致）。
 * @returns {string} 形如 `[1] 作者. 题名. 来源, 2020, 第3-5页`。
 */
export function buildReference(item, index) {
  const source = item || {}
  const title = source.title_cn || source.title_en || '未知文献'
  const author = source.author ? `${source.author}. ` : ''
  const container = source.source ? `${source.source}, ` : ''
  const year = source.publish_time ? `${source.publish_time}` : ''
  const pages = source.page_start
    ? `, 第${source.page_start}${source.page_end ? `-${source.page_end}` : ''}页`
    : ''
  return `[${index}] ${author}${title}. ${container}${year}${pages}`
    .replace(/[ \t]+/g, ' ')
    .trim()
}

/**
 * 把一个版本并入版本列表：去重（与最新版本内容相同则跳过）、限量。
 *
 * @param {Array} list 现有版本（最新在前）。
 * @param {{id: string, at: number, html: string}} entry 新版本。
 * @param {number} limit 保留条数上限。
 * @returns {Array} 新的版本列表。
 */
export function pushVersion(list, entry, limit = 20) {
  const current = Array.isArray(list) ? list : []
  if (!entry || !entry.html) return current
  if (current[0] && current[0].html === entry.html) return current
  return [entry, ...current].slice(0, limit)
}
