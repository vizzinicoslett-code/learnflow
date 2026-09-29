import type { MaterialExtraction, MaterialPage, ProcessingStage, Resource } from '../domain/model';

export const acceptedFiles = '.pdf,.ppt,.pptx,.doc,.docx,.txt,.md,.markdown,.png,.jpg,.jpeg';
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_TEXT = 200_000;
const types: Record<string, Resource['type']> = {
  pdf: 'PDF',
  ppt: 'PPT',
  pptx: 'PPTX',
  doc: 'DOC',
  docx: 'DOCX',
  txt: 'TXT',
  md: 'Markdown',
  markdown: 'Markdown',
  png: 'PNG',
  jpg: 'JPG',
  jpeg: 'JPEG',
};
export function identifyFile(file: Pick<File, 'name' | 'size'>): Resource['type'] {
  const type = types[file.name.split('.').at(-1)?.toLowerCase() ?? ''];
  if (!type) throw new Error('不支持此格式，请选择 PDF、PPT、Word、TXT、MD 或 PNG/JPG 图片。');
  if (file.size === 0) throw new Error('文件为空，请重新选择。');
  if (file.size > MAX_FILE_BYTES) throw new Error('单个文件不能超过 20 MB，请拆分后上传。');
  return type;
}
export const checkAborted = (signal: AbortSignal) => {
  if (signal.aborted) throw new DOMException('解析已取消，可从资料列表重试。', 'AbortError');
};
export type ProgressReporter = (stage: ProcessingStage) => void;
export async function stage(
  reporter: ProgressReporter,
  value: ProcessingStage,
  signal: AbortSignal,
) {
  checkAborted(signal);
  reporter(value);
  // Yield so the browser paints the actual processing stage before CPU work.
  await new Promise((resolve) => setTimeout(resolve, 25));
  checkAborted(signal);
}
function decode(bytes: Uint8Array) {
  if (bytes[0] === 255 && bytes[1] === 254) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes[0] === 254 && bytes[1] === 255) return new TextDecoder('utf-16be').decode(bytes);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('gb18030').decode(bytes);
  }
}
export function textSections(text: string): MaterialPage[] {
  const blocks: { title: string; lines: string[] }[] = [];
  let current = { title: '正文', lines: [] as string[] };
  for (const line of text.split(/\r?\n/)) {
    if (/^#{1,6}\s+\S|^第[一二三四五六七八九十百\d]+[章节讲]\s*\S/.test(line.trim())) {
      if (current.lines.join('').trim()) blocks.push(current);
      current = {
        title: line
          .replace(/^#+\s*/, '')
          .trim()
          .slice(0, 120),
        lines: [],
      };
    } else current.lines.push(line);
  }
  if (current.lines.join('').trim() || current.title !== '正文') blocks.push(current);
  return blocks
    .flatMap((block) => {
      const content = block.lines.join('\n').trim();
      const chunks = content.match(/[\s\S]{1,5000}/g) ?? [''];
      return chunks.map((text, i) => ({
        page: null,
        section: '',
        title: `${block.title}${chunks.length > 1 ? ` · 片段 ${i + 1}` : ''}`,
        text,
      }));
    })
    .map((p, i) => ({ ...p, section: `section-${i + 1}` }));
}
function xml(bytes: Uint8Array): Document {
  const doc = new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'application/xml');
  if (doc.getElementsByTagName('parsererror').length)
    throw new Error('Office 文档结构损坏，无法读取。');
  return doc;
}
function officeText(doc: Document) {
  return Array.from(doc.getElementsByTagNameNS('*', 'p'))
    .map((p) =>
      Array.from(p.getElementsByTagNameNS('*', 't'))
        .map((t) => t.textContent ?? '')
        .join(''),
    )
    .filter(Boolean)
    .join('\n');
}
async function office(bytes: Uint8Array, type: Resource['type']): Promise<MaterialPage[]> {
  const { unzipSync } = await import('fflate');
  let expanded = 0;
  const files = unzipSync(bytes, {
    filter: (entry) => {
      if (
        !/^(word\/document\.xml|ppt\/presentation\.xml|ppt\/_rels\/presentation\.xml\.rels|ppt\/slides\/slide\d+\.xml)$/.test(
          entry.name,
        )
      )
        return false;
      expanded += entry.originalSize;
      if (expanded > 8 * 1024 * 1024) throw new Error('Office 解压后的正文过大，请拆分文件。');
      return true;
    },
  });
  if (type === 'DOCX') {
    if (!files['word/document.xml']) throw new Error('文件不是有效的 DOCX 文档。');
    return textSections(officeText(xml(files['word/document.xml'])));
  }
  if (!files['ppt/presentation.xml'] || !files['ppt/_rels/presentation.xml.rels'])
    throw new Error('文件不是有效的 PPTX 演示文稿。');
  const presentation = xml(files['ppt/presentation.xml']);
  const relationships = xml(files['ppt/_rels/presentation.xml.rels']);
  const rels = new Map(
    Array.from(relationships.getElementsByTagNameNS('*', 'Relationship')).map((r) => [
      r.getAttribute('Id'),
      r.getAttribute('Target'),
    ]),
  );
  return Array.from(presentation.getElementsByTagNameNS('*', 'sldId')).map((s, i) => {
    const rid =
      s.getAttributeNS(
        'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
        'id',
      ) ?? s.getAttribute('r:id');
    const target = rels.get(rid);
    const path = target?.startsWith('/') ? target.slice(1) : `ppt/${target?.replace(/^\.\//, '')}`;
    if (!target || !files[path]) throw new Error('演示文稿含无法读取的幻灯片引用。');
    const text = officeText(xml(files[path]));
    return {
      page: i + 1,
      section: `slide-${i + 1}`,
      title: text.split('\n')[0]?.slice(0, 120) || `第 ${i + 1} 页（无文字）`,
      text,
    };
  });
}
export async function extractMaterial(
  file: File,
  report: ProgressReporter,
  signal: AbortSignal,
): Promise<MaterialExtraction> {
  const type = identifyFile(file);
  await stage(report, 'read', signal);
  const bytes = new Uint8Array(await file.arrayBuffer());
  checkAborted(signal);
  await stage(report, 'extract', signal);
  let pages: MaterialPage[] = [];
  let method: MaterialExtraction['method'] = 'unavailable';
  const warnings: string[] = [];
  if (type === 'TXT' || type === 'Markdown') {
    method = 'text';
    pages = textSections(decode(bytes));
  } else if (type === 'PPTX' || type === 'DOCX') {
    method = 'office';
    pages = await office(bytes, type);
    warnings.push('仅提取正文文字；图片、公式对象、图表及复杂排版可能遗漏，请对照原文件。');
  } else if (type === 'PDF') {
    method = 'pdf';
    const pdfjs = await import('pdfjs-dist');
    const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const task = pdfjs.getDocument({
      data: bytes,
      cMapUrl: new URL(`${import.meta.env.BASE_URL}pdfjs/cmaps/`, document.baseURI).href,
      cMapPacked: true,
      standardFontDataUrl: new URL(
        `${import.meta.env.BASE_URL}pdfjs/standard_fonts/`,
        document.baseURI,
      ).href,
    });
    const cancel = () => {
      void task.destroy();
    };
    signal.addEventListener('abort', cancel, { once: true });
    // Never leave password-protected PDFs waiting indefinitely for a prompt.
    task.onPassword = () => {
      void task.destroy();
    };
    try {
      const pdf = await task.promise;
      if (pdf.numPages > 300) throw new Error('PDF 超过 300 页，请拆分后上传。');
      for (let i = 1; i <= pdf.numPages; i++) {
        checkAborted(signal);
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const text = content.items
          .map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : ''))
          .join('')
          .trim();
        pages.push({ page: i, section: `page-${i}`, title: `第 ${i} 页`, text });
        page.cleanup();
        if (pages.reduce((count, p) => count + p.text.length, 0) > MAX_TEXT) {
          warnings.push('正文超过分析长度限制，后续页尚未读取。');
          break;
        }
      }
    } catch (error) {
      checkAborted(signal);
      throw new Error(
        error instanceof Error && error.message.includes('300')
          ? error.message
          : 'PDF 无法读取，可能已加密或损坏。请先解密或重新导出 PDF。',
      );
    } finally {
      signal.removeEventListener('abort', cancel);
      await task.destroy();
    }
    warnings.push('PDF 仅读取文字层，未识别扫描图像、图表与公式布局。');
  } else
    warnings.push(
      ['PPT', 'DOC'].includes(type)
        ? '旧版二进制 Office 格式暂未解码。请另存为 PPTX / DOCX 后重新导入；当前仅生成流程占位示例。'
        : '图片已保存，可预览；尚未接入 OCR，当前仅生成流程占位示例。',
    );
  checkAborted(signal);
  let remaining = MAX_TEXT;
  pages = pages.map((p) => {
    const text = p.text.slice(0, Math.max(0, remaining));
    remaining -= p.text.length;
    return { ...p, text };
  });
  if (remaining < 0) warnings.push('正文超过 200,000 字符，仅处理前 200,000 字符。');
  if (pages.some((p) => !p.text.trim()))
    warnings.push('部分页面没有可提取的文字，可能需要 OCR；没有为这些页虚构内容。');
  if (!pages.some((p) => p.text.trim()))
    warnings.push('尚未获取有效正文。知识点将明确标为待识别示例，请勿当作文件内容或考试结论。');
  return { method, pages, warnings };
}
