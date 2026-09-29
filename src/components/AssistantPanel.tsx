import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  actionLabels,
  statuses,
  uid,
  type AppData,
  type KnowledgeNode,
  type Question,
} from '../domain/model';
import { record } from '../domain/logic';
import type { QuestionProvider } from '../services/questions';
import type { Update } from '../services/storage';
import { Icon } from './Icons';
import { Modal } from './Modal';
import { formatTime } from './Shared';
export function AssistantPanel({
  node,
  data,
  update,
  provider,
  quizTrigger,
}: {
  node: KnowledgeNode;
  data: AppData;
  update: Update;
  provider: QuestionProvider;
  quizTrigger: number;
}) {
  const [tab, setTab] = useState('assistant');
  const [question, setQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Question | 'new' | null>(null);
  const trigger = useRef(quizTrigger);
  async function quiz() {
    setBusy(true);
    setError('');
    try {
      const q = await provider.generateQuestion({ node, questions: data.questions });
      setQuestion(q);
      setAnswer('');
      setRevealed(false);
      setDone(false);
      setTab('assistant');
      update((d) => record(d, node.id, 'quiz', { questionPrompt: q.prompt }));
    } catch {
      setError('暂时无法出题，请重试。');
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (quizTrigger > 0 && quizTrigger !== trigger.current) {
      trigger.current = quizTrigger;
      void quiz();
    }
  }, [quizTrigger]);
  const questions = data.questions.filter((q) => q.nodeId === node.id);
  const history = data.events
    .filter((e) => e.nodeId === node.id)
    .slice(-8)
    .reverse();
  function saveQuestion(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const prompt = String(f.get('prompt')).trim();
    if (!prompt) return;
    const q = {
      id: editing && editing !== 'new' ? editing.id : uid(),
      nodeId: node.id,
      prompt,
      answer: String(f.get('answer')).trim(),
    };
    if (
      update((d) => ({
        ...d,
        questions:
          editing === 'new' ? [...d.questions, q] : d.questions.map((p) => (p.id === q.id ? q : p)),
      }))
    )
      setEditing(null);
  }
  return (
    <aside className="assistant-panel">
      <div className="panel-tabs">
        <button className={tab === 'assistant' ? 'active' : ''} onClick={() => setTab('assistant')}>
          <Icon name="spark" size={15} />
          学习助手
        </button>
        <button className={tab === 'notes' ? 'active' : ''} onClick={() => setTab('notes')}>
          <Icon name="edit" size={15} />
          笔记
        </button>
      </div>
      {tab === 'notes' ? (
        <div className="panel-body">
          <div className="eyebrow">把理解留在这里</div>
          <h3>我的学习笔记</h3>
          <p className="muted">课堂灵感、AI 对话要点、还没想明白的问题。</p>
          <textarea
            className="notes-editor"
            aria-label="学习笔记"
            placeholder="用自己的话写下今天的收获…"
            value={node.content.notes}
            onChange={(e) =>
              update((d) => ({
                ...d,
                nodes: d.nodes.map((n) =>
                  n.id === node.id ? { ...n, content: { ...n.content, notes: e.target.value } } : n,
                ),
              }))
            }
          />
        </div>
      ) : (
        <div className="panel-body">
          <div className="assistant-intro">
            <div className="assistant-symbol">
              <Icon name="spark" size={24} />
            </div>
            <h3>理解之后，试着回忆</h3>
            <p>
              合上笔记，讲给自己听。
              <br />
              能独立说出来，知识才开始留下来。
            </p>
            <span className="local-tag">本地练习 · 无 AI 联网</span>
          </div>
          {!question ? (
            <button disabled={busy} className="button primary wide" onClick={() => void quiz()}>
              <Icon name="spark" size={16} />
              {busy ? '正在准备…' : '考我一道'}
            </button>
          ) : (
            <section className="quiz">
              <div className="eyebrow">ACTIVE RECALL</div>
              <h4>{question.prompt}</h4>
              <label>
                我的作答
                <textarea
                  rows={5}
                  placeholder="先独立写下你的思路…"
                  value={answer}
                  disabled={done}
                  onChange={(e) => setAnswer(e.target.value)}
                />
              </label>
              {!revealed ? (
                <button className="button wide" onClick={() => setRevealed(true)}>
                  查看参考答案
                </button>
              ) : (
                <>
                  <div className="reference">
                    <small>参考答案 · 请自行核对</small>
                    <p>{question.answer || '未填写参考答案，请对照教材或课堂笔记检查。'}</p>
                  </div>
                  <p className="muted">按自己的完成情况评分，不是 AI 判分。</p>
                  {!done ? (
                    <div className="quiz-rating">
                      <button
                        className="button"
                        onClick={() => {
                          if (
                            update((d) =>
                              record(d, node.id, 'incorrect', {
                                answer,
                                questionPrompt: question.prompt,
                              }),
                            )
                          )
                            setDone(true);
                        }}
                      >
                        还不会
                      </button>
                      <button
                        className="button primary"
                        onClick={() => {
                          if (
                            update((d) =>
                              record(d, node.id, 'correct', {
                                answer,
                                questionPrompt: question.prompt,
                              }),
                            )
                          )
                            setDone(true);
                        }}
                      >
                        答对了
                      </button>
                    </div>
                  ) : (
                    <p className="success">
                      <Icon name="check" size={15} />
                      作答已保存，已安排下次复习
                    </p>
                  )}
                </>
              )}
              {done && (
                <button className="text-button" disabled={busy} onClick={() => void quiz()}>
                  再来一道 <Icon name="arrow" size={14} />
                </button>
              )}
            </section>
          )}
          {error && <p role="alert">{error}</p>}
          <section className="question-bank">
            <div className="section-heading">
              <h4>
                我的题库 <span className="count">{questions.length}</span>
              </h4>
              <button
                className="icon-button"
                aria-label="添加题目"
                onClick={() => setEditing('new')}
              >
                <Icon name="plus" size={16} />
              </button>
            </div>
            {questions.map((q) => (
              <div className="question-row" key={q.id}>
                <button onClick={() => setEditing(q)}>{q.prompt}</button>
                <button
                  className="icon-button danger"
                  aria-label="删除题目"
                  onClick={() => {
                    if (confirm('删除这道题？'))
                      update((d) => ({
                        ...d,
                        questions: d.questions.filter((p) => p.id !== q.id),
                      }));
                  }}
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            ))}
            {!questions.length && (
              <p className="muted">
                保存你想反复练习的问题。没有题目时，会从“典型题型”生成回忆提示。
              </p>
            )}
          </section>
          <section className="history">
            <h4>学习足迹</h4>
            {history.length ? (
              history.map((e) => (
                <details key={e.id}>
                  <summary>
                    <span className="history-dot" />
                    <span>
                      {actionLabels[e.action]}
                      <small>{formatTime(e.at)}</small>
                    </span>
                  </summary>
                  <p>
                    {statuses[e.fromStatus]} → {statuses[e.toStatus]}
                  </p>
                  {e.questionPrompt && <p>{e.questionPrompt}</p>}
                  {e.answer !== undefined && <p>我的作答：{e.answer || '未填写'}</p>}
                </details>
              ))
            ) : (
              <p className="muted">每一次回忆，都值得被记录。</p>
            )}
          </section>
        </div>
      )}
      {editing && (
        <Modal
          title={editing === 'new' ? '添加一道题' : '编辑题目'}
          onClose={() => setEditing(null)}
        >
          <form className="form-stack" onSubmit={saveQuestion}>
            <label>
              题目
              <textarea
                name="prompt"
                required
                rows={4}
                autoFocus
                defaultValue={editing === 'new' ? '' : editing.prompt}
              />
            </label>
            <label>
              参考答案
              <textarea
                name="answer"
                rows={4}
                defaultValue={editing === 'new' ? '' : editing.answer}
              />
            </label>
            <footer>
              <button type="button" className="button" onClick={() => setEditing(null)}>
                取消
              </button>
              <button className="button primary">保存题目</button>
            </footer>
          </form>
        </Modal>
      )}
    </aside>
  );
}
