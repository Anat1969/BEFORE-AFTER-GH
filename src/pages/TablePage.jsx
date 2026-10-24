import { Fragment, useMemo, useState } from "react";
import { ConfirmButton, Empty } from "../components/ui.jsx";
import { STATUSES, statusLabel, updateProject, updateUpgrade, moveUpgrade, formatDate } from "../data/model.js";
import { go } from "../lib/router.js";

const COLS = [
  { key: "subject", label: "פרויקט" },
  { key: "contact", label: "איש קשר" },
  { key: "status", label: "שלב" },
  { key: "upgradeTitle", label: "שידרוג" },
  { key: "altLabel", label: "חלופה" },
  { key: "chosen", label: "נבחרה" },
];

function toRows(projects) {
  const rows = [];
  for (const p of projects) {
    const base = { p, projectId: p.id, subject: p.subject, contact: p.contact, status: statusLabel(p.status), date: formatDate(p) };
    if (!p.upgrades.length) rows.push({ ...base, upgradeTitle: "", altLabel: "", ui: -1, ai: -1 });
    p.upgrades.forEach((u, ui) => {
      if (!u.alternatives.length) rows.push({ ...base, u, upgradeTitle: u.title, altLabel: "", ui, ai: -1, thumb: u.beforeSrc });
      u.alternatives.forEach((a, ai) =>
        rows.push({ ...base, u, a, upgradeTitle: u.title, altLabel: a.label, ui, ai, thumb: a.afterSrc, chosen: u.chosenAltId === a.id ? "כן" : "" })
      );
    });
  }
  return rows;
}

const csvCell = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';

// טבלת אנשי קשר ופרויקטים: מיון בכל עמודה, קיבוץ לפי פרויקט, חיפוש, ייצוא, ועריכה במקום במצב עריכה.
export default function TablePage({ projects, editing, commit }) {
  const [sortKey, setSortKey] = useState("subject");
  const [dir, setDir] = useState(1);
  const [q, setQ] = useState("");
  const [collapsed, setCollapsed] = useState({});

  const all = useMemo(() => toRows(projects), [projects]);
  const rows = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const f = words.length ? all.filter((r) => words.every((w) => [r.subject, r.contact, r.upgradeTitle, r.altLabel, r.status].join(" ").toLowerCase().includes(w))) : all;
    return [...f].sort((a, b) => dir * String(a[sortKey] || "").localeCompare(String(b[sortKey] || ""), "he"));
  }, [all, q, sortKey, dir]);

  const groups = useMemo(() => {
    const m = new Map();
    for (const r of rows) {
      if (!m.has(r.projectId)) m.set(r.projectId, []);
      m.get(r.projectId).push(r);
    }
    return [...m.entries()];
  }, [rows]);

  const sortBy = (k) => { if (k === sortKey) setDir((d) => -d); else { setSortKey(k); setDir(1); } };

  const exportCsv = () => {
    const head = ["פרויקט", "איש קשר", "שלב", "תאריך", "שידרוג", "חלופה", "נבחרה", "דרישה"];
    const lines = all.map((r) => [r.subject, r.contact, r.status, r.date, r.upgradeTitle, r.altLabel, r.chosen, r.p.requirement].map(csvCell).join(","));
    const blob = new Blob(["﻿" + [head.map(csvCell).join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "שידרוגים-טבלה.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const delRow = (r) =>
    r.a
      ? commit((l) => updateUpgrade(l, r.projectId, r.u.id, (u) => ({ ...u, alternatives: u.alternatives.filter((x) => x.id !== r.a.id), chosenAltId: u.chosenAltId === r.a.id ? null : u.chosenAltId })))
      : r.u
        ? commit((l) => updateProject(l, r.projectId, (p) => ({ ...p, upgrades: p.upgrades.filter((x) => x.id !== r.u.id) })))
        : commit((l) => l.filter((p) => p.id !== r.projectId), { deletedIds: [r.projectId] });

  if (!projects.length) return <Empty title="אין עדיין רשומות" text="הטבלה נבנית אוטומטית מהפרויקטים בספריה." action={<button className="btn" onClick={() => go("library")}>לספריה</button>} />;

  const ncol = COLS.length + 1 + (editing ? 1 : 0);

  return (
    <div className="table-page">
      <header className="form-head">
        <h1>אנשי קשר ופרויקטים</h1>
        <p className="muted">
          כל חלופה בשורה משלה, מקובצת לפי פרויקט. לחיצה על כותרת ממיינת, לחיצה על תא פותחת את התצוגה.
          {editing ? " במצב עריכה: שינוי הפרויקט בעמודה הראשונה מעביר את השידרוג, וכל שדה נשמר ביציאה ממנו." : ""}
        </p>
      </header>

      <div className="toolbar panel">
        <label className="search">
          <span className="label">חיפוש</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="פרויקט, איש קשר, שידרוג, חלופה או שלב" />
        </label>
        <span className="label">{rows.length === all.length ? all.length + " שורות" : rows.length + " מתוך " + all.length}</span>
        <button className="btn btn-sm" onClick={() => setCollapsed(Object.fromEntries(groups.map(([id]) => [id, !Object.values(collapsed).some(Boolean)])))}>
          {Object.values(collapsed).some(Boolean) ? "פתיחת כל הקבוצות" : "כיווץ כל הקבוצות"}
        </button>
        <button className="btn btn-sm" onClick={exportCsv} title="קובץ שנפתח ב-Excel">ייצוא ל-Excel</button>
      </div>

      {!rows.length ? (
        <Empty title={'לא נמצאו תוצאות עבור "' + q + '"'} action={<button className="btn" onClick={() => setQ("")}>ניקוי חיפוש</button>} />
      ) : (
        <div className="table-scroll panel">
          <table className="tbl">
            <thead>
              <tr>
                <th className="th-img"><span className="label">תמונה</span></th>
                {COLS.map((c) => (
                  <th key={c.key} aria-sort={sortKey === c.key ? (dir > 0 ? "ascending" : "descending") : "none"}>
                    <button className="th-btn" onClick={() => sortBy(c.key)}>
                      {c.label}
                      <span className="sort-mark" aria-hidden="true">{sortKey === c.key ? (dir > 0 ? "↑" : "↓") : "↕"}</span>
                    </button>
                  </th>
                ))}
                {editing && <th><span className="label">פעולות</span></th>}
              </tr>
            </thead>
            <tbody>
              {groups.map(([pid, grs]) => {
                const p = grs[0].p;
                const closed = collapsed[pid];
                return (
                  <Fragment key={pid}>
                    <tr className="grp">
                      <td colSpan={ncol}>
                        <button className="grp-btn" aria-expanded={!closed} onClick={() => setCollapsed((c) => ({ ...c, [pid]: !c[pid] }))}>
                          <span className={"caret" + (closed ? " closed" : "")} aria-hidden="true" />
                          <strong>{p.subject}</strong>
                          <span className="label">{grs.length} שורות · {statusLabel(p.status)}</span>
                        </button>
                      </td>
                    </tr>
                    {!closed &&
                      grs.map((r) => (
                        <tr key={pid + "-" + (r.u?.id || 0) + "-" + (r.a?.id || 0)}>
                          <td className="td-img">
                            {r.thumb ? (
                              <button className="thumb-btn" onClick={() => go(`project/${pid}/${Math.max(0, r.ui)}/${Math.max(0, r.ai)}`)} aria-label="פתיחה">
                                <img src={r.thumb} alt="" loading="lazy" />
                              </button>
                            ) : <span className="muted">—</span>}
                          </td>
                          <td>
                            {editing && r.u ? (
                              <select className="cell-input" value={pid} aria-label="העברה לפרויקט" onChange={(e) => commit((l) => moveUpgrade(l, r.u.id, Number(pid), Number(e.target.value)))}>
                                {projects.map((x) => <option key={x.id} value={x.id}>{x.subject}</option>)}
                              </select>
                            ) : (
                              <button className="cell-link" onClick={() => go("project/" + pid)}>{r.subject}</button>
                            )}
                          </td>
                          <td>
                            {editing ? (
                              <input className="cell-input" defaultValue={r.contact} key={r.contact} placeholder="איש קשר" aria-label="איש קשר"
                                onBlur={(e) => e.target.value !== r.contact && commit((l) => updateProject(l, Number(pid),(x) => ({ ...x, contact: e.target.value.trim() })))} />
                            ) : r.contact || <span className="muted">—</span>}
                          </td>
                          <td>
                            {editing ? (
                              <select className="cell-input" value={p.status} aria-label="שלב" onChange={(e) => commit((l) => updateProject(l, Number(pid), (x) => ({ ...x, status: e.target.value })))}>
                                {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                              </select>
                            ) : <span className={"status st-" + p.status}>{r.status}</span>}
                          </td>
                          <td>
                            {editing && r.u ? (
                              <input className="cell-input" defaultValue={r.upgradeTitle} key={r.upgradeTitle} aria-label="שידרוג"
                                onBlur={(e) => e.target.value.trim() && e.target.value !== r.upgradeTitle && commit((l) => updateUpgrade(l, Number(pid), r.u.id, (u) => ({ ...u, title: e.target.value.trim() })))} />
                            ) : r.u ? <button className="cell-link" onClick={() => go(`project/${pid}/${r.ui}/0`)}>{r.upgradeTitle}</button> : <span className="muted">—</span>}
                          </td>
                          <td>
                            {editing && r.a ? (
                              <input className="cell-input" defaultValue={r.altLabel} key={r.altLabel} aria-label="חלופה"
                                onBlur={(e) => e.target.value.trim() && e.target.value !== r.altLabel && commit((l) => updateUpgrade(l, Number(pid), r.u.id, (u) => ({ ...u, alternatives: u.alternatives.map((a) => (a.id === r.a.id ? { ...a, label: e.target.value.trim() } : a)) })))} />
                            ) : r.a ? <button className="cell-link" onClick={() => go(`project/${pid}/${r.ui}/${r.ai}`)}>{r.altLabel}</button> : <span className="muted">—</span>}
                          </td>
                          <td>
                            {r.a ? (
                              editing ? (
                                <button className={"chip chip-sm" + (r.chosen ? " on" : "")} aria-pressed={!!r.chosen}
                                  onClick={() => commit((l) => updateUpgrade(l, Number(pid), r.u.id, (u) => ({ ...u, chosenAltId: u.chosenAltId === r.a.id ? null : r.a.id })))}>
                                  {r.chosen ? "נבחרה" : "בחירה"}
                                </button>
                              ) : r.chosen ? <span className="pill ok">נבחרה</span> : ""
                            ) : ""}
                          </td>
                          {editing && (
                            <td>
                              <ConfirmButton className="btn btn-sm btn-danger" confirmText="לאשר?" onConfirm={() => delRow(r)}>
                                {r.a ? "מחיקת חלופה" : r.u ? "מחיקת שידרוג" : "מחיקת פרויקט"}
                              </ConfirmButton>
                            </td>
                          )}
                        </tr>
                      ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
