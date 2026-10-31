# Foreign 统一前端

Foreign 多语种教育文献数据库的 Vue 应用，统一承载登录、文献采集与管理、审核、统计、知识库及智能研究。业务页面与研究工作区共用登录身份和前端部署入口。

后端配置与服务启动见 [Backend README](../Backend/README.md)，研究服务详情见 [Research Agent README](../Backend/research-agent/README.md)。

## 技术栈与功能

采用 Vue 3、Vite 6、Vue Router 4、Pinia、Element Plus 和 Axios；统计图使用 ECharts，研究关系图使用 Dagre，页面样式使用 Sass / CSS。业务页面以 JavaScript 为主，研究模块使用 TypeScript。

| 功能 | 入口 / 说明 |
| --- | --- |
| 登录与账号 | `/login`，包含注册、找回及重置密码相关流程 |
| 数据收集者工作台 | `/user`，默认进入 `/user/count`；上传、文献管理、搜索、翻译、统计等 |
| 知识库 | `/user/knowledge-bases`，管理关联文献及索引状态 |
| 管理与审核 | `/admin`，默认进入 `/admin/perlist`；账号、文献审核、分类、关键词及工作量管理 |
| 全局搜索文献阅读 | 从文献搜索页面选择文献，使用研究服务进行分析与追问 |
| 启明·智能问答 | `/research/qiming` |
| 智鉴·比对分析 | `/research/zhijian` |
| 溯知·文献综述 | `/research/suzhi` |
| 融通·国际传播 | `/research/rongtong` |

管理员和负责人分别为角色 `0`、`1`，数据收集者为角色 `2`。数据收集者从业务菜单底部“智能研究”进入研究工作区，点击“返回业务系统”回到 `/user/count`。

## 目录结构

```text
Frontend/
├── public/                     # 静态文件与文献格式示例
├── src/
│   ├── main.js / App.vue       # 应用入口
│   ├── router/                 # 登录、业务、管理路由与角色守卫
│   ├── api/                    # 业务 API 封装
│   ├── utils/request.js        # /api Axios 客户端与身份处理
│   ├── stores/                 # 业务状态
│   ├── components/             # 公共组件与 PDF 高亮
│   ├── views/                  # 登录、采集、管理页面
│   ├── assets/                 # 图片与业务样式
│   └── research/               # 研究布局、路由、API、状态、组件和样式
├── tests/                      # Node 回归测试
├── vite.config.js              # 开发端口、别名与代理
├── tsconfig.research.json       # 研究模块类型检查范围
├── default.conf / default-dev.conf
├── Dockerfile / Dockerfile-dev
└── deploy.sh / deploy-dev.sh
```

`@` 对应 `src/`。Element Plus API 和组件通过 Vite 插件自动导入，生成声明位于 `auto-imports.d.ts` 和 `components.d.ts`。

## 开发调试

使用 Node.js 22 与 npm。在 `Frontend/` 目录执行：

```bash
npm install
npm run dev
```

开发入口为 `http://localhost:5173`，Vite 配置会自动打开浏览器。完整业务功能需要可用的 Flask 后端；智能研究和文献阅读还需要 Research Agent。

### API 代理配置

开发代理位于 `vite.config.js`，当前配置为：

| 浏览器请求前缀 | 默认目标 | 路径转换 |
| --- | --- | --- |
| `/api` | `http://10.222.9.151:9503` | 移除 `/api`，如 `/api/user/captcha` → `/user/captcha` |
| `/research-api` | `http://127.0.0.1:18000` | 改为 `/api/v1`，如 `/research-api/health/ready` → `/api/v1/health/ready` |

联调时将两个 `target` 改为实际的服务器后端和 Agent 地址，修改后重启 Vite。当前 API 地址通过代理配置管理，没有定义 `VITE_API_URL` 等环境变量；业务客户端固定使用 `/api`，研究客户端固定使用 `/research-api`。

正式 `deploy.sh` 使用 `default.conf`：`/api` 指向生产 Backend `9502`，
`/research-api/` 指向生产 Agent `18001`。dev 的 `default-dev.conf` 与 Vite 仍使用 dev 服务，
不能把正式文献接口与 dev 研究接口混接，否则证据 ID 会去错误的数据库补题录，
出现 `Foreign 文献 #编号` 和“来源文献已删除”。
代理调整后需在正式 Frontend 目录拉取并执行 `sh deploy.sh`，重新构建 Nginx 镜像和容器。
之前误连 dev 创建的研究记录留在 dev；切回生产后重新发起研究，不需要因此重建生产索引。

## 登录、研究与 PDF 约定

- 登录令牌与角色分别保存在 `localStorage.token`、`localStorage.userRole`；请求携带 `Authorization: Bearer <token>`。
- 前端角色守卫控制页面入口。研究页面仅对角色 `2` 开放，并通过 Agent 恢复、验证会话；后端仍会校验 JWT、有效账号和资源权限。
- 研究工作区使用独立布局。`ResearchLayout.vue` 在进入 / 离开时添加 / 移除 `body.research-active`，研究样式位于 `src/research/styles/research.css`，新增样式应保持该作用域约定。
- 项目同时保留 `pdfjs-dist` 3.11.174 和 `research-pdfjs`（PDF.js 6.3.289）两套依赖。维护阅读器时，解析器、Viewer 和 Worker 必须使用各自配套的版本。
- `npm run dev` 和 `npm run build` 会自动把当前 PDF.js 的 CMap、标准字体复制到 `public/pdfjs/<版本>/`，两个阅读入口通过共享配置同源加载。生成资源不提交 Git；正式镜像必须通过 npm 构建流程打包，避免中文正文因字符映射缺失而消失。
- 文献阅读及启明、智鉴、溯知、融通的原文弹窗共用 `ContinuousPdfViewer.vue`，使用配套的 PDF.js 3.11.174 Viewer 纵向连续滚动，按可见页调度渲染并缓存邻近页。页码随滚动更新，缩放和适合宽度保留阅读位置；引用按真实页码跳转，并逐页叠加高亮。滚动和缩放复用已经鉴权下载的文档，不重复请求原文。
- 研究会话历史、运行结果和引用通过 `src/research/api/` 获取；流式请求使用带身份处理的 `authorizedFetch`。代理需要关闭响应缓冲，才能持续接收 SSE。
- 活动研究每五秒检查进度推送是否静默，静默时只读核对同一个 Run 的步骤和终态。
  即使代理延迟响应头或流块，也能更新检索、生成等阶段并加载最终结果；不会重新执行问答。
  结束运行或离开页面时，同时停止推送、快照查询和计时器。
- 重新打开活动会话时，从运行详情的持久化步骤立即恢复实际阶段；重放的旧节点事件不能让
  已确认的进度倒退为“准备上下文”。已完成会话直接展示已发布回答，不创建生成占位。

知识库列表会显示文献索引状态，并在当前页存在活动任务时轮询。重建请求由后端登记，消费者完成双路索引后才显示就绪；具体流程见 [索引 Worker 文档](../Backend/docs/corpus_index_worker.md)。普通文献问答的 SSE 参数和事件见 [接口说明](../Backend/docs/corpus_qa_frontend.md)。

## 常用命令

均在 `Frontend/` 目录执行：

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务 |
| `npm run type-check:research` | 检查 `src/research` 的 TypeScript / Vue 类型 |
| `npm run test:research` | 使用 Node 测试运行器执行 `tests/*.test.cjs` |
| `npm run build` | 构建静态产物到 `dist/` |
| `npm run preview` | 预览构建产物；API 联调仍需配置可用代理 |
| `npm run lint` | ESLint 检查并自动修复，会修改源码 |
| `npm run format` | Prettier 格式化 `src/`，会修改源码 |

提交涉及研究模块的修改前，执行：

```bash
npm run type-check:research
npm run test:research
npm run build
```

类型检查只覆盖研究模块；现有测试涵盖会话身份、运行生命周期、引用高亮和文献选择等逻辑，不能替代登录后页面与真实接口的验收。

## 一键脚本部署

在 Linux 服务器使用现有 `deploy-dev.sh`。先按 [Backend 部署说明](../Backend/README.md) 部署后端，再在 `Frontend/` 目录执行：

```bash
sh deploy-dev.sh
```

服务器需要 Node.js 22、npm 与 sudo Docker 权限。脚本会安装依赖、构建 `dist/`，通过 `Dockerfile-dev` 构建 Nginx 镜像，再更新 `foreign-frontend-dev` 容器并加入 `foreign-dev` 网络。部署后访问 `http://服务器地址:8002`。

也可以在 `Foreign/` 目录依次执行前后端脚本：

```bash
sh Backend/deploy-dev.sh
sh Frontend/deploy-dev.sh
```

只更新前端时重新执行 Frontend 的 `deploy-dev.sh` 即可。脚本执行安装和生产构建；研究模块的类型检查及测试按“常用命令”一节执行。

`default-dev.conf` 中的代理规则为：

| 前缀 | `foreign-dev` 网络内目标 |
| --- | --- |
| `/api/` | `ForeignBackend-dev:5000`，移除 `/api/` 前缀 |
| `/research-api/` | `ForeignResearchAgent-dev:18000`，改为 `/api/v1/` |

查看部署状态和日志：

```bash
sudo docker ps --filter name=foreign-frontend-dev
sudo docker logs --tail=100 foreign-frontend-dev
```

旧 EduResearch 独立前端不再作为当前部署入口。`Dockerfile`、`default.conf` 和 `deploy.sh` 属于原有正式前端入口，宿主端口为 `80`，业务代理目标为服务器 `9502`；`default.conf` 当前没有研究 API 代理。完整研究功能使用上述 `deploy-dev.sh` 流程。

Nginx 需保留 History 路由回退、PDF Worker 的 `.mjs` JavaScript MIME 类型和 SSE 的关闭缓冲配置，具体参考 `default-dev.conf`。

## 常见问题

| 现象 | 排查方向 |
| --- | --- |
| 验证码、登录或业务接口不可用 | 检查 `/api` 的代理目标、后端监听端口及网络；Vite 默认连接服务器 dev 后端 |
| 研究页面无法进入 | 确认已登录、角色为 `2`，且 Agent 能验证当前令牌 |
| 研究接口 502 / 503 | 查看 Agent 和 Nginx 日志，检查 `/research-api/health/ready` 及数据库迁移状态 |
| SSE 一次性返回或中途超时 | 检查反向代理缓冲及读取超时，参照现有研究代理配置 |
| PDF 预览或 Worker 加载失败 | 检查包与 Worker 版本、`.mjs` MIME 类型、附件权限和文件接口响应 |
| 刷新子路由后 404 | 确认 Nginx 对 SPA 路由回退到 `index.html` |
| 修改代码后部署页面仍未更新 | 确认已重新生成 `dist/` 并构建 / 更新前端容器；需要时刷新浏览器缓存 |
# 文献问答个人文件（2026-10-20）

`/user/literature-detail` 支持上传不超过 50 MB 的本地 PDF，也可从“我的文件与选文”选择公共已审核文献，混合分析最多 20 篇。上传到个人空间后自动加入本次选择；状态由后端任务轮询更新，就绪后点击开始分析。待处理文件不会被静默忽略，用户可明确选择仅分析已就绪材料。

材料选择使用 `src/research/components/literature/LiteratureMaterials.vue`，上传、题录和原文访问使用 `src/research/api/literature-files.ts`。业务文件接口走 `/api/literature/`，分析与追问继续走 `/research-api/agents/literature/runs`。私人文件不经过公开下载接口；切换材料会新建分析会话，旧会话保持原选择。

后端升级前先运行 Backend 的 `python -m scripts.migrate_personal_files`，增加 `corpus.owner_id`；`status=4` 表示个人上传，其余记录所有者为空。需要同时更新 Backend、实际索引 Worker、Research Agent 和 Frontend。只替换前端无法使用新接口。已于 2026-10-20 通过 `compose.local.yaml` 和 `local-docker` 构建配置部署到 Docker Desktop，访问 `http://localhost:8002/user/literature-detail`；操作与验收记录见 `../local-docker/README.md`。
