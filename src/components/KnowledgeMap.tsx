import { useMemo } from 'react';
import type { AppData, KnowledgeNode } from '../domain/model';
import { Badge } from './Shared';
import { Empty } from './Modal';
export function KnowledgeMap({
  data,
  courseId,
  select,
}: {
  data: AppData;
  courseId: string;
  select: (n: KnowledgeNode) => void;
}) {
  const nodes = data.nodes.filter((n) => n.courseId === courseId && n.kind === 'topic');
  const edges = data.edges.filter((e) => e.courseId === courseId);
  const positions = useMemo(() => {
    const depth = new Map<string, number>();
    const visiting = new Set<string>();
    function level(id: string): number {
      if (depth.has(id)) return depth.get(id)!;
      if (visiting.has(id)) return 0;
      visiting.add(id);
      const incoming = edges.filter((e) => e.kind === 'prerequisite' && e.targetId === id);
      const value = incoming.length ? Math.max(...incoming.map((e) => level(e.sourceId))) + 1 : 0;
      visiting.delete(id);
      depth.set(id, value);
      return value;
    }
    const rows = new Map<number, number>();
    return new Map(
      nodes.map((n) => {
        const col = level(n.id);
        const row = rows.get(col) ?? 0;
        rows.set(col, row + 1);
        return [n.id, { x: 40 + col * 265, y: 60 + row * 140 }];
      }),
    );
  }, [nodes, edges]);
  if (!nodes.length)
    return (
      <Empty title="连接你的第一个知识点" text="先在知识树中添加知识点，再设置前置或相关关系。" />
    );
  const width = Math.max(850, ...[...positions.values()].map((p) => p.x + 250));
  const height = Math.max(460, ...[...positions.values()].map((p) => p.y + 140));
  return (
    <section className="map-section">
      <div className="section-heading">
        <div>
          <h2>让知识连接起来</h2>
          <p>实线箭头：前置知识 → 后续知识　 ·　 虚线：相关知识</p>
        </div>
        <span className="muted">
          {nodes.length} 个节点 · {edges.length} 条连接
        </span>
      </div>
      <div className="map-scroll">
        <div className="map-canvas" style={{ width, height }}>
          <svg width={width} height={height} aria-label="知识点之间的前置与相关关系">
            <defs>
              <marker
                id="arrowhead"
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
              >
                <path d="M0,0 L8,4 L0,8" fill="var(--accent)" />
              </marker>
            </defs>
            {edges.map((e) => {
              const a = positions.get(e.sourceId),
                b = positions.get(e.targetId);
              if (!a || !b) return null;
              const x1 = a.x + 205,
                y1 = a.y + 40,
                x2 = b.x,
                y2 = b.y + 40;
              return (
                <path
                  key={e.id}
                  d={`M${x1},${y1} C${x1 + 45},${y1} ${x2 - 45},${y2} ${x2 - 4},${y2}`}
                  stroke={e.kind === 'prerequisite' ? 'var(--accent)' : 'var(--muted)'}
                  strokeWidth="1.6"
                  fill="none"
                  strokeDasharray={e.kind === 'related' ? '5 5' : undefined}
                  markerEnd={e.kind === 'prerequisite' ? 'url(#arrowhead)' : undefined}
                />
              );
            })}
          </svg>
          {nodes.map((n) => {
            const p = positions.get(n.id)!;
            return (
              <button
                key={n.id}
                className="map-node"
                style={{ left: p.x, top: p.y }}
                onClick={() => select(n)}
              >
                <strong>{n.title}</strong>
                <Badge status={n.status} />
              </button>
            );
          })}
        </div>
      </div>
      {!edges.length && (
        <p className="empty-inline">
          在知识点页面设置“前置知识点”或“相关知识点”，这里就会出现连线。
        </p>
      )}
      <details className="map-relations">
        <summary>查看关系清单（{edges.length}）</summary>
        {edges.map((e) => (
          <p key={e.id}>
            {nodes.find((n) => n.id === e.sourceId)?.title} {e.kind === 'prerequisite' ? '→' : '↔'}{' '}
            {nodes.find((n) => n.id === e.targetId)?.title}
          </p>
        ))}
      </details>
    </section>
  );
}
