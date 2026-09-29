export const statuses = {
  unlearned: '未学习',
  learning: '学习中',
  understood: '基本理解',
  mastered: '已掌握',
  review: '需要复习',
} as const;
export type Status = keyof typeof statuses;
export const fields = {
  concept: '核心概念',
  formula: '关键公式',
  understanding: '自己的理解',
  confusion: '容易混淆的地方',
  examples: '典型题型',
  mistakes: '错题记录',
  notes: '学习笔记',
} as const;
export type Content = Record<keyof typeof fields, string>;
export interface Course {
  id: string;
  title: string;
  description: string;
  color: string;
  createdAt: string;
}
export interface KnowledgeNode {
  id: string;
  courseId: string;
  parentId: string | null;
  kind: 'chapter' | 'topic';
  order: number;
  title: string;
  status: Status;
  importance: 1 | 2 | 3;
  content: Content;
  reviewAt: string | null;
  updatedAt: string;
}
export interface Edge {
  id: string;
  courseId: string;
  sourceId: string;
  targetId: string;
  kind: 'prerequisite' | 'related';
}
export interface Question {
  id: string;
  nodeId: string;
  prompt: string;
  answer: string;
}
export type Action =
  | 'open'
  | 'understand'
  | 'vague'
  | 'unknown'
  | 'review'
  | 'quiz'
  | 'correct'
  | 'incorrect'
  | 'status';
export const actionLabels: Record<Action, string> = {
  open: '开始学习',
  understand: '我懂了',
  vague: '有点模糊',
  unknown: '完全不会',
  review: '加入复习',
  quiz: '考我一道',
  correct: '自测：答对了',
  incorrect: '自测：还不会',
  status: '调整掌握程度',
};
export interface LearningEvent {
  id: string;
  courseId: string;
  nodeId: string;
  nodeTitle: string;
  action: Action;
  fromStatus: Status;
  toStatus: Status;
  at: string;
  answer?: string;
  questionPrompt?: string;
}
export const resourceTypes = [
  'PPT',
  'PDF',
  '教材',
  '网页',
  '视频',
  '老师笔记',
  '往年题',
  'Markdown',
  'TXT',
] as const;
export interface Resource {
  id: string;
  courseId: string;
  name: string;
  type: (typeof resourceTypes)[number];
  url: string;
  notes: string;
  text?: string;
  createdAt: string;
}
export interface AppData {
  schemaVersion: 1;
  revision: number;
  courses: Course[];
  nodes: KnowledgeNode[];
  edges: Edge[];
  resources: Resource[];
  questions: Question[];
  events: LearningEvent[];
}
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export const emptyContent = (): Content => ({
  concept: '',
  formula: '',
  understanding: '',
  confusion: '',
  examples: '',
  mistakes: '',
  notes: '',
});
export const emptyData = (): AppData => ({
  schemaVersion: 1,
  revision: 0,
  courses: [],
  nodes: [],
  edges: [],
  resources: [],
  questions: [],
  events: [],
});
export const newNode = (
  courseId: string,
  title: string,
  kind: KnowledgeNode['kind'],
  parentId: string | null,
  order: number,
): KnowledgeNode => ({
  id: uid(),
  courseId,
  title,
  kind,
  parentId,
  order,
  status: 'unlearned',
  importance: 2,
  content: emptyContent(),
  reviewAt: null,
  updatedAt: now(),
});
