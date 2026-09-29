# LearnFlow MVP 设计（编码前）

## 产品结构

学习闭环：课程 → 整理知识树 → 写自己的理解 → 主动回忆 → 记录掌握变化 → 复习薄弱点。
推荐顺序：到期复习 → 当前薄弱点 → 前置知识已基本理解的未学节点。始终说明推荐理由，不用隐藏 AI 分数。

## 页面结构

- 我的课程 `/`：今日学习、待复习、薄弱知识点、最近学习；课程增删改与掌握进度；下一步建议。
- 课程 `#/course/:id`：左知识树（搜索、折叠、新增、排序、父子设置），中知识点文档，右主动回忆助手/学习笔记。
- 课程内三个页签：知识工作台、学习地图、课程资料。
- 复习 `#/review`：待复习 / 全部计划、跳到知识点。
- 统计 `#/stats`：各课程知识点/掌握/薄弱/复习、本周学习次数、最近七日本地日历计数。
- 数据 `#/settings`：浅深主题、JSON 导出/校验导入、说明本地数据边界。
- 手机：导航压缩，知识树与笔记区上下排列，地图容器内滚动；提供按钮排序作为触屏和键盘的拖动替代。

## 数据模型

时间统一存 ISO UTC，展示及日/周统计用本地日历。ID 用 crypto.randomUUID。

| 实体          | 主要字段                                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------------------------- |
| AppData       | schemaVersion:1, revision, courses[], nodes[], edges[], resources[], questions[], events[]                 |
| Course        | id, title, description, color, createdAt                                                                   |
| KnowledgeNode | id, courseId, parentId, kind:chapter/topic, order, title, status, importance, content, reviewAt, updatedAt |
| Content       | concept, formula, understanding, confusion, examples, mistakes, notes                                      |
| Edge          | id, courseId, sourceId, targetId, kind:prerequisite/related                                                |
| Question      | id, nodeId, prompt, answer                                                                                 |
| LearningEvent | id, courseId, nodeId, nodeTitle, action, fromStatus, toStatus, at, answer?, questionPrompt?                |
| Resource      | id, courseId, name, type, url, notes, text?, createdAt                                                     |

状态：unlearned / learning / understood / mastered / review。章节不计入知识点统计。
父子与前置边分别校验无环；禁止跨课程、悬空、自引用。相关边去重。内容与事件独立，删除节点保留历史快照。
每次按钮、手动状态改变、自测和打开知识点记录事件；统计“学习次数”排除打开和加入复习，避免浏览等于学习。
QuestionProvider.generateQuestion(context): Promise<Question>；在入口注入 MockQuestionProvider，组件只依赖接口。题库优先随机抽题，其次从典型题型生成回忆提示，缺少内容时提供通用自述题。答案与尝试一并保存，不自动伪造 AI 判分。

## 目录

```text
.github/workflows/deploy.yml
docs/ github-research.md product-design.md verification.md
src/
  domain/ model.ts logic.ts validation.ts seed.ts
  services/ storage.ts questions.ts
  components/ Icons.tsx Modal.tsx KnowledgeTree.tsx KnowledgeMap.tsx
  pages/ Dashboard.tsx Workspace.tsx Review.tsx Stats.tsx Settings.tsx
  App.tsx main.tsx styles.css
tests/ domain.test.ts app.spec.ts
```

React 本地状态 + 一个数据访问 hook 足够，不加入 Redux / Router / UI 全家桶。原生 CSS 变量实现主题及布局，比当前加入 Tailwind 构建层更简单。SVG 实现少量节点关系图。

## GitHub Pages

- 只有静态文件；无服务器、注册、同步、私密密钥。任何 VITE_ 环境变量都可能进入前端，不能放密钥。
- Vite base='./'，hash 路由；直接刷新 hash 深链接只请求 index.html，不需服务器重写。
- Actions：安装锁定依赖 → 单元测试 → TypeScript/生产构建 → 上传 dist → Pages 部署。main 推送自动触发，PR 仅验证。
- 用户需拥有 GitHub 仓库并启用 Settings → Pages → GitHub Actions；没有远程地址/认证时本地不能声称已上线。
- 数据属于浏览器 origin；换域名、换浏览器不会自动搬迁。同域不同仓库用 base path 隔离存储键。清除站点数据会删除记录，提供备份恢复。
- MVP 保证刷新后持久化；不包含离线资源缓存 PWA。

## 第一版交付边界

实现需求中的课程 CRUD、知识树 CRUD/拖动/父子/状态、全部知识内容字段、前置/相关关系、五个学习按钮及时间日志、Mock 自测与自建题库、复习队列、学习地图、资料 CRUD/Markdown TXT 本地导入、统计、主题、自适应、备份恢复、README 和 Pages 工作流。

暂缓：账号、社交、支付、在线同步、真实 AI、PDF/OCR、向量库/RAG、多人协作、复杂间隔算法、云附件、后台管理。

## 分阶段验证

1. 文档：核对需求、来源、范围，确认空项目无历史文件覆盖。
2. 基础与数据：TypeScript 检查、树/依赖无环、学习事件/调度、删除清理、数据导入与持久化测试。
3. 界面：构建 + 浏览器验证课程/知识点/自测/刷新/地图/主题/小屏。
4. 发布：生产子路径深链接测试，README 和 Actions 对齐。最终报告实际通过与未验证项。
