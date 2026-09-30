import { emptyContent, newNode, now, type AppData, type ParsedDocument } from './model';
import { validateAnalysis, type MaterialAnalysisResult } from '../services/materialAnalysis';

export function attachMaterialAnalysis(
  data: AppData,
  resourceId: string,
  result: MaterialAnalysisResult,
  extraction: ParsedDocument,
): AppData {
  const resource = data.resources.find((r) => r.id === resourceId);
  if (!resource?.file || !data.courses.some((c) => c.id === resource.courseId))
    throw new Error('资料或课程已被删除。');
  validateAnalysis(result, { fileId: resourceId, fileName: resource.file.name, extraction });
  if (resource.analysis?.knowledgePointIds.join() === result.points.map((p) => p.id).join())
    return data;
  const previousNodes = data.nodes.filter((n) =>
    resource.analysis?.knowledgePointIds.includes(n.id),
  );
  const matchedIds = new Set<string>();
  const normalize = (value: string) =>
    value.normalize('NFKC').trim().replace(/\s+/g, '').toLowerCase();
  const findPrevious = (point: MaterialAnalysisResult['points'][number]) => {
    const available = previousNodes.filter((node) => !matchedIds.has(node.id));
    const sameLocation = available.find(
      (node) =>
        node.source?.fileId === resourceId &&
        node.source.section === point.source.section &&
        node.source.page === point.source.page,
    );
    const sameTitleAndPage = available.find(
      (node) =>
        node.source?.fileId === resourceId &&
        node.source.page === point.source.page &&
        normalize(node.title) === normalize(point.title),
    );
    const sameTitle = available.find(
      (node) =>
        node.source?.fileId === resourceId && normalize(node.title) === normalize(point.title),
    );
    const matched = sameLocation ?? sameTitleAndPage ?? sameTitle;
    if (matched) matchedIds.add(matched.id);
    return matched;
  };
  const oldRoot = data.nodes.find((n) => n.id === previousNodes[0]?.parentId);
  const root =
    oldRoot ??
    newNode(
      resource.courseId,
      resource.name,
      'chapter',
      null,
      data.nodes.filter((n) => n.courseId === resource.courseId && !n.parentId).length,
    );
  const nodes = result.points.map((p, i) => {
    const old = findPrevious(p);
    if (old)
      return {
        ...old,
        title:
          old.title === resource.analysis?.sections.find((s) => s.id === p.source.section)?.title
            ? p.title
            : old.title,
        summary: p.summary,
        source: p.source,
        documentId: resourceId,
        generatedBy: result.mode,
        learningPriority: p.importance,
        importance: ({ must: 3, understand: 2, optional: 1 } as const)[p.importance],
        updatedAt: now(),
        content: {
          ...old.content,
          concept: old.content.concept === old.summary ? p.summary : old.content.concept,
        },
      };
    if (data.nodes.some((node) => node.id === p.id)) throw new Error('知识点 ID 冲突，请重试。');
    return {
      ...newNode(resource.courseId, p.title, 'topic', root.id, i),
      id: p.id,
      summary: p.summary,
      learningPriority: p.importance,
      source: p.source,
      documentId: resourceId,
      generatedBy: result.mode,
      importance: ({ must: 3, understand: 2, optional: 1 } as const)[p.importance],
      content: { ...emptyContent(), concept: p.summary },
    };
  });
  return {
    ...data,
    nodes: [
      ...data.nodes.filter((n) => !nodes.some((p) => p.id === n.id)),
      ...(oldRoot ? [] : [root]),
      ...nodes,
    ],
    resources: data.resources.map((r) =>
      r.id !== resourceId
        ? r
        : {
            ...r,
            extraction,
            processing: { status: 'ready', stage: 'complete' },
            analysis: {
              parserVersion: 2,
              mode: result.mode,
              summary: result.summary,
              sections: result.sections,
              knowledgePointIds: nodes.map((n) => n.id),
              warnings: [...extraction.warnings, ...result.warnings],
              analyzedAt: now(),
            },
          },
    ),
  };
}
