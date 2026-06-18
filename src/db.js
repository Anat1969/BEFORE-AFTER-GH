const DB_NAME = "before-after-db";
const STORE_NAME = "projects";
const DB_VERSION = 1;
const LS_KEY = "before-after-projects";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet() {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).get("all");
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      })
  );
}

function idbPut(data) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(data, "all");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      })
  );
}

function lsGet() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.projects)) return parsed.projects;
    return null;
  } catch {
    return null;
  }
}

function lsPut(data) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export async function loadProjects() {
  // 1) Try IndexedDB
  try {
    const data = await idbGet();
    if (data && Array.isArray(data) && data.length > 0) {
      return data;
    }
  } catch (e) {
    console.warn("IndexedDB load failed:", e);
  }

  // 2) Try localStorage
  const lsData = lsGet();
  if (lsData && lsData.length > 0) {
    // migrate to IndexedDB for next time
    try { await idbPut(lsData); } catch {}
    return lsData;
  }

  return [];
}

export async function saveProjects(projects) {
  let saved = false;

  // 1) Try IndexedDB
  try {
    await idbPut(projects);
    saved = true;
  } catch (e) {
    console.warn("IndexedDB save failed:", e);
  }

  // 2) Always also try localStorage as backup
  const lsOk = lsPut(projects);
  if (!saved) saved = lsOk;

  return saved;
}
