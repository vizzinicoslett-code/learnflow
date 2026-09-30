import { describe, expect, it } from 'vitest';
import { seedData } from '../src/domain/seed';
import {
  addEdge,
  deleteCourse,
  deleteNodes,
  descendants,
  isStudy,
  isWeak,
  nextNode,
  record,
  reorder,
  setParent,
  sevenDays,
} from '../src/domain/logic';
import { safeUrl, validateData } from '../src/domain/validation';
import { MockQuestionProvider } from '../src/services/questions';
import { courseKnowledgeBase, courseProgress, saveNote } from '../src/domain/courseKnowledge';
describe('知识结构和历史', () => {
  it('仅修改名称或保存原父节点不改变排序', () => {
    const d = reorder(seedData(), 'laser-2', 'laser-0');
    expect(setParent(d, 'laser-2', 'laser-chapter').nodes).toEqual(d.nodes);
  });
  it('理解前置知识后优先推荐下一个新知识', () => {
    const d = record(seedData(), 'laser-0', 'understand');
    expect(nextNode(d)?.node.id).toBe('laser-1');
  });
  it('拒绝父子循环、跨课程父节点和前置循环', () => {
    const d = seedData();
    expect(() => setParent(d, 'laser-chapter', 'laser-0')).toThrow();
    expect(() => setParent(d, 'laser-0', 'missing')).toThrow();
    expect(() => addEdge(d, 'laser-3', 'laser-0', 'prerequisite')).toThrow();
  });
  it('同级排序后顺序唯一', () => {
    const d = reorder(seedData(), 'laser-0', 'laser-2');
    expect(
      d.nodes
        .filter((n) => n.kind === 'topic')
        .sort((a, b) => a.order - b.order)
        .map((n) => n.id),
    ).toEqual(['laser-1', 'laser-2', 'laser-0', 'laser-3']);
  });
  it('删除子树清理题库和关系，保留事件快照', () => {
    let d = record(seedData(), 'laser-0', 'unknown');
    d = deleteNodes(d, descendants(d.nodes, 'laser-chapter'));
    expect(d.nodes).toHaveLength(0);
    expect(d.edges).toHaveLength(0);
    expect(d.questions).toHaveLength(0);
    expect(d.events[0].nodeTitle).toBe('ABCD 矩阵');
    expect(validateData(d)).toEqual(d);
  });
  it('删除课程保留可读历史', () => {
    const d = deleteCourse(record(seedData(), 'laser-0', 'understand'), 'laser');
    expect(d.nodes).toHaveLength(0);
    expect(validateData(d).events).toHaveLength(1);
  });
});
describe('学习事件和调度', () => {
  it('状态、课程进度、学习地图节点与笔记共用同一份知识点数据', () => {
    const initial = seedData();
    expect(courseProgress(initial.nodes)).toMatchObject({ total: 4, mastered: 0, percent: 0 });
    const learning = record(initial, 'laser-0', 'status', {
      status: 'learning',
      at: '2026-09-30T01:00:00.000Z',
    });
    const mastered = record(learning, 'laser-0', 'status', {
      status: 'mastered',
      at: '2026-09-30T02:00:00.000Z',
    });
    const noted = saveNote(mastered, 'laser', 'laser-0', '矩阵从右向左作用。');
    expect(courseProgress(noted.nodes)).toMatchObject({
      total: 4,
      mastered: 1,
      learning: 0,
      percent: 25,
    });
    expect(
      courseKnowledgeBase(noted, 'laser').nodes.find((node) => node.id === 'laser-0'),
    ).toMatchObject({
      status: 'mastered',
      content: { notes: '矩阵从右向左作用。' },
    });
    expect(JSON.parse(JSON.stringify(noted)).nodes[1].content.notes).toBe('矩阵从右向左作用。');
  });
  it('看懂只到基本理解；自测正确才到掌握并排七天', () => {
    let d = record(seedData(), 'laser-0', 'understand', { at: '2026-09-29T00:00:00Z' });
    expect(d.nodes[1].status).toBe('understood');
    d = record(d, 'laser-0', 'correct', { at: '2026-09-29T00:00:00Z', answer: '矩阵逆序相乘' });
    expect(d.nodes[1].status).toBe('mastered');
    expect(d.nodes[1].reviewAt).toBe('2026-10-06T00:00:00.000Z');
    expect(d.events[1].answer).toBe('矩阵逆序相乘');
  });
  it('加入复习立即到期且不计学习次数，重复不会进入薄弱点', () => {
    const d = record(record(seedData(), 'laser-0', 'unknown'), 'laser-0', 'review', {
      at: '2026-09-29T00:00:00Z',
    });
    expect(d.nodes[1].reviewAt).toBe('2026-09-29T00:00:00.000Z');
    expect(isWeak(d, d.nodes[1])).toBe(true);
    expect(isStudy('open')).toBe(false);
    expect(isStudy('review')).toBe(false);
  });
  it('七天统计只统计学习动作', () => {
    const d = record(record(seedData(), 'laser-0', 'open'), 'laser-0', 'vague');
    expect(sevenDays(d).at(-1)?.count).toBe(1);
  });
});
describe('备份边界', () => {
  it('正常数据往返，错误结构/状态/循环/非法链接拒绝', () => {
    const d = seedData();
    expect(validateData(JSON.parse(JSON.stringify(d)))).toEqual(d);
    expect(() => validateData({ schemaVersion: 1 })).toThrow();
    const bad = structuredClone(d);
    bad.nodes[1].parentId = 'laser-0';
    expect(() => validateData(bad)).toThrow();
    expect(safeUrl('javascript:alert(1)')).toBe(false);
    expect(safeUrl('https://example.org')).toBe(true);
  });
  it('拒绝未知版本、重复 ID、悬空边和无效日期', () => {
    const d = seedData();
    expect(() => validateData({ ...d, schemaVersion: 2 })).toThrow();
    expect(() => validateData({ ...d, nodes: [...d.nodes, d.nodes[0]] })).toThrow();
    expect(() => validateData({ ...d, edges: [{ ...d.edges[0], targetId: 'missing' }] })).toThrow();
    expect(() =>
      validateData({ ...d, courses: [{ ...d.courses[0], createdAt: 'oops' }] }),
    ).toThrow();
  });
});
describe('可替换出题接口', () => {
  it('优先使用用户题库，无题时使用典型题型', async () => {
    const d = seedData();
    const p = new MockQuestionProvider();
    expect((await p.generateQuestion({ node: d.nodes[1], questions: d.questions })).id).toBe(
      'question-demo',
    );
    expect((await p.generateQuestion({ node: d.nodes[1], questions: [] })).prompt).toContain(
      '薄透镜',
    );
  });
});
