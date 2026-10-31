import request from '@/utils/request'
import { convertToFormData } from '@/utils/utils'

export const publicSearchService = (data) => {
  const params = new URLSearchParams()
  // 遍历data对象，允许重复属性
  Object.entries(data).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      // 数组类型：生成重复参数
      value.forEach((v) => params.append(key, v))
    } else {
      params.append(key, value)
    }
  })
  return request.get('/public/search', {
    params,
    paramsSerializer: {
      encode: (param) => param, // 禁用默认编码
    },
  })
}

export const publicGetFileService = (data) => {
  console.log(data)
  return request.get('/public/file/corpus', { params: data, responseType: 'blob' })
}

export const getLanguageSumService = () => {
  return request.get('/public/statistic/language')
}

export const getCategorySumService = () => {
  return request.get('/public/statistic/category')
}

export const getDatabaseSumService = () => {
  return request.get('/public/statistic/database')
}

export const getYearSumService = () => {
  return request.get('/public/statistic/year')
}

export const smartSearchService = (data) => {
  return request.get('/public/search/smart', { params: data })
}

export const getCorpusDetailService = (data) => {
  return request.get('/public/corpus_detail', { params: data })
}

/** 根主题库列表（菜单与筛选下拉用）。 */
export const getDatabaseRootsService = () => {
  return request.get('/public/database')
}

/** 按主题库（含其子库）检索已审核公开文献，支持标题/作者/语种/类型/年份筛选。 */
export const getDatabaseCorpusService = (data) => {
  return request.get('/public/database/corpus', { params: data })
}
