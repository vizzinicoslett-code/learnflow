import { describe, expect, it } from 'vitest';
import { seedData } from '../src/domain/seed';
import { now, type MaterialExtraction } from '../src/domain/model';
import { attachMaterialAnalysis } from '../src/domain/materials';
import { validateData } from '../src/domain/validation';
import { MockMaterialAnalysisProvider, validateAnalysis } from '../src/services/materialAnalysis';
import { identifyFile, textSections } from '../src/services/materialExtraction';
const extraction: MaterialExtraction = {
  method: 'text',
  pages: textSections('# 基本定义\n光束参数的定义与公式。\n# 附录\n历史背景。'),
  warnings: [],
};
const context = { fileId: 'file-1', fileName: '课堂.md', extraction };
describe('资料解析与知识树', () => {
  it('生成可校对的结构化草案，保持来源、优先级并防止重复写入', async () => {
    const stages: string[] = [];
    const result = await new MockMaterialAnalysisProvider().analyze(
      context,
      (s) => stages.push(s),
      new AbortController().signal,
    );
    expect(stages).toEqual(['structure', 'knowledge']);
    expect(result.points.map((p) => p.importance)).toEqual(['must', 'optional']);
    expect(result.points.every((p) => p.source.page === null)).toBe(true);
    const data = seedData();
    data.resources.push({
      id: context.fileId,
      courseId: 'laser',
      name: '课堂',
      type: 'Markdown',
      url: '',
      notes: '',
      createdAt: now(),
      file: { name: context.fileName, size: 100, mime: 'text/markdown', lastModified: 0 },
    });
    const next = attachMaterialAnalysis(data, context.fileId, result, extraction);
    expect(next.nodes.length).toBe(data.nodes.length + 3);
    expect(next.nodes.at(-2)?.source?.fileId).toBe(context.fileId);
    expect(validateData(JSON.parse(JSON.stringify(next)))).toEqual(next);
    expect(attachMaterialAnalysis(next, context.fileId, result, extraction)).toBe(next);
    expect(() =>
      validateAnalysis(
        {
          ...result,
          points: result.points.map((p) => ({ ...p, source: { ...p.source, page: 12 } })),
        },
        context,
      ),
    ).toThrow();
  });
  it('无正文时仅生成标记清楚的占位，取消时不返回结果', async () => {
    const c = {
      ...context,
      extraction: { method: 'unavailable', pages: [], warnings: [] } as MaterialExtraction,
    };
    const provider = new MockMaterialAnalysisProvider();
    const result = await provider.analyze(c, () => {}, new AbortController().signal);
    expect(result.points[0].title).toContain('待识别');
    expect(validateAnalysis(result, c)).toBe(result);
    const abort = new AbortController();
    abort.abort();
    await expect(provider.analyze(c, () => {}, abort.signal)).rejects.toThrow('取消');
  });
  it('拒绝不支持、空文件、过大文件和损坏的新增备份字段', () => {
    expect(() => identifyFile({ name: 'x.exe', size: 2 })).toThrow();
    expect(() => identifyFile({ name: 'x.pdf', size: 0 })).toThrow();
    expect(() => identifyFile({ name: 'x.pdf', size: 21 * 1024 * 1024 })).toThrow();
    expect(identifyFile({ name: 'X.PPTX', size: 2 })).toBe('PPTX');
    const data = seedData();
    Object.assign(data.nodes[0], {
      source: { fileId: 'a', fileName: 'b', section: 'c', page: -1 },
    });
    expect(() => validateData(data)).toThrow();
  });
});
