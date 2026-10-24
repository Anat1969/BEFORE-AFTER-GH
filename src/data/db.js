// אחסון מקומי: IndexedDB ראשי, localStorage גיבוי, וצילומי מצב אוטומטיים לשחזור.
// שמות המאגר והמפתחות נשמרו מהגרסה הקודמת כדי שהנתונים הקיימים ייטענו כמו שהם.
const DB_NAME = "before-after-db";
const STORE_NAME = "projects";
const SNAP_STORE = "snapshots";
const DB_VERSION = 2;
const LS_KEY = "before-after-projects";
const LS_DELETED = "before-after-deleted";
const MAX_SNAPSHOTS = 8;
const SNAPSHOT_GAP = 10 * 60 * 1000;

let dbPromise = null;
function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      if (!db.objectStoreNames.contains(SNAP_STORE)) db.createObjectStore(SNAP_STORE, { keyPath: "at" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbPromise = null; reject(req.error); };
  });
  return dbPromise;
}

function tx(store, mode, fn) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, mode);
        const result = fn(t.objectStore(store));
        t.oncomplete = () => resolve(result instanceof IDBRequest ? result.result : result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error || new Error("IndexedDB aborted"));
      })
  );
}

function lsGet() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LS_KEY) || "null");
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.projects)) return parsed.projects;
  } catch { /* גיבוי פגום: נשענים על IndexedDB */ }
  return null;
}

export async function loadProjects() {
  try {
    const data = await tx(STORE_NAME, "readonly", (s) => s.get("all"));
    if (Array.isArray(data) && data.length > 0) return data;
  } catch (e) {
    console.warn("IndexedDB load failed:", e);
  }
  const ls = lsGet();
  if (ls && ls.length) {
    try { await tx(STORE_NAME, "readwrite", (s) => s.put(ls, "all")); } catch { /* ייכתב בשמירה הבאה */ }
    return ls;
  }
  return [];
}

// מחזיר { ok, error }. IndexedDB הוא המקור; localStorage עלול להתמלא מתמונות, וזה לא נחשב כישלון כשה-IDB הצליח.
export async function saveProjects(projects) {
  let idbOk = false, error = null;
  try {
    await tx(STORE_NAME, "readwrite", (s) => s.put(projects, "all"));
    idbOk = true;
  } catch (e) {
    error = e;
  }
  let lsOk = false;
  try { localStorage.setItem(LS_KEY, JSON.stringify(projects)); lsOk = true; } catch { /* מכסה מלאה */ }
  if (idbOk) maybeSnapshot(projects);
  return { ok: idbOk || lsOk, error: idbOk || lsOk ? null : error || new Error("אין מקום פנוי באחסון הדפדפן") };
}

let lastSnapAt = 0;
async function maybeSnapshot(projects) {
  if (!projects.length || Date.now() - lastSnapAt < SNAPSHOT_GAP) return;
  lastSnapAt = Date.now();
  try {
    await tx(SNAP_STORE, "readwrite", (s) => s.put({ at: lastSnapAt, projects }));
    const all = await listSnapshots();
    const extra = all.slice(MAX_SNAPSHOTS);
    if (extra.length) await tx(SNAP_STORE, "readwrite", (s) => extra.forEach((x) => s.delete(x.at)));
  } catch (e) {
    console.warn("Snapshot failed:", e);
  }
}

// צילומי מצב, מהחדש לישן, בלי התמונות עצמן (רק תקציר)
export async function listSnapshots() {
  const all = await tx(SNAP_STORE, "readonly", (s) => s.getAll());
  return (all || []).sort((a, b) => b.at - a.at);
}

// טיוטת פרויקט חדש נשמרת בכל הקלדה, כדי ששום תמונה לא תאבד לפני הלחיצה על "יצירה"
export const loadDraft = () => tx(STORE_NAME, "readonly", (s) => s.get("draft")).catch(() => null);
export const saveDraft = (d) => tx(STORE_NAME, "readwrite", (s) => (d ? s.put(d, "draft") : s.delete("draft")));

export function getDeleted() {
  try { return JSON.parse(localStorage.getItem(LS_DELETED) || "[]"); } catch { return []; }
}

export function setDeleted(ids) {
  try { localStorage.setItem(LS_DELETED, JSON.stringify(ids.slice(-500))); } catch { /* לא קריטי */ }
}
