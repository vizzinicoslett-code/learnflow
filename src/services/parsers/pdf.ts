import { checkAborted, MAX_TEXT } from '../materialExtraction';
import type { ParserOutput } from './shared';
export async function parsePdf(file: File, signal: AbortSignal): Promise<ParserOutput> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  checkAborted(signal);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    cMapUrl: new URL(import.meta.env.BASE_URL + 'pdfjs/cmaps/', document.baseURI).href,
    cMapPacked: true,
    standardFontDataUrl: new URL(
      import.meta.env.BASE_URL + 'pdfjs/standard_fonts/',
      document.baseURI,
    ).href,
  });
  let rejectLoad: (error: Error) => void = () => {};
  const interrupted = new Promise<never>((_, reject) => {
    rejectLoad = reject;
  });
  const cancel = () => {
    rejectLoad(new DOMException('解析已取消，可从资料列表重试。', 'AbortError'));
    void task.destroy();
  };
  signal.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => {
    rejectLoad(new Error('PDF 读取超时，请拆分后重试。'));
    void task.destroy();
  }, 60000);
  task.onPassword = () => {
    rejectLoad(new Error('PDF 已加密，请解密后重新上传。'));
    void task.destroy();
  };
  const result: ParserOutput = {
    pages: [],
    warnings: ['PDF 仅读取文字层；图片、图表和公式布局未识别。'],
    ocrPages: [],
  };
  try {
    checkAborted(signal);
    const pdf = await Promise.race([task.promise, interrupted]);
    if (pdf.numPages > 300) throw new Error('PDF 超过 300 页，请拆分后上传。');
    let count = 0;
    for (let i = 1; i <= pdf.numPages; i++) {
      checkAborted(signal);
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : ''))
        .join('')
        .trim();
      result.pages.push({ page: i, section: 'page-' + i, title: '第 ' + i + ' 页', text });
      if (!text) result.ocrPages!.push(i);
      page.cleanup();
      count += text.length;
      if (count > MAX_TEXT) {
        result.warnings.push('正文超过 200,000 字符，后续页尚未读取。');
        break;
      }
    }
    result.needsOCR = result.ocrPages!.length > 0;
    if (result.needsOCR)
      result.warnings.push(
        result.ocrPages!.length === result.pages.length
          ? '该 PDF 可能为扫描版，需要 OCR'
          : '部分 PDF 页面没有文本层，可能需要 OCR。',
      );
    return result;
  } catch (e) {
    checkAborted(signal);
    throw new Error('PDF 无法读取：' + (e instanceof Error ? e.message : '文件损坏或格式无效'));
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', cancel);
    await task.destroy();
  }
}
