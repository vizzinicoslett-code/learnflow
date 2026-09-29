import { useRef, useState, type FormEvent } from 'react';
import { now, resourceTypes, uid, type AppData, type Resource } from '../domain/model';
import { safeUrl } from '../domain/validation';
import type { Update } from '../services/storage';
import { Icon } from '../components/Icons';
import { Empty, Modal } from '../components/Modal';
export function Resources({
  data,
  courseId,
  update,
}: {
  data: AppData;
  courseId: string;
  update: Update;
}) {
  const [editing, setEditing] = useState<Resource | 'new' | null>(null);
  const [reading, setReading] = useState<Resource | null>(null);
  const [error, setError] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const resources = data.resources.filter((r) => r.courseId === courseId);
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get('name')).trim();
    const url = String(f.get('url')).trim();
    if (!name) return;
    if (url && !safeUrl(url)) {
      setError('链接仅支持完整的 http:// 或 https:// 地址。');
      return;
    }
    const old = editing !== 'new' ? editing : null;
    const r: Resource = {
      id: old?.id ?? uid(),
      courseId,
      name,
      type: String(f.get('type')) as Resource['type'],
      url,
      notes: String(f.get('notes')),
      createdAt: old?.createdAt ?? now(),
      ...(old?.text !== undefined ? { text: old.text } : {}),
    };
    if (
      update((d) => ({
        ...d,
        resources: old ? d.resources.map((p) => (p.id === r.id ? r : p)) : [...d.resources, r],
      }))
    ) {
      setEditing(null);
      setError('');
    }
  }
  async function importFile(selected: File | undefined) {
    if (!selected) return;
    setError('');
    if (!/\.(md|markdown|txt)$/i.test(selected.name)) {
      setError('请选择 Markdown 或 TXT 文件。');
      return;
    }
    if (selected.size > 1024 * 1024) {
      setError('单个文件请小于 1 MB。');
      return;
    }
    try {
      const text = await selected.text();
      update((d) => ({
        ...d,
        resources: [
          ...d.resources,
          {
            id: uid(),
            courseId,
            name: selected.name,
            type: /\.txt$/i.test(selected.name) ? 'TXT' : 'Markdown',
            url: '',
            notes: '从本地导入，文本已保存在当前浏览器。',
            text,
            createdAt: now(),
          },
        ],
      }));
    } catch {
      setError('文件读取失败，请重新选择。');
    }
  }
  return (
    <section className="resources-page">
      <div className="section-heading">
        <div>
          <h2>课程资料</h2>
          <p>让课件、教材与灵感，都有一个归处。</p>
        </div>
        <div className="button-group">
          <button className="button" onClick={() => file.current?.click()}>
            <Icon name="upload" size={16} />
            导入文本
          </button>
          <button
            className="button primary"
            onClick={() => {
              setError('');
              setEditing('new');
            }}
          >
            <Icon name="plus" size={16} />
            添加资料
          </button>
        </div>
        <input
          ref={file}
          hidden
          type="file"
          accept=".md,.markdown,.txt"
          onChange={(e) => {
            void importFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      {error && !editing && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      <p className="muted">保存资料链接和备注 · 支持导入 Markdown / TXT（单个不超过 1 MB）</p>
      {!resources.length && (
        <Empty
          title="把学习资料放在一起"
          text="添加 PPT、PDF、教材或老师笔记的链接，也可以导入本地文本。"
        />
      )}
      <div className="resource-list">
        {resources.map((r) => (
          <article className="resource-row" key={r.id}>
            <div className="resource-icon">
              <Icon name="file" size={24} />
            </div>
            <div className="grow">
              <div className="resource-title">
                <h3>{r.name}</h3>
                <span className="tag">{r.type}</span>
              </div>
              <p>{r.notes || '暂无备注'}</p>
              {r.url && safeUrl(r.url) && (
                <a href={r.url} target="_blank" rel="noopener noreferrer">
                  打开资料 ↗
                </a>
              )}
              {r.text !== undefined && (
                <button className="text-button" onClick={() => setReading(r)}>
                  阅读导入文本 →
                </button>
              )}
            </div>
            <button
              className="icon-button"
              aria-label={`编辑资料${r.name}`}
              onClick={() => {
                setError('');
                setEditing(r);
              }}
            >
              <Icon name="edit" size={16} />
            </button>
            <button
              className="icon-button danger"
              aria-label={`删除资料${r.name}`}
              onClick={() => {
                if (confirm(`删除资料「${r.name}」？`))
                  update((d) => ({ ...d, resources: d.resources.filter((p) => p.id !== r.id) }));
              }}
            >
              <Icon name="trash" size={16} />
            </button>
          </article>
        ))}
      </div>
      {editing && (
        <Modal
          title={editing === 'new' ? '添加课程资料' : '编辑课程资料'}
          onClose={() => setEditing(null)}
        >
          <form onSubmit={save} className="form-stack">
            <label>
              名称
              <input
                name="name"
                required
                autoFocus
                defaultValue={editing === 'new' ? '' : editing.name}
              />
            </label>
            <label>
              类型
              <select name="type" defaultValue={editing === 'new' ? 'PPT' : editing.type}>
                {resourceTypes.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              链接（可选）
              <input
                type="url"
                name="url"
                placeholder="https://…"
                defaultValue={editing === 'new' ? '' : editing.url}
              />
            </label>
            <label>
              备注
              <textarea
                name="notes"
                rows={3}
                defaultValue={editing === 'new' ? '' : editing.notes}
              />
            </label>
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
            <footer>
              <button type="button" className="button" onClick={() => setEditing(null)}>
                取消
              </button>
              <button className="button primary">保存资料</button>
            </footer>
          </form>
        </Modal>
      )}
      {reading && (
        <Modal title={reading.name} onClose={() => setReading(null)}>
          <pre className="imported-text">{reading.text}</pre>
          <p className="muted">按纯文本安全显示，Markdown 源文保留。</p>
        </Modal>
      )}
    </section>
  );
}
