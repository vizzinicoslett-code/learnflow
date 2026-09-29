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
  if (result.points.some((p) => data.nodes.some((n) => n.id === p.id)))
    throw new Error('知识点 ID 冲突，请重试。');
  const previousNodes = data.nodes.filter((n) =>
    resource.analysis?.knowledgePointIds.includes(n.id),
  );
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
    const old = previousNodes.find(
      (n) => n.source?.section === p.source.section && n.source.page === p.source.page,
    );
    if (old)
      return {
        ...old,
        title:
          old.title === resource.analysis?.sections.find((s) => s.id === p.source.section)?.title
            ? p.title
            : old.title,
        summary: p.summary,
        source: p.source,
        generatedBy: result.mode,
        updatedAt: now(),
        content: {
          ...old.content,
          concept: old.content.concept === old.summary ? p.summary : old.content.concept,
        },
      };
    return {
      ...newNode(resource.courseId, p.title, 'topic', root.id, i),
      id: p.id,
      summary: p.summary,
      learningPriority: p.importance,
      source: p.source,
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
