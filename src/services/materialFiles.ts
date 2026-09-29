import { storageKey } from './storage';

export interface MaterialFileRepository {
  put(id: string, file: Blob): Promise<void>;
  get(id: string): Promise<Blob | undefined>;
  remove(id: string): Promise<void>;
}

/** Binary attachments are deliberately separate from localStorage/JSON backups. */
export class IndexedDBMaterialFiles implements MaterialFileRepository {
  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      let blocked = false;
      const request = indexedDB.open(`${storageKey()}:files`, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('files');
      request.onsuccess = () => {
        if (blocked) request.result.close();
        else {
          request.result.onversionchange = () => request.result.close();
          resolve(request.result);
        }
      };
      request.onerror = () => reject(new Error('无法打开本地文件存储，请检查浏览器存储权限。'));
      request.onblocked = () => {
        blocked = true;
        reject(new Error('文件存储被其他标签页占用，请关闭其他 LearnFlow 页面后重试。'));
      };
    });
  }
  private async transaction<T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('files', mode);
      const request = action(tx.objectStore('files'));
      tx.oncomplete = () => {
        db.close();
        resolve(request.result);
      };
      tx.onabort = tx.onerror = () => {
        db.close();
        reject(new Error('原文件保存失败，浏览器空间可能不足。请释放空间后重试。'));
      };
    });
  }
  async put(id: string, file: Blob) {
    await this.transaction('readwrite', (store) => store.put(file, id));
  }
  get(id: string) {
    return this.transaction<Blob | undefined>('readonly', (store) => store.get(id));
  }
  async remove(id: string) {
    await this.transaction('readwrite', (store) => store.delete(id));
  }
}
export const materialFiles: MaterialFileRepository = new IndexedDBMaterialFiles();
