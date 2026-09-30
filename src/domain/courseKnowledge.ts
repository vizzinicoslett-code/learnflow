import {
  now,
  type AppData,
  type KnowledgeNode,
  type LearningPriority,
  type MaterialSource,
  type Resource,
  type Status,
} from './model';
import { dayKey, isStudy, nextNode } from './logic';
export interface KnowledgePoint {
  id: string;
  courseId: string;
  documentId: string | null;
  title: string;
  summary: string;
  importance: LearningPriority;
  status: Status;
  source: (MaterialSource & { documentId: string; pageNumber: number | null }) | null;
  prerequisites: string[];
  relatedKnowledgePointIds: string[];
  createdAt: string;
  updatedAt: string;
}
export const priorityLabels: Record<LearningPriority, string> = {
  must: '必须掌握',
  understand: '理解即可',
  optional: '暂时跳过',
};
export const priorityOf = (node: KnowledgeNode): LearningPriority =>
  (({ 1: 'optional', 2: 'understand', 3: 'must' }) as const)[node.importance];
/** Additive compatibility migration: no identifiers, notes, events or raw files are deleted. */
export function migrateKnowledgeData(data: AppData): AppData {
  return {
    ...data,
    modelVersion: 2,
    nodes: data.nodes.map((n) => {
      const resource = data.resources.find((r) => r.id === n.source?.fileId);
      return {
        ...n,
        createdAt: n.createdAt ?? resource?.createdAt ?? n.updatedAt,
        ...(n.kind === 'topic' ? { learningPriority: priorityOf(n) } : {}),
        ...(n.source
          ? {
              documentId: n.source.fileId,
              source: {
                ...n.source,
                documentId: n.source.fileId,
                pageNumber: n.source.page,
                quote: n.source.quote ?? n.summary?.slice(0, 350),
              },
            }
          : {}),
      };
    }),
  };
}
export function knowledgePoint(data: AppData, n: KnowledgeNode): KnowledgePoint {
  return {
    id: n.id,
    courseId: n.courseId,
    documentId: n.source?.fileId ?? null,
    title: n.title,
    summary: n.summary ?? n.content.concept,
    importance: priorityOf(n),
    status: n.status,
    source: n.source
      ? { ...n.source, documentId: n.source.fileId, pageNumber: n.source.page }
      : null,
    prerequisites: data.edges
      .filter((e) => e.kind === 'prerequisite' && e.targetId === n.id)
      .map((e) => e.sourceId),
    relatedKnowledgePointIds: data.edges
      .filter((e) => e.kind === 'related' && (e.targetId === n.id || e.sourceId === n.id))
      .map((e) => (e.targetId === n.id ? e.sourceId : e.targetId)),
    createdAt: n.createdAt ?? n.updatedAt,
    updatedAt: n.updatedAt,
  };
}
export function courseProgress(nodes: KnowledgeNode[]) {
  const topics = nodes.filter((n) => n.kind === 'topic');
  const mastered = topics.filter((n) => n.status === 'mastered').length;
  return {
    total: topics.length,
    mastered,
    unlearned: topics.filter((n) => n.status === 'unlearned').length,
    learning: topics.filter((n) => n.status === 'learning').length,
    understood: topics.filter((n) => n.status === 'understood').length,
    review: topics.filter((n) => n.status === 'review').length,
    percent: topics.length ? Math.round((mastered / topics.length) * 100) : 0,
  };
}
export function sourcePage(data: AppData, node: KnowledgeNode) {
  if (!node.source) return undefined;
  const document = data.resources.find(
    (r) => r.id === node.source!.fileId && r.courseId === node.courseId,
  );
  const page =
    document?.extraction?.metadata?.parserVersion === 2
      ? document.extraction.pages.find(
          (p) => p.section === node.source!.section && p.page === node.source!.page,
        )
      : undefined;
  return document && page ? { document, page } : undefined;
}
export const sourceLabel = (document: Resource, page: number | null, index?: number) =>
  page !== null
    ? (document.type === 'PPTX' ? 'Slide ' : '第 ') + page + (document.type === 'PPTX' ? '' : ' 页')
    : '正文片段' + (index === undefined ? '' : ' ' + (index + 1));
export const documentRoute = (courseId: string, documentId: string) =>
  '/course/' + encodeURIComponent(courseId) + '/resource/' + encodeURIComponent(documentId);
export const readerRoute = (courseId: string, documentId: string, section: string) =>
  '/course/' +
  encodeURIComponent(courseId) +
  '/read/' +
  encodeURIComponent(documentId) +
  '/' +
  encodeURIComponent(section);
export function courseKnowledgeBase(data: AppData, courseId: string) {
  const nodes = data.nodes.filter((n) => n.courseId === courseId && n.kind === 'topic');
  const events = data.events.filter((e) => e.courseId === courseId);
  const documents = data.resources.filter((r) => r.courseId === courseId);
  const next = nextNode({
    ...data,
    nodes: data.nodes.filter((n) => n.courseId === courseId),
    events,
    edges: data.edges.filter((e) => e.courseId === courseId),
  });
  const today = events.filter(
    (e) => isStudy(e.action) && dayKey(new Date(e.at)) === dayKey(new Date()),
  );
  const masteredIds = [
    ...new Set(
      [...events]
        .reverse()
        .filter((e) => e.toStatus === 'mastered' && e.fromStatus !== 'mastered')
        .map((e) => e.nodeId),
    ),
  ];
  return {
    course: data.courses.find((c) => c.id === courseId),
    documents,
    knowledgePoints: nodes.map((n) => knowledgePoint(data, n)),
    nodes,
    notes: nodes
      .filter((n) => n.content.notes)
      .map((n) => ({
        courseId,
        knowledgePointId: n.id,
        content: n.content.notes,
        updatedAt: n.updatedAt,
      })),
    learningSessions: events
      .filter((e) => e.action === 'open')
      .map((e) => ({ id: e.id, courseId, knowledgePointId: e.nodeId, startedAt: e.at })),
    events,
    today,
    progress: courseProgress(nodes),
    next: next?.node,
    recentlyMastered: masteredIds
      .map((id) => nodes.find((n) => n.id === id && n.status === 'mastered'))
      .filter((n): n is KnowledgeNode => !!n)
      .slice(0, 5),
  };
}
export function saveNote(
  data: AppData,
  courseId: string,
  knowledgePointId: string,
  content: string,
): AppData {
  return {
    ...data,
    nodes: data.nodes.map((n) =>
      n.id === knowledgePointId && n.courseId === courseId
        ? { ...n, content: { ...n.content, notes: content }, updatedAt: now() }
        : n,
    ),
  };
}
