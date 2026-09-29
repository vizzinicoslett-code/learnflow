# DocumentParser 修复与中文验收（2026-09-30）

## 排查结论

对提交 d543e3f 的代码检索与调用链检查：

- 没有将正确后缀的 PDF/PPTX/DOCX 原始字节直接传给摘要。PDF 已走 pdf.js，Office 已走 ZIP/XML。
- 旧 TXT/MD 分支仅凭后缀选择。若二进制文件被错误命名为 .txt/.md，会进入 TextDecoder；UTF-8 失败后继续用非严格 GB18030 解码，产生带 PK、控制字符及替换字符的字符串。
- 摘要入口只检查“有非空文本”，没有正文质量校验，因此上述内容可以直接成为 Mock 摘要。已有乱码结果持久保存在 localStorage，部署新代码不会自动消除。
- 无正文时旧版本还会生成“待识别内容”占位知识点。现已完全移除。
- 用户原始问题文件未提供，因此不能确认其乱码是否由错误后缀、旧版缓存、PDF 字体映射或其他文件内容问题造成。这里记录的是已验证的代码缺陷及修复范围，不将推测写成结论。

复现：将测试中的中文 PPTX 字节作为 wrong.txt 上传。旧分支会解码 ZIP；新版本在文件签名检查阶段拒绝，页面显示“文件解析失败”，无摘要、无知识点。

将同一 PPTX 样本实际送入旧版文本解码函数：触发 GB18030 兜底，结果以 PK 开头，含 539 个控制字符、138 个 U+FFFD。新的上传回归测试验证该样本作为 TXT 时被拒绝、作为 PPTX 时正确提取两页中文。

## 新数据流

File → parseDocument → 文件签名与专用 parser → cleanText 质量校验 → ParsedDocument → Mock / HTTP analyzer → 结构化知识点。

统一结果：

```ts
{
  title, fileType,
  pages: [{pageNumber, title, text, section, page}],
  fullText,
  method, warnings,
  metadata: {
    parserVersion: 2, parser, fileSize, pageCount, characters,
    needsOCR, ocrPages
  }
}
```

page 与 pageNumber 同步，兼容原有数据模型；DOCX/TXT/MD 没有可信的固定分页，两者均为 null，以 section 定位，不虚构原始页码。PDF fullText 使用 --- Page N ---，PPTX 使用 --- Slide N ---，无分页文档使用 --- Section N ---。

| 格式         | 实现                                            | 限制                                                         |
| ------------ | ----------------------------------------------- | ------------------------------------------------------------ |
| PDF          | pdfjs-dist / getTextContent，逐页保留来源       | 无文字页记录 needsOCR/ocrPages；字体映射异常或大量替换符报错 |
| PPTX         | fflate 解压，DOMParser 读取实际幻灯片顺序及 a:t | 只解码解压后的 XML；图片、公式对象、SmartArt 跳过            |
| DOCX         | mammoth.browser.extractRawText                  | 提取纯文本，不渲染 HTML；无可信页码                          |
| TXT/MD       | 通过文件签名检查后严格 UTF-8 TextDecoder        | 无 GB18030 / UTF-16 自动兜底，需另存 UTF-8                   |
| PNG/JPG/JPEG | ImageParser，仅保存与预览                       | 提示 OCR 尚未接入，不创建正文或知识点                        |
| PPT/DOC      | 检测旧 Office 文件头后明确提示转换              | 不做 Mock 解析，不创建占位知识点                             |

[PDF.js 官方示例](https://mozilla.github.io/pdf.js/examples/)、
[Mammoth 纯文本 API](https://github.com/mwilliamson/mammoth.js#library)。
Mammoth 使用 BSD-2-Clause；仅调用 extractRawText，不将第三方生成的 HTML 插入页面。

## 校验和错误行为

- 文件签名与后缀不符时停止；ZIP/PDF/图片不能伪装文本进入摘要。
- 文本中有二进制头、异常控制字符、U+FFFD 或大量方块/私用字形时停止。正常术语 PK 不会因字母本身被误判。
- 不尝试用删除乱码字符的方式伪装成功；明确给出失败原因。
- 图片/扫描 PDF 保留原文件与 needsOCR 状态；空正文不调用 Mock/HTTP。
- PDF 加密、损坏、超时有错误反馈。解压体积、文件大小、PDF 页数、文本长度仍受限制。
- 旧摘要先隐藏，用户点击“重新解析”读取 IndexedDB 原件。匹配来源的知识点复用 ID，笔记与掌握度保留；已删除来源或手动改变的结构可能不能匹配，旧学习记录不会被自动删除。
- 规则校验不能保证识别所有“字形可打印但语义已损坏”的编码问题；复杂课件仍需对照原件检查。

## 中文样本与实测

样本位于 tests/fixtures，使用 scripts/generate-parser-fixtures.mjs 创建；不包含用户私有资料。

| 实际文件            | 解析结果                                                  | 提取字符数 |
| ------------------- | --------------------------------------------------------- | ---------- |
| chinese-course.pdf  | 2 页，中文文本与嵌入字体，source.page 为 1、2             | 59         |
| chinese-course.pptx | 2 页，presentation 顺序与文件数字顺序相反，仍正确按页读取 | 55         |
| chinese-course.docx | 2 个正文片段，真实 OPC ZIP/XML，经 Mammoth                | 38         |
| chinese-course.md   | 2 个正文片段，UTF-8 中文                                  | 38         |
| scanned-course.pdf  | 1 页图片，无文本层，needsOCR=true，ocrPages=[1]           | 0          |

正文样例：“晶体结合的基本类型包括离子键、共价键和金属键。”

测试覆盖中文显示、逐页读取、来源页码、摘要节选必须属于正文、无 PK/替换符/二进制控制字符、重新解析保留笔记和状态；另测 ZIP 假 TXT、损坏 DOCX、非法编码、旧 Office 提示、扫描件和旧缓存修复。

开发模式 console.debug 输出文件类型、字节大小、解析器、页数、字符数和前 500 字符，四种解析器日志已实测。生产构建不输出这些日志，正式界面不显示调试信息。

## 修改文件

- 新增 documentParser.ts、parsers/pdf.ts、pptx.ts、docx.ts、text.ts、image.ts、shared.ts、mammoth.d.ts。
- 修改 materialExtraction.ts（仅保留类型/进度/分段工具）、materialAnalysis.ts、domain/model.ts、materials.ts、validation.ts。
- 修改 Resources.tsx、MaterialDetail.tsx 的解析状态、重试及旧摘要显示；未修改整体样式。
- 新增 document-parser.spec.ts、中文测试文件与生成脚本；更新原资料测试、依赖和文档。
