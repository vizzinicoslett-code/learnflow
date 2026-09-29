import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  now,
  uid,
  type AppData,
  type Resource,
  type KnowledgeNode,
  type ProcessingStage,
} from '../domain/model';
import { attachMaterialAnalysis } from '../domain/materials';
import { safeUrl } from '../domain/validation';
import type { Update } from '../services/storage';
import type { MaterialAnalysisProvider } from '../services/materialAnalysis';
import { materialFiles } from '../services/materialFiles';
import {
  acceptedFiles,
  checkAborted,
  extractMaterial,
  identifyFile,
} from '../services/materialExtraction';
import { Icon } from '../components/Icons';
import { Empty, Modal } from '../components/Modal';
import { MaterialDetail, fileSize } from '../components/MaterialDetail';
const stages: Record<ProcessingStage, string> = {
  read: '正在读取文件',
  extract: '正在提取内容',
  structure: '正在识别章节结构',
  knowledge: '正在生成知识点',
  complete: '完成',
};
export function Resources({
  data,
  courseId,
  update,
  provider,
  select,
}: {
  data: AppData;
  courseId: string;
  update: Update;
  provider: MaterialAnalysisProvider;
  select: (n: KnowledgeNode) => void;
}) {
  const [upload, setUpload] = useState(false);
  const [editing, setEditing] = useState<Resource | 'new' | null>(null);
  const [selected, setSelected] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProcessingStage>('read');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const latestUpdate = useRef(update);
  latestUpdate.current = update;
  useEffect(() => () => controller.current?.abort(), []);
  const resources = data.resources.filter((r) => r.courseId === courseId);
  const detail = resources.find((r) => r.id === detailId);
  function choose(file?: File) {
    if (!file || busy) return;
    try {
      identifyFile(file);
      setSelected(file);
      setName(file.name);
      setError('');
      setDone(false);
      setJobId(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function close() {
    controller.current?.abort();
    setUpload(false);
  }
  function saveOnline(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const old = editing === 'new' ? null : editing;
    const url = String(f.get('url') ?? old?.url ?? '').trim();
    if (url && !safeUrl(url)) {
      setError('链接仅支持 http:// 或 https:// 地址。');
      return;
    }
    const r: Resource = {
      ...(old ?? { id: uid(), courseId, type: '网页', createdAt: now() }),
      name: String(f.get('name')).trim(),
      url,
      notes: String(f.get('notes') ?? ''),
    };
    if (!r.name) return;
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
  async function process(file: File, existing?: Resource) {
    if (controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setDone(false);
    setError('');
    setProgress('read');
    const id = existing?.id ?? uid();
    setJobId(id);
    let registered = !!existing;
    const commit: Update = (transform) => latestUpdate.current(transform);
    try {
      const type = identifyFile(file);
      if (!existing) {
        await materialFiles.put(id, file);
        checkAborted(abort.signal);
        const r: Resource = {
          id,
          courseId,
          name: name.trim() || file.name,
          type,
          url: '',
          notes,
          createdAt: now(),
          file: {
            name: file.name,
            size: file.size,
            mime: file.type,
            lastModified: file.lastModified,
          },
          processing: { status: 'processing', stage: 'read' },
        };
        if (
          !commit((d) => {
            if (!d.courses.some((c) => c.id === courseId)) throw new Error('课程已被删除。');
            return { ...d, resources: [...d.resources, r] };
          })
        )
          throw new Error('资料信息保存失败，请检查存储空间后重试。');
        registered = true;
      }
      const report = (stage: ProcessingStage) => {
        checkAborted(abort.signal);
        setProgress(stage);
        if (
          !commit((d) => {
            if (!d.resources.some((r) => r.id === id)) throw new Error('资料已被删除。');
            return {
              ...d,
              resources: d.resources.map((r) =>
                r.id === id ? { ...r, processing: { status: 'processing', stage } } : r,
              ),
            };
          })
        )
          throw new Error('无法保存解析进度，请重试。');
      };
      const extraction = await extractMaterial(file, report, abort.signal);
      const result = await provider.analyze(
        { fileId: id, fileName: file.name, extraction },
        report,
        abort.signal,
      );
      checkAborted(abort.signal);
      if (!commit((d) => attachMaterialAnalysis(d, id, result, extraction)))
        throw new Error('知识点保存失败，请检查存储空间后重试。');
      setProgress('complete');
      setDone(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : '解析失败，请重新选择文件。';
      setError(message);
      if (registered)
        commit((d) => ({
          ...d,
          resources: d.resources.map((r) =>
            r.id === id
              ? { ...r, processing: { status: 'error', stage: 'extract', error: message } }
              : r,
          ),
        }));
      else await materialFiles.remove(id).catch(() => undefined);
    } finally {
      controller.current = null;
      setBusy(false);
    }
  }
  async function retry(r: Resource) {
    setError('');
    try {
      const blob = await materialFiles.get(r.id);
      if (!blob || !r.file) throw new Error('找不到原文件，请重新添加本地文件。');
      setUpload(true);
      setSelected(
        new File([blob], r.file.name, { type: r.file.mime, lastModified: r.file.lastModified }),
      );
      setName(r.name);
      setNotes(r.notes);
      await process(new File([blob], r.file.name, { type: r.file.mime }), r);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function remove(r: Resource) {
    if (
      !confirm('删除资料「' + r.name + '」及此浏览器中的原文件？已生成的知识点和学习记录会保留。')
    )
      return;
    update((d) => ({ ...d, resources: d.resources.filter((p) => p.id !== r.id) }));
  }
  return (
    <section className="resources-page">
      {detail ? (
        <MaterialDetail
          resource={detail}
          data={data}
          select={select}
          back={() => setDetailId(null)}
        />
      ) : (
        <>
          <div className="section-heading">
            <div>
              <h2>课程资料</h2>
              <p>把本地课件，变成下一步可以学习的知识。</p>
            </div>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => {
                setUpload(true);
                setSelected(null);
                setName('');
                setNotes('');
                setError('');
                setDone(false);
                setJobId(null);
              }}
            >
              <Icon name="upload" size={16} />
              添加资料
            </button>
          </div>
          <p className="muted">本地文件 → 提取正文 → Mock 分析草案 → 知识树 → 学习与复习</p>
          <button
            className="text-button"
            onClick={() => {
              setError('');
              setEditing('new');
            }}
          >
            添加在线资料 ↗
          </button>
          {!resources.length && (
            <Empty
              title="从一份课程资料开始"
              text="上传课件、教材或课堂笔记，整理出可编辑的学习内容。"
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
                  <p>
                    {r.file
                      ? fileSize(r.file.size) +
                        ' · ' +
                        (r.analysis
                          ? (r.analysis.mode === 'mock' ? 'Mock 草案 · ' : '') +
                            r.analysis.knowledgePointIds.length +
                            ' 个知识点'
                          : busy && jobId === r.id
                            ? stages[progress]
                            : r.processing?.status === 'processing'
                              ? '上次处理已中断，可重试'
                              : '解析失败，可重试')
                      : r.notes || '在线资料'}
                  </p>
                  {r.url && safeUrl(r.url) && (
                    <a href={r.url} target="_blank" rel="noopener noreferrer">
                      打开资料 ↗
                    </a>
                  )}
                  {(r.file || r.text) && (
                    <button className="text-button" onClick={() => setDetailId(r.id)}>
                      查看资料 →
                    </button>
                  )}
                  {r.file && !r.analysis && (
                    <button className="text-button" disabled={busy} onClick={() => void retry(r)}>
                      重新解析
                    </button>
                  )}
                </div>
                <button
                  className="icon-button"
                  disabled={busy}
                  aria-label={'编辑资料' + r.name}
                  onClick={() => {
                    setEditing(r);
                    setError('');
                  }}
                >
                  <Icon name="edit" size={16} />
                </button>
                <button
                  className="icon-button danger"
                  disabled={busy}
                  aria-label={'删除资料' + r.name}
                  onClick={() => void remove(r)}
                >
                  <Icon name="trash" size={16} />
                </button>
              </article>
            ))}
          </div>
        </>
      )}
      {error && !upload && !editing && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {upload && (
        <Modal title="添加课程资料" onClose={close}>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (selected)
                void process(
                  selected,
                  resources.find((r) => r.id === jobId),
                );
            }}
          >
            {!busy && !done && (
              <>
                <div
                  className={'file-drop ' + (dragging ? 'dragging' : '')}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    if (e.dataTransfer.files.length > 1) setError('请一次添加一个文件。');
                    else choose(e.dataTransfer.files[0]);
                  }}
                >
                  <Icon name="upload" size={32} />
                  <h3>拖拽课程资料到这里</h3>
                  <span className="muted">或</span>
                  <button
                    type="button"
                    className="button primary"
                    onClick={() => input.current?.click()}
                  >
                    选择本地文件
                  </button>
                  <p>支持 PDF / PPT / Word / Markdown / TXT / 图片</p>
                  <small>单个文件不超过 20 MB · 原文件仅保存在当前浏览器</small>
                </div>
                <input
                  ref={input}
                  aria-label="课程资料文件"
                  hidden
                  type="file"
                  accept={acceptedFiles}
                  onChange={(e) => {
                    choose(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
                {selected && (
                  <div className="selected-file">
                    <Icon name="file" />
                    <div className="grow">
                      <strong>{selected.name}</strong>
                      <p>
                        {identifyFile(selected)} · {fileSize(selected.size)} · 已选择
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => input.current?.click()}
                    >
                      重新选择
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        setSelected(null);
                        setJobId(null);
                      }}
                    >
                      删除
                    </button>
                  </div>
                )}
                <label>
                  资料名称
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="选择文件后自动填写"
                  />
                </label>
                <label>
                  备注（可选）
                  <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </label>
                <p className="muted">
                  文字提取真实运行；摘要与知识整理当前使用 Mock。PPT / DOC 旧格式和图片尚需转换或
                  OCR，会显示流程示例。
                </p>
              </>
            )}
            {(busy || done) && (
              <div aria-live="polite" className="processing">
                <h3>{done ? '资料已整理，可以开始学习' : selected?.name}</h3>
                <ol>
                  {Object.entries(stages).map(([key, label], i) => (
                    <li
                      key={key}
                      className={i <= Object.keys(stages).indexOf(progress) ? 'active' : ''}
                    >
                      {i < Object.keys(stages).indexOf(progress) ? '✓' : i + 1} · {label}
                    </li>
                  ))}
                </ol>
                <p>
                  {done
                    ? 'Mock 草案已加入知识树，请对照原文校对。'
                    : '请保持此页面打开。取消或刷新后可从资料列表重新解析。'}
                </p>
              </div>
            )}
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
            <footer>
              <button type="button" className="button" onClick={close}>
                {busy ? '取消解析' : '取消'}
              </button>
              {done ? (
                <button
                  type="button"
                  className="button primary"
                  onClick={() => {
                    setDetailId(jobId);
                    setUpload(false);
                  }}
                >
                  查看解析结果
                </button>
              ) : (
                <button className="button primary" disabled={!selected || busy || !name.trim()}>
                  上传并解析
                </button>
              )}
            </footer>
          </form>
        </Modal>
      )}
      {editing && (
        <Modal
          title={editing === 'new' ? '添加在线资料' : '编辑课程资料'}
          onClose={() => setEditing(null)}
        >
          <form className="form-stack" onSubmit={saveOnline}>
            <label>
              名称
              <input name="name" required defaultValue={editing === 'new' ? '' : editing.name} />
            </label>
            {(editing === 'new' || !editing.file) && (
              <label>
                链接（可选）
                <input type="url" name="url" defaultValue={editing === 'new' ? '' : editing.url} />
              </label>
            )}
            <label>
              备注
              <textarea name="notes" defaultValue={editing === 'new' ? '' : editing.notes} />
            </label>
            {error && <p role="alert">{error}</p>}
            <footer>
              <button className="button primary">保存资料</button>
            </footer>
          </form>
        </Modal>
      )}
    </section>
  );
}
