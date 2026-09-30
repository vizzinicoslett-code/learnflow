import type { AppData, KnowledgeNode } from '../domain/model';
import {
  documentRoute,
  priorityLabels,
  priorityOf,
  readerRoute,
  sourceLabel,
} from '../domain/courseKnowledge';
import { Badge } from '../components/Shared';
import { Empty } from '../components/Modal';
export function DocumentReader({
  data,
  courseId,
  documentId,
  section,
  navigate,
  select,
}: {
  data: AppData;
  courseId: string;
  documentId?: string;
  section?: string;
  navigate: (path: string) => void;
  select: (node: KnowledgeNode) => void;
}) {
  const document = data.resources.find((r) => r.id === documentId && r.courseId === courseId);
  if (!document)
    return (
      <Empty title="找不到来源资料" text="资料可能已删除，知识点和笔记仍保留。">
        <button className="button" onClick={() => navigate('/course/' + courseId)}>
          返回知识工作台
        </button>
      </Empty>
    );
  const pages = document.extraction?.metadata?.parserVersion === 2 ? document.extraction.pages : [];
  const current = section ? pages.find((p) => p.section === section) : pages[0];
  if (!current)
    return (
      <Empty
        title={pages.length ? '此来源片段已不存在' : '这份资料还没有可阅读的正文'}
        text={
          document.processing?.error ||
          document.extraction?.warnings.join(' ') ||
          '请在资料页完成解析或 OCR。'
        }
      >
        <button className="button" onClick={() => navigate(documentRoute(courseId, document.id))}>
          返回资料详情
        </button>
      </Empty>
    );
  const index = pages.indexOf(current);
  const points = data.nodes.filter(
    (n) =>
      n.courseId === courseId &&
      n.kind === 'topic' &&
      n.source?.fileId === document.id &&
      n.source.section === current.section &&
      n.source.page === current.page,
  );
  return (
    <section className="document-reader">
      <aside className="reader-pages">
        <button
          className="text-button"
          onClick={() => navigate(documentRoute(courseId, document.id))}
        >
          ← 资料详情
        </button>
        <h2>{document.name}</h2>
        <p className="muted">
          {pages.length}{' '}
          {document.type === 'PPTX' ? '张幻灯片' : document.type === 'PDF' ? '页' : '个正文片段'}
        </p>
        <nav aria-label="资料页码">
          {pages.map((p, i) => (
            <button
              key={p.section}
              aria-current={p.section === current.section ? 'page' : undefined}
              className={p.section === current.section ? 'active' : ''}
              onClick={() => navigate(readerRoute(courseId, document.id, p.section))}
            >
              <small>{sourceLabel(document, p.page, i)}</small>
              <span>{p.title}</span>
            </button>
          ))}
        </nav>
      </aside>
      <main className="reader-content">
        <div className="eyebrow">{sourceLabel(document, current.page, index)}</div>
        <h1>{current.title}</h1>
        <p className="muted">来自《{document.name}》的提取正文</p>
        <pre className="reader-text">{current.text || '本页没有可提取的文字，可能需要 OCR。'}</pre>
        <div className="reader-pagination">
          <button
            className="button"
            disabled={index === 0}
            onClick={() => navigate(readerRoute(courseId, document.id, pages[index - 1].section))}
          >
            上一页
          </button>
          <span>
            {index + 1} / {pages.length}
          </span>
          <button
            className="button"
            disabled={index === pages.length - 1}
            onClick={() => navigate(readerRoute(courseId, document.id, pages[index + 1].section))}
          >
            下一页
          </button>
        </div>
      </main>
      <aside className="reader-knowledge">
        <h2>本页知识点</h2>
        {points.map((n) => (
          <article key={n.id}>
            <Badge status={n.status} />
            <h3>{n.title}</h3>
            <p>{n.summary ?? n.content.concept}</p>
            <small className="muted">{priorityLabels[priorityOf(n)]}</small>
            <button className="button primary" onClick={() => select(n)}>
              开始学习
            </button>
          </article>
        ))}
        {!points.length && <p className="muted">本页尚未生成知识点，仍可阅读正文。</p>}
      </aside>
    </section>
  );
}
