# LearnFlow

**让知识，真正成为你的。**

面向大学生的本地学习工作台。把课程资料整理成知识结构，用自己的语言理解，用主动回忆检查，再通过复习逐渐掌握。

本项目是可直接部署到 GitHub Pages 的纯前端 MVP，不需要独立服务器、注册或 API Key。

项目仓库：[vizzinicoslett-code/learnflow](https://github.com/vizzinicoslett-code/learnflow)。

## 已实现功能

- **我的课程**：新建、编辑、删除、搜索；已掌握比例；今日学习、到期复习、薄弱知识点、最近学习和下一步建议。
- **三栏工作台**：左侧知识树，中间可编辑知识文档，右侧学习助手和笔记。
- **学习入口**：课程工作台按真实状态显示继续学习、待学习、正在学习、最近掌握和课程进度；知识点可以直接开始学习或标记已掌握。
- **知识树**：章节与知识点，多层父子关系、展开折叠、搜索、增删改、同级拖动排序，以及上移/下移按钮。编辑节点可改父节点；拒绝循环和跨课程移动。
- **知识点**：核心概念、关键公式、自己的理解、混淆点、典型题型、错题、笔记、重要程度及五种掌握状态；前置与相关知识可增删。
- **学习记录**：我懂了、有点模糊、完全不会、考我一道、加入复习、手动状态变更、自测评分均留存时间和状态变化。作答提交后保存题目与答案。删除知识点仍保留带名称的历史记录。
- **本地出题**：自建题库可增删改；优先随机抽取题库，否则根据典型题型生成回忆提示。显示参考答案后自评，不假装 AI 判分。
- **学习地图**：使用课程中的真实知识点与实时状态；没有可靠依赖时按重要程度和资料顺序排列，只显示用户已经保存的前置或相关关系。
- **复习计划**：到期队列、全部计划、课程筛选。不会/模糊 1 天，理解 3 天，自测正确 7 天；加入复习立即到期。
- **课程资料与来源**：以本地文件选择/拖拽为主，自动识别类型，保存原文件并提取正文；显示处理进度、Mock 摘要、结构与三级学习建议。知识点可回到准确的 PDF 页、PPTX Slide 或正文片段，并查看该页关联知识点。
- **统计**：各课程知识点、掌握、薄弱、到期复习、本周学习次数和最近七天柱状图。
- **本地数据**：自动保存，刷新保留；JSON 学习数据备份/恢复（不含原文件）；版本与引用校验；损坏数据恢复入口；保存失败明确提示。
- **体验**：浅色/深色模式、手机/平板布局、键盘可操作表单和原生模态对话框。

首次启动为空白学习空间，不显示与用户资料无关的示例课程。创建课程并上传资料后，知识点、笔记、学习状态、进度和地图都使用同一份本地数据。

## 本地运行

需要 **Node.js 22.12+（推荐 24 LTS）**、npm 和 Git。

```bash
npm ci
npm run dev
```

打开终端显示的地址，默认是 `http://127.0.0.1:5173`。请使用 HTTP 服务运行，不要双击打开 `index.html`。

```bash
npm run build       # TypeScript 检查并构建 dist/
npm run preview     # 本地预览生产构建，默认端口 4173
npm run lint        # 检查代码格式
npm run typecheck   # 独立 TypeScript 检查
npm test            # 数据结构、调度、备份等单元测试
npm run check       # 格式 + 类型 + 单元测试 + 生产构建
npx playwright install chromium
npm run test:e2e    # 浏览器流程测试，自动构建并在 /learnflow/ 子路径启动生产预览
```

浏览器测试使用端口 4173；若该端口已有不相关服务，请先停止该服务。Windows 上也可把浏览器安装在项目内：

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = "$PWD\.playwright"
npx playwright install chromium
npm run test:e2e
```

源码格式化：`npm run format`。Prettier、Vitest、Playwright 都是开发依赖，不进入网页运行包。

## GitHub 管理与 Pages 部署

### 第一次发布

1. 在自己的 GitHub 账号创建空仓库，例如 `learnflow`。GitHub Free 推荐公开仓库；私有仓库 Pages 可用性取决于账号方案。
2. 将本地项目连接到仓库（把 `YOUR_USERNAME` 替换为你的账号）：

   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/learnflow.git
   git add .
   git commit -m "Build LearnFlow MVP"
   git branch -M main
   git push -u origin main
   ```

   如果本地已有提交，不必重复 commit；如果已有 origin，用 `git remote -v` 检查地址。推送使用你自己的 GitHub 身份凭据或 SSH，不把 token 写入项目文件。

3. 仓库 **Settings → Pages → Build and deployment → Source → GitHub Actions**。
4. 在 **Actions → Check and deploy LearnFlow** 查看运行。必要时点 **Run workflow** 重跑。
5. 成功后打开 `https://YOUR_USERNAME.github.io/learnflow/`；实际地址以部署输出为准。

之后推送 `main` 会自动测试和部署；Pull Request 只做验证，不发布。工作流位于 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)，只在全部测试通过后发布 `dist/`。

**本地交付与线上部署是两件事。** 没有配置 GitHub 远程地址、身份验证及 Pages 设置时，本地代码不会自动出现在 GitHub，工作流也尚未真正运行。

### 静态托管约束

- Vite `base: './'` 使用相对资源路径，兼容仓库子路径、自定义域名和用户根站点。
- 路由使用 `#/course/...`，刷新深链接只访问静态入口，不需要服务端重写或 404 hack。
- GitHub Pages 不提供后端运行环境。真实 AI 和同步后续应通过受保护的后端接口实现。
- 不把 API Key 放入前端、localStorage 或 `VITE_` 环境变量。当前没有 API Key 配置入口。
- 本版依赖浏览器本地存储。不同设备、浏览器、域名或项目路径的学习数据互不共享；搬迁前先导出备份。
- 没有 Service Worker，尚不承诺无网络首次加载或完整离线启动。

部署参考：[Vite 官方静态部署指南](https://vite.dev/guide/static-deploy.html)、[GitHub Pages 官方限制](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)。

## 技术栈与目录

React 19 + TypeScript 5 + Vite 8 + 原生 CSS。CSS 变量负责主题、CSS Grid 负责布局。初期使用原生 CSS，省去 Tailwind 配置和工具类层；运行依赖为 React、React DOM，以及按需加载的 pdfjs-dist（PDF 文字提取）、fflate（PPTX ZIP 解压）和 mammoth（DOCX 纯文本提取）。

```text
src/
  domain/       数据类型、树与依赖规则、学习事件、校验、示例数据
  services/     本地存储、IndexedDB 附件、文本提取、分析 Provider、出题 Provider
  components/   知识树、地图、学习助手、对话框、图标和共享组件
  pages/        课程首页、工作台、资料、复习、统计、设置
  App.tsx       哈希路由与应用导航
  main.tsx      注入 QuestionProvider 与 MaterialAnalysisProvider
  styles.css    主题与响应式样式
tests/          单元测试与生产子路径浏览器测试
docs/           调研、编码前设计和验证记录
.github/        CI / GitHub Pages 自动部署
```

没有状态管理、图谱、富文本、图表或服务器框架依赖。图标与界面均为本项目编写，没有复制开源完整项目。

## 数据与扩展

### 模型

`AppData` 是 `schemaVersion: 1` 的版本化快照，包含 `courses / nodes / edges / questions / resources / events`。节点用稳定 UUID、`parentId`、`order`、`kind` 表达树结构。前置/相关关系放在独立边表中，未来 AI 生成结构时可转换到同一模型并通过校验后保存。

时间保存 ISO 字符串，日/周统计按用户本地日历，周一为一周开始。课程掌握百分比只统计知识点中的“已掌握”；章节不进入分母。当前自评并不构成客观能力认证。

### 存储

`DataRepository` 当前由 `LocalRepository` 实现。存储键含路径，避免同域不同 Pages 项目混用数据；编辑先写入存储，成功才更新页面状态。相邻标签页通过 storage 事件更新，revision 检查会拒绝已检测到的过期写入。

localStorage 配额由浏览器决定，适合少量课程文本；大量导入可能触及上限，会显示错误。日常使用建议单标签页编辑，MVP 不提供多标签同时写入的事务保证。原文件已使用 IndexedDB；未来可将文本快照也迁入 IndexedDB。清除站点数据或隐私模式结束可能丢失本地记录，所以提供 JSON 学习数据备份与原文件单独下载。JSON 不含二进制附件，换浏览器恢复时会提示缺少原文件。导入备份目前为替换，不做合并。

### 出题接口

```ts
interface QuestionProvider {
  generateQuestion(context: QuestionContext): Promise<Question>;
}
```

业务组件依赖此接口，入口注入 `MockQuestionProvider`。以后可提供 `OpenAIProvider / DeepSeekProvider / ClaudeProvider / LocalModelProvider`，网页客户端调用安全后端或受控本地服务。第三方服务密钥只放在安全服务端。

“典型题型”按非空行拆分，每次抽取一行。优先展示自建题目的参考答案；回忆提示默认使用自己的理解/核心概念供对照。自测作答在点击评分后入历史，未提交草稿目前不持久化。

## 路线图

1. 全量 IndexedDB 迁移、附件打包备份、大容量资料与备份合并。
2. 更完整的复习调度（评估 ts-fsrs）、练习证据与自评信心分开记录。
3. Markdown/LaTeX 排版、PDF 原页渲染、可导出学习档案。
4. 接入受控 Serverless 文本分析 API，将 Mock 替换为真实 AI；随后增加 OCR、旧 Office 转换、资料问答和逐页讲解。
5. 需要时再增加安全后端、可选同步与账号。

不在 MVP 范围：社交、支付、多人协作、复杂 Agent、PDF OCR、向量数据库、RAG、后台管理。

## 文档

- [GitHub 开源调研](docs/github-research.md)
- [编码前产品与数据设计](docs/product-design.md)
- [资料到学习闭环设计](docs/phase2-design.md)
- [验证记录与已知边界](docs/verification.md)

## 课程资料：真实能力与边界

支持 PDF、PPT、PPTX、DOC、DOCX、TXT、MD、PNG、JPG、JPEG 文件选择与拖放，单个 ≤ 20 MB。资料名称默认使用文件名，类型自动识别。上传指保存到当前浏览器，当前不会发送给云端或模型服务。

| 格式             | 当前真实可用                                    | 尚未实现                     |
| ---------------- | ----------------------------------------------- | ---------------------------- |
| TXT / MD         | 严格 UTF-8 解码、文件签名检查、按标题与长度分段 | 语义理解                     |
| PDF              | PDF.js 文字层提取，保留页码；最多 300 页        | 扫描件 OCR、公式和图表理解   |
| PPTX             | 根据实际幻灯片顺序提取正文，保留页码            | 图片、公式对象、讲者备注解析 |
| DOCX             | Mammoth 纯文本提取，来源不伪造页码              | 完整版式、嵌入图片和公式识别 |
| PPT / DOC        | 原文件持久保存与下载                            | 旧版二进制格式转换           |
| PNG / JPG / JPEG | 原文件保存、预览、下载                          | OCR                          |

摘要、知识点拆分与重要程度均由 **MockMaterialAnalysisProvider** 生成规则草案，界面持续标注 Mock。只对 DocumentParser 校验后的正文生成草案；没有正文时不生成摘要或知识点。扫描 PDF 与图片提示需要 OCR，旧 PPT/DOC 提示转换。文件签名不符或乱码内容会停止处理并显示原因。最多分析前 40 个片段、提取最多 200,000 字符，截断会提示。

生成节点保留 id/title/summary/status/source/learningPriority，直接复用知识树、笔记、现有 Mock 自测、复习与统计。为了兼容旧版本，节点 importance 仍为 3/2/1；learningPriority 对应 must/understand/optional。用户在工作台调整重要程度时两者同步。删除资料保留已有知识点与历史；删除课程同时清理其资料原件。

JSON 备份不包含 IndexedDB 原文件，请单独下载原件。所有数据仍受浏览器配额、清理站点数据和隐私模式影响。无法写入时会显示错误，不伪装处理成功。

### 如何接入真正的 AI

1. 在 Cloudflare Workers 或 Vercel Functions 部署文本分析 endpoint，服务商密钥只存服务端 Secret。
2. 加入访问验证、限流、预算、请求长度限制、CORS 和结构化输出校验；不要只靠 CORS 保护额度。
3. 按 [资料解析架构与接口契约](docs/material-ingestion.md) 实现请求/响应，保留真实来源页码。
4. 在 src/main.tsx 将 MockMaterialAnalysisProvider 替换为 HttpMaterialAnalysisProvider，注入公开的 HTTPS endpoint。当前接口通过凭证请求，但访问保护需要随 Serverless 服务一起实现。
5. 使用真实课件校对结果，再增加 OCR/旧 Office 转换及资料问答、逐页讲解、笔记与题目生成。

GitHub Pages 仅发布静态前端，可以运行浏览器解析与 IndexedDB；无法运行服务端模型调用、存放私密 API Key 或同步用户文件。本次没有部署收费 AI 服务，也没有把 API Key 放入代码。

## 文件解析修复

当前使用统一 DocumentParser，各文件格式独立解析。开发控制台提供解析器、页数、字符数与前 500 字符预览；正式构建不输出原文日志。已有资料请点击“重新解析”更新旧结果。

详见 [乱码排查、中文样本与验收](docs/document-parser-fix.md)。
