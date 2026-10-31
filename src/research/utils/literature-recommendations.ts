/** 混合推荐的展示去重；库外文献无 corpus_id，不能把所有 null ID 当成一篇。 */
export interface LiteratureRecommendation {
  corpus_id: number | null
  title: string
  author?: string
  year?: number | null
  source?: string
  attachment_paths?: string[]
  origin?: 'LIBRARY' | 'WEB'
  external_url?: string
  doi?: string
}

/** 后端保留的联网诊断字段，仅描述接口数据，不生成面向用户的失败提示。 */
export interface WebRecommendationDetails {
  stage?: string
  reason?: string
  candidate_count?: number | null
  returned_count?: number | null
  filtered_count?: number
  elapsed_ms?: number
  error_type?: string
}

/** 为库内附件或联网来源生成可打开的链接，拒绝带脚本协议或凭据的外链。 */
export function recommendationLink(item: LiteratureRecommendation): string {
  if (item.origin === 'WEB') {
    try {
      const url = new URL(item.external_url || '')
      return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
        ? url.href : ''
    } catch { return '' }
  }
  if (!item.corpus_id || !item.attachment_paths?.length) return ''
  return '/api/public/file/corpus?' + new URLSearchParams({
    corpus_id: String(item.corpus_id), attachment_path: item.attachment_paths[0]!,
  }).toString()
}

/** 排除已选和重复文献，库内至多十篇、联网至多五篇；不足时不补齐。 */
export function displayRecommendations(items: LiteratureRecommendation[], selectedIds: number[]) {
  const ids = new Set(selectedIds)
  const titles = new Set<string>()
  const webKeys = new Set<string>()
  let libraryCount = 0
  let webCount = 0
  return items.filter((item) => {
    const title = (item.title || '').normalize('NFKC').toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}]/gu, '')
    if (!title || titles.has(title)) return false
    if (item.origin === 'WEB') {
      const link = recommendationLink(item)
      const key = item.doi?.toLocaleLowerCase() || link
      if (!link || webKeys.has(key) || webCount >= 5) return false
      webKeys.add(key)
      webCount++
    } else {
      if (!item.corpus_id || ids.has(item.corpus_id) || libraryCount >= 10) return false
      ids.add(item.corpus_id)
      libraryCount++
    }
    titles.add(title)
    return true
  })
}
