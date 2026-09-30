import { useEffect, useRef, useState } from 'react';
import { emptyData, type AppData } from '../domain/model';
import { validateData } from '../domain/validation';
import { migrateKnowledgeData } from '../domain/courseKnowledge';
import { materialFiles } from './materialFiles';
export const storageKey = () =>
  `learnflow:v1:${window.location.pathname.replace(/index\.html$/, '')}`;
export interface DataRepository {
  load(): AppData | null;
  save(data: AppData): void;
}
export class LocalRepository implements DataRepository {
  load() {
    const raw = localStorage.getItem(storageKey());
    return raw === null ? null : migrateKnowledgeData(validateData(JSON.parse(raw)));
  }
  save(data: AppData) {
    localStorage.setItem(storageKey(), JSON.stringify(data));
  }
}
export function download(name: string, value: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function useData() {
  const repository = useRef(new LocalRepository());
  const [initial] = useState(() => {
    try {
      const stored = repository.current.load();
      const data = stored ?? migrateKnowledgeData(emptyData());
      if (!stored) repository.current.save(data);
      return { data, error: '' };
    } catch {
      return {
        data: null,
        error: '无法读取本地数据。原始数据仍保留，请先下载备份，再导入有效备份或重置。',
      };
    }
  });
  const [data, setData] = useState(initial.data);
  const current = useRef(data);
  const [error, setError] = useState(initial.error);
  const [savedAt, setSavedAt] = useState('');
  function cleanRemovedFiles(previous: AppData | null, next: AppData) {
    const removed =
      previous?.resources.filter((r) => r.file && !next.resources.some((n) => n.id === r.id)) ?? [];
    if (removed.length)
      void Promise.all(removed.map((resource) => materialFiles.remove(resource.id))).catch(() =>
        setError('学习数据已保存，但被删除资料的原文件清理失败，请检查浏览器存储权限。'),
      );
  }
  function update(transform: (d: AppData) => AppData): boolean {
    try {
      if (!current.current) throw new Error('请先恢复本地数据。');
      const latest = repository.current.load();
      if (latest && latest.revision !== current.current.revision) {
        current.current = latest;
        setData(latest);
        throw new Error('另一个标签页更新了数据，已载入最新内容，请重新执行本次编辑。');
      }
      const next = migrateKnowledgeData({
        ...transform(current.current),
        revision: current.current.revision + 1,
      });
      repository.current.save(next);
      cleanRemovedFiles(current.current, next);
      current.current = next;
      setData(next);
      setError('');
      setSavedAt(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败，请导出备份后重试。');
      return false;
    }
  }
  function replace(next: AppData) {
    try {
      validateData(next);
      next = migrateKnowledgeData({ ...next, revision: (current.current?.revision ?? 0) + 1 });
      repository.current.save(next);
      cleanRemovedFiles(current.current, next);
      current.current = next;
      setData(next);
      setError('');
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
      return false;
    }
  }
  useEffect(() => {
    const listener = (e: StorageEvent) => {
      if (e.key !== storageKey()) return;
      try {
        const next = repository.current.load();
        if (next) {
          current.current = next;
          setData(next);
          setError('');
        } else setError('另一个标签页移除了数据，请导出当前备份。');
      } catch {
        setError('另一个标签页写入了无效数据，请先导出当前备份。');
      }
    };
    window.addEventListener('storage', listener);
    return () => window.removeEventListener('storage', listener);
  }, []);
  return { data, update, replace, error, setError, savedAt };
}
export type Update = (transform: (data: AppData) => AppData) => boolean;
