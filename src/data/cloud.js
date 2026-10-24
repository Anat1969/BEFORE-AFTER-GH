// סנכרון ענן דרך Supabase. הפורמט נשמר כמו בגרסה הקודמת (שורה "all" עם מערך פרויקטים),
// כדי שמכשירים עם גרסה ישנה במטמון ימשיכו לקרוא ולכתוב בלי לשבור.
// מחיקות נשמרות בשורה נפרדת "deleted", כך שפרויקט שנמחק במכשיר אחד לא חוזר ממכשיר אחר.
// פרויקט cultura-GH: כאן נמצאים 17 הפרויקטים ו-50 התמונות (הפרויקט הקודם slcpldoaaagkoozpbjsk כבר לא בחשבון)
const SUPABASE_URL = "https://ktqmwpbzcnzkhjskqisy.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0cW13cGJ6Y256a2hqc2txaXN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxODM4OTgsImV4cCI6MjEwNTc1OTg5OH0.uPKn4hrLk16jhDoajMjPl4OmV5j1b3bMIECVmOdhWGI";
const TABLE = "before_after_projects";
const ROW_ID = "all";
const DELETED_ROW = "deleted";

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

// בדיקה קלה: רק חותמת הזמן של השורה, בלי הנתונים (שכוללים את כל התמונות)
async function rowStamp(id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${id}&select=updated_at`, { headers });
  if (!res.ok) throw new Error("קריאה מהענן נכשלה (" + res.status + ")");
  const rows = await res.json();
  return rows[0]?.updated_at ?? null;
}

async function readRow(id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${id}&select=data`, { headers });
  if (!res.ok) throw new Error("קריאה מהענן נכשלה (" + res.status + ")");
  const rows = await res.json();
  return rows[0]?.data ?? null;
}

async function writeRow(id, data) {
  const body = JSON.stringify({ id, data, updated_at: new Date().toISOString() });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${id}&select=id,updated_at`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=representation" },
    body,
  });
  if (!res.ok) throw new Error("כתיבה לענן נכשלה (" + res.status + ")");
  const rows = await res.json();
  if (rows.length) return rows[0].updated_at;
  const ins = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?select=updated_at`, { method: "POST", headers: { ...headers, Prefer: "return=representation" }, body });
  if (!ins.ok) throw new Error("יצירת רשומה בענן נכשלה (" + ins.status + ")");
  return (await ins.json())[0]?.updated_at ?? null;
}

// knownAt: חותמת הזמן של הגרסה שכבר יש במכשיר. אם לא השתנתה, לא מורידים שוב את כל התמונות.
export async function cloudPull(knownAt) {
  const [at, deleted] = await Promise.all([rowStamp(ROW_ID), readRow(DELETED_ROW).catch(() => null)]);
  const del = Array.isArray(deleted) ? deleted : [];
  if (knownAt && at === knownAt) return { unchanged: true, at, deleted: del };
  const projects = await readRow(ROW_ID);
  return { projects: Array.isArray(projects) ? projects : [], deleted: del, at };
}

export async function cloudPush(projects, deleted) {
  const at = await writeRow(ROW_ID, projects);
  if (deleted?.length) {
    try { await writeRow(DELETED_ROW, deleted.slice(-500)); } catch (e) { console.warn("Tombstones push failed:", e); }
  }
  return at;
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
