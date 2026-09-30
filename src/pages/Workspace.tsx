import { useState } from 'react';
import {
  fields,
  now,
  statuses,
  type AppData,
  type Course,
  type KnowledgeNode,
} from '../domain/model';
import { addEdge, deleteNodes, descendants, record } from '../domain/logic';
import type { Update } from '../services/storage';
import type { QuestionProvider } from '../services/questions';
import type { MaterialAnalysisProvider } from '../services/materialAnalysis';
import { KnowledgeTree, NodeForm } from '../components/KnowledgeTree';
import { KnowledgeMap } from '../components/KnowledgeMap';
import { AssistantPanel } from '../components/AssistantPanel';
import { Badge, courseTopics, masteredPercent, Progress } from '../components/Shared';
import { Icon } from '../components/Icons';
import { Resources } from './Resources';
import { isStudyTopic, nodeTextIssue } from '../domain/studyContent';
import { CourseOverview } from './CourseOverview';
import { DocumentReader } from './DocumentReader';
import {
  documentRoute,
  priorityLabels,
  priorityOf,
  readerRoute,
  saveNote,
  sourcePage,
} from '../domain/courseKnowledge';
export function Workspace({
  course,
  data,
  update,
  selectedId,
  go,
  navigate,
  provider,
  materialProvider,
  routeParts,
}: {
  course: Course;
  data: AppData;
  update: Update;
  selectedId?: string;
  go: (n: KnowledgeNode) => void;
  navigate: (path: string) => void;
  provider: QuestionProvider;
  materialProvider: MaterialAnalysisProvider;
  routeParts: string[];
}) {
  const tab =
    selectedId === 'map'
      ? 'map'
      : selectedId === 'read'
        ? 'reader'
        : ['resources', 'resource'].includes(selectedId ?? '')
          ? 'resources'
          : 'knowledge';
  function setTab(next: string) {
    navigate(`/course/${course.id}${next === 'knowledge' ? '' : '/' + next}`);
  }
  const [editing, setEditing] = useState(false);
  const [quizTrigger, setQuizTrigger] = useState(0);
  const nodes = courseTopics(data, course.id);
  const selected = data.nodes.find((n) => n.id === selectedId && n.courseId === course.id);
  const original = selected ? sourcePage(data, selected) : undefined;
  const contentIssue = selected?.contentIssue ?? (selected && nodeTextIssue(selected));
  const percent = masteredPercent(nodes);
  function select(n: KnowledgeNode) {
    setQuizTrigger(0);
    go(n);
  }
  function patch(values: Partial<KnowledgeNode>) {
    if (selected)
      update((d) => ({
        ...d,
        nodes: d.nodes.map((n) =>
          n.id === selected.id
            ? {
                ...n,
                ...values,
                ...(values.importance && n.learningPriority
                  ? {
                      learningPriority: ({ 1: 'optional', 2: 'understand', 3: 'must' } as const)[
                        values.importance
                      ],
                    }
                  : {}),
                updatedAt: now(),
              }
            : n,
        ),
      }));
  }
  function chapterLabel(n: KnowledgeNode): string {
    let parent = data.nodes.find((p) => p.id === n.parentId);
    const seen = new Set<string>();
    while (parent && !seen.has(parent.id)) {
      if (parent.kind === 'chapter') return parent.title;
      seen.add(parent.id);
      parent = data.nodes.find((p) => p.id === parent?.parentId);
    }
    return '课程根目录';
  }
  const parent = selected ? chapterLabel(selected) : '';
  return (
    <div className="workspace">
      <div className="workspace-header">
        <div>
          <button className="breadcrumb" onClick={() => navigate('/')}>
            我的课程
          </button>
          <span className="muted"> / </span>
          <span>{course.title}</span>
        </div>
        <span className="local-tag">
          <span className="online-dot" />
          本地学习空间
        </span>
      </div>
      <div className="course-heading">
        <div
          className="course-symbol"
          style={{ color: course.color, background: `${course.color}14` }}
        >
          <Icon name="book" size={24} />
        </div>
        <div className="grow">
          <h1>{course.title}</h1>
          <p>{course.description}</p>
        </div>
        <div className="course-progress">
          <span>
            {nodes.filter((n) => n.status === 'mastered').length} / {nodes.length} 个已掌握
            {' · '}
            {percent}%
          </span>
          <Progress value={percent} />
        </div>
      </div>
      <nav className="workspace-tabs" aria-label="课程页面">
        {[
          ['knowledge', 'tree', '知识工作台'],
          ['map', 'map', '学习地图'],
          ['resources', 'file', '课程资料'],
        ].map(([id, icon, title]) => (
          <button
            className={tab === id || (id === 'resources' && tab === 'reader') ? 'active' : ''}
            onClick={() => setTab(id)}
            key={id}
          >
            <Icon name={icon} size={16} />
            {title}
          </button>
        ))}
      </nav>
      {tab === 'reader' ? (
        <DocumentReader
          data={data}
          courseId={course.id}
          documentId={routeParts[0]}
          section={routeParts[1]}
          navigate={navigate}
          select={select}
        />
      ) : tab === 'map' ? (
        <KnowledgeMap data={data} courseId={course.id} select={select} />
      ) : tab === 'resources' ? (
        <Resources
          data={data}
          courseId={course.id}
          update={update}
          provider={materialProvider}
          select={select}
          detailId={selectedId === 'resource' ? routeParts[0] : undefined}
          setDetailId={(id) =>
            navigate(id ? documentRoute(course.id, id) : `/course/${course.id}/resources`)
          }
          readSource={(id, section) => navigate(readerRoute(course.id, id, section))}
        />
      ) : (
        <div className="workbench">
          <KnowledgeTree
            data={data}
            courseId={course.id}
            selected={selected?.id}
            select={select}
            update={update}
          />
          {!selected ? (
            <CourseOverview
              data={data}
              courseId={course.id}
              select={select}
              upload={() => setTab('resources')}
            />
          ) : contentIssue ? (
            <main className="knowledge-document">
              <h1>这个知识点的来源文字无法可靠识别</h1>
              <p role="alert">{contentIssue}</p>
              <p>原文件、笔记和掌握记录已保留，异常内容暂不参与学习推荐和进度计算。</p>
              <button
                className="button primary"
                onClick={() =>
                  navigate(
                    selected.source
                      ? documentRoute(course.id, selected.source.fileId)
                      : `/course/${course.id}/resources`,
                  )
                }
              >
                查看原始资料
              </button>
              <section className="study-note">
                <label>
                  我的笔记
                  <textarea
                    aria-label="我的笔记"
                    rows={5}
                    value={selected.content.notes}
                    onChange={(e) =>
                      update((d) => saveNote(d, course.id, selected.id, e.target.value))
                    }
                  />
                </label>
              </section>
            </main>
          ) : (
            <>
              <main className="knowledge-document">
                <div className="document-breadcrumb">
                  <span>{selected.kind === 'chapter' ? '章节' : parent}</span>
                  <div className="button-group">
                    <button
                      className="icon-button"
                      aria-label="编辑当前知识结构"
                      onClick={() => setEditing(true)}
                    >
                      <Icon name="edit" size={16} />
                    </button>
                    <button
                      className="icon-button danger"
                      aria-label="删除当前知识结构"
                      onClick={() => {
                        const ids = descendants(data.nodes, selected.id);
                        if (
                          confirm(
                            `删除「${selected.title}」及全部子节点（共 ${ids.size} 项）？历史记录会保留。`,
                          )
                        ) {
                          if (update((d) => deleteNodes(d, ids))) navigate(`/course/${course.id}`);
                        }
                      }}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                </div>
                <h1>{selected.title}</h1>
                {selected.source && (
                  <div className="knowledge-source muted">
                    来源：{selected.source.fileName}
                    {selected.source.page
                      ? ` · ${data.resources.find((r) => r.id === selected.source?.fileId)?.type === 'PPTX' ? 'Slide ' : '第 '}${selected.source.page}${data.resources.find((r) => r.id === selected.source?.fileId)?.type === 'PPTX' ? '' : ' 页'}`
                      : ' · 正文片段'}
                    {selected.generatedBy === 'mock' && ' · Mock 草案，请校对'}
                    {original ? (
                      <button
                        className="text-button"
                        onClick={() =>
                          navigate(
                            readerRoute(course.id, original.document.id, original.page.section),
                          )
                        }
                      >
                        查看来源正文 →
                      </button>
                    ) : (
                      <span> · 来源暂不可用，请检查资料是否已删除或尚未解析</span>
                    )}
                  </div>
                )}
                {selected.kind === 'chapter' ? (
                  <>
                    <p className="muted">在这个章节下，一点点搭起完整的理解。</p>
                    <div className="chapter-list">
                      {data.nodes
                        .filter(
                          (n) =>
                            n.parentId === selected.id && (n.kind === 'chapter' || isStudyTopic(n)),
                        )
                        .sort((a, b) => a.order - b.order)
                        .map((n) => (
                          <button key={n.id} onClick={() => select(n)}>
                            <Icon name={n.kind === 'chapter' ? 'book' : 'file'} />
                            <span className="grow">{n.title}</span>
                            {n.kind === 'topic' && <Badge status={n.status} />}
                            <Icon name="arrow" size={15} />
                          </button>
                        ))}
                    </div>
                    {!data.nodes.some((n) => n.parentId === selected.id) && (
                      <p className="empty-inline">
                        章节还没有内容。使用左侧“添加章节 / 知识点”，并选择本章节为父节点。
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <section className="study-summary">
                      <div>
                        <span className="eyebrow">知识点摘要</span>
                        <h2>你需要掌握</h2>
                      </div>
                      <span className={`priority-pill priority-${priorityOf(selected)}`}>
                        {priorityLabels[priorityOf(selected)]}
                      </span>
                      <p>
                        {selected.summary || selected.content.concept || '这个知识点还没有摘要。'}
                      </p>
                    </section>
                    {original && (
                      <details className="study-source" open>
                        <summary>
                          对应资料原文 · {original.document.type === 'PPTX' ? 'Slide ' : '第 '}
                          {original.page.page ?? '正文片段'}
                          {original.page.page && original.document.type !== 'PPTX' ? ' 页' : ''}
                        </summary>
                        <pre>{original.page.text || '本页没有可提取文字。'}</pre>
                        <button
                          className="text-button"
                          onClick={() =>
                            navigate(
                              readerRoute(course.id, original.document.id, original.page.section),
                            )
                          }
                        >
                          查看来源
                        </button>
                      </details>
                    )}
                    <section className="study-note">
                      <label>
                        我的笔记
                        <textarea
                          aria-label="我的笔记"
                          rows={5}
                          value={selected.content.notes}
                          placeholder="用自己的话写下理解，输入后自动保存…"
                          onChange={(e) =>
                            update((d) => saveNote(d, course.id, selected.id, e.target.value))
                          }
                        />
                      </label>
                      <small className="muted">自动保存在本浏览器 · 与当前知识点关联</small>
                    </section>
                    <div className="study-status" role="group" aria-label="学习操作">
                      <button
                        className={`button ${selected.status === 'learning' ? 'primary' : ''}`}
                        onClick={() =>
                          update((d) => record(d, selected.id, 'status', { status: 'learning' }))
                        }
                      >
                        开始学习
                      </button>
                      <button
                        className={`button ${selected.status === 'mastered' ? 'primary' : ''}`}
                        onClick={() =>
                          update((d) => record(d, selected.id, 'status', { status: 'mastered' }))
                        }
                      >
                        标记已掌握
                      </button>
                      <button
                        className="button"
                        disabled={!original}
                        onClick={() =>
                          original &&
                          navigate(
                            readerRoute(course.id, original.document.id, original.page.section),
                          )
                        }
                      >
                        查看来源
                      </button>
                    </div>
                    <div className="document-meta">
                      <label>
                        掌握程度
                        <select
                          aria-label="掌握程度"
                          value={selected.status}
                          onChange={(e) =>
                            update((d) =>
                              record(d, selected.id, 'status', {
                                status: e.target.value as KnowledgeNode['status'],
                              }),
                            )
                          }
                        >
                          {Object.entries(statuses).map(([key, name]) => (
                            <option key={key} value={key}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        重要程度
                        <select
                          aria-label="重要程度"
                          value={selected.importance}
                          onChange={(e) =>
                            patch({ importance: Number(e.target.value) as 1 | 2 | 3 })
                          }
                        >
                          <option value={1}>暂时跳过</option>
                          <option value={2}>理解即可</option>
                          <option value={3}>必须掌握</option>
                        </select>
                      </label>
                    </div>
                    <div className="learning-actions">
                      <button
                        className="understand"
                        onClick={() => update((d) => record(d, selected.id, 'understand'))}
                      >
                        <Icon name="check" size={16} />
                        我懂了
                      </button>
                      <button onClick={() => update((d) => record(d, selected.id, 'vague'))}>
                        有点模糊
                      </button>
                      <button onClick={() => update((d) => record(d, selected.id, 'unknown'))}>
                        完全不会
                      </button>
                      <button
                        onClick={() => {
                          setQuizTrigger((v) => v + 1);
                          document
                            .getElementById('assistant-anchor')
                            ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }}
                      >
                        <Icon name="spark" size={15} />
                        考我一道
                      </button>
                      <button onClick={() => update((d) => record(d, selected.id, 'review'))}>
                        <Icon name="review" size={15} />
                        加入复习
                      </button>
                    </div>
                    <p className="save-hint">
                      用自己的语言组织知识 · 编辑后自动保存
                      {selected.reviewAt &&
                        ` · 下次复习 ${new Date(selected.reviewAt).toLocaleDateString('zh-CN')}`}
                    </p>
                    {(Object.entries(fields) as [keyof typeof fields, string][])
                      .filter(([key]) => key !== 'notes')
                      .map(([key, title], i) => (
                        <section
                          className={`content-section ${key === 'formula' ? 'formula-section' : ''}`}
                          key={key}
                        >
                          <h2>
                            <span>{String(i + 1).padStart(2, '0')}</span>
                            {title}
                          </h2>
                          <textarea
                            aria-label={title}
                            value={selected.content[key]}
                            placeholder={
                              {
                                concept: '这个知识点解决什么问题？最重要的定义是什么？',
                                formula: '写下关键公式，以及适用条件…',
                                understanding: '试着用一句自己的话解释，而不是复制定义…',
                                confusion: '容易混淆的概念、条件或符号…',
                                examples: '每行记录一个典型问题或题型，供自测抽取…',
                                mistakes: '题目、错误原因，以及下一次如何避免…',
                              }[key as Exclude<keyof typeof fields, 'notes'>]
                            }
                            rows={Math.min(
                              12,
                              Math.max(
                                3,
                                selected.content[key].split('\n').length +
                                  Math.ceil(selected.content[key].length / 65),
                              ),
                            )}
                            onChange={(e) =>
                              patch({ content: { ...selected.content, [key]: e.target.value } })
                            }
                          />
                        </section>
                      ))}
                    <Relations data={data} node={selected} update={update} select={select} />
                  </>
                )}
              </main>
              {selected.kind === 'topic' && (
                <div id="assistant-anchor">
                  <AssistantPanel
                    key={selected.id}
                    node={selected}
                    data={data}
                    update={update}
                    provider={provider}
                    quizTrigger={quizTrigger}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
      {editing && selected && (
        <NodeForm
          node={selected}
          data={data}
          courseId={course.id}
          update={update}
          close={() => setEditing(false)}
        />
      )}
    </div>
  );
}
function Relations({
  data,
  node,
  update,
  select,
}: {
  data: AppData;
  node: KnowledgeNode;
  update: Update;
  select: (n: KnowledgeNode) => void;
}) {
  return (
    <section className="relations">
      <h2>
        <Icon name="map" size={18} />
        知识连接
      </h2>
      {(['prerequisite', 'related'] as const).map((kind) => {
        const links = data.edges.filter(
          (e) =>
            e.kind === kind &&
            (e.targetId === node.id || (kind === 'related' && e.sourceId === node.id)),
        );
        return (
          <div key={kind} className="relation-group">
            <h3>{kind === 'prerequisite' ? '前置知识点' : '相关知识点'}</h3>
            <div className="relation-tags">
              {links.map((e) => {
                const other = data.nodes.find(
                  (n) => n.id === (e.sourceId === node.id ? e.targetId : e.sourceId),
                );
                if (!other) return null;
                return (
                  <div className="relation-tag" key={e.id}>
                    <button onClick={() => select(other)}>{other.title}</button>
                    <button
                      aria-label={`移除关系${other.title}`}
                      onClick={() =>
                        update((d) => ({ ...d, edges: d.edges.filter((edge) => edge.id !== e.id) }))
                      }
                    >
                      <Icon name="close" size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
            <select
              aria-label={`添加${kind === 'prerequisite' ? '前置' : '相关'}知识点`}
              value=""
              onChange={(e) => {
                if (e.target.value) update((d) => addEdge(d, e.target.value, node.id, kind));
              }}
            >
              <option value="">+ 选择一个知识点</option>
              {data.nodes
                .filter(
                  (n) =>
                    n.courseId === node.courseId &&
                    n.kind === 'topic' &&
                    n.id !== node.id &&
                    !links.some((e) => e.sourceId === n.id || e.targetId === n.id),
                )
                .map((n) => (
                  <option value={n.id} key={n.id}>
                    {n.title}
                  </option>
                ))}
            </select>
          </div>
        );
      })}
    </section>
  );
}
