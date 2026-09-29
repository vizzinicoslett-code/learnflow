import { useState, type FormEvent } from 'react';
import { newNode, statuses, type AppData, type KnowledgeNode } from '../domain/model';
import { descendants, reorder, setParent } from '../domain/logic';
import type { Update } from '../services/storage';
import { Icon } from './Icons';
import { Modal } from './Modal';
export function NodeForm({
  node,
  courseId,
  data,
  update,
  close,
  onCreated,
}: {
  node?: KnowledgeNode;
  courseId: string;
  data: AppData;
  update: Update;
  close: () => void;
  onCreated?: (n: KnowledgeNode) => void;
}) {
  const [kind, setKind] = useState<KnowledgeNode['kind']>(node?.kind ?? 'topic');
  const excluded = node ? descendants(data.nodes, node.id) : new Set<string>();
  const parents = data.nodes.filter(
    (n) =>
      n.courseId === courseId &&
      !excluded.has(n.id) &&
      (kind !== 'chapter' || n.kind === 'chapter'),
  );
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const title = String(f.get('title')).trim();
    if (!title) return;
    const parentId = String(f.get('parent')) || null;
    const next = node
      ? { ...node, title }
      : newNode(courseId, title, kind, null, data.nodes.length);
    if (
      update((d) => {
        const withNode = {
          ...d,
          nodes: node
            ? d.nodes.map((n) => (n.id === node.id ? { ...n, title } : n))
            : [...d.nodes, next],
        };
        return setParent(withNode, next.id, parentId);
      })
    ) {
      close();
      if (!node) onCreated?.(next);
    }
  }
  return (
    <Modal title={node ? '编辑知识结构' : '添加到知识树'} onClose={close}>
      <form className="form-stack" onSubmit={save}>
        <label>
          名称
          <input
            name="title"
            required
            maxLength={120}
            defaultValue={node?.title}
            autoFocus
            placeholder="例如：高斯光束传输"
          />
        </label>
        {!node && (
          <label>
            类型
            <select
              aria-label="类型"
              value={kind}
              onChange={(e) => setKind(e.target.value as KnowledgeNode['kind'])}
            >
              <option value="topic">知识点</option>
              <option value="chapter">章节</option>
            </select>
          </label>
        )}
        <label>
          父节点
          <select aria-label="父节点" name="parent" defaultValue={node?.parentId ?? ''}>
            <option value="">课程根目录</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.kind === 'chapter' ? '章节 · ' : '知识点 · '}
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <p className="muted">知识点可以继续包含子知识点。前置知识关系在正文中单独设置。</p>
        <footer>
          <button type="button" className="button" onClick={close}>
            取消
          </button>
          <button className="button primary">保存</button>
        </footer>
      </form>
    </Modal>
  );
}
export function KnowledgeTree({
  data,
  courseId,
  selected,
  select,
  update,
}: {
  data: AppData;
  courseId: string;
  selected?: string;
  select: (n: KnowledgeNode) => void;
  update: Update;
}) {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const nodes = data.nodes.filter((n) => n.courseId === courseId);
  const match = new Set(
    nodes.filter((n) => n.title.toLowerCase().includes(query.toLowerCase())).map((n) => n.id),
  );
  if (query)
    for (const node of nodes.filter((n) => match.has(n.id))) {
      let parent = node.parentId;
      const seen = new Set<string>();
      while (parent && !seen.has(parent)) {
        seen.add(parent);
        match.add(parent);
        parent = nodes.find((n) => n.id === parent)?.parentId ?? null;
      }
    }
  function render(parentId: string | null, depth: number) {
    const siblings = nodes.filter((n) => n.parentId === parentId).sort((a, b) => a.order - b.order);
    return siblings
      .filter((n) => !query || match.has(n.id))
      .map((n) => {
        const children = nodes.some((c) => c.parentId === n.id);
        const folded = !query && collapsed.has(n.id);
        return (
          <div key={n.id}>
            <div
              className={`tree-row ${selected === n.id ? 'selected' : ''} ${n.kind}`}
              style={{ paddingLeft: `${10 + depth * 14}px` }}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('text/plain', n.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/plain');
                update((d) => reorder(d, id, n.id));
              }}
            >
              {children ? (
                <button
                  className={`fold-button ${folded ? 'folded' : ''}`}
                  aria-label={`${folded ? '展开' : '折叠'}${n.title}`}
                  aria-expanded={!folded}
                  onClick={() =>
                    setCollapsed((prev) => {
                      const next = new Set(prev);
                      if (next.has(n.id)) next.delete(n.id);
                      else next.add(n.id);
                      return next;
                    })
                  }
                >
                  <Icon name="down" size={12} />
                </button>
              ) : (
                <span className="tree-spacer" />
              )}
              <button
                className="tree-node"
                onClick={() => select(n)}
                title={`${n.title} · ${statuses[n.status]}`}
              >
                {n.kind === 'chapter' ? (
                  <Icon name="book" size={15} />
                ) : (
                  <span className={`state-dot status-${n.status}`} />
                )}
                <span>{n.title}</span>
              </button>
              <div className="tree-order">
                <button
                  disabled={siblings[0].id === n.id}
                  aria-label={`上移${n.title}`}
                  onClick={() =>
                    update((d) =>
                      reorder(d, n.id, siblings[siblings.findIndex((s) => s.id === n.id) - 1].id),
                    )
                  }
                >
                  <Icon name="up" size={11} />
                </button>
                <button
                  disabled={siblings.at(-1)?.id === n.id}
                  aria-label={`下移${n.title}`}
                  onClick={() =>
                    update((d) =>
                      reorder(d, n.id, siblings[siblings.findIndex((s) => s.id === n.id) + 1].id),
                    )
                  }
                >
                  <Icon name="down" size={11} />
                </button>
              </div>
            </div>
            {!folded && render(n.id, depth + 1)}
          </div>
        );
      });
  }
  return (
    <aside className="knowledge-tree">
      <div className="section-heading">
        <h3>知识树</h3>
        <button
          className="icon-button"
          aria-label="添加知识点或章节"
          onClick={() => setAdding(true)}
        >
          <Icon name="plus" size={18} />
        </button>
      </div>
      <div className="search-field small">
        <Icon name="search" size={15} />
        <input
          aria-label="搜索知识点"
          placeholder="寻找一个知识点…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="tree-content">
        {render(null, 0)}
        {!nodes.length && <p className="empty-inline">添加第一个章节，开始梳理这门课。</p>}
        {query && !match.size && <p className="empty-inline">没有匹配的知识点</p>}
      </div>
      <button className="add-tree" onClick={() => setAdding(true)}>
        <Icon name="plus" size={15} />
        添加章节 / 知识点
      </button>
      <p className="tree-hint">拖动调整同级顺序 · 编辑设置父节点</p>
      <div className="tree-legend">
        {Object.entries(statuses).map(([s, label]) => (
          <span key={s}>
            <i className={`state-dot status-${s}`} />
            {label}
          </span>
        ))}
      </div>
      {adding && (
        <NodeForm
          courseId={courseId}
          data={data}
          update={update}
          close={() => setAdding(false)}
          onCreated={select}
        />
      )}
    </aside>
  );
}
