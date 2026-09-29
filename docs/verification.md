# LearnFlow MVP 验证记录

验证日期：2026-09-29。环境：Windows、Node.js 24.20.0、Chromium（Playwright 管理）。

## 阶段一：调研与设计

- 检查工作目录为空，没有覆盖已有项目。
- 在编写应用代码前完成 GitHub 搜索、候选比较、产品结构、页面结构、数据模型、目录和部署约束文档。
- 研究记录位于 `github-research.md`，设计位于 `product-design.md`。

## 阶段二：数据与持久化

12 项 Vitest 单元测试通过，覆盖：

- 树和前置关系禁止循环，非法父节点拒绝。
- 同级排序结果，保留原父节点时不改变顺序。
- 删除子树清理题库与关系，删除课程保留历史名称快照。
- 基本理解与已掌握的区别、1/3/7 天调度与立即复习。
- 统计排除纯浏览及加入复习，七天按本地日历计数。
- 新知识推荐需要满足前置条件，理解前置后继续向后推荐。
- 备份格式/版本/重复 ID/日期/悬空引用校验及安全链接协议。
- MockQuestionProvider 优先题库，无题时抽取典型题型。

## 阶段三：真实浏览器流程

生产构建通过 TypeScript 严格检查。Playwright 自动启动生产预览，使用 `/learnflow/` 子路径，10 个端到端场景：

1. 课程与章节/知识点增删改，排序与刷新后保留。
2. 不会 → 加入复习 → 自测 → 答对 → 笔记 → 统计的闭环；切换页签不重复生成练习。
3. 前置循环提示、相关关系添加、地图节点导航、真实鼠标拖动同级排序。
4. Markdown 导入按纯文本显示，HTML 不执行；资料链接、编辑、刷新、删除。
5. 下载完整备份、拒绝无效备份、清空后恢复、主题刷新保留。
6. 损坏存储保持原始内容，显示恢复入口。
7. 模拟存储配额写入失败，界面显示错误且不显示已保存的新状态。
8. 桌面 1440×1000、手机 390×844、浅深色截图；手机首页与工作台无横向页面溢出；hash 深链接刷新。
9. 自建题库、父节点调整、删除知识关系的持久化。
10. 两个标签页之间的笔记更新通知与刷新保留。

已人工查看首页、工作台浅色和手机深色截图。桌面三栏独立滚动，小屏顺序排列。测试过程中修正了表单标签、只改名称时意外重排、切换页签触发重复出题，以及知识推荐停留在已理解节点的问题。

## 阶段四：交付与发布

- `npm audit`：升级 Vite/React 插件/Vitest 后，0 项已知漏洞（包括开发依赖）；这不代表完整安全审计。
- 保留 package-lock.json，GitHub Actions 使用 `npm ci` 安装锁定依赖。
- CI 包含单元测试、类型检查、生产构建、Chromium 浏览器测试，全部通过才上传 Pages 构建。
- PR 只验证；main 推送及手动触发可部署。
- 目标仓库：[vizzinicoslett-code/learnflow](https://github.com/vizzinicoslett-code/learnflow)。通过现有系统代理已确认仓库可连接且初始为空。线上 Actions 与真实 Pages 域名应另行验证，不能把本地模拟部署通过表述为已上线。

## 当前边界

- 学习状态是自评，Mock 不推理、不联网、不自动判分。
- 文本公式与 Markdown 源文可编辑，暂不排版 LaTeX/Markdown。
- localStorage 有浏览器配额，保存失败会提示；建议定期导出 JSON。未来大量资料改用 IndexedDB。
- 无网络资源缓存、云同步或跨设备自动迁移；地址变更需要备份恢复。
- revision 检查与 storage 事件支持通常的多标签更新，不承诺多标签同时写入的事务隔离。
- 自测评分后持久化作答；未提交作答草稿不持久化。
- 已测 Chromium，不声称已在真实 iOS Safari、Firefox 或所有平板设备验证。
- 地图适合课程级小规模节点，超大图的布局/性能没有做压力测试。

## 资料工作流重新验收（2026-09-29）

本节替代早期“链接收藏 + 文本导入”的资料验收结论。

- 主入口改为文件选择与拖放；文件名、类型、大小、删除和重选可用。
- 原文件存 IndexedDB，解析结果与知识点存兼容的 v1 快照。原文件刷新后可下载。
- TXT/MD、文字 PDF、PPTX、DOCX 真实提取；PNG/JPG 预览；PPT/DOC/图片无正文时明确使用待识别 Mock 示例。
- 真正的 AI 摘要、AI 问答、逐页讲解、AI 生成笔记/题目尚未接入，不宣称已经完成。
- 流程包含读取、提取、结构、知识点、完成，并支持取消和重试。失败不显示假成功。
- PDF worker、中文 CMap 与基础字体从本站加载；构建前自动从 pdfjs-dist 复制资源，保留 License。
- 学习建议与知识树引用同一节点，开始学习后复用掌握度、笔记、自测、复习和统计。
- 资料/课程删除和数据替换会清理不再引用的原文件；删除资料保留已生成知识点。清理失败明确提示。

单元测试增至 15 项：新增来源校验、优先级映射、重复提交保护、占位与取消、文件类型/大小、扩展备份格式校验。

浏览器场景增至 17 项：保留原有课程/学习/地图/备份/多标签回归；新资料测试包含真实 Markdown、TXT、PPTX 幻灯片顺序、DOCX、PDF 文字层、下载持久化、拖放、重命名、旧在线链接、图片预览、损坏 PDF 重试、取消后恢复、配额失败、旧 PPT 占位及手机/深色显示。Office/PDF 使用可重复的合成文档，不代表已覆盖所有厂商和复杂版式。

依赖检查：npm audit --omit=dev 返回 0 vulnerabilities。未接入外部 AI 网络调用；API Key 未出现在前端或仓库。

新增/修改文件分组：

- 界面：Resources.tsx、MaterialDetail.tsx、Workspace.tsx、Settings.tsx、styles.css。
- 数据：model.ts、materials.ts、validation.ts、storage.ts。
- 服务：materialFiles.ts、materialExtraction.ts、materialAnalysis.ts。
- 入口/构建：App.tsx、main.tsx、vite-env.d.ts、package.json/lock、scripts/prepare-pdf-assets.mjs、.gitignore、.prettierignore。
- 验收/文档：materials.test.ts、materials.spec.ts、app.spec.ts、README.md、material-ingestion.md、本文件。
