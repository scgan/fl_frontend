import { defineStore } from 'pinia'

export const useLiteratureSelectionStore = defineStore('literatureSelection', {
  state: () => ({
    // 存储选中的文献 ID 和相关信息 (使用对象而不是 Map 以支持持久化)
    selectedLiteratures: {},
    // 是否启用跨搜索选中
    enableCrossSearch: true,
    // AI 增强搜索的搜索内容
    aiSearchContent: '',
    // AI 跳转传递的搜索结果（用于jump事件）
    aiJumpSearchResults: null,
    // AI 跳转传递的总数
    aiJumpTotal: 0,
  }),

  getters: {
    // 获取所有选中 ID
    selectedIds: (state) => Object.keys(state.selectedLiteratures),

    // 获取所有附件路径
    selectedAttachments: (state) =>
      Object.values(state.selectedLiteratures).map((item) => item.attachment || []),

    // 获取选中数量
    selectedCount: (state) => Object.keys(state.selectedLiteratures).length,

    // 判断是否选中某个文献
    isItemSelected: (state) => (id) => state.selectedLiteratures.hasOwnProperty(id),

    // 获取所有选中项的信息
    getSelectedLiteratures: (state) => Object.values(state.selectedLiteratures),
  },

  actions: {
    // 添加选中项
    addSelection(literature) {
      const id = literature.corpus_id || literature.id
      this.selectedLiteratures[id] = {
        ...literature,
        attachment: literature.attachment || [],
        corpus_id: literature.corpus_id || literature.id,
      }
    },

    // 移除选中项
    removeSelection(id) {
      delete this.selectedLiteratures[id]
    },

    // 批量添加选中项
    addMultipleSelection(literatures) {
      literatures.forEach((literature) => {
        const id = literature.corpus_id || literature.id
        this.selectedLiteratures[id] = {
          ...literature,
          attachment: literature.attachment || [],
          corpus_id: literature.corpus_id || literature.id,
        }
      })
    },

    // 批量移除选中项
    removeMultipleSelection(ids) {
      ids.forEach((id) => {
        delete this.selectedLiteratures[id]
      })
    },

    // 清空选中项
    clearSelection() {
      this.selectedLiteratures = {}
    },

    // 切换选中状态
    toggleSelection(literature) {
      const id = literature.corpus_id || literature.id
      if (this.selectedLiteratures[id]) {
        this.removeSelection(id)
      } else {
        this.addSelection(literature)
      }
    },

    // 设置跨搜索选中开关
    setEnableCrossSearch(enable) {
      this.enableCrossSearch = enable
    },

    // 保存 AI 搜索内容
    saveAiSearchContent(content) {
      this.aiSearchContent = content
    },

    // 清空 AI 搜索内容
    clearAiSearchContent() {
      this.aiSearchContent = ''
    },

    // 设置 AI 跳转的搜索结果
    setAiJumpSearchResults(results, total) {
      this.aiJumpSearchResults = results
      this.aiJumpTotal = total || 0
    },

    // 清空 AI 跳转的搜索结果
    clearAiJumpSearchResults() {
      this.aiJumpSearchResults = null
      this.aiJumpTotal = 0
    },
  },

  // 持久化配置
  persist: {
    enabled: true,
    strategies: [
      {
        key: 'literature-selection',
        storage: localStorage,
        paths: ['aiSearchContent', 'aiJumpSearchResults', 'aiJumpTotal'], // 持久化AI搜索内容和AI跳转数据
      },
    ],
  },
})