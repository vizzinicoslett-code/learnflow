import type { AppData } from '../domain/model';
import { isDue, isStudy, isWeak, sevenDays } from '../domain/logic';
import { courseTopics, masteredPercent, Progress } from '../components/Shared';
import { isStudyTopic } from '../domain/studyContent';
export function Stats({ data }: { data: AppData }) {
  const topics = data.nodes.filter(isStudyTopic);
  const days = sevenDays(data);
  const max = Math.max(1, ...days.map((d) => d.count));
  const monday = new Date();
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const week = data.events.filter(
    (e) => isStudy(e.action) && new Date(e.at) >= monday && new Date(e.at) <= new Date(),
  ).length;
  return (
    <div className="page">
      <div className="eyebrow">SMALL STEPS, REAL PROGRESS</div>
      <h1>每一小步，都算数。</h1>
      <p className="page-intro">不追赶数字，看见自己正在建立的理解。</p>
      <div className="overview stats-overview">
        {[
          ['总知识点', topics.length],
          ['已掌握', topics.filter((n) => n.status === 'mastered').length],
          ['薄弱知识点', topics.filter((n) => isWeak(data, n)).length],
          ['待复习', topics.filter(isDue).length],
          ['本周学习', week],
        ].map(([label, count]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>
              {count}
              <small>{label === '本周学习' ? '次' : '个'}</small>
            </strong>
          </div>
        ))}
      </div>
      <section className="activity-chart">
        <div className="section-heading">
          <div>
            <h2>最近 7 天</h2>
            <p>每一次自评、出题与作答，都是一次主动学习。</p>
          </div>
          <span className="muted">共 {days.reduce((s, d) => s + d.count, 0)} 次</span>
        </div>
        <div
          className="bar-chart"
          role="img"
          aria-label={days.map((d) => `${d.label}：${d.count}次`).join('，')}
        >
          {days.map((d, i) => (
            <div className="bar-column" key={d.key}>
              <span>{d.count}</span>
              <div className="bar-track">
                <div
                  className={i === 6 ? 'today' : ''}
                  style={{ height: `${Math.max(2, (d.count / max) * 100)}%` }}
                />
              </div>
              <small>{i === 6 ? '今天' : d.label}</small>
            </div>
          ))}
        </div>
      </section>
      <section>
        <div className="section-heading">
          <h2>课程掌握情况</h2>
          <span className="muted">只将「已掌握」计入进度</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>课程</th>
                <th>知识点</th>
                <th>已掌握</th>
                <th>薄弱点</th>
                <th>待复习</th>
                <th>掌握进度</th>
              </tr>
            </thead>
            <tbody>
              {data.courses.map((c) => {
                const nodes = courseTopics(data, c.id);
                return (
                  <tr key={c.id}>
                    <td>
                      <span className="course-dot" style={{ background: c.color }} />
                      {c.title}
                    </td>
                    <td>{nodes.length}</td>
                    <td>{nodes.filter((n) => n.status === 'mastered').length}</td>
                    <td>{nodes.filter((n) => isWeak(data, n)).length}</td>
                    <td>{nodes.filter(isDue).length}</td>
                    <td>
                      <div className="table-progress">
                        <Progress value={masteredPercent(nodes)} />
                        <span>{masteredPercent(nodes)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <p className="stats-note">
        本周从本地时间周一开始。打开知识点、加入复习和编辑笔记不计入学习次数。薄弱点指需要复习，或最近自评为模糊
        / 不会的未掌握知识点。历史学习次数包含已删除知识点的记录。
      </p>
    </div>
  );
}
