import { useState, type FormEvent } from 'react';
import { now, uid, type AppData, type Course, type KnowledgeNode } from '../domain/model';
import {
  dayKey,
  deleteCourse,
  isDue,
  isStudy,
  isWeak,
  nextNode,
  sevenDays,
  struggleCount,
} from '../domain/logic';
import type { Update } from '../services/storage';
import { Icon } from '../components/Icons';
import { Empty, Modal } from '../components/Modal';
import { courseTopics, masteredPercent, NodeRow, Progress } from '../components/Shared';
export function CourseForm({
  course,
  close,
  update,
}: {
  course?: Course;
  close: () => void;
  update: Update;
}) {
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const title = String(f.get('title')).trim();
    if (!title) return;
    const next = {
      id: course?.id ?? uid(),
      title,
      description: String(f.get('description')).trim(),
      color: String(f.get('color')),
      createdAt: course?.createdAt ?? now(),
    };
    if (
      update((d) => ({
        ...d,
        courses: course
          ? d.courses.map((c) => (c.id === course.id ? next : c))
          : [...d.courses, next],
      }))
    )
      close();
  }
  return (
    <Modal title={course ? '编辑课程' : '开启一门新课程'} onClose={close}>
      <form onSubmit={save} className="form-stack">
        <label>
          课程名称
          <input
            name="title"
            required
            maxLength={80}
            defaultValue={course?.title}
            placeholder="例如：激光原理"
            autoFocus
          />
        </label>
        <label>
          一句话介绍
          <textarea
            name="description"
            defaultValue={course?.description}
            placeholder="这门课，你希望理解什么？"
            rows={3}
          />
        </label>
        <label>
          课程颜色
          <input name="color" type="color" defaultValue={course?.color ?? '#287c68'} />
        </label>
        <footer>
          <button type="button" className="button" onClick={close}>
            取消
          </button>
          <button className="button primary" type="submit">
            {course ? '保存修改' : '创建课程'}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
export function Dashboard({
  data,
  update,
  go,
  navigate,
}: {
  data: AppData;
  update: Update;
  go: (n: KnowledgeNode) => void;
  navigate: (path: string) => void;
}) {
  const [editing, setEditing] = useState<Course | 'new' | null>(null);
  const [query, setQuery] = useState('');
  const topics = data.nodes.filter((n) => n.kind === 'topic');
  const weak = topics.filter((n) => isWeak(data, n));
  const due = topics.filter(isDue);
  const today = data.events.filter(
    (e) => isStudy(e.action) && dayKey(new Date(e.at)) === dayKey(new Date()),
  );
  const next = nextNode(data);
  const days = sevenDays(data);
  const recentIds = [...new Set([...data.events].reverse().map((e) => e.nodeId))].slice(0, 4);
  const recent = recentIds
    .map((id) => topics.find((n) => n.id === id))
    .filter((n): n is KnowledgeNode => !!n);
  return (
    <div className="page dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR LEARNING SPACE</div>
          <h1>
            让知识，真正成为你的<span className="green">。</span>
          </h1>
          <p>每一次理解，每一个疑问，都在这里慢慢连接。</p>
        </div>
        <div className="date-label">
          <Icon name="sun" />
          {new Date().toLocaleDateString('zh-CN', {
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          })}
        </div>
      </div>
      <div className="overview">
        <div>
          <span>今日学习</span>
          <strong>
            {today.length}
            <small>次</small>
          </strong>
          <small>{new Set(today.map((e) => e.nodeId)).size} 个知识点留下了新进展</small>
        </div>
        <button onClick={() => navigate('/review')}>
          <span>
            待复习 <Icon name="arrow" size={15} />
          </span>
          <strong>
            {due.length}
            <small>个</small>
          </strong>
          <small>给记忆一点温故知新的时间</small>
        </button>
        <button
          onClick={() => document.getElementById('weak')?.scrollIntoView({ behavior: 'smooth' })}
        >
          <span>
            薄弱知识点 <Icon name="arrow" size={15} />
          </span>
          <strong>
            {weak.length}
            <small>个</small>
          </strong>
          <small>看见不会，才是学会的开始</small>
        </button>
        <div>
          <span>本周节奏</span>
          <div className="mini-chart" aria-label="最近七天学习次数">
            {days.map((day) => (
              <div
                key={day.key}
                title={`${day.label}：${day.count} 次`}
                style={{
                  height: `${Math.max(5, (day.count / Math.max(1, ...days.map((d) => d.count))) * 40)}px`,
                }}
              />
            ))}
          </div>
          <small>最近 7 天 · {days.reduce((s, d) => s + d.count, 0)} 次学习</small>
        </div>
      </div>
      <div className="dashboard-columns">
        <section className="courses">
          <div className="section-heading">
            <div>
              <h2>
                我的课程 <span className="count">{data.courses.length}</span>
              </h2>
              <p>一点点梳理，一步步掌握。</p>
            </div>
            <button className="button primary" onClick={() => setEditing('new')}>
              <Icon name="plus" size={16} />
              新建课程
            </button>
          </div>
          <div className="search-field">
            <Icon name="search" />
            <input
              aria-label="搜索课程"
              placeholder="搜索我的课程…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="course-list">
            {data.courses
              .filter((c) => c.title.toLowerCase().includes(query.toLowerCase()))
              .map((course, i) => {
                const nodes = courseTopics(data, course.id);
                const percent = masteredPercent(nodes);
                return (
                  <article className="course-row" key={course.id}>
                    <button
                      className="course-main"
                      onClick={() => navigate(`/course/${course.id}`)}
                    >
                      <div
                        className="course-symbol"
                        style={{ color: course.color, background: `${course.color}14` }}
                      >
                        <Icon name={['spark', 'map', 'sun', 'target', 'chart'][i % 5]} size={25} />
                      </div>
                      <div className="grow">
                        <h3>{course.title}</h3>
                        <p>{course.description || '从第一个知识点开始，建立你的知识体系。'}</p>
                        <div className="course-meta">
                          <span>{nodes.length} 个知识点</span>
                          <span>{nodes.filter(isDue).length} 个待复习</span>
                        </div>
                      </div>
                      <div className="course-progress">
                        <span>
                          <b>{percent}%</b> 已掌握
                        </span>
                        <Progress value={percent} />
                      </div>
                      <Icon name="arrow" />
                    </button>
                    <div className="course-actions">
                      <button
                        className="icon-button"
                        aria-label={`编辑${course.title}`}
                        onClick={() => setEditing(course)}
                      >
                        <Icon name="edit" size={15} />
                      </button>
                      <button
                        className="icon-button danger"
                        aria-label={`删除${course.title}`}
                        onClick={() => {
                          if (
                            confirm(
                              `删除「${course.title}」及其知识点、题库和资料？学习历史会保留。`,
                            )
                          )
                            update((d) => deleteCourse(d, course.id));
                        }}
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </div>
                  </article>
                );
              })}
          </div>
          {!data.courses.length && (
            <Empty
              title="你的学习空间，从这里开始"
              text="新建一门课程，再把章节与知识点慢慢放进来。"
            />
          )}
          {data.courses.length > 0 &&
            !data.courses.some((c) => c.title.toLowerCase().includes(query.toLowerCase())) && (
              <Empty title="没有匹配的课程" text="换个关键词试试。" />
            )}
          <div className="quiet-note">
            <Icon name="book" size={18} />
            <span>不只是收集知识，更是建立属于自己的理解。</span>
          </div>
        </section>
        <aside className="dashboard-aside">
          <section className="next-step">
            <div className="eyebrow">
              <Icon name="spark" size={15} /> NEXT STEP
            </div>
            <h3>下一步，学什么？</h3>
            {next ? (
              <>
                <p>{data.courses.find((c) => c.id === next.node.courseId)?.title}</p>
                <h2>{next.node.title}</h2>
                <p>{next.reason}</p>
                <button className="button primary" onClick={() => go(next.node)}>
                  开始这一小步 <Icon name="arrow" size={16} />
                </button>
              </>
            ) : (
              <p>暂时没有可推荐的知识点。添加新知识，或检查尚未理解的前置知识。</p>
            )}
          </section>
          <section>
            <div className="section-heading">
              <h3>最近学习</h3>
              <Icon name="clock" size={17} />
            </div>
            {recent.length ? (
              recent.map((node) => <NodeRow key={node.id} node={node} data={data} go={go} />)
            ) : (
              <p className="empty-inline">还没有学习记录。打开一个知识点，从今天开始。</p>
            )}
          </section>
          <section id="weak">
            <div className="section-heading">
              <h3>再多理解一点</h3>
              <span className="count">{weak.length}</span>
            </div>
            {weak.length ? (
              weak
                .slice(0, 4)
                .map((node) => (
                  <NodeRow
                    key={node.id}
                    node={node}
                    data={data}
                    go={go}
                    detail={`${struggleCount(data, node.id)} 次标记不会 · ${data.courses.find((c) => c.id === node.courseId)?.title}`}
                  />
                ))
            ) : (
              <p className="empty-inline">目前没有标记的薄弱点。遇到困惑时，放心按下“有点模糊”。</p>
            )}
          </section>
        </aside>
      </div>
      {editing && (
        <CourseForm
          course={editing === 'new' ? undefined : editing}
          close={() => setEditing(null)}
          update={update}
        />
      )}
    </div>
  );
}
