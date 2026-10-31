import request from '@/utils/request'
import { convertToFormData } from '@/utils/utils'

export const getUnverify = (data) => {
    return request.get('/admin/users/waiting_examine',{ params: data })
}

export const passPerson = (data) => {
    return request.get('/admin/users/examine',{ params: data })
}

export const deletePerson = (data) => {
    return request.post(`/admin/users/delete`,{user_id:data})
}

export const getUserList = (data) => {
    return request.get('/user/get',{ params: data })
}

export const changeUserInfo = (data) => {
		let formData = convertToFormData(data)
    return request.post('/admin/users/update',formData)
}

export const getDatabaseTree = () => {
    return request.get('/corpus/database/get')
}

export const addDatabaseTree = (data) => {
		let formData = convertToFormData(data)
    return request.post('/admin/database/add',formData)
}

export const deleteDatabaseTree = (data) => {
    return request.post('/admin/database/delete',data)
}

//关键词API
export const getKeywords = (data) => {
    return request.get('/corpus/keywords',{ params: data })
}

export const addKeyword = (data) => {
    return request.post('/admin/keyword/add',data)
}

export const updataKeyword = (data) => {
		let formData = convertToFormData(data)
    return request.post('/admin/keyword/update',formData)
}

export const deleteKeyword = (data) => {
    return request.get(`/admin/keyword/delete?keyword_id=${data}`)
}

//语料库设置API
export const getCorpus = (data) => {
    return request.get('/corpus/category/get',{ params: data })
}

export const addCorpus = (data) => {
    return request.post('/admin/category/add',data)
}

export const updataCorpus = (data) => {
    return request.post('/admin/category/update',data)
}

export const deleteCorpus = (data) => {
    return request.get(`/admin/category/delete?category_id=${data}`)
}

//语料库列表API
export const getVerifyCor = (data) => {//获取未审核的列表
    return request.get('/leader/examine',{ params: data })
}

export const getCorList = (data) => {//获取已审核的列表
    return request.get('/corpus/get',{ params: data })
}

export const passVerifyCor = (data) => {//通过语料审核
    return request.post('/leader/examine/approve',data)
}

export const rejectVerifyCor = (data) => {//驳回语料审核
   return request.post('/leader/examine/reject',data)
}

export const exportScoreService = (data) => {
  return request.get('/collector/export_corpus_count', { params: data, responseType: 'blob'});
};

// 重置用户密码API
export const resetUserPassword = (data) => {
    return request.post('/user/reset_user_password', data)
}

// 新增：获取二级管理员下属用户列表
export const getSubUsersService = (data) => {
  return request.get('/leader/subordinates', { params: data })
}

export const getExamineRecoveryService = (data) => {
  return request.get('/leader/examine/recovery', { params: data })
}

// 新增：统计工作量接口（is_recovery: 1=历史恢复语料，0=非恢复语料）
export const getExamineRecoveryStatsService = (params = {}) => {
  return request.get('/leader/examine/recovery/stats', { params });
}

// 新增：获取已审核的恢复语料接口
export const getExamineRecoveryReviewedService = (data) => {
  return request.get('/leader/examine/recovery/reviewed', { params: data })
}

// 新增：审核决策接口
export const getExamineRecoveryDecisionService = (data) => {
  return request.post('/leader/examine/recovery/decision', data);
}

// 新增：删除恢复语料接口
export const deleteExamineRecoveryService = (data) => {
  return request.post('/leader/examine/recovery/delete', data);
}

// AI 批量归类并审核：启动任务
export const startExamineRecoveryAiClassifyService = (data) => {
  return request.post('/leader/examine/recovery/ai-classify/start', data);
}

// AI 批量归类并审核：查询进度
export const getExamineRecoveryAiClassifyProgressService = (params) => {
  return request.get('/leader/examine/recovery/ai-classify/progress', { params });
}

// AI 批量归类并审核：停止任务
export const stopExamineRecoveryAiClassifyService = (data) => {
  return request.post('/leader/examine/recovery/ai-classify/stop', data);
}

// 新增：获取管理员用户列表接口
export const getAdminUserList = (data) => {
  return request.get('/admin/users/get', { params: data })
}
