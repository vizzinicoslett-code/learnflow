import { textSections, checkAborted } from '../materialExtraction';
import { readOfficeEntries, type ParserOutput } from './shared';
export async function parseDocx(file: File, signal: AbortSignal): Promise<ParserOutput> {
  const buffer = await file.arrayBuffer();
  // Bound inflated size before passing a validated archive to Mammoth.
  const entries = await readOfficeEntries(new Uint8Array(buffer), (p) => p === 'word/document.xml');
  if (!entries['word/document.xml']) throw new Error('DOCX 缺少 word/document.xml。');
  checkAborted(signal);
  const mammoth = await import('mammoth/mammoth.browser');
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  checkAborted(signal);
  return {
    pages: textSections(result.value),
    warnings: [
      'DOCX 已提取纯文本；无固定分页，来源使用正文片段。图片与公式对象未识别。',
      ...result.messages.map((m) => m.message),
    ],
  };
}
