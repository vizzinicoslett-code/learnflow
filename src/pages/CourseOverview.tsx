import type { AppData, KnowledgeNode } from '../domain/model';
import { courseKnowledgeBase } from '../domain/courseKnowledge';
import { Badge, Progress } from '../components/Shared';
import { Empty } from '../components/Modal';
export function CourseOverview({
  data,
  courseId,
  select,
  upload,
}: {
  data: AppData;
  courseId: string;
  select: (n: KnowledgeNode) => void;
  upload: () => void;
}) {
  const kb = courseKnowledgeBase(data, courseId);
  const p = kb.progress;
  return (
    <section className="course-overview">
      <div className="eyebrow">从资料，到真正掌握</div>
      <h2>今天，从哪里开始？</h2>
      <div className="course-metrics">
        <div>
          <strong>{kb.today.length}</strong>
          <span>今日学习操作</span>
        </div>
        <div>
          <strong>{p.unlearned}</strong>
          <span>待学习</span>
        </div>
        <div>
          <strong>{p.learning + p.understood + p.review}</strong>
          <span>学习中 / 待巩固</span>
        </div>
        <div>
          <strong>{p.mastered}</strong>
          <span>已掌握</span>
        </div>
      </div>
      <div className="course-completion">
        <strong>
          {p.mastered} / {p.total} 已掌握 · {p.percent}%
        </strong>
        <Progress value={p.percent} />
      </div>
      {!kb.documents.length && (
        <Empty title="还没有课程资料" text="上传老师的课件或课堂笔记，把正文整理成可以学习的知识。">
          <button className="button primary" onClick={upload}>
            上传第一份资料
          </button>
        </Empty>
      )}
      {p.total > 0 && p.mastered === p.total ? (
        <div className="material-notice">
          <h3>这一程，全部掌握了</h3>
          <p>可以回顾笔记、检查复习计划，或加入下一份课程资料。</p>
          <button className="button" onClick={upload}>
            添加新资料
          </button>
        </div>
      ) : kb.next ? (
        <div className="continue-learning">
          <p className="muted">下一步</p>
          <h3>{kb.next.title}</h3>
          <p>{kb.next.summary ?? kb.next.content.concept}</p>
          <button className="button primary" onClick={() => select(kb.next!)}>
            继续学习
          </button>
        </div>
      ) : (
        kb.documents.length > 0 && (
          <p className="material-notice">
            还没有可学习的知识点。到课程资料检查解析状态，或从左侧手动添加。
          </p>
        )
      )}
      <section className="learning-queue">
        <h3>待学习知识点</h3>
        {kb.nodes
          .filter((n) => n.status === 'unlearned')
          .slice(0, 8)
          .map((n) => (
            <button className="overview-node" key={n.id} onClick={() => select(n)}>
              <span>{n.title}</span>
              <Badge status={n.status} />
            </button>
          ))}
        {!p.unlearned && <p className="muted">当前没有未学习的知识点。</p>}
      </section>
      <section className="learning-queue">
        <h3>继续巩固</h3>
        {kb.nodes
          .filter((n) => !['unlearned', 'mastered'].includes(n.status))
          .slice(0, 8)
          .map((n) => (
            <button className="overview-node" key={n.id} onClick={() => select(n)}>
              <span>{n.title}</span>
              <Badge status={n.status} />
            </button>
          ))}
      </section>
      <section className="learning-queue">
        <h3>最近掌握</h3>
        {kb.recentlyMastered.map((n) => (
          <button className="overview-node" key={n.id} onClick={() => select(n)}>
            <span>{n.title}</span>
            <Badge status={n.status} />
          </button>
        ))}
        {!kb.recentlyMastered.length && (
          <p className="muted">掌握一个知识点后，会在这里留下进展。</p>
        )}
      </section>
    </section>
  );
}
