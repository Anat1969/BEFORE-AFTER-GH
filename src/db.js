const DB_NAME = "before-after-db";
const STORE_NAME = "projects";
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadProjects() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get("all");
      req.onsuccess = () => {
        if (req.result) {
          resolve(req.result);
          return;
        }
        try {
          const raw = localStorage.getItem("before-after-projects");
          if (raw) {
            const parsed = JSON.parse(raw);
            const migrated = Array.isArray(parsed) ? parsed : parsed.projects || [];
            if (migrated.length) {
              saveProjects(migrated);
              localStorage.removeItem("before-after-projects");
            }
            resolve(migrated);
            return;
          }
        } catch {}
        resolve([]);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function saveProjects(projects) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(projects, "all");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("Failed to save to IndexedDB:", e);
  }
}
