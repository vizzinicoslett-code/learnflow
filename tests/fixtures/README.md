# 中文解析验收样本

这些文件由 scripts/generate-parser-fixtures.mjs 生成，不含用户资料。

- chinese-course.pdf：Chromium 打印的两页中文 PDF，含嵌入字体和文字层。
- chinese-course.pptx：两张幻灯片，presentation 目录指定 slide2 在 slide1 前；验证实际页序。
- chinese-course.docx：规范 OPC ZIP 包，中文段落通过 Mammoth 提取。
- chinese-course.md：UTF-8 中文标题与正文。
- scanned-course.pdf：将画布中文字变成图片后打印，验证无文本层分支。

自动化测试直接读取实际二进制文件。它们是可重复的最小课程样本，不代表所有复杂教材版式。重新生成需要 Playwright Chromium 和可用的中文系统字体；常规 CI 不重新生成。
