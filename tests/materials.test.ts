import { describe, expect, it } from 'vitest';
import { seedData } from '../src/domain/seed';
import { now, type ParsedDocument } from '../src/domain/model';
import { attachMaterialAnalysis } from '../src/domain/materials';
import { validateData } from '../src/domain/validation';
import { MockMaterialAnalysisProvider, validateAnalysis } from '../src/services/materialAnalysis';
import { identifyFile } from '../src/services/materialExtraction';
import { parseDocument } from '../src/services/documentParser';
import { assertCleanText } from '../src/services/parsers/shared';
async function context() {
  return {
    fileId: 'file-1',
    fileName: '课堂.md',
    extraction: await parseDocument(
      new File(['# 基本定义\n光束参数的定义与公式。\n# 附录\n历史背景。'], '课堂.md'),
    ),
  };
}
describe('资料解析与知识树', () => {
  it('结构化草案使用真实正文，重解析保留笔记、状态与节点 ID', async () => {
    const c = await context();
    const stages: string[] = [];
    const provider = new MockMaterialAnalysisProvider();
    const result = await provider.analyze(c, (s) => stages.push(s), new AbortController().signal);
    expect(stages).toEqual(['structure', 'knowledge']);
    expect(result.points.map((p) => p.importance)).toEqual(['must', 'optional']);
    for (const p of result.points) expect(c.extraction.fullText).toContain(p.summary);
    const data = seedData();
    data.resources.push({
      id: c.fileId,
      courseId: 'laser',
      name: '课堂',
      type: 'Markdown',
      url: '',
      notes: '',
      createdAt: now(),
      file: { name: c.fileName, size: 100, mime: 'text/markdown', lastModified: 0 },
    });
    const next = attachMaterialAnalysis(data, c.fileId, result, c.extraction);
    expect(next.nodes.length).toBe(data.nodes.length + 3);
    expect(validateData(JSON.parse(JSON.stringify(next)))).toEqual(next);
    expect(attachMaterialAnalysis(next, c.fileId, result, c.extraction)).toBe(next);
    next.nodes.at(-2)!.content.notes = '我的笔记';
    next.nodes.at(-2)!.status = 'mastered';
    const rerun = await provider.analyze(c, () => {}, new AbortController().signal);
    const restored = attachMaterialAnalysis(next, c.fileId, rerun, c.extraction);
    expect(restored.nodes.length).toBe(next.nodes.length);
    expect(restored.nodes.at(-2)?.id).toBe(next.nodes.at(-2)?.id);
    expect(restored.nodes.at(-2)?.content.notes).toBe('我的笔记');
    expect(restored.nodes.at(-2)?.status).toBe('mastered');
    expect(() =>
      validateAnalysis(
        {
          ...result,
          points: result.points.map((p) => ({ ...p, source: { ...p.source, page: 12 } })),
        },
        c,
      ),
    ).toThrow();
  });
  it('无正文、二进制、未验证结果不能进入分析，取消不返回结果', async () => {
    const c = await context();
    const provider = new MockMaterialAnalysisProvider();
    const empty: ParsedDocument = { ...c.extraction, pages: [], fullText: '' };
    await expect(
      provider.analyze({ ...c, extraction: empty }, () => {}, new AbortController().signal),
    ).rejects.toThrow('没有可分析');
    await expect(
      provider.analyze(
        { ...c, extraction: { pages: [] } as unknown as ParsedDocument },
        () => {},
        new AbortController().signal,
      ),
    ).rejects.toThrow('DocumentParser');
    await expect(
      provider.analyze(
        { ...c, extraction: { ...c.extraction, fullText: 'PK\u0003\u0004binary' } },
        () => {},
        new AbortController().signal,
      ),
    ).rejects.toThrow('二进制');
    const abort = new AbortController();
    abort.abort();
    await expect(provider.analyze(c, () => {}, abort.signal)).rejects.toThrow('取消');
  });
  it('错误后缀 ZIP/PDF、无效 UTF-8 与二进制正文会被拒绝，合法 PK 术语保留', async () => {
    for (const bytes of [
      new Uint8Array([80, 75, 3, 4, 0, 0, 0, 0]),
      new TextEncoder().encode('%PDF-1.4'),
      new Uint8Array([0xff, 0xfe, 0, 2]),
      new Uint8Array([0, 1, 2, 3]),
    ]) {
      await expect(parseDocument(new File([bytes], 'misnamed.txt'))).rejects.toThrow(
        '文件解析失败',
      );
    }
    await expect(
      parseDocument(new File(['PK 在药理学中是正常缩写'], 'good.txt')),
    ).resolves.toHaveProperty('metadata.parserVersion', 2);
    expect(() => assertCleanText('■■■■■■■■无法识别')).toThrow();
    expect(() => assertCleanText('正常中文�错误')).toThrow();
  });
  it('拒绝不支持、空文件、过大文件和损坏的来源', () => {
    expect(() => identifyFile({ name: 'x.exe', size: 2 })).toThrow();
    expect(() => identifyFile({ name: 'x.pdf', size: 0 })).toThrow();
    expect(() => identifyFile({ name: 'x.pdf', size: 21 * 1024 * 1024 })).toThrow();
    const data = seedData();
    Object.assign(data.nodes[0], {
      source: { fileId: 'a', fileName: 'b', section: 'c', page: -1 },
    });
    expect(() => validateData(data)).toThrow();
  });
});
