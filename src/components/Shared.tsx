import { statuses, type AppData, type KnowledgeNode, type Status } from '../domain/model';
import { isWeak } from '../domain/logic';
import { isStudyTopic } from '../domain/studyContent';
import { Icon } from './Icons';
export function Badge({ status }: { status: Status }) {
  return (
    <span className={`badge status-${status}`}>
      <i />
      {statuses[status]}
    </span>
  );
}
export function Progress({ value }: { value: number }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label="掌握进度"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${value}%` }} />
    </div>
  );
}
export const courseTopics = (data: AppData, id: string) =>
  data.nodes.filter((n) => n.courseId === id && isStudyTopic(n));
export const masteredPercent = (nodes: KnowledgeNode[]) =>
  nodes.length
    ? Math.round((nodes.filter((n) => n.status === 'mastered').length / nodes.length) * 100)
    : 0;
export function NodeRow({
  node,
  data,
  go,
  detail,
}: {
  node: KnowledgeNode;
  data: AppData;
  go: (n: KnowledgeNode) => void;
  detail?: string;
}) {
  return (
    <button className="node-row" onClick={() => go(node)}>
      <span className={`state-dot status-${node.status}`} />
      <span className="grow">
        <strong>{node.title}</strong>
        <small>{detail ?? data.courses.find((c) => c.id === node.courseId)?.title}</small>
      </span>
      {isWeak(data, node) && <span className="subtle">需巩固</span>}
      <Icon name="arrow" size={16} />
    </button>
  );
}
export const formatTime = (at: string) =>
  new Date(at).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
