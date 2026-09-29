import { emptyContent, newNode, now, type AppData, type MaterialExtraction } from './model';
import { validateAnalysis, type MaterialAnalysisResult } from '../services/materialAnalysis';

export function attachMaterialAnalysis(
  data: AppData,
  resourceId: string,
  result: MaterialAnalysisResult,
  extraction: MaterialExtraction,
): AppData {
  const resource = data.resources.find((r) => r.id === resourceId);
  if (!resource?.file || !data.courses.some((c) => c.id === resource.courseId))
    throw new Error('资料或课程已被删除。');
  if (resource.analysis) return data;
  validateAnalysis(result, { fileId: resourceId, fileName: resource.file.name, extraction });
  if (result.points.some((p) => data.nodes.some((n) => n.id === p.id)))
    throw new Error('知识点 ID 冲突，请重试。');
  const root = newNode(
    resource.courseId,
    resource.name,
    'chapter',
    null,
    data.nodes.filter((n) => n.courseId === resource.courseId && !n.parentId).length,
  );
  const nodes = result.points.map((p, i) => ({
    ...newNode(resource.courseId, p.title, 'topic', root.id, i),
    id: p.id,
    summary: p.summary,
    learningPriority: p.importance,
    source: p.source,
    generatedBy: result.mode,
    importance: ({ must: 3, understand: 2, optional: 1 } as const)[p.importance],
    content: { ...emptyContent(), concept: p.summary },
  }));
  return {
    ...data,
    nodes: [...data.nodes, root, ...nodes],
    resources: data.resources.map((r) =>
      r.id !== resourceId
        ? r
        : {
            ...r,
            extraction,
            processing: { status: 'ready', stage: 'complete' },
            analysis: {
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
