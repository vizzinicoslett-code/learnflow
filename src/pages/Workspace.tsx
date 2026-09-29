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
import { KnowledgeTree, NodeForm } from '../components/KnowledgeTree';
import { KnowledgeMap } from '../components/KnowledgeMap';
import { AssistantPanel } from '../components/AssistantPanel';
import { Badge, courseTopics, masteredPercent, Progress } from '../components/Shared';
import { Icon } from '../components/Icons';
import { Empty } from '../components/Modal';
import { Resources } from './Resources';
export function Workspace({
  course,
  data,
  update,
  selectedId,
  go,
  navigate,
  provider,
}: {
  course: Course;
  data: AppData;
  update: Update;
  selectedId?: string;
  go: (n: KnowledgeNode) => void;
  navigate: (path: string) => void;
  provider: QuestionProvider;
}) {
  const [tab, setTab] = useState('knowledge');
  const [editing, setEditing] = useState(false);
  const [quizTrigger, setQuizTrigger] = useState(0);
  const nodes = courseTopics(data, course.id);
  const selected = data.nodes.find((n) => n.id === selectedId && n.courseId === course.id);
  const percent = masteredPercent(nodes);
  function select(n: KnowledgeNode) {
    setTab('knowledge');
    setQuizTrigger(0);
    go(n);
  }
  function patch(values: Partial<KnowledgeNode>) {
    if (selected)
      update((d) => ({
        ...d,
        nodes: d.nodes.map((n) =>
          n.id === selected.id ? { ...n, ...values, updatedAt: now() } : n,
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
          <button className={tab === id ? 'active' : ''} onClick={() => setTab(id)} key={id}>
            <Icon name={icon} size={16} />
            {title}
          </button>
        ))}
      </nav>
      {tab === 'map' ? (
        <KnowledgeMap data={data} courseId={course.id} select={select} />
      ) : tab === 'resources' ? (
        <Resources data={data} courseId={course.id} update={update} />
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
            <div className="document-empty">
              <Empty
                title="选一个知识点，专注这一刻"
                text="从左侧知识树开始，也可以先添加属于自己的章节。"
              />
            </div>
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
                {selected.kind === 'chapter' ? (
                  <>
                    <p className="muted">在这个章节下，一点点搭起完整的理解。</p>
                    <div className="chapter-list">
                      {data.nodes
                        .filter((n) => n.parentId === selected.id)
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
                          <option value={1}>一般</option>
                          <option value={2}>重要</option>
                          <option value={3}>核心考点</option>
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
