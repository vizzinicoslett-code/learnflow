# 第二阶段：资料到学习闭环（编码前设计）

## 审查结论

本阶段以已验收的 DocumentParser 为稳定基础，只连接解析结果与学习流程。
已有知识树、节点状态、笔记、学习事件、复习调度、进度统计、自建题库和 SVG 地图均可复用。

缺口：来源只有文字、资料详情无法深链接、课程首页缺少学习队列、地图对无关系的真实资料不易阅读、AI/Quiz 对外契约未统一。

## 数据与兼容

沿用 AppData.schemaVersion=1 与原存储键，不清空 localStorage/IndexedDB。
增加可选 modelVersion=2，采用纯函数补齐缺失元数据。旧备份先校验，再补齐；下次正常保存写入。原二进制文件库不变。

- nodes 是知识点唯一数据源，增加 createdAt/documentId/source.documentId/pageNumber/quote；既有 fileId/page 保留兼容。
- KnowledgePoint 课程级视图公开字符串 importance、前置/相关 ID、来源和状态；关系仍只保存于 edges，不维护两份可冲突的关系。
- Notes 从 node.content.notes 映射，包含 courseId/knowledgePointId。
- LearningSessions 从 open 事件及后续操作映射，不伪造学习时长。
- Progress 每次从同一批 topic 计算，只有 mastered 计为已掌握。
- 重解析复用能匹配的源片段节点 ID，保留手写内容、笔记、关系和学习事件，不重置课程。

## 页面与路由

采用原哈希路由：

- #/course/:id：知识工作台概览 + 知识树
- #/course/:id/:nodeId：复用知识点学习页
- #/course/:id/resources：资料列表
- #/course/:id/resource/:documentId：资料概览
- #/course/:id/read/:documentId/:section：三栏正文阅读，左页码、中正文、右本页知识点
- #/course/:id/map：真实资料节点地图

来源链接从资料卡片、学习页和地图进入阅读器。无固定页码文档以 section 定位。失效来源给出空状态；禁止跨课程读取。哈希链接刷新/前进/后退可恢复位置。

详情显示格式、页数/片段数、解析时间/状态、摘要、可点击内容结构和知识点。
学习页增加“你需要掌握”、原文、来源链接、直接笔记和状态按钮，复用原有编辑区及助手。
工作台显示真实今日操作、状态计数、继续学习、最近掌握；新用户从空数据开始，旧用户数据不删。
地图默认按资料及页面顺序展示，保留现有手工关系图；不生成随机前置关系。

## Provider 与部署

- 资料分析继续使用现有 MaterialAnalysisProvider 与 Mock 实现，输入只来自校验后的分页正文。
- 出题继续使用现有 QuestionProvider，题库优先；本阶段不增加复杂 Quiz 系统。
- 默认仍在 main.tsx 注入 Mock，网络 Provider 尚未启用。
- 未来默认 Cloudflare Workers，API Key 仅在服务端 Secret；本轮只准备类型和文档，不注册、部署或产生费用。

## 验证

先验证数据投影/兼容迁移/来源查找/重解析，然后浏览器覆盖新课程→中文文件→页来源→学习→笔记→状态→进度→地图→刷新。
覆盖长标题/长摘要/大量节点、空课程、OCR、失败、全掌握；运行 lint/typecheck/unit/build/E2E，发布后线上再验收。
