import { now, uid, type Action, type AppData, type KnowledgeNode, type Status } from './model';
import { isStudyTopic } from './studyContent';

export function descendants(nodes: KnowledgeNode[], id: string): Set<string> {
  const found = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of nodes)
      if (n.parentId && found.has(n.parentId) && !found.has(n.id)) {
        found.add(n.id);
        changed = true;
      }
  }
  return found;
}
export function setParent(data: AppData, id: string, parentId: string | null): AppData {
  const node = data.nodes.find((n) => n.id === id);
  const parent = data.nodes.find((n) => n.id === parentId);
  if (
    !node ||
    (parentId &&
      (!parent || parent.courseId !== node.courseId || descendants(data.nodes, id).has(parentId)))
  )
    throw new Error('父节点无效，不能形成循环或跨课程移动。');
  if (node.kind === 'chapter' && parent?.kind === 'topic')
    throw new Error('章节不能放在知识点下。');
  if (node.parentId === parentId) return data;
  return {
    ...data,
    nodes: data.nodes.map((n) =>
      n.id === id
        ? {
            ...n,
            parentId,
            order:
              Math.max(
                -1,
                ...data.nodes.filter((p) => p.parentId === parentId).map((p) => p.order),
              ) + 1,
          }
        : n,
    ),
  };
}
export function reorder(data: AppData, id: string, targetId: string): AppData {
  const a = data.nodes.find((n) => n.id === id);
  const b = data.nodes.find((n) => n.id === targetId);
  if (!a || !b || a.id === b.id || a.courseId !== b.courseId || a.parentId !== b.parentId)
    return data;
  const siblings = data.nodes
    .filter((n) => n.courseId === a.courseId && n.parentId === a.parentId)
    .sort((x, y) => x.order - y.order);
  const from = siblings.findIndex((n) => n.id === id);
  const to = siblings.findIndex((n) => n.id === targetId);
  siblings.splice(to, 0, siblings.splice(from, 1)[0]);
  return {
    ...data,
    nodes: data.nodes.map((n) =>
      siblings.some((s) => s.id === n.id)
        ? { ...n, order: siblings.findIndex((s) => s.id === n.id) }
        : n,
    ),
  };
}
export function deleteNodes(data: AppData, ids: Set<string>): AppData {
  return {
    ...data,
    nodes: data.nodes.filter((n) => !ids.has(n.id)),
    edges: data.edges.filter((e) => !ids.has(e.sourceId) && !ids.has(e.targetId)),
    questions: data.questions.filter((q) => !ids.has(q.nodeId)),
  };
}
export function deleteCourse(data: AppData, id: string): AppData {
  return {
    ...deleteNodes(data, new Set(data.nodes.filter((n) => n.courseId === id).map((n) => n.id))),
    courses: data.courses.filter((c) => c.id !== id),
    resources: data.resources.filter((r) => r.courseId !== id),
  };
}
export function hasPath(data: AppData, from: string, to: string): boolean {
  const visited = new Set<string>();
  const queue = [from];
  while (queue.length) {
    const id = queue.pop()!;
    if (id === to) return true;
    if (visited.has(id)) continue;
    visited.add(id);
    queue.push(
      ...data.edges
        .filter((e) => e.kind === 'prerequisite' && e.sourceId === id)
        .map((e) => e.targetId),
    );
  }
  return false;
}
export function addEdge(
  data: AppData,
  sourceId: string,
  targetId: string,
  kind: 'prerequisite' | 'related',
): AppData {
  const source = data.nodes.find((n) => n.id === sourceId);
  const target = data.nodes.find((n) => n.id === targetId);
  if (
    !source ||
    !target ||
    sourceId === targetId ||
    source.courseId !== target.courseId ||
    source.kind !== 'topic' ||
    target.kind !== 'topic'
  )
    throw new Error('请选择同一课程内两个不同的知识点。');
  if (
    data.edges.some(
      (e) =>
        e.kind === kind &&
        ((e.sourceId === sourceId && e.targetId === targetId) ||
          (kind === 'related' && e.sourceId === targetId && e.targetId === sourceId)),
    )
  )
    return data;
  if (kind === 'prerequisite' && hasPath(data, targetId, sourceId))
    throw new Error('此前置关系会形成循环，请检查依赖顺序。');
  return {
    ...data,
    edges: [...data.edges, { id: uid(), courseId: source.courseId, sourceId, targetId, kind }],
  };
}
export function record(
  data: AppData,
  nodeId: string,
  action: Action,
  options: { status?: Status; answer?: string; questionPrompt?: string; at?: string } = {},
): AppData {
  const node = data.nodes.find((n) => n.id === nodeId);
  if (!node || !isStudyTopic(node)) return data;
  const at = options.at ?? now();
  const transitions: Partial<Record<Action, Status>> = {
    understand: 'understood',
    vague: 'learning',
    unknown: 'unlearned',
    review: 'review',
    correct: 'mastered',
    incorrect: 'learning',
  };
  const status = options.status ?? transitions[action] ?? node.status;
  const days: Partial<Record<Action, number>> = {
    understand: 3,
    vague: 1,
    unknown: 1,
    review: 0,
    correct: 7,
    incorrect: 1,
  };
  const interval = action === 'status' && status === 'review' ? 0 : days[action];
  const reviewAt =
    interval !== undefined
      ? new Date(new Date(at).getTime() + interval * 86400000).toISOString()
      : node.reviewAt;
  return {
    ...data,
    nodes: data.nodes.map((n) => (n.id === nodeId ? { ...n, status, reviewAt, updatedAt: at } : n)),
    events: [
      ...data.events,
      {
        id: uid(),
        courseId: node.courseId,
        nodeId,
        nodeTitle: node.title,
        action,
        fromStatus: node.status,
        toStatus: status,
        at,
        ...(options.answer !== undefined ? { answer: options.answer } : {}),
        ...(options.questionPrompt ? { questionPrompt: options.questionPrompt } : {}),
      },
    ],
  };
}
export function isWeak(data: AppData, node: KnowledgeNode): boolean {
  const ratings = data.events.filter(
    (e) =>
      e.nodeId === node.id &&
      ['unknown', 'vague', 'incorrect', 'understand', 'correct', 'status'].includes(e.action),
  );
  const last = ratings.at(-1);
  return (
    node.status === 'review' ||
    (node.status !== 'mastered' &&
      !!last &&
      ['unknown', 'vague', 'incorrect'].includes(last.action))
  );
}
export const struggleCount = (data: AppData, id: string) =>
  data.events.filter((e) => e.nodeId === id && ['unknown', 'incorrect'].includes(e.action)).length;
export const isDue = (n: KnowledgeNode) =>
  isStudyTopic(n) && !!n.reviewAt && new Date(n.reviewAt).getTime() <= Date.now();
export const isStudy = (action: Action) => !['open', 'review'].includes(action);
export const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function sevenDays(data: AppData) {
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - 6 + i);
    const key = dayKey(date);
    return {
      key,
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      count: data.events.filter((e) => isStudy(e.action) && dayKey(new Date(e.at)) === key).length,
    };
  });
}
export function nextNode(data: AppData): { node: KnowledgeNode; reason: string } | undefined {
  const topics = data.nodes.filter(isStudyTopic);
  const due = topics.filter(isDue).sort((a, b) => a.reviewAt!.localeCompare(b.reviewAt!))[0];
  if (due) return { node: due, reason: '已到复习时间，先试着回忆，再看笔记。' };
  const weak = topics.find((n) => isWeak(data, n));
  if (weak) return { node: weak, reason: '最近的回忆还有些模糊，给它多一次练习。' };
  const priority: Record<Status, number> = {
    learning: 0,
    unlearned: 1,
    understood: 2,
    review: 3,
    mastered: 4,
  };
  const ready = [...topics]
    .sort((a, b) => priority[a.status] - priority[b.status])
    .find(
      (n) =>
        n.status !== 'mastered' &&
        data.edges
          .filter((e) => e.kind === 'prerequisite' && e.targetId === n.id)
          .every((e) =>
            ['understood', 'mastered'].includes(
              data.nodes.find((p) => p.id === e.sourceId)?.status ?? '',
            ),
          ),
    );
  return ready
    ? {
        node: ready,
        reason: data.edges.some((e) => e.kind === 'prerequisite' && e.targetId === ready.id)
          ? '前置知识已基本理解，适合继续向前。'
          : '这是一个尚未掌握的起点，从它开始建立理解。',
      }
    : undefined;
}
