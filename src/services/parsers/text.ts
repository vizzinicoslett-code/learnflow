import { textSections } from '../materialExtraction';
import { cleanText, type ParserOutput } from './shared';
export async function parseText(file: File): Promise<ParserOutput> {
  // Only the signature-checked TXT/MD branch decodes bytes. Never guess an encoding.
  let decoded: string;
  try {
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
  } catch {
    throw new Error('文本不是有效 UTF-8，请使用 UTF-8 编码重新保存。');
  }
  const text = cleanText(decoded);
  if (!text) throw new Error('文件没有可读取的正文。');
  return { pages: textSections(text), warnings: [] };
}
