import type { ParsedDocument } from '../domain/model';
import {
  identifyFile,
  checkAborted,
  stage,
  MAX_TEXT,
  type ProgressReporter,
} from './materialExtraction';
import { cleanText, assertCleanText, type ParserOutput } from './parsers/shared';
import { parseText } from './parsers/text';
import { parsePdf } from './parsers/pdf';
import { parsePptx } from './parsers/pptx';
import { parseDocx } from './parsers/docx';
import { parseImage } from './parsers/image';

function signature(bytes: Uint8Array): string {
  const starts = (values: number[]) => values.every((v, i) => bytes[i] === v);
  if (starts([0x50, 0x4b, 3, 4]) || starts([0x50, 0x4b, 5, 6])) return 'zip';
  if (starts([0x25, 0x50, 0x44, 0x46, 0x2d])) return 'pdf';
  if (starts([0xd0, 0xcf, 0x11, 0xe0])) return 'office';
  if (starts([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10])) return 'png';
  if (starts([0xff, 0xd8, 0xff])) return 'jpeg';
  return 'unknown';
}
export function assertParsedDocument(document: ParsedDocument): void {
  if (
    !document ||
    document.metadata?.parserVersion !== 2 ||
    typeof document.fullText !== 'string' ||
    !Array.isArray(document.pages)
  )
    throw new Error('分析入口仅接受 DocumentParser 的正文结果。');
  assertCleanText(document.fullText);
  for (const page of document.pages) {
    assertCleanText(page.text);
    assertCleanText(page.title);
  }
  if (!document.pages.some((p) => p.text.trim()))
    throw new Error('没有可分析的正文；请先完成 OCR 或转换文件。');
}
export async function parseDocument(
  file: File,
  report: ProgressReporter = () => {},
  signal: AbortSignal = new AbortController().signal,
): Promise<ParsedDocument> {
  try {
    const fileType = identifyFile(file);
    await stage(report, 'read', signal);
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const kind = signature(head);
    const expected: Record<string, string> = {
      PDF: 'pdf',
      PPTX: 'zip',
      DOCX: 'zip',
      PPT: 'office',
      DOC: 'office',
      PNG: 'png',
      JPG: 'jpeg',
      JPEG: 'jpeg',
    };
    if (fileType === 'TXT' || fileType === 'Markdown') {
      if (kind !== 'unknown')
        throw new Error(
          '文件扩展名为文本，但文件头是二进制格式。请使用真实的 PDF、PPTX、DOCX 或图片后缀重新上传。',
        );
    } else if (kind !== expected[fileType])
      throw new Error(fileType + ' 文件签名不匹配，文件可能损坏或扩展名错误。');
    await stage(report, 'extract', signal);
    let output: ParserOutput;
    let parser: string;
    let method: ParsedDocument['method'];
    switch (fileType) {
      case 'PDF':
        output = await parsePdf(file, signal);
        parser = 'PDFParser';
        method = 'pdf';
        break;
      case 'PPTX':
        output = await parsePptx(file, signal);
        parser = 'PPTXParser';
        method = 'office';
        break;
      case 'DOCX':
        output = await parseDocx(file, signal);
        parser = 'DOCXParser (Mammoth)';
        method = 'office';
        break;
      case 'TXT':
      case 'Markdown':
        output = await parseText(file);
        parser = 'TextParser (UTF-8)';
        method = 'text';
        break;
      case 'PNG':
      case 'JPG':
      case 'JPEG':
        output = await parseImage();
        parser = 'ImageParser (OCR pending)';
        method = 'unavailable';
        break;
      default:
        throw new Error('旧版 PPT / DOC 暂不支持内容解析，请另存为 PPTX / DOCX 后上传。');
    }
    checkAborted(signal);
    let remaining = MAX_TEXT;
    const pages = output.pages.map((p) => {
      const text = cleanText(p.text);
      const limited = text.slice(0, Math.max(0, remaining));
      remaining -= text.length;
      return { ...p, title: cleanText(p.title), text: limited, pageNumber: p.page };
    });
    if (remaining < 0) output.warnings.push('仅保留前 200,000 字符，请拆分资料以读取剩余内容。');
    const characters = pages.reduce((sum, p) => sum + p.text.length, 0);
    if (!characters && !output.needsOCR)
      throw new Error('未提取到有效正文，请检查文件内容或转换格式。');
    const fullText = pages
      .map(
        (p, i) =>
          '--- ' +
          (fileType === 'PPTX' ? 'Slide' : fileType === 'PDF' ? 'Page' : 'Section') +
          ' ' +
          (p.pageNumber ?? i + 1) +
          ' ---\n' +
          p.text,
      )
      .join('\n\n');
    const result: ParsedDocument = {
      title: file.name,
      fileType,
      method,
      pages,
      fullText,
      warnings: output.warnings,
      metadata: {
        parserVersion: 2,
        parser,
        fileSize: file.size,
        pageCount: pages.length,
        characters,
        needsOCR: !!output.needsOCR,
        ocrPages: output.ocrPages ?? [],
      },
    };
    if (import.meta.env.DEV)
      console.debug('[DocumentParser]', {
        fileType,
        fileSize: file.size,
        parser,
        pages: pages.length,
        characters,
        preview: fullText.slice(0, 500),
      });
    return result;
  } catch (e) {
    if (signal.aborted) checkAborted(signal);
    throw new Error('文件解析失败：' + (e instanceof Error ? e.message : '未知格式错误'));
  }
}
