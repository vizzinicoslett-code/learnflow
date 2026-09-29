import { actionLabels, fields, resourceTypes, statuses, type AppData } from './model';
import { addEdge, setParent } from './logic';
type Obj = Record<string, unknown>;
const fail = (): never => {
  throw new Error('数据格式不正确或包含无效引用，请选择 LearnFlow 导出的 v1 JSON 备份。');
};
const obj = (v: unknown): Obj =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : fail();
const str = (v: unknown): v is string => typeof v === 'string';
const date = (v: unknown) => str(v) && Number.isFinite(Date.parse(v));
const text = (v: Obj, names: string[]) => names.every((k) => str(v[k]));
export function validateData(input: unknown): AppData {
  const d = obj(input);
  if (d.schemaVersion !== 1 || !Number.isSafeInteger(d.revision) || Number(d.revision) < 0) fail();
  for (const key of ['courses', 'nodes', 'edges', 'resources', 'questions', 'events']) {
    if (!Array.isArray(d[key])) fail();
    const ids = new Set<string>();
    for (const item of d[key] as unknown[]) {
      const v = obj(item);
      const id = v.id;
      if (!str(id) || !id || ids.has(id)) return fail();
      ids.add(id);
    }
  }
  const data = d as unknown as AppData;
  for (const c of data.courses)
    if (
      !text(obj(c), ['title', 'description', 'color']) ||
      !c.title.trim() ||
      !/^#[0-9a-fA-F]{6}$/.test(c.color) ||
      !date(c.createdAt)
    )
      fail();
  for (const n of data.nodes) {
    if (
      !text(obj(n), ['title', 'courseId']) ||
      !n.title.trim() ||
      !data.courses.some((c) => c.id === n.courseId) ||
      !['chapter', 'topic'].includes(n.kind) ||
      !Object.hasOwn(statuses, n.status) ||
      ![1, 2, 3].includes(n.importance) ||
      !Number.isFinite(n.order) ||
      !(n.parentId === null || str(n.parentId)) ||
      !date(n.updatedAt) ||
      !(n.reviewAt === null || date(n.reviewAt)) ||
      !text(obj(n.content), Object.keys(fields))
    )
      fail();
    setParent(data, n.id, n.parentId);
  }
  let check: AppData = { ...data, edges: [] };
  for (const e of data.edges) {
    if (
      !['prerequisite', 'related'].includes(e.kind) ||
      data.nodes.find((n) => n.id === e.sourceId)?.courseId !== e.courseId
    )
      fail();
    const next = addEdge(check, e.sourceId, e.targetId, e.kind);
    if (next.edges.length === check.edges.length) fail();
    check = next;
  }
  for (const q of data.questions)
    if (
      !text(obj(q), ['prompt', 'answer', 'nodeId']) ||
      !q.prompt.trim() ||
      !data.nodes.some((n) => n.id === q.nodeId && n.kind === 'topic')
    )
      fail();
  for (const r of data.resources)
    if (
      !text(obj(r), ['courseId', 'name', 'url', 'notes']) ||
      !r.name.trim() ||
      !data.courses.some((c) => c.id === r.courseId) ||
      !resourceTypes.includes(r.type) ||
      !date(r.createdAt) ||
      (r.text !== undefined && !str(r.text)) ||
      (r.url && !safeUrl(r.url))
    )
      fail();
  // Historical events intentionally survive course/node deletion.
  for (const e of data.events)
    if (
      !text(obj(e), ['courseId', 'nodeId', 'nodeTitle']) ||
      !Object.hasOwn(actionLabels, e.action) ||
      !Object.hasOwn(statuses, e.fromStatus) ||
      !Object.hasOwn(statuses, e.toStatus) ||
      !date(e.at) ||
      (e.answer !== undefined && !str(e.answer)) ||
      (e.questionPrompt !== undefined && !str(e.questionPrompt))
    )
      fail();
  return data;
}
export function safeUrl(value: string): boolean {
  try {
    return ['https:', 'http:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
