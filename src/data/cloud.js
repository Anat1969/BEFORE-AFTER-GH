// סנכרון ענן דרך Supabase. הפורמט נשמר כמו בגרסה הקודמת (שורה "all" עם מערך פרויקטים),
// כדי שמכשירים עם גרסה ישנה במטמון ימשיכו לקרוא ולכתוב בלי לשבור.
// מחיקות נשמרות בשורה נפרדת "deleted", כך שפרויקט שנמחק במכשיר אחד לא חוזר ממכשיר אחר.
const SUPABASE_URL = "https://slcpldoaaagkoozpbjsk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsY3BsZG9hYWFna29venBianNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3OTM0MjEsImV4cCI6MjA5NDM2OTQyMX0.g0iLhliFQNlD3Ey_mrvwMolppj-nV24Pj9klrFtsLWo";
const TABLE = "before_after_projects";
const ROW_ID = "all";
const DELETED_ROW = "deleted";

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

async function readRow(id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${id}&select=data`, { headers });
  if (!res.ok) throw new Error("קריאה מהענן נכשלה (" + res.status + ")");
  const rows = await res.json();
  return rows[0]?.data ?? null;
}

async function writeRow(id, data) {
  const body = JSON.stringify({ id, data, updated_at: new Date().toISOString() });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${id}&select=id`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=representation" },
    body,
  });
  if (!res.ok) throw new Error("כתיבה לענן נכשלה (" + res.status + ")");
  const rows = await res.json();
  if (rows.length) return;
  const ins = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, { method: "POST", headers, body });
  if (!ins.ok) throw new Error("יצירת רשומה בענן נכשלה (" + ins.status + ")");
}

export async function cloudPull() {
  const [projects, deleted] = await Promise.all([
    readRow(ROW_ID),
    readRow(DELETED_ROW).catch(() => null),
  ]);
  return { projects: Array.isArray(projects) ? projects : [], deleted: Array.isArray(deleted) ? deleted : [] };
}

export async function cloudPush(projects, deleted) {
  await writeRow(ROW_ID, projects);
  if (deleted?.length) {
    try { await writeRow(DELETED_ROW, deleted.slice(-500)); } catch (e) { console.warn("Tombstones push failed:", e); }
  }
}

// מיזוג לפי פרויקט: הגרסה שעודכנה אחרונה מנצחת; בתיקו (נתונים ישנים בלי חותמת זמן) המקומית מנצחת.
// פרויקט שנמצא ברשימת המחיקות לא חוזר.
export function mergeProjects(local, remote, deleted = []) {
  const gone = new Set(deleted);
  const map = new Map();
  for (const p of remote) if (!gone.has(p.id)) map.set(p.id, p);
  for (const p of local) {
    if (gone.has(p.id)) continue;
    const r = map.get(p.id);
    if (!r || (p.updatedAt || 0) >= (r.updatedAt || 0)) map.set(p.id, p);
  }
  return Array.from(map.values()).sort((a, b) => b.id - a.id);
}

export const sameContent = (a, b) =>
  a.length === b.length && a.every((p, i) => p.id === b[i].id && (p.updatedAt || 0) === (b[i].updatedAt || 0));
