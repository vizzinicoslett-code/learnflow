import type { ParserOutput } from './shared';
export async function parseImage(): Promise<ParserOutput> {
  return {
    pages: [],
    needsOCR: true,
    ocrPages: [],
    warnings: ['图片资料已上传，OCR 功能尚未接入。'],
  };
}
