/** 私有知识库页面使用的列表、详情与文献关联接口。 */
import request from '@/utils/request'

export const listKnowledgeBases = (params) => request.get('/knowledge-bases', { params })
export const createKnowledgeBase = (data) => request.post('/knowledge-bases', data)
export const getKnowledgeBase = (id) => request.get(`/knowledge-bases/${id}`)
export const updateKnowledgeBase = (id, data) => request.put(`/knowledge-bases/${id}`, data)
export const deleteKnowledgeBase = (id) => request.delete(`/knowledge-bases/${id}`)
export const listKnowledgeBaseDocuments = (id, params) =>
  request.get(`/knowledge-bases/${id}/documents`, { params })
export const listKnowledgeBaseCandidates = (id, params) =>
  request.get(`/knowledge-bases/${id}/candidates`, { params })
export const addKnowledgeBaseDocuments = (id, corpusIds) =>
  request.post(`/knowledge-bases/${id}/documents`, { corpus_ids: corpusIds })
export const previewKnowledgeBaseDocuments = (id, corpusIds) =>
  request.post(`/knowledge-bases/${id}/documents/preview`, { corpus_ids: corpusIds })
export const removeKnowledgeBaseDocument = (id, corpusId) =>
  request.delete(`/knowledge-bases/${id}/documents/${corpusId}`)

/** 在当前知识库内提交文献异步索引重建。 */
export const rebuildKnowledgeBaseDocumentIndex = (id, corpusId) =>
  request.post(`/knowledge-bases/${id}/documents/${corpusId}/reindex`)
