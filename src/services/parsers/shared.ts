import type { MaterialPage } from '../../domain/model';
export interface ParserOutput {
  pages: MaterialPage[];
  warnings: string[];
  needsOCR?: boolean;
  ocrPages?: number[];
}
export function assertCleanText(text: string): void {
  if (
    typeof text !== 'string' ||
    /PK[\u0000-\u0008]|%PDF-\d\.\d|[\u0000-\u0008\u000b\u000e-\u001f\u007f\ufffd]/u.test(text)
  ) {
    throw new Error(
      '检测到二进制内容、无效编码或替换字符，已停止生成摘要。请检查文件格式，文本文件请另存为 UTF-8。',
    );
  }
  const broken = (text.match(/[\ue000-\uf8ff\u25a0\u25a1]/gu) ?? []).length;
  if (broken >= 4 && broken / Math.max(text.trim().length, 1) > 0.08) {
    throw new Error('提取正文包含大量无法识别的字形，可能缺少字体映射；请重新导出文件或使用 OCR。');
  }
}
export function cleanText(text: string): string {
  assertCleanText(text);
  return text
    .replace(/^\ufeff/, '')
    .replace(/\r\n?/g, '\n')
    .trim();
}
export async function readOfficeEntries(bytes: Uint8Array, wanted: (path: string) => boolean) {
  const { unzipSync } = await import('fflate');
  let total = 0;
  let count = 0;
  return unzipSync(bytes, {
    filter: (e) => {
      total += e.originalSize;
      count++;
      if (total > 64 * 1024 * 1024 || count > 4000)
        throw new Error('Office 解压内容过大，请拆分文件。');
      return wanted(e.name);
    },
  });
}
export function parseXml(bytes: Uint8Array): Document {
  // Only a selected XML entry after ZIP decompression, never the Office archive.
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('Office XML 不是有效 UTF-8，文件可能损坏。');
  }
  const document = new DOMParser().parseFromString(text, 'application/xml');
  if (document.getElementsByTagName('parsererror').length) throw new Error('Office XML 结构损坏。');
  return document;
}
