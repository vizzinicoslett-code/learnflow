import {
  uid,
  type LearningPriority,
  type MaterialExtraction,
  type MaterialSource,
} from '../domain/model';
import { checkAborted, stage, type ProgressReporter } from './materialExtraction';

export interface MaterialContext {
  fileId: string;
  fileName: string;
  extraction: MaterialExtraction;
}
export interface MaterialPoint {
  id: string;
  title: string;
  summary: string;
  importance: LearningPriority;
  source: MaterialSource;
  status: 'unlearned';
}
export interface MaterialAnalysisResult {
  mode: 'mock' | 'ai';
  summary: string;
  sections: { id: string; title: string; page: number | null }[];
  points: MaterialPoint[];
  warnings: string[];
}
export interface MaterialAnalysisProvider {
  analyze(
    context: MaterialContext,
    report: ProgressReporter,
    signal: AbortSignal,
  ): Promise<MaterialAnalysisResult>;
}
export class MockMaterialAnalysisProvider implements MaterialAnalysisProvider {
  async analyze(
    context: MaterialContext,
    report: ProgressReporter,
    signal: AbortSignal,
  ): Promise<MaterialAnalysisResult> {
    await stage(report, 'structure', signal);
    const pages = context.extraction.pages.filter((p) => p.text.trim()).slice(0, 40);
    const sourcePages = pages.length
      ? pages
      : [
          {
            section: 'unrecognized',
            title: '待识别内容（Mock 示例）',
            page: null,
            text: '尚未提取到正文。请转换文件格式或接入 OCR 后再整理知识。此条仅用于体验学习流程。',
          },
        ];
    const sections = sourcePages.map((p) => ({ id: p.section, title: p.title, page: p.page }));
    await stage(report, 'knowledge', signal);
    const points: MaterialPoint[] = sourcePages.map((p) => ({
      id: uid(),
      title: p.title.slice(0, 120),
      summary: p.text.slice(0, 650),
      importance: /附录|参考文献|历史背景/.test(p.title)
        ? 'optional'
        : /定义|公式|定理|核心|基本/.test(p.text)
          ? 'must'
          : 'understand',
      source: {
        fileId: context.fileId,
        fileName: context.fileName,
        page: p.page,
        section: p.section,
      },
      status: 'unlearned',
    }));
    return {
      mode: 'mock',
      sections,
      points,
      summary: pages.length
        ? `规则草案：从正文提取了 ${pages.length} 个内容片段。以下为原文节选，尚未经过 AI 理解：\n${pages
            .map((p) => p.text.slice(0, 180))
            .join('\n')
            .slice(0, 1800)}`
        : '尚未读取到正文；当前仅提供明确标记的流程示例，不代表资料的实际内容。',
      warnings: [
        'Mock 规则分析，未调用 AI。标题来自正文，重要程度按关键词粗略分配，请对照原文校对。',
        ...(context.extraction.pages.length > 40
          ? ['本次草案最多整理 40 个片段；完整提取内容可在下方阅读。']
          : []),
      ],
    };
  }
}

/** Treat remote model output as untrusted data before it enters the knowledge tree. */
export function validateAnalysis(value: unknown, context: MaterialContext): MaterialAnalysisResult {
  const bad = (): never => {
    throw new Error('解析结果格式或来源引用无效，未写入知识树。');
  };
  if (!value || typeof value !== 'object') return bad();
  const v = value as MaterialAnalysisResult;
  const text = (s: unknown, max: number) =>
    typeof s === 'string' && s.length > 0 && s.length <= max;
  if (
    !['mock', 'ai'].includes(v.mode) ||
    !text(v.summary, 12000) ||
    !Array.isArray(v.sections) ||
    !Array.isArray(v.points) ||
    !Array.isArray(v.warnings) ||
    v.points.length < 1 ||
    v.points.length > 200 ||
    v.sections.length > 200 ||
    v.warnings.some((w) => !text(w, 2000))
  )
    return bad();
  const ids = new Set<string>();
  for (const s of v.sections) {
    if (
      !s ||
      !text(s.id, 200) ||
      ids.has(s.id) ||
      !text(s.title, 300) ||
      !(s.page === null || (Number.isInteger(s.page) && Number(s.page) > 0))
    )
      return bad();
    ids.add(s.id);
  }
  ids.clear();
  for (const p of v.points) {
    if (
      !p ||
      !text(p.id, 200) ||
      ids.has(p.id) ||
      !text(p.title, 300) ||
      !text(p.summary, 12000) ||
      !['must', 'understand', 'optional'].includes(p.importance) ||
      p.status !== 'unlearned' ||
      !p.source ||
      p.source.fileId !== context.fileId ||
      p.source.fileName !== context.fileName ||
      !v.sections.some((s) => s.id === p.source.section && s.page === p.source.page)
    )
      return bad();
    const real = context.extraction.pages.some(
      (s) => s.section === p.source.section && s.page === p.source.page,
    );
    if (
      !real &&
      !(
        v.mode === 'mock' &&
        p.source.section === 'unrecognized' &&
        p.source.page === null &&
        !context.extraction.pages.some((s) => s.text.trim())
      )
    )
      return bad();
    ids.add(p.id);
  }
  return v;
}

/** Point this at an authenticated Serverless endpoint, never directly at a model vendor. */
export class HttpMaterialAnalysisProvider implements MaterialAnalysisProvider {
  constructor(private endpoint: string) {
    if (new URL(endpoint).protocol !== 'https:') throw new Error('AI 接口必须使用 HTTPS。');
  }
  async analyze(context: MaterialContext, report: ProgressReporter, signal: AbortSignal) {
    await stage(report, 'structure', signal);
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: 1, ...context }),
      credentials: 'include',
      signal: AbortSignal.any([signal, AbortSignal.timeout(90000)]),
    });
    if (!response.ok) throw new Error(`AI 服务暂不可用（${response.status}），可稍后重试。`);
    checkAborted(signal);
    await stage(report, 'knowledge', signal);
    const result = validateAnalysis(await response.json(), context);
    if (result.mode !== 'ai') throw new Error('AI 接口返回了非 AI 结果。');
    return result;
  }
}
