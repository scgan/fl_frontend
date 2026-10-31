const uploadRouter = [
  {
    path: '/user',
    name: 'manage',
    component: () => import('../views/UploadView/index.vue'),
    redirect: '/user/home',
    children: [
      {
        path: '/user/home',
        name: 'userHome',
        component: () => import('../views/UploadView/FileManage/HomeViewShowcase.vue'),
      },
      {
        // 首页实时数据版（统计接口），保留备用
        path: '/user/home-realtime',
        name: 'userHomeRealtime',
        component: () => import('../views/UploadView/FileManage/HomeView.vue'),
      },
      {
        path: '/user/upload',
        name: 'upload',
        component: () => import('../views/UploadView/FileManage/FileUpload.vue'),
      },
      {
        path: '/user/term-search',
        name: 'termSearch',
        component: () => import('../views/UploadView/Terminology/TermSearch.vue'),
      },
      {
        path: '/user/term-upload',
        name: 'termUpload',
        component: () => import('../views/UploadView/Terminology/TermUpload.vue'),
      },
      {
        path: '/user/quickUpload',
        name: 'quickUpload',
        component: () => import('../views/UploadView/FileManage/FileQuickUpload.vue'),
      },
      {
        path: '/user/paper',
        name: 'paper',
        component: () => import('../views/UploadView/FileManage/FileManage.vue'),
      },
      {
        path: '/user/knowledge-bases',
        name: 'knowledgeBases',
        component: () => import('../views/UploadView/KnowledgeBase/List.vue'),
      },
      {
        // 知识库 · 数据库：某个主题库（含子库）下的文献展示
        path: '/user/database/:databaseId',
        name: 'userDatabase',
        component: () => import('../views/UploadView/KnowledgeBase/DatabaseLiterature.vue'),
      },
      {
        // 启明·智能体：智库问答 / 综览撰述 / 文献比对
        // 统一挂在 /user/agent 下，沿用研究布局骨架但隐藏其独立侧栏（meta.embed）
        path: '/user/agent',
        name: 'userAgent',
        meta: { embed: true },
        component: () => import('../research/ResearchLayout.vue'),
        redirect: '/user/agent/qiming',
        children: [
          {
            path: 'qiming',
            name: 'userAgentQiming',
            component: () => import('../research/views/qiming/QimingView.vue'),
          },
          {
            path: 'qiming/conversations/:id',
            name: 'userAgentQimingConversation',
            component: () => import('../research/views/qiming/QimingView.vue'),
          },
          {
            path: 'suzhi',
            name: 'userAgentSuzhi',
            component: () => import('../research/views/suzhi/SuzhiView.vue'),
          },
          {
            path: 'suzhi/runs/:runId',
            name: 'userAgentSuzhiRun',
            component: () => import('../research/views/suzhi/SuzhiView.vue'),
          },
          {
            path: 'zhijian',
            name: 'userAgentZhijian',
            component: () => import('../research/views/zhijian/ZhijianView.vue'),
          },
          {
            path: 'zhijian/runs/:runId',
            name: 'userAgentZhijianRun',
            component: () => import('../research/views/zhijian/ZhijianView.vue'),
          },
        ],
      },
      {
        path: '/user/knowledge-bases/:id',
        name: 'knowledgeBaseDetail',
        component: () => import('../views/UploadView/KnowledgeBase/Detail.vue'),
      },
      {
        path: '/user/change',
        name: 'change',
        component: () => import('../views/UploadView/FileManage/InfoChange.vue'),
      },
      {
        path: '/user/count',
        name: 'count',
        component: () => import('../views/UploadView/FileManage/FileCount.vue'),
      },
      {
        path: '/user/search',
        name: 'search',
        component: () => import('../views/UploadView/FileManage/FileSearch.vue'),
      },
      {
        path: '/user/aiExtract',
        name: 'extract',
        component: () => import('../views/UploadView/FileManage/AiExtract.vue'),
      },
      {
        path: '/user/rank',
        name: 'userRank',
        component: () => import('../views/AdminView/SubmitRank/index.vue'),
      },
      {
        path: '/user/draw',
        name: 'userDraw',
        component: () => import('../views/UploadView/FileManage/DrawTimeline.vue'),
      },
      {
        path: '/user/literature-detail',
        name: 'literatureDetail',
        component: () => import('../views/UploadView/FileManage/LiteratureDetail.vue'),
      },
      {
        path: '/visualizeAnalysis',
        name: 'visualizeAnalysis',
        component: () => import('../views/UploadView/FileManage/VisualizeAnalysis.vue'),
      },
      {
        path: '/user/translate',
        name: 'fileTranslate',
        component: () => import('../views/UploadView/FileManage/FileTranslate.vue'),
      },
      {
        path: '/user/writing',
        name: 'writingAssistant',
        component: () => import('../views/UploadView/FileManage/WritingAssistant.vue'),
      },
    ],
  },
  {
    path: '/agent',
    name: 'IntelligentAgent',
    component: () => import('../views/UploadView/FileManage/IntelligentAgent.vue'),
  },
  {
    // 每个 AI 对话一个独立路由：可直达、可刷新恢复，也便于从其他页面返回
    path: '/agent/c/:conversationId',
    name: 'IntelligentAgentConversation',
    component: () => import('../views/UploadView/FileManage/IntelligentAgent.vue'),
  },
]

export default uploadRouter
