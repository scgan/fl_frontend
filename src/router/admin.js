const adminRouter = [
  {
    path: '/admin',
    name: 'admin',
    component: () => import('../views/AdminView/index.vue'),
    redirect: '/admin/perlist',
    
    children: [
      {
        path: '/admin/perlist',
        name: 'perlist',
        component: () => import('../views/AdminView/PeopleList/index.vue'),
      },
      {
        path: '/admin/verifyper',
        name: 'verifyper',
        component: () => import('../views/AdminView/VerifyPer/index.vue'),
      },
      {
        path: '/admin/peopleNo',
        name: 'peopleNo',
        component: () => import('../views/AdminView/PeopleNo/index.vue'),
      },
      {
        path: '/admin/databaseTree',
        name: 'databaseTree',
        component: () => import('../views/AdminView/DatabaseTree/index.vue'),
      },
      {
        path: '/admin/keyWords',
        name: 'keyWords',
        component: () => import('../views/AdminView/KeywordView/index.vue'),
      },
      {
        path: '/admin/corpusSet',
        name: 'corpusSet',
        component: () => import('../views/AdminView/CorpusSet/index.vue'),
      },
      {
        path: '/admin/corpusList',
        name: 'corpusList',
        component: () => import('../views/AdminView/CorpusList/index.vue'),
      },
      {
        path: '/admin/corpusListNo',
        name: 'corpusListNo',
        component: () => import('../views/AdminView/CorpusNo/index.vue'),
      },
      {
        path: '/admin/verifyCor',
        name: 'verifyCor',
        component: () => import('../views/AdminView/VerifyCor/index.vue'),
      },
      {
        path: '/admin/databaseImg',
        name: 'databaseImg',
        component: () => import('../views/AdminView/DatabaseImg/index.vue'),
      },
      {
        path: '/admin/rank',
        name: 'rank',
        component: () => import('../views/AdminView/SubmitRank/index.vue'),
      },
      {
        path: '/admin/resetPassword',
        name: 'resetPassword',
        component: () => import('../views/AdminView/ResetPassword/index.vue'),
      },
      // 新增：历史数据审核页面
      {
        path: '/admin/historyVerify',
        name: 'historyVerify',
        component: () => import('../views/AdminView/HistoryVerify/index.vue'),
      },
      // 新增：工作量统计页面
      {
        path: '/admin/workloadStats',
        name: 'workloadStats',
        component: () => import('../views/AdminView/WorkloadStats/index.vue'),
      },
      // 新增：已审核恢复语料页面
      {
        path: '/admin/reviewedRecovery',
        name: 'reviewedRecovery',
        component: () => import('../views/AdminView/ReviewedRecovery/index.vue'),
      },
    ],
  },
]

export default adminRouter