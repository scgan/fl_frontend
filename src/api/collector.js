import request from '@/utils/request'
import { convertToFormData } from '@/utils/utils'

// config 可传 { silent: true }：不弹统一错误提示，由调用方自己提示（术语附件链路用）
export const corpusUploadService = (data, config = {}) => {
  let formData = convertToFormData(data)
  // console.log(formData)
  // console.log(data.file)
  return request.post('/collector/upload', formData, config)
}

export const corpusUpdateService = (data) => {
  let formData = convertToFormData(data)
  return request.post('/collector/update', formData)
}

export const getCorpusListService = (data) => {
  console.log(data)
  const params = new URLSearchParams()
  // 遍历data对象，允许重复属性
  Object.entries(data).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      // 数组类型：生成重复参数
      value.forEach((v) => params.append(key, v))
    } else {
      if (value !== null && value !== undefined) params.append(key, value)
    }
  })
  return request.get('/collector/get', {
    params,
    paramsSerializer: {
      encode: (param) => param, // 禁用默认编码
    },
  })
}

export const corpusDeleteService = (data) => {
  return request.get('/collector/delete', { params: data })
}

export const corpusExamineService = (data) => {
  return request.get(`/collector/examine?corpus_id=${data}`)
}

export const corpusWithdrawService = (data) => {
  return request.get(`/collector/withdraw?corpus_id=${data}`)
}

// 查看语料详情（公用）
export const corpusDetailService = (data) => {
  return request.get('/corpus/get/detail', { params: data })
}

export const getCategoryService = (data) => {
  return request.get('/corpus/category/get', { params: data })
}

export const getDatabaseService = () => {
  return request.get('/corpus/database/get')
}

export const getCorpusFileService = (data) => {
  console.log(data)
  return request.get('/file/corpus', { params: data, responseType: 'blob' })
}

// export const getCorpusFileService2 = (data) => {
//   console.log(data)
//   return request.get('/file/corpus', { params: data })
// }

export const getKeywordService = (data) => {
  return request.get('/corpus/keywords', { params: data })
}

export const getCorpusAbstractService = (data) => {
  let formData = convertToFormData(data)
  return request.post('/collector/generate_summary', formData)
}

export const translateAbstractService = (data) => {
  // let formData = convertToFormData(data)
  return request.post('/collector/translate_summary', data)
}

export const translateKeywordService = (data) => {
  // let formData = convertToFormData(data)
  return request.post('/collector/keywords_translate', data)
}

export const getUserLeader = (data) => {
  return request.get('/public/leaders', { params: data })
}

export const getUserDraft = (data) => {
  return request.get('/collector/get_draft', { params: data })
}

export const checkTitleService = (data) => {
  let formData = convertToFormData(data)
  return request.post('/collector/check_title', formData)
}

export const aiExtractService = (data, { refresh = false } = {}) => {
  let formData = convertToFormData(data)
  // refresh=1：跳过后端提取缓存，强制重新识别（识别质量差时用）
  if (refresh) formData.append('refresh', '1')
  return request.post('/collector/extract_pdf_info', formData)
}

export const aiExtractBatchService = (data) => {
  const formData = new FormData()
  data.files.forEach((fileItem) => {
    formData.append('files', fileItem.raw)
  })
  // console.log(data.file)
  return request.post('/collector/extract_pdf_info_batch', formData)
}

export const aiChatService = (data) => {
  // let formData = convertToFormData(data)
  return request.post('/ai_search/nl-search', data)
}

export const getAiTimeline = (data) => {
  return request.post('/ai_search/timeline', data)
}

// 新增：文献智能问答接口
// 修改文献问答接口支持流式输出
export const corpusQaService = (data, onChunk, onDone, onError, onJump) => {
  // 使用原生的fetch API来实现SSE流式传输,这样更可靠
  return new Promise((resolve, reject) => {
    // 构建请求URL
    const url = '/ai_search/corpus_qa'

    // 获取baseURL
    const baseURL = request.defaults.baseURL || ''
    const fullUrl = baseURL + url

    // 获取token
    const token = localStorage.getItem('token') || ''

    // 使用fetch API
    fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        'Accept': 'text/event-stream',
        'Accept-Encoding': 'identity', // 禁止压缩,确保流式传输正常工作
      },
      body: JSON.stringify(data),
    })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''
      let lastProcessedIndex = 0

      // 读取流式数据
      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          // 流结束,处理剩余的buffer
          if (buffer.trim()) {
            processSSEEvents(buffer, onChunk, onDone, onError, onJump, lastProcessedIndex)
          }
          resolve()
          break
        }

        // 解码数据块
        buffer += decoder.decode(value, { stream: true })

        // 处理完整的SSE事件(以双换行符分隔)
        const events = buffer.split('\n\n')

        // 保留最后一个可能不完整的事件
        if (buffer.endsWith('\n\n')) {
          buffer = ''
        } else {
          buffer = events.pop() || ''
        }

        // 处理完整的事件
        const completeEvents = events.join('\n\n')
        if (completeEvents.trim()) {
          lastProcessedIndex = processSSEEvents(completeEvents, onChunk, onDone, onError, onJump, lastProcessedIndex)
        }
      }
    })
    .catch((error) => {
      console.error('SSE流式请求失败:', error)
      if (onError) {
        onError(error.message || '网络请求失败')
      }
      reject(error)
    })
  })
}

// SSE事件处理函数
const processSSEEvents = (text, onChunk, onDone, onError, onJump, startIndex = 0) => {
  const events = text.split('\n\n')
  let lastIndex = startIndex

  for (let i = 0; i < events.length; i++) {
    const event = events[i]
    if (!event.trim()) continue

    const lines = event.split('\n')
    let eventType = ''
    let eventData = ''

    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventType = line.substring(6).trim()
      } else if (line.startsWith('data:')) {
        eventData = line.substring(5).trim()
      }
    }

    if (!eventType || !eventData) continue

    try {
      const data = JSON.parse(eventData)

      switch (eventType) {
        case 'meta':
          // 元数据事件
          console.log('SSE Meta:', data)
          break
        case 'chunk':
          // 内容片段
          if (data.content && onChunk) {
            onChunk(data.content)
          }
          break
        case 'done':
          // 完成事件
          if (onDone) {
            onDone(data)
          }
          break
        case 'error':
          // 错误事件
          if (onError) {
            onError(data.error || '未知错误')
          }
          break
        case 'jump':
          // 跳转事件
          if (onJump) {
            onJump(data)
          }
          break
      }
    } catch (error) {
      console.error('SSE数据解析错误:', error, eventData)
    }

    lastIndex = i + 1
  }

  return lastIndex
}

// 新增：获取文献问答历史记录接口
export const getCorpusQaHistoryService = (data) => {
  return request.get('/ai_search/corpus_qa/history', { params: data })
}

// 新增：删除文献问答历史记录接口
export const deleteCorpusQaHistoryService = (historyId) => {
  return request.delete(`/ai_search/corpus_qa/history/${historyId}`)
}

// 新增：获取文献问答历史记录详情接口
export const getCorpusQaHistoryDetailService = (historyId) => {
  return request.get(`/ai_search/corpus_qa/history/${historyId}`)
}

export const corpusTimelineService = (data) => {
  return request.post('ai_search/timeline_by_ids', data)
}

// 新增：文档翻译接口
export const translateDocumentService = (data) => {
  let formData = convertToFormData(data)
  return request.post('/corpus/translate_document', formData)
}

// 新增：查询翻译状态接口
export const getTranslationStatusService = (requestId) => {
  return request.get(`/corpus/translation_result/${requestId}`)
}

export const getTranslationDownLoadService = (requestId) => {
  return request.get(`/corpus/download_translation/${requestId}`, { responseType: 'blob' })
}

// 新增：核心检索接口（RAG搜索）
export const ragSearchService = (data) => {
  return request.post('/ai_search/internal/rag/search', data)
}
