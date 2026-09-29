import { useEffect, useRef, useState } from 'react';
import { emptyData, type KnowledgeNode } from './domain/model';
import { isDue, record } from './domain/logic';
import { validateData } from './domain/validation';
import { download, storageKey, useData } from './services/storage';
import type { QuestionProvider } from './services/questions';
import { Dashboard } from './pages/Dashboard';
import { Workspace } from './pages/Workspace';
import { Review } from './pages/Review';
import { Stats } from './pages/Stats';
import { Settings } from './pages/Settings';
import { Icon } from './components/Icons';
import { Empty } from './components/Modal';
export default function App({ questionProvider }: { questionProvider: QuestionProvider }) {
  const { data, update, replace, error, setError, savedAt } = useData();
  const [path, setPath] = useState(location.hash.slice(1) || '/');
  const lastOpenedPath = useRef('');
  const [theme, setTheme] = useState(() => {
    try {
      return (
        localStorage.getItem('learnflow:theme') ||
        (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      );
    } catch {
      return 'light';
    }
  });
  useEffect(() => {
    const listener = () => {
      setPath(location.hash.slice(1) || '/');
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', listener);
    return () => window.removeEventListener('hashchange', listener);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('learnflow:theme', theme);
    } catch {
      /* Theme preference does not affect learning data. */
    }
  }, [theme]);
  useEffect(() => {
    if (!data || lastOpenedPath.current === path) return;
    lastOpenedPath.current = path;
    const route = path.split('/');
    const node = data.nodes.find(
      (n) => route[1] === 'course' && n.courseId === route[2] && n.id === route[3],
    );
    if (node?.kind === 'topic') update((d) => record(d, node.id, 'open'));
  }, [path, data]);
  const navigate = (next: string) => {
    location.hash = next;
  };
  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  function go(node: KnowledgeNode) {
    navigate(`/course/${node.courseId}/${node.id}`);
  }
  if (!data)
    return (
      <div className="recovery">
        <h1>找回你的学习空间</h1>
        <p role="alert">{error}</p>
        <div className="button-group">
          <button
            className="button"
            onClick={() => {
              try {
                download('learnflow-recovery.json', localStorage.getItem(storageKey()) ?? '{}');
              } catch {
                setError('浏览器禁止读取存储，请检查浏览器隐私设置。');
              }
            }}
          >
            下载原始数据
          </button>
          <label className="button">
            导入有效备份
            <input
              type="file"
              hidden
              accept=".json"
              onChange={async (e) => {
                try {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 8 * 1024 * 1024) throw new Error('备份不能超过 8 MB');
                  replace(validateData(JSON.parse(await f.text())));
                } catch {
                  setError('备份无效，请选择有效的 LearnFlow JSON 文件。');
                }
              }}
            />
          </label>
          <button
            className="button danger"
            onClick={() => {
              if (confirm('重置会覆盖无法读取的原始数据，请先下载。继续？')) replace(emptyData());
            }}
          >
            重置为空白空间
          </button>
        </div>
      </div>
    );
  const parts = path.split('/');
  const course = parts[1] === 'course' ? data.courses.find((c) => c.id === parts[2]) : undefined;
  const reviewCount = data.nodes.filter(isDue).length;
  return (
    <div className="app-shell">
      <a
        href="#main-content"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        跳转到主要内容
      </a>
      <aside className="app-sidebar">
        <a className="brand" href="#/">
          <span className="brand-mark">
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <path
                d="M7 6v21h20M15 6v13h12"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span>
            LearnFlow<small>让学习，流动起来</small>
          </span>
        </a>
        <div className="sidebar-label">我的学习空间</div>
        <nav className="main-nav" aria-label="主导航">
          {[
            ['/', 'home', '我的课程'],
            ['/review', 'review', '复习计划'],
            ['/stats', 'chart', '学习统计'],
          ].map(([url, icon, name]) => (
            <a
              href={`#${url}`}
              key={url}
              className={path === url ? 'active' : ''}
              aria-current={path === url ? 'page' : undefined}
            >
              <Icon name={icon} />
              <span>{name}</span>
              {url === '/review' && reviewCount > 0 && <b>{reviewCount}</b>}
            </a>
          ))}
        </nav>
        <div className="sidebar-label course-label">
          课程 <span>{data.courses.length}</span>
        </div>
        <nav className="sidebar-courses" aria-label="课程导航">
          {data.courses.map((c) => (
            <a href={`#/course/${c.id}`} className={course?.id === c.id ? 'active' : ''} key={c.id}>
              <span className="course-dot" style={{ background: c.color }} />
              <span>{c.title}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-quote">
            <Icon name="spark" size={19} />
            <p>
              不必一次掌握所有。
              <br />
              今天，理解多一点。
            </p>
          </div>
          <a href="#/settings" className={path === '/settings' ? 'active' : ''}>
            <Icon name="settings" size={18} />
            <span>设置与数据</span>
          </a>
          <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? '切换浅色模式' : '切换深色模式'}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
            <span>{theme === 'dark' ? '浅色模式' : '深色模式'}</span>
          </button>
          <div className="local-status">
            <span className="online-dot" />
            {error ? '保存遇到问题' : savedAt ? `${savedAt} 已保存到本地` : '数据保存在此浏览器'}
          </div>
        </div>
      </aside>
      <div className="app-content" id="main-content" tabIndex={-1}>
        {error && (
          <div className="error-banner" role="alert">
            <span>未能保存本次操作：{error}</span>
            <button
              className="button"
              onClick={() =>
                download('learnflow-unsaved-backup.json', JSON.stringify(data, null, 2))
              }
            >
              导出当前备份
            </button>
          </div>
        )}
        {course ? (
          <Workspace
            key={course.id}
            course={course}
            data={data}
            update={update}
            selectedId={parts[3]}
            go={go}
            navigate={navigate}
            provider={questionProvider}
          />
        ) : path === '/' ? (
          <Dashboard data={data} update={update} go={go} navigate={navigate} />
        ) : path === '/review' ? (
          <Review data={data} go={go} />
        ) : path === '/stats' ? (
          <Stats data={data} />
        ) : path === '/settings' ? (
          <Settings data={data} replace={replace} theme={theme} toggleTheme={toggleTheme} />
        ) : (
          <Empty title="这个页面暂时找不到了" text="课程可能已被删除，回到首页继续学习。">
            <button className="button primary" onClick={() => navigate('/')}>
              回到我的课程
            </button>
          </Empty>
        )}
      </div>
    </div>
  );
}
