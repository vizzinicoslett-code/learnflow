import { useState } from 'react';
import type { AppData, KnowledgeNode } from '../domain/model';
import { isDue } from '../domain/logic';
import { isStudyTopic } from '../domain/studyContent';
import { Empty } from '../components/Modal';
import { NodeRow } from '../components/Shared';
import { Icon } from '../components/Icons';
export function Review({ data, go }: { data: AppData; go: (n: KnowledgeNode) => void }) {
  const [all, setAll] = useState(false);
  const [course, setCourse] = useState('');
  const scheduled = data.nodes
    .filter((n) => isStudyTopic(n) && n.reviewAt && (!course || n.courseId === course))
    .sort((a, b) => a.reviewAt!.localeCompare(b.reviewAt!));
  const due = scheduled.filter(isDue);
  const shown = all ? scheduled : due;
  return (
    <div className="page narrow">
      <div className="eyebrow">MAKE IT STICK</div>
      <h1>和知识，再见一面。</h1>
      <p className="page-intro">复习不是重新开始，而是让已经走过的路更清晰。</p>
      <div className="review-banner">
        <Icon name="review" size={30} />
        <div className="grow">
          <h2>{due.length ? `${due.length} 个知识点，等待一次回忆` : '今天的复习，已经就绪'}</h2>
          <p>
            {due.length
              ? '先不看笔记，试着回答，再检查自己的理解。'
              : '没有到期的知识点，继续探索新知识吧。'}
          </p>
        </div>
        {due[0] && (
          <button className="button primary" onClick={() => go(due[0])}>
            开始复习 <Icon name="arrow" size={16} />
          </button>
        )}
      </div>
      <div className="section-heading">
        <div className="segmented">
          <button className={!all ? 'active' : ''} onClick={() => setAll(false)}>
            待复习 {due.length}
          </button>
          <button className={all ? 'active' : ''} onClick={() => setAll(true)}>
            全部计划 {scheduled.length}
          </button>
        </div>
        <select
          aria-label="筛选复习课程"
          value={course}
          onChange={(e) => setCourse(e.target.value)}
        >
          <option value="">全部课程</option>
          {data.courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>
      {shown.length ? (
        shown.map((n) => (
          <NodeRow
            key={n.id}
            node={n}
            data={data}
            go={go}
            detail={`${data.courses.find((c) => c.id === n.courseId)?.title} · ${isDue(n) ? '已到期' : '计划'} ${new Date(n.reviewAt!).toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
          />
        ))
      ) : (
        <Empty
          title="没有待处理的复习"
          text="在知识点中点击“加入复习”，或完成一次自评，系统会为你安排下一次回忆。"
        />
      )}
      <div className="review-rules">
        <h3>复习如何安排？</h3>
        <p>
          加入复习：立即到期。完全不会 / 有点模糊 / 自测还不会：1 天后。基本理解：3
          天后。自测答对：7 天后。
        </p>
        <p className="muted">
          这是可理解的简单规则，尚未使用自适应间隔算法。掌握状态和自测结果均由你自己判断。
        </p>
      </div>
    </div>
  );
}
