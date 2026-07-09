// On-device storage. Every bit of app data lives in the phone's IndexedDB —
// there is no server. Mirrors the old SQLite tables as object stores so the
// api.js layer can read/write locally with the same shapes the pages expect.

const DB_NAME = 'fitness';
const DB_VERSION = 1;

// store name -> { keyPath, autoIncrement?, indexes? }
const STORES = {
  account:      { keyPath: 'id' },                                              // single record, id = 1
  plan_day:     { keyPath: 'id', autoIncrement: true, indexes: { week: 'week' } },
  exercise:     { keyPath: 'id', autoIncrement: true, indexes: { plan_day_id: 'plan_day_id' } },
  exercise_log: { keyPath: 'key', indexes: { exercise_id: 'exercise_id', date: 'date' } }, // key = `${date}|${exercise_id}`
  daily_log:    { keyPath: 'date' },
  body_entry:   { keyPath: 'id', autoIncrement: true, indexes: { date: 'date' } },
  meal:         { keyPath: 'id', autoIncrement: true, indexes: { date: 'date' } },
  photo:        { keyPath: 'id', autoIncrement: true, indexes: { date: 'date' } },
};

let _db = null;

export function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const [name, cfg] of Object.entries(STORES)) {
        if (db.objectStoreNames.contains(name)) continue;
        const store = db.createObjectStore(name, {
          keyPath: cfg.keyPath,
          autoIncrement: !!cfg.autoIncrement,
        });
        for (const [idx, keyPath] of Object.entries(cfg.indexes || {})) {
          store.createIndex(idx, keyPath);
        }
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

const reqP = (request) =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const txDone = (tx) =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

export async function get(store, key) {
  const db = await openDB();
  return reqP(db.transaction(store).objectStore(store).get(key));
}

export async function getAll(store) {
  const db = await openDB();
  return reqP(db.transaction(store).objectStore(store).getAll());
}

export async function getAllByIndex(store, index, value) {
  const db = await openDB();
  return reqP(db.transaction(store).objectStore(store).index(index).getAll(value));
}

export async function put(store, value) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  const key = await reqP(tx.objectStore(store).put(value));
  await txDone(tx);
  return key;
}

export async function add(store, value) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  const key = await reqP(tx.objectStore(store).add(value));
  await txDone(tx);
  return key;
}

export async function del(store, key) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  await reqP(tx.objectStore(store).delete(key));
  await txDone(tx);
}

export async function clear(store) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  await reqP(tx.objectStore(store).clear());
  await txDone(tx);
}
