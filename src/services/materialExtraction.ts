import type { MaterialPage, ProcessingStage, Resource } from '../domain/model';

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
