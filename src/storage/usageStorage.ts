import type { UsageLog } from '../types/usage';
const DB = 'aircon-cost-tracker-ph';
const STORE = 'usage-logs';
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => { const db = request.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = action(tx.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => db.close();
  });
}
export const getLogs = () => transaction<UsageLog[]>('readonly', store => store.getAll());
export const putLog = (log: UsageLog) => transaction<IDBValidKey>('readwrite', store => store.put(log));
export const removeLog = (id: string) => transaction<undefined>('readwrite', store => store.delete(id));

// All-or-nothing import; a failed transaction leaves the existing database unchanged.
export async function importLogsAtomic(logs: UsageLog[], mode: 'merge' | 'replace'): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    if (mode === 'replace') store.clear();
    for (const log of logs) {
      if (mode === 'merge') store.add(log);
      else store.put(log);
    }
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Import failed')); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Import aborted')); };
  });
}
