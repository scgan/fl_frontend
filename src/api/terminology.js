/**
 * 术语库接口 + 术语附件的自动入库链路。
 *
 * 术语附件不是普通附件，每个附件都会变成一篇文献。附件的处理方式由
 * TERM_ATTACHMENT_BACKEND_READY 决定（见下方说明）：
 *
 * 【新契约 · 后端后台处理（TERM_ATTACHMENT_BACKEND_READY = true，已就绪）】
 *   附件原始文件随 /terminology/upload、/terminology/update 一起提交，后端在后台完成：
 *     1) 大模型提取（POST /collector/extract_pdf_info 同一套能力）
 *     2) 文献入库：提取成功 → 按提取结果入库；提取失败 → 同样入库，但文献状态置为
 *        CorpusStatus.EDITING(0,「编辑中」)，供用户在「文献管理」里自行补全
 *     3) 附件的所属数据库取术语的 category（附件与术语类别一致）
 *   前端不等待提取，学生只需「上传附件 + 提交」。
 *
 * 【旧实现（TERM_ATTACHMENT_BACKEND_READY = false，前端同步处理）】
 *   前端在提交时自动串行完成「大模型提取 → 文献上传 → 按术语类别绑定」，
 *   页面上已去掉「大模型提取 / 文献信息」按钮，学生同样是「上传附件 + 提交」。
 *   （后端已支持新契约，此分支仅作回退开关保留。）
 *
 * 术语接口（/terminology/*）本身已就绪（/upload、/get、/attachment_file）。
 */
import request from '@/utils/request'
import {
  aiExtractService,
  corpusUploadService,
  getCategoryService,
  getCorpusListService,
  getDatabaseService,
} from '@/api/collector'

// 后端术语接口是否就绪：置为 true 后走真实上传（附件同时走上面的入库链路）
export const TERM_API_READY = true

// 术语上传接口路径（后端就绪后若路径不同，只改这里）
export const TERM_UPLOAD_URL = '/terminology/upload'

/**
 * 附件是否交给后端在后台做大模型提取与文献入库（新契约）。
 * false：前端在提交时自动处理附件（当前可用）；
 * true ：前端只提交原始文件，不再等待提取——需要后端让 /terminology/upload、/terminology/update
 *        接收三个附件文件字段（source_attachment / definition_cn_attachment / definition_en_attachment），
 *        并在后台完成提取与入库（提取失败时文献状态置为 EDITING=0）。
 */
export const TERM_ATTACHMENT_BACKEND_READY = true

/** 术语的三个附件字段（均为选填） */
export const TERM_ATTACHMENT_FIELDS = [
  'source_attachment',
  'definition_cn_attachment',
  'definition_en_attachment',
]

/** 附件字段的中文名，用于提示文案 */
export const TERM_ATTACHMENT_LABELS = {
  source_attachment: '术语出处附件',
  definition_cn_attachment: '术语定义（中文）附件',
  definition_en_attachment: '术语定义（英文）附件',
}

/**
 * 附件字段 → 术语提交时携带的「关联文献 id」字段名。
 * 附件已作为文献入库，术语只保存关联关系，不再重复提交原始文件。
 */
export const TERM_ATTACHMENT_CORPUS_FIELDS = {
  source_attachment: 'source_attachment_corpus_id',
  definition_cn_attachment: 'definition_cn_attachment_corpus_id',
  definition_en_attachment: 'definition_en_attachment_corpus_id',
}

const pickId = (node) => node?.id ?? node?.database_id ?? node?.value ?? null

/* ------------------------------------------------------------------ *
 * 多条目结构：一个术语可以有多个出处、多个中/英文定义；
 * 术语出处模块整体可上传多个附件，每个定义也可写多条 MLA、上传多个附件
 * ------------------------------------------------------------------ */

let entryUid = 0
const nextUid = () => `e${++entryUid}`

/** 新增一个「术语定义」条目：定义文本 + 多条 MLA 出处（默认 1 条）+ 附件（可多选） */
export function createDefinitionEntry(text = '', mla = '') {
  return { _uid: nextUid(), text, sources: [mla], attachments: [] }
}

/** 新增一条空的 MLA（术语出处模块的每一项就是一条 MLA） */
export const createSourceMla = () => ''

/* ---------------- 列表增删与排序（定义条目与 MLA 列表共用） ---------------- */

export function addEntryToList(list, factory = createSourceMla) {
  list.push(factory())
}

export function removeEntryFromList(list, index, keepAtLeast = 1) {
  if (list.length <= keepAtLeast) return
  list.splice(index, 1)
}

export function moveEntryInList(list, index, offset) {
  const target = index + offset
  if (target < 0 || target >= list.length) return
  const [entry] = list.splice(index, 1)
  list.splice(target, 0, entry)
}

/** 统计新选择的附件数量（术语出处模块 + 每个定义条目，只算带 .raw 的新文件） */
export function countTermAttachments(data) {
  const countOf = (list) => (Array.isArray(list) ? list : []).filter((file) => file?.raw).length
  const definitions = [...(data?.definitions_cn || []), ...(data?.definitions_en || [])]
  return (
    countOf(data?.sourceAttachments) +
    definitions.reduce((sum, entry) => sum + countOf(entry?.attachments), 0)
  )
}

/**
 * 组装提交给术语接口的 multipart/form-data。
 *
 * 表单结构：
 *   sources            ['MLA1', 'MLA2', …]                        术语出处（多条 MLA）
 *   sourceAttachments  [file, …]                                  术语出处附件（可多个）
 *   definitions_cn     [{ text, sources: ['MLA1', …], attachments: [file, …] }, …]
 *   definitions_en     同上
 *
 * 提交契约（后端待实现，旧的扁平字段同时保留，现有后端可直接建出「第 1 条」）：
 *   · 结构用 JSON 字符串提交，避免多维下标难以对齐：
 *       sources        = ["MLA1", …]
 *       definitions_cn = [{ "text": "…", "sources": ["MLA1", …] }, …]
 *       definitions_en = 同上
 *     另附计数：source_count / definition_cn_count / definition_en_count
 *   · 附件仍按字段以文件形式提交（每个字段可多个文件）：
 *       术语出处          → source_attachment（本模块全部附件）
 *       第 1 个定义       → definition_cn_attachment / definition_en_attachment
 *       第 i 个定义(i≥1)  → definition_cn_attachment_i / definition_en_attachment_i
 *     JSON 里定义的顺序与附件字段下标一一对应。
 *   · 兼容旧字段（现有后端只认这些）：source_mla、definition_cn、
 *     definition_cn_source、definition_en、definition_en_source。
 */
export function buildTermFormData(data) {
  const formData = new FormData()

  const appendText = (key, value) => {
    if (value === undefined || value === null || value === '') return
    formData.append(key, value)
  }
  const appendFiles = (key, list) => {
    if (!Array.isArray(list)) return
    list.forEach((item) => {
      // 只提交新选择的文件（el-upload 项的 .raw 才是真 File）；
      // 服务端已有的附件记录不带 raw，不会被重复提交。
      if (item?.raw) formData.append(key, item.raw)
    })
  }
  const toJson = (value) => JSON.stringify(value ?? [])
  const clean = (list) => (Array.isArray(list) ? list : []).map((item) => item || '').filter(Boolean)

  appendText('name', data?.name)
  appendText('category', data?.category)
  appendText('terminology_id', data?.terminology_id)

  // 模块一：术语出处（多条 MLA + 模块级附件）
  const sources = clean(data?.sources)
  appendText('source_mla', sources[0])
  appendFiles('source_attachment', data?.sourceAttachments)
  if (sources.length) {
    formData.append('source_count', String(sources.length))
    formData.append('sources', toJson(sources))
  }

  // 模块二/三：中/英文定义（每个定义：文本 + 多条 MLA + 附件）
  const appendDefinitions = (list, key) => {
    const entries = Array.isArray(list) ? list : []
    if (!entries.length) return

    const payload = entries.map((entry) => ({
      text: entry?.text || '',
      sources: clean(entry?.sources),
    }))
    formData.append(`${key}_count`, String(entries.length))
    formData.append(key === 'definition_cn' ? 'definitions_cn' : 'definitions_en', toJson(payload))

    entries.forEach((entry, index) => {
      if (index === 0) {
        // 旧字段：现有后端据此建出「第 1 个定义」
        appendText(key, payload[index].text)
        appendText(`${key}_source`, payload[index].sources[0])
        appendFiles(`${key}_attachment`, entry?.attachments)
      } else {
        appendText(`${key}_${index}`, payload[index].text)
        appendFiles(`${key}_attachment_${index}`, entry?.attachments)
      }
    })
  }
  appendDefinitions(data?.definitions_cn, 'definition_cn')
  appendDefinitions(data?.definitions_en, 'definition_en')

  return formData
}

/**
 * 把一条术语归一化成「模块 + 多条」结构，供详情弹窗与修改弹窗展示。
 * 兼容三种后端形态：
 *   1) 现有后端（扁平字段）：source_mla / source_attachment(+_url) /
 *      definition_cn(_source) / attachment_process（按旧附件字段名记录状态）；
 *   2) 本次约定（JSON 字段）：sources: ["MLA…"]、definitions_cn: [{ text, sources: [...] }]，
 *      附件按 source_attachment、definition_cn_attachment_i 返回；
 *   3) 直接返回嵌套数组（sources: [{ mla|text, attachments }]）。
 *
 * @returns {{sourceMlas: string[], sourceAttachments: Array, sourceProcess: object|null,
 *            definitionsCn: Array, definitionsEn: Array}}
 *   定义条目形如 { text, mlas: string[], attachments: [{name, url}], process }
 */
export function normalizeTermEntries(row) {
  const process = row?.attachment_process || {}

  const toAttachments = (value) => {
    if (!value) return []
    const list = Array.isArray(value) ? value : [value]
    return list
      .map((item) => {
        if (!item) return null
        if (typeof item === 'string') return { name: item, url: '' }
        return {
          name: item.name || item.original_filename || item.filename || '',
          url: item.url || item.file_url || '',
        }
      })
      .filter((item) => item && item.name)
  }

  const parseList = (value) => {
    if (Array.isArray(value)) return value
    if (typeof value === 'string' && value.trim()) {
      try {
        const parsed = JSON.parse(value)
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    }
    return []
  }

  const splitMla = (value) =>
    String(value || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

  // ---- 模块一：术语出处 ----
  const rawSources = parseList(row?.sources)
  let sourceMlas = rawSources
    .map((item) => (typeof item === 'string' ? item : item?.mla || item?.text || ''))
    .filter(Boolean)
  if (sourceMlas.length === 0) sourceMlas = splitMla(row?.source_mla)

  let sourceAttachments = toAttachments(row?.source_attachments)
  if (sourceAttachments.length === 0) {
    sourceAttachments = row?.source_attachment
      ? [{ name: row.source_attachment, url: row.source_attachment_url || '' }]
      : []
  }
  if (sourceAttachments.length === 0) {
    // 旧形态：附件挂在出处条目上
    rawSources.forEach((item) => {
      if (item && typeof item === 'object' && item.attachments) {
        sourceAttachments = sourceAttachments.concat(toAttachments(item.attachments))
      }
    })
  }

  // ---- 模块二/三：中/英文定义 ----
  const buildDefinitions = (listValue, key, flatAttach, flatUrl, flatProcess) => {
    const list = parseList(listValue)
    if (list.length) {
      return list.map((item) => ({
        text: item?.text || '',
        mlas:
          typeof item?.sources === 'string'
            ? splitMla(item.sources)
            : parseList(item?.sources)
                .map((mla) => (typeof mla === 'string' ? mla : mla?.text || ''))
                .filter(Boolean),
        attachments: toAttachments(item?.attachments),
        process: item?.process || item?.attachment_process || null,
      }))
    }
    return [
      {
        text: row?.[key] || '',
        mlas: splitMla(row?.[`${key}_source`]),
        attachments: flatAttach ? [{ name: flatAttach, url: flatUrl || '' }] : [],
        process: flatProcess || null,
      },
    ]
  }

  return {
    sourceMlas,
    sourceAttachments,
    sourceProcess: process.source_attachment || null,
    definitionsCn: buildDefinitions(
      row?.definitions_cn,
      'definition_cn',
      row?.definition_cn_attachment,
      row?.definition_cn_attachment_url,
      process.definition_cn_attachment,
    ),
    definitionsEn: buildDefinitions(
      row?.definitions_en,
      'definition_en',
      row?.definition_en_attachment,
      row?.definition_en_attachment_url,
      process.definition_en_attachment,
    ),
  }
}

/* ------------------------------------------------------------------ *
 * 附件后台处理状态（/terminology/get 返回的 attachment_process）
 * 取值：processing 识别中 / done 已入库 / reused 已关联已有文献 /
 *       editing 识别未成功但已入库为「待补全」文献 / failed 处理失败
 * ------------------------------------------------------------------ */

export const TERM_PROCESS_LABELS = {
  processing: '后台识别中',
  done: '已入库',
  reused: '已关联已有文献',
  editing: '识别未成功，已入库为「待补全」文献',
  failed: '识别失败',
}

const TERM_PROCESS_TAGS = {
  processing: 'warning',
  done: 'success',
  reused: 'success',
  editing: 'warning',
  failed: 'danger',
}

/** 某个附件字段的处理状态（详情弹窗逐条展示用），无记录时返回 null */
export function attachmentProcessOf(attachmentProcess, field) {
  const entry = (attachmentProcess || {})[field]
  if (!entry?.state) return null
  return {
    state: entry.state,
    label: TERM_PROCESS_LABELS[entry.state] || entry.state,
    tag: TERM_PROCESS_TAGS[entry.state] || 'info',
    error: entry.error || '',
  }
}

/** 是否还有附件在后台识别中（弹窗据此轮询刷新） */
export function hasProcessingAttachment(attachmentProcess) {
  return Object.values(attachmentProcess || {}).some((item) => item?.state === 'processing')
}

/* ------------------------------------------------------------------ *
 * 所属类别：直接读取现有的大类（数据库树的最外层节点）
 * ------------------------------------------------------------------ */

let categoryTreeCache = null

/**
 * 读取术语可选的大类。大类就是「文献上传 → 所属数据库」里的那些库，
 * 直接取数据库树的最外层节点；若最外层只有一个节点（通常是根节点），则往下取一层。
 */
export async function getTermCategoryOptions(force = false) {
  if (!categoryTreeCache || force) {
    const res = await getDatabaseService()
    let nodes = res?.data?.data ?? []
    if (!Array.isArray(nodes)) nodes = []
    if (nodes.length === 1 && nodes[0]?.children?.length > 0) {
      nodes = nodes[0].children
    }
    categoryTreeCache = nodes.filter((node) => node && pickId(node) !== null)
  }

  return categoryTreeCache.map((node) => ({
    value: pickId(node),
    label: node.database_name || node.name || '',
  }))
}

/* ------------------------------------------------------------------ *
 * 术语附件 → 文献
 * ------------------------------------------------------------------ */

let categoryListCache = null

/** 大模型提取返回的文献类型名称 → category_id */
export async function resolveLiteratureCategoryId(categoryName) {
  if (!categoryName) return undefined

  if (!categoryListCache) {
    const res = await getCategoryService()
    categoryListCache = res?.data?.data ?? []
  }

  const hit = categoryListCache.find(
    (item) => item.category_name === categoryName || item.code === categoryName,
  )
  return hit?.category_id
}

/**
 * 把大模型提取结果整理成文献上传接口需要的字段。
 * 与文献上传页保持一致：提取结果里的中英文标题、ISBN/ISSN 顺序相反，这里同样对调一次。
 */
export function normalizeExtractedLiterature(extracted) {
  const literature = { ...(extracted || {}) }

  const title = literature.title_cn
  literature.title_cn = literature.title_en
  literature.title_en = title

  literature.ISSN = literature.ISBN
  delete literature.ISBN

  return literature
}

/** 去掉 undefined / null / '' 的字段，避免表单里出现 "undefined" 字符串 */
export function pruneEmpty(obj) {
  const result = {}
  Object.entries(obj || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    result[key] = value
  })
  return result
}

/** 从文献上传接口的返回里取新建文献的 id（后端若用别的字段名，只改这里） */
function pickCorpusId(res) {
  const body = res?.data
  const payload = body && typeof body === 'object' && 'data' in body ? body.data : body
  if (payload === undefined || payload === null) return null
  if (typeof payload === 'number' || typeof payload === 'string') return payload
  return payload.corpus_id ?? payload.id ?? null
}

/** 兜底：按标题查自己的文献列表，找到同标题的已有文献 id（旧版后端标题重复不带 id 时用） */
async function findOwnCorpusIdByTitle(title) {
  if (!title) return null
  const res = await getCorpusListService({ title_cn: title, page_num: 1, page_size: 10 })
  const rows = res?.data?.data?.data || []
  const hit = rows.find((row) => (row.title_cn || '').trim() === title.trim())
  return hit?.corpus_id ?? null
}

/** 单个附件：调用大模型提取，返回可校对、可提交的文献信息 */
export async function extractTermAttachment(fileItem) {
  const extractRes = await aiExtractService({ file: [fileItem] })
  const literature = normalizeExtractedLiterature(extractRes?.data?.data)

  const categoryId = await resolveLiteratureCategoryId(literature.category)
  if (categoryId !== undefined) literature.category_id = categoryId

  return literature
}

/**
 * 按附件本身的内容判断它该归入哪一个大类（仅作预填，学生可在弹窗里改）。
 * 特征词按「政策 / 外语 / 思想」三组投票，取命中最多的一组，再匹配大类名称。
 */
const CATEGORY_KEYWORD_RULES = [
  {
    key: '政策',
    keywords: [
      '政策', '规划', '纲要', '文件', '法规', '条例', '方案', '通知', '意见', '白皮书',
      'policy', 'plan', 'guideline', 'regulation',
    ],
  },
  {
    key: '外语',
    keywords: [
      '外语', '英语', '日语', '德语', '法语', '俄语', '韩语', '翻译', '二语', '教学法',
      '教材', '课堂', '学习者', 'language', 'english', 'translation', 'pedagog',
    ],
  },
  {
    key: '思想',
    keywords: [
      '思想', '哲学', '儒家', '道家', '墨家', '法家', '孔子', '孟子', '老子', '庄子',
      '荀子', '伦理', '文化', 'thought', 'philosoph', 'confucian', 'daoist',
    ],
  },
]

const toText = (value) => {
  if (value === undefined || value === null) return ''
  return Array.isArray(value) ? value.join(' ') : String(value)
}

/** 按文献内容（标题/关键词/摘要/来源/文件名）猜一个大类 id */
export function guessCategoryOptionId(literature, categoryOptions = [], fileName = '') {
  const text = [
    toText(literature?.title_cn),
    toText(literature?.title_en),
    toText(literature?.source),
    toText(literature?.summary),
    toText(literature?.keyword_cn),
    toText(literature?.keyword_en),
    toText(fileName),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (!text) return null

  let bestKey = null
  let bestScore = 0
  CATEGORY_KEYWORD_RULES.forEach((rule) => {
    const score = rule.keywords.reduce(
      (sum, keyword) => (text.includes(keyword.toLowerCase()) ? sum + 1 : sum),
      0,
    )
    if (score > bestScore) {
      bestScore = score
      bestKey = rule.key
    }
  })

  if (!bestKey) return null
  const option = (categoryOptions || []).find((item) => String(item.label).includes(bestKey))
  return option ? option.value : null
}

/** 大模型若直接返回了库信息（database_id / database / database_name），统一换算成 id 数组 */
function normalizeDatabaseId(literature, categoryOptions = []) {
  const raw =
    literature?.database_id ??
    literature?.database_ids ??
    literature?.database ??
    literature?.database_name
  if (raw === undefined || raw === null || raw === '') return null

  const ids = (Array.isArray(raw) ? raw : [raw])
    .map((value) => {
      if (typeof value === 'number') return value
      const asText = String(value)
      if (/^\d+$/.test(asText)) return Number(asText)
      const option = (categoryOptions || []).find(
        (item) => item.label === asText || item.label.includes(asText),
      )
      return option ? option.value : null
    })
    .filter((value) => value !== null)

  return ids.length > 0 ? ids : null
}

/**
 * 附件应归入的大类（数据库）id 数组，优先级：
 *   1) 文献信息里已经确认/修改过的 database_id
 *   2) preferred：术语的所属类别（术语类别同时就是附件类别，页面会默认填入附件）
 *   3) 大模型返回的库信息，最后按附件内容判断
 */
export function resolveLiteratureDatabaseIds(
  literature,
  categoryOptions = [],
  fileName = '',
  preferred = null,
) {
  const fromLiterature = normalizeDatabaseId(literature, categoryOptions)
  if (fromLiterature) return fromLiterature

  if (Array.isArray(preferred) && preferred.length > 0) return preferred

  const guessed = guessCategoryOptionId(literature, categoryOptions, fileName)
  return guessed === null || guessed === undefined ? null : [guessed]
}

/**
 * 把附件作为文献入库：
 * 已提取/校对保存过的用保存的信息，未保存过的现场调用大模型提取；
 * 所属类别默认取术语的所属类别（preferred），学生单独改过的以改后的为准。
 *
 * @param {object} fileItem el-upload 的文件项
 * @param {object|null} verified 「文献信息」弹窗里保存下来的文献信息
 * @param {Array} categoryOptions 大类列表
 * @param {Array|null} preferred 术语所属类别 id 数组
 */
export async function uploadTermAttachmentAsLiterature(
  fileItem,
  verified,
  categoryOptions = [],
  preferred = null,
) {
  const raw = fileItem?.raw
  if (!raw) return { corpusId: null, skipped: true }

  const literature = verified ? { ...verified } : await extractTermAttachment(fileItem)

  // 文献类型（category_id）是文献上传的必填项：大模型提取结果里若没有可信类型
  // （如返回了"跨学科研究"这类非类型词），必须让学生在「文献信息」弹窗里手选。
  if (literature.category_id === undefined || literature.category_id === null) {
    return { corpusId: null, needCategory: true, literature }
  }

  const databaseIds = resolveLiteratureDatabaseIds(
    literature,
    categoryOptions,
    fileItem.name,
    preferred,
  )
  if (!databaseIds) {
    // 判断不出所属类别时先不入库，让学生在弹窗里自己选
    return { corpusId: null, needDatabase: true, literature }
  }
  literature.database_id = databaseIds

  // 注意：必须传 el-upload 的文件项本身——convertToFormData 取的是 item.raw，
  // 传裸 File 会 append 成字符串 "undefined"，后端就会报"缺少语料文件"。
  literature.file = [fileItem]
  literature.status = 0 // 与文献上传页一致：待审核

  let uploadRes
  try {
    // silent：标题重复等由这里自行处理并复用已有文献，不再弹统一错误提示（失败原因由 submitTerm 回传）
    uploadRes = await corpusUploadService(pruneEmpty(literature), { silent: true })
  } catch (error) {
    // 同标题文献已存在：不重复上传，直接复用库里已有的那篇。
    // 优先用后端重复响应附带的 corpus_id；旧版后端不带时，查自己的文献列表兜底。
    const errData = error?.response?.data
    if (errData?.error === '原文标题重复') {
      const existingId = errData.corpus_id || (await findOwnCorpusIdByTitle(literature.title_cn))
      if (existingId) {
        return { corpusId: Number(existingId), reused: true, literature }
      }
    }
    throw error
  }

  return { corpusId: pickCorpusId(uploadRes), literature }
}

/**
 * 提交术语。附件的处理方式见文件头 TERM_ATTACHMENT_BACKEND_READY 说明：
 *   true ：附件原始文件随术语一起提交，后端后台提取并入库，前端不等待；
 *   false：前端逐个把附件自动入库（大模型提取 → 文献上传 → 按术语类别绑定），
 *          拿到 corpus_id 后连同术语一起提交；任一个附件失败则不提交术语。
 * 术语的所属类别（data.category）同时作为附件所属数据库的默认值。
 *
 * @param {object} data 术语表单（含三个附件字段的 el-upload 文件列表）
 */
export async function submitTerm(data) {
  // 多条目表单：附件分散在三个模块的各条目里，这里只做数量统计（提示文案与旧链路自查用）
  const attachmentCount = countTermAttachments(data)
  // 旧链路（TERM_ATTACHMENT_BACKEND_READY=false）只认识旧的扁平字段，即只处理第 0 条；
  // 当前后端已支持附件后台识别，走上面的新契约分支。
  const attachments = TERM_ATTACHMENT_FIELDS.map((field) => ({
    field,
    item: data?.[field]?.[0],
  })).filter(({ item }) => item?.raw)

  // 新契约：只提交原始文件，提取与入库都由后端在后台完成
  if (TERM_ATTACHMENT_BACKEND_READY) {
    const res = await request.post(TERM_UPLOAD_URL, buildTermFormData(data))
    return { ok: true, res, backendExtract: true, attachments: attachmentCount }
  }

  if (!TERM_API_READY) {
    // 术语接口未就绪：不发起任何请求，只把将要执行的操作交回调用方，便于联调前自查
    const plan = attachments.map(({ field, item }) => ({
      field,
      file: item.name,
      steps: [
        'POST /collector/extract_pdf_info  大模型提取',
        'POST /collector/upload  文献上传（status=0 待审核）',
        '所属类别取术语的所属类别',
      ],
    }))
    return { mock: true, plan, formData: buildTermFormData(data) }
  }

  const categoryOptions = await getTermCategoryOptions()
  const preferredDatabaseIds =
    data?.category === undefined || data?.category === null || data?.category === ''
      ? null
      : [data.category]

  // 三个附件相互独立：各自走「大模型提取 → 文献上传」链路、各得一条关联文献，
  // 文件相同也只是内容相同，不共享关联。
  const bindings = {}
  const reused = []
  for (const { field, item } of attachments) {
    let result
    try {
      result = await uploadTermAttachmentAsLiterature(
        item,
        null,
        categoryOptions,
        preferredDatabaseIds,
      )
    } catch (error) {
      // 透出后端返回的具体原因（如"原文标题重复"），不再吞成通用文案
      const detail = error?.response?.data?.error || error?.message || '未知错误'
      return {
        ok: false,
        message: `附件「${item.name}」识别或上传失败：${detail}`,
        error,
      }
    }
    if (result.needDatabase) {
      return {
        ok: false,
        message: `附件「${item.name}」未能自动判断所属类别，请检查术语所属类别后重试`,
      }
    }
    if (result.needCategory) {
      return {
        ok: false,
        message: `附件「${item.name}」未能自动识别文献类型，请检查附件内容后重试`,
      }
    }
    if (result.corpusId === undefined || result.corpusId === null) {
      return {
        ok: false,
        message: `附件「${item.name}」已入库但未返回文献 id，术语未提交`,
      }
    }
    if (result.reused) {
      reused.push({ field, file: item.name, corpusId: result.corpusId })
    }
    bindings[TERM_ATTACHMENT_CORPUS_FIELDS[field]] = result.corpusId
  }

  const res = await request.post(TERM_UPLOAD_URL, buildTermFormData({ ...data, ...bindings }))
  return { ok: true, mock: false, res, bindings, reused }
}

/**
 * 修改术语：
 *   1) 文本字段（名称/类别/出处/中英文定义及出处）直接随 /terminology/update 提交；
 *   2) 换了附件的字段：TERM_ATTACHMENT_BACKEND_READY 为 true 时把新文件直接提交给后端后台处理；
 *      否则前端先把新附件入库（大模型提取 → 文献上传 → 按术语所属类别绑定）再提交新的 corpus_id；
 *   3) 没换附件的字段不提交，保持原有绑定。
 * 整个过程只新增文献并改绑定关系：原来的文献与附件文件都保留在文献库里，不会被删除或修改。
 *
 * @param {object} data 术语表单（含 terminology_id；多条目结构见 buildTermFormData 注释，
 *                      每个条目的 attachments 里放新选择的文件）
 * @param {object} files 兼容旧的传参方式：{ source_attachment: [fileItem] } 等，可省略
 */
export async function updateTerm(data, files = {}) {
  // 新契约：新附件原始文件随 /terminology/update 一起提交，由后端后台提取并入库；
  // 条目附件的字段命名规则与上传一致（第 0 条用旧字段名，第 1 条起用 字段名_下标）。
  if (TERM_ATTACHMENT_BACKEND_READY) {
    const payload = { ...data }
    TERM_ATTACHMENT_FIELDS.forEach((field) => {
      // files 里传了旧式附件时，并入第 0 条
      if (files?.[field]?.length) {
        const listKey =
          field === 'source_attachment'
            ? 'sources'
            : field === 'definition_cn_attachment'
              ? 'definitions_cn'
              : 'definitions_en'
        const entries = Array.isArray(payload[listKey]) ? [...payload[listKey]] : []
        if (entries[0]) {
          entries[0] = {
            ...entries[0],
            attachments: [...(entries[0].attachments || []), ...files[field]],
          }
          payload[listKey] = entries
        }
      }
    })
    const res = await request.post(TERM_UPDATE_URL, buildTermFormData(payload))
    return { ok: true, res, backendExtract: true }
  }

  const categoryOptions = await getTermCategoryOptions()
  const preferredDatabaseIds =
    data?.category === undefined || data?.category === null || data?.category === ''
      ? null
      : [data.category]

  const bindings = {}
  const reused = []
  for (const field of TERM_ATTACHMENT_FIELDS) {
    const item = files?.[field]?.[0]
    if (!item?.raw) continue // 没换附件：不动原有绑定

    let result
    try {
      result = await uploadTermAttachmentAsLiterature(item, null, categoryOptions, preferredDatabaseIds)
    } catch (error) {
      const detail = error?.response?.data?.error || error?.message || '未知错误'
      return { ok: false, message: `附件「${item.name}」识别或上传失败：${detail}` }
    }
    if (result.needCategory) {
      return {
        ok: false,
        message: `附件「${item.name}」未能自动识别文献类型，请检查附件内容后重试`,
      }
    }
    if (result.needDatabase) {
      return {
        ok: false,
        message: `附件「${item.name}」未能自动判断所属类别，请检查术语所属类别后重试`,
      }
    }
    if (result.corpusId === undefined || result.corpusId === null) {
      return { ok: false, message: `附件「${item.name}」已入库但未返回文献 id，术语未保存` }
    }
    if (result.reused) {
      reused.push({ field, file: item.name, corpusId: result.corpusId })
    }
    bindings[TERM_ATTACHMENT_CORPUS_FIELDS[field]] = result.corpusId
  }

  const res = await request.post(TERM_UPDATE_URL, buildTermFormData({ ...data, ...bindings }))
  return { ok: true, res, bindings, reused }
}

/** 术语列表查询（术语查找页接入后端时使用） */
export const getTermListService = (params) => {
  return request.get('/terminology/get', { params })
}

/* ------------------------------------------------------------------ *
 * 术语管理：编辑 / 删除
 * ------------------------------------------------------------------ */

/**
 * 后端已提供 /terminology/update 与 /terminology/delete（行为见下方约定），
 * 「操作」列的编辑、删除真正发请求。
 *   POST /terminology/update   字段同 /terminology/upload + terminology_id；
 *       只更新传上来的字段与附件关联（*_corpus_id），没传的附件字段保持原绑定；
 *       不要删除或修改原来的文献记录。
 *   GET  /terminology/delete?terminology_id=xx
 *       只把术语条目软删除（is_deleted=1），关联的文献与附件文件保留在文献库中。
 */
export const TERM_MANAGE_API_READY = true

export const TERM_UPDATE_URL = '/terminology/update'
export const TERM_DELETE_URL = '/terminology/delete'

/** 术语编辑：字段与上传一致（multipart），terminology_id 指明要改哪条 */
export const termUpdateService = (data) => {
  return request.post(TERM_UPDATE_URL, buildTermFormData(data))
}

/** 术语删除（沿用项目里 GET + params 的写法） */
export const termDeleteService = (terminologyId) => {
  return request.get(TERM_DELETE_URL, { params: { terminology_id: terminologyId } })
}
