# 资料进入学习系统

## 本次设计

入口以文件选择/拖放为主。名称自动来自文件，可修改；自动识别格式；备注可选。在线链接放在次要入口，旧资料继续可读。

流程：校验文件 → IndexedDB 保存原文件 → 读取字节 → 提取文本 → 分析结构 → 生成知识点 → 一次性保存章节、知识点与资料分析 → 进入现有工作台。

分层：`materialFiles.ts` 管原文件；`materialExtraction.ts` 管格式解析；`materialAnalysis.ts` 定义 Provider 与结构化返回；`materials.ts` 将返回内容转换为现有课程节点。UI 不依赖具体 AI 服务。

状态持久化为 processing / ready / error，包含当前阶段。失败保留原文件以重试，取消/刷新后的未完成任务可从资料卡重试。仅成功时插入完整知识树，避免半份知识点；重试不重复插入。删除资料保留已经产生的学习知识与来源名称快照。

原文件在 IndexedDB，文本、来源与学习数据继续使用兼容的 v1 localStorage 快照，新增字段可选，不清空已有数据。JSON 备份包含解析文本/结构/知识点，不包含原始二进制附件；详情支持单独下载原件，导入备份后明确提示原件可能不在此浏览器。

## 当前能力

| 格式             | 原文件选择/保存/下载 | 内容提取                                         | 结构与学习建议                     |
| ---------------- | -------------------- | ------------------------------------------------ | ---------------------------------- |
| TXT / MD         | 真实                 | 真实 UTF-8 / GB18030 文本                        | Mock 规则草案                      |
| PDF              | 真实                 | PDF.js 逐页提取文字层，不做 OCR                  | Mock 规则草案，保留实际页码        |
| PPTX             | 真实                 | ZIP/XML 读取幻灯片正文，按 presentation 关系顺序 | Mock 规则草案，保留幻灯片页码      |
| DOCX             | 真实                 | ZIP/XML 读取段落，不虚构分页                     | Mock 规则草案，来源为段落/章节     |
| PPT / DOC        | 真实                 | 旧二进制格式暂不解码                             | 明确标注的占位示例，非文件内容结论 |
| PNG / JPG / JPEG | 真实                 | 图片可预览，不做 OCR                             | 明确标注的占位示例，非文件内容结论 |

文件上限 20 MB、PDF 上限 300 页、分析最多 40 节、文本上限 200,000 字符；截断/无文字页会提示。加密或损坏文件报错，不用伪造结果替代解析失败。

Provider 返回 `MaterialPoint { id, title, summary, importance: must|understand|optional, source: {fileId,page,section}, status: unlearned }`。入库映射为现有 `KnowledgeNode`，保留 `summary/source/learningPriority/generatedBy`，既有 `importance: 3|2|1` 继续兼容工作台。详情通过节点 ID 读取当前状态，避免生成草案与学习状态两套数据不一致。

## 真实 AI 接入方案

推荐先用 Cloudflare Worker 处理已提取的分段文本：

```text
GitHub Pages 浏览器（提取文本，保留原件）
  → HTTPS POST /v1/materials/analyze（小批章节文本）
  → Cloudflare Worker（验证访问凭证、限流、校验大小、读取服务端 Secret）
  → 模型 API（要求符合 JSON schema 的结构化结果）
  → Worker 验证来源与 JSON → 前端验证 → 保存并开始学习
```

`HttpMaterialAnalysisProvider` 是前端接入位置，在入口替换 Mock。允许公开配置的仅为 API URL，不是服务商密钥。当前不会发送文件或文本到任何 AI 服务。

最小服务端职责：只允许部署的 Pages Origin 的 CORS；OPTIONS；短期授权或 Turnstile 验证 + 服务端限流/预算（CORS 不是认证）；请求长度与类型检查；模型密钥从 Worker Secret 读取；超时/错误结构化返回；模型输出 schema 与来源页码校验。资料内容作为不可信数据，不允许资料中的指令调用工具或改写系统任务。不要记录原文或密钥到日志。

请求契约：`{version:1,fileId,fileName,extraction:{pages:[{page,section,title,text}],warnings,...}}`。响应：`MaterialAnalysisResult`。本地 Provider 验证返回 ID 唯一、来源存在、importance 枚举和长度上限。

扫描 PDF/图片需要 OCR，旧 PPT/DOC 需要转换；不要把 LibreOffice 之类完整程序塞进 Worker。第二步可使用服务商的文件/OCR API，或单独的 Vercel Function 协调异步文件任务。大文件采用短期对象存储上传 URL + jobId 轮询，原文件保留期限可配置并在处理后删除。前端需明确告知将上传第三方服务。

Vercel Functions 也可承载相同契约，但大文件和长任务不能依赖一次同步请求。平台的请求体、内存与执行时间限制随方案变化，部署前核对：[Cloudflare 限制](https://developers.cloudflare.com/workers/platform/limits/)、[Vercel Functions 限制](https://vercel.com/docs/functions/limitations)。

接入顺序：部署受控文本分析 endpoint → 配置服务端 Secret 与访问保护 → 小样本核对摘要/知识点/出处 → 在入口注入 HTTP Provider → OCR/Office 转换任务 → 基于同一 source 的问答、逐页讲解、笔记和题目生成。当前详情中的未接入 AI 能力清楚标注，不提供假装可用的按钮。
