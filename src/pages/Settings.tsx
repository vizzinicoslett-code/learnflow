import { useRef, useState } from 'react';
import { emptyData, type AppData } from '../domain/model';
import { validateData } from '../domain/validation';
import { download } from '../services/storage';
import { Icon } from '../components/Icons';
export function Settings({
  data,
  replace,
  theme,
  toggleTheme,
}: {
  data: AppData;
  replace: (d: AppData) => boolean;
  theme: string;
  toggleTheme: () => void;
}) {
  const file = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  async function restore(selected?: File) {
    if (!selected) return;
    try {
      if (selected.size > 8 * 1024 * 1024) throw new Error('备份文件不能超过 8 MB。');
      const next = validateData(JSON.parse(await selected.text()));
      if (
        !confirm(
          `备份包含 ${next.courses.length} 门课程、${next.nodes.length} 个节点和 ${next.events.length} 条历史。替换当前数据？建议先导出当前备份。`,
        )
      )
        return;
      if (replace(next)) {
        setMessage('备份已恢复。');
        setError(false);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '无法恢复备份');
      setError(true);
    }
  }
  return (
    <div className="page narrow">
      <div className="eyebrow">A SPACE OF YOUR OWN</div>
      <h1>你的空间，你的数据。</h1>
      <p className="page-intro">学习的积累，应该掌握在自己手里。</p>
      <section className="settings-section">
        <h2>外观</h2>
        <div className="setting-row">
          <div>
            <h3>{theme === 'dark' ? '深色模式' : '浅色模式'}</h3>
            <p>选择更适合此刻的学习环境。</p>
          </div>
          <button className="button" onClick={toggleTheme}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
            切换为{theme === 'dark' ? '浅色' : '深色'}
          </button>
        </div>
      </section>
      <section className="settings-section">
        <h2>备份与恢复</h2>
        <p>
          数据自动保存在当前浏览器中，刷新页面不会丢失。更换浏览器或网址、清除站点数据后，需要通过备份恢复。
        </p>
        <div className="backup-summary">
          <span>{data.courses.length} 门课程</span>
          <span>{data.nodes.filter((n) => n.kind === 'topic').length} 个知识点</span>
          <span>{data.events.length} 条学习记录</span>
        </div>
        <div className="button-group">
          <button
            className="button primary"
            onClick={() =>
              download(
                `learnflow-backup-${new Date().toISOString().slice(0, 10)}.json`,
                JSON.stringify(data, null, 2),
              )
            }
          >
            <Icon name="download" size={16} />
            导出学习数据
          </button>
          <button className="button" onClick={() => file.current?.click()}>
            <Icon name="upload" size={16} />
            导入备份
          </button>
          <input
            hidden
            ref={file}
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              void restore(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
        {message && (
          <p role="status" className={error ? 'error-message' : 'success'}>
            {message}
          </p>
        )}
        <p className="muted">
          JSON 备份包含课程、笔记、题库、资料提取文本、知识点、关系与全部学习记录，不包含 IndexedDB
          中的原文件。原文件请在资料详情中单独下载。请在清理浏览器前备份。
        </p>
      </section>
      <section className="settings-section">
        <h2>关于 LearnFlow</h2>
        <p>一个围绕理解、主动回忆和复习的大学生学习空间。</p>
        <p>当前版本：0.1.0 · 数据存储：本地浏览器 · 练习：MockQuestionProvider</p>
        <p className="muted">
          本版不需要账号，不联网生成题目。没有云同步，导入的文本以纯文本显示。公式支持直接编辑文本，暂不进行
          LaTeX 排版。
        </p>
      </section>
      <section className="settings-section">
        <h2>重新开始</h2>
        <div className="setting-row">
          <p>清空所有课程、资料与学习记录。此操作不能撤销。</p>
          <button
            className="button danger"
            onClick={() => {
              if (confirm('确定清空全部数据？请先导出备份。此操作不可撤销。')) replace(emptyData());
            }}
          >
            清空数据
          </button>
        </div>
      </section>
    </div>
  );
}
