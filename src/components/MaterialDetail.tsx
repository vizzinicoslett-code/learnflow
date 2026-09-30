import { useEffect, useState } from 'react';
import { statuses, type AppData, type KnowledgeNode, type Resource } from '../domain/model';
import { materialFiles } from '../services/materialFiles';
export const fileSize = (n: number) =>
  n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(0.1, n / 1024).toFixed(1) + ' KB';
export function MaterialDetail({
  resource: r,
  data,
  select,
  back,
  readSource,
}: {
  resource: Resource;
  data: AppData;
  select: (node: KnowledgeNode) => void;
  back: () => void;
  readSource: (section: string) => void;
}) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setUrl('');
    setError('');
    setPage(0);
    if (r.file)
      void materialFiles
        .get(r.id)
        .then((blob) => {
          if (!active) return;
          if (!blob) {
            setError(
              '当前浏览器中没有原文件。JSON 备份不包含文件，请在原浏览器下载，或重新添加本地文件。',
            );
            return;
          }
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        })
        .catch(() => {
          if (active) setError('原文件读取失败，请检查浏览器存储权限。');
        });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [r.id, r.file]);
  const points = data.nodes.filter((n) => r.analysis?.knowledgePointIds.includes(n.id));
  const verified = r.extraction?.metadata?.parserVersion === 2;
  const pages = verified ? (r.extraction?.pages ?? []) : [];
  return (
    <article className="material-detail">
      <button className="text-button" onClick={back}>
        ← 返回课程资料
      </button>
      <header className="material-heading">
        <span className="eyebrow">课程资料 / {r.type}</span>
        <h2>{r.name}</h2>
        <p className="muted">
          {r.file
            ? r.file.name + ' · ' + fileSize(r.file.size) + ' · 原文件保存在此浏览器'
            : '在线资料记录'}
        </p>
        {url && (
          <a className="button" href={url} download={r.file?.name}>
            下载原文件
          </a>
        )}
        {r.notes && <p>{r.notes}</p>}
        {error && <p role="alert">{error}</p>}
      </header>
      {url && ['PNG', 'JPG', 'JPEG'].includes(r.type) && (
        <img className="material-image" src={url} alt={r.name} />
      )}
      {r.analysis && verified && r.processing?.status !== 'error' ? (
        <>
          <div className="material-notice">
            <strong>
              {r.analysis.mode === 'mock'
                ? 'Mock 分析草案 · 未调用 AI'
                : 'AI 分析 · 请对照原文校对'}
            </strong>
            <p>知识点已加入课程知识树。重要程度是建议，可在学习工作台调整。</p>
          </div>
          <section>
            <h3>AI 摘要 {r.analysis.mode === 'mock' && <span className="tag">Mock</span>}</h3>
            <p className="material-summary">{r.analysis.summary}</p>
          </section>
          <section>
            <h3>核心知识点与学习建议</h3>
            {(['must', 'understand', 'optional'] as const).map((priority, i) => (
              <div className="priority-group" key={priority}>
                <h4>
                  <span className={'priority-dot ' + priority} />
                  {['必须掌握', '理解即可', '暂时可以跳过'][i]}
                </h4>
                {points
                  .filter((n) => n.importance === [3, 2, 1][i])
                  .map((n) => (
                    <div className="material-point" key={n.id}>
                      <div>
                        <strong>{n.title}</strong>
                        <span className="tag">{statuses[n.status]}</span>
                        <p>{n.content.concept}</p>
                        <small className="muted">
                          {n.source?.page
                            ? '第 ' + n.source.page + ' 页'
                            : '正文片段（无固定页码）'}
                        </small>
                      </div>
                      <button className="button" onClick={() => select(n)}>
                        开始学习
                      </button>
                    </div>
                  ))}
                {!points.some((n) => n.importance === [3, 2, 1][i]) && (
                  <p className="muted">暂无此层级知识点</p>
                )}
              </div>
            ))}
            {points.length < r.analysis.knowledgePointIds.length && (
              <p className="muted">部分生成的知识点已从知识树删除。</p>
            )}
          </section>
          <section>
            <h3>内容结构 / 章节</h3>
            <ol>
              {r.analysis.sections.map((s) => (
                <li key={s.id}>
                  <button className="text-button" onClick={() => readSource(s.id)}>
                    {s.title}
                    {s.page !== null && (
                      <span className="muted">
                        {' · '}
                        {r.type === 'PPTX' ? `Slide ${s.page}` : `第 ${s.page} 页`}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ol>
          </section>
          <details>
            <summary>解析范围与校对提示</summary>
            <ul>
              {r.analysis.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </details>
        </>
      ) : (
        <p className="material-notice">
          {r.processing?.error ||
            (!verified
              ? '此资料使用旧解析结果，请返回资料列表点击“重新解析”，重新提取原文件正文。'
              : r.extraction?.warnings.join(' ') || '未提取到正文，未生成摘要或知识点。')}
        </p>
      )}
      {!!pages.length && (
        <section>
          <h3>提取正文</h3>
          <div className="button-group">
            <button className="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              上一页 / 片段
            </button>
            <span>
              {page + 1} / {pages.length}
            </span>
            <button
              className="button"
              disabled={page >= pages.length - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页 / 片段
            </button>
          </div>
          <h4>{pages[page]?.title}</h4>
          <pre className="imported-text">
            {pages[page]?.text || '此页未提取到文字，可能需要 OCR。'}
          </pre>
          {pages[page] && (
            <button className="button" onClick={() => readSource(pages[page].section)}>
              在来源阅读器中打开
            </button>
          )}
        </section>
      )}
      {r.text && <p className="muted">旧版导入文本尚未通过格式校验，请重新上传原始文件。</p>}
      <footer className="material-notice">
        <strong>接下来如何学习</strong>
        <p>点击知识点“开始学习”，即可编辑笔记、使用现有 Mock 自测、加入复习并更新掌握度。</p>
        <p className="muted">
          资料级 AI 问答、AI 逐页讲解、AI 生成笔记与题目尚未接入。本页逐页阅读展示实际提取的正文。
        </p>
      </footer>
    </article>
  );
}
