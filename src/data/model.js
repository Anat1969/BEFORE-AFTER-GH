// מודל הנתונים: מקור אחד לכל התצוגות. כל פונקציה כאן טהורה ומחזירה מערך חדש.

export const STATUSES = [
  { key: "idea", label: "רעיון" },
  { key: "design", label: "בתכנון" },
  { key: "work", label: "בביצוע" },
  { key: "done", label: "הושלם" },
];

export const statusLabel = (key) => (STATUSES.find((s) => s.key === key) || STATUSES[1]).label;

let lastId = 0;
// מזהה מספרי ייחודי גם כשיוצרים כמה פריטים באותה מילישנייה
export function newId() {
  let id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  if (id <= lastId) id = lastId + 1;
  lastId = id;
  return id;
}

export const emptyUpgrade = () => ({ id: newId(), title: "", beforeSrc: null, alternatives: [], chosenAltId: null });

export function normalizeProject(p) {
  return {
    ...p,
    subject: p.subject || "",
    requirement: p.requirement || "",
    contact: p.contact || "",
    status: p.status || "design",
    upgrades: (p.upgrades || []).map((u, i) => ({
      ...u,
      title: u.title || "שידרוג " + (i + 1),
      alternatives: (u.alternatives || []).map((a, j) => ({ ...a, label: a.label || "חלופה " + (j + 1) })),
      chosenAltId: u.chosenAltId ?? null,
    })),
    updatedAt: p.updatedAt || 0,
  };
}

export const touch = (p) => ({ ...p, updatedAt: Date.now() });

export function updateProject(projects, id, fn) {
  return projects.map((p) => (p.id === id ? touch(fn(p)) : p));
}

export function updateUpgrade(projects, projId, upgId, fn) {
  return updateProject(projects, projId, (p) => ({
    ...p,
    upgrades: p.upgrades.map((u) => (u.id === upgId ? fn(u) : u)),
  }));
}

export function moveUpgrade(projects, upgId, fromId, toId) {
  const from = projects.find((p) => p.id === fromId);
  const upg = from?.upgrades.find((u) => u.id === upgId);
  if (!upg || fromId === toId) return projects;
  return projects.map((p) => {
    if (p.id === fromId) return touch({ ...p, upgrades: p.upgrades.filter((u) => u.id !== upgId) });
    if (p.id === toId) return touch({ ...p, upgrades: [...p.upgrades, upg] });
    return p;
  });
}

export function projectStats(p) {
  const alts = p.upgrades.reduce((s, u) => s + u.alternatives.length, 0);
  const chosen = p.upgrades.filter((u) => u.chosenAltId).length;
  return { upgrades: p.upgrades.length, alts, chosen };
}

export function totals(projects) {
  const contacts = new Set(projects.map((p) => p.contact.trim()).filter(Boolean));
  let upgrades = 0, alts = 0, images = 0, chosen = 0;
  for (const p of projects) {
    for (const u of p.upgrades) {
      upgrades++;
      alts += u.alternatives.length;
      images += (u.beforeSrc ? 1 : 0) + u.alternatives.filter((a) => a.afterSrc).length;
      if (u.chosenAltId) chosen++;
    }
  }
  return { projects: projects.length, upgrades, alts, images, chosen, contacts: contacts.size };
}

// תמונת השער של פרויקט: החלופה הנבחרת אם יש, אחרת הראשונה
export function coverOf(p) {
  const u = p.upgrades.find((x) => x.beforeSrc && x.alternatives.length) || p.upgrades[0];
  if (!u) return { before: null, after: null };
  const alt = u.alternatives.find((a) => a.id === u.chosenAltId) || u.alternatives[0];
  return { before: u.beforeSrc, after: alt?.afterSrc || null };
}

export function matches(p, q) {
  if (!q) return true;
  const hay = [p.subject, p.requirement, p.contact, ...p.upgrades.flatMap((u) => [u.title, ...u.alternatives.map((a) => a.label)])]
    .join(" ")
    .toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

export function formatDate(p) {
  if (p.date) return p.date;
  return new Date(Math.floor(p.id / 1000) > 1e12 ? Math.floor(p.id / 1000) : p.id).toLocaleDateString("he-IL");
}
