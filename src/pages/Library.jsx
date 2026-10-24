import { useMemo, useState } from "react";
import { Empty } from "../components/ui.jsx";
import { CompareThumb } from "../components/Compare.jsx";
import { STATUSES, coverOf, projectStats, statusLabel, matches, formatDate, createdTime } from "../data/model.js";
import { go } from "../lib/router.js";
import { shareProject } from "../lib/share.js";

const SORTS = [
  { key: "new", label: "חדש קודם", fn: (a, b) => createdTime(b) - createdTime(a) },
  { key: "old", label: "ישן קודם", fn: (a, b) => createdTime(a) - createdTime(b) },
  { key: "name", label: "לפי שם", fn: (a, b) => a.subject.localeCompare(b.subject, "he") },
  { key: "updated", label: "עודכן לאחרונה", fn: (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0) },
];

export default function Library({ projects, route, editing, flash }) {
  const [q, setQ] = useState(route.q.q || "");
  const [sort, setSort] = useState("new");
  const [open, setOpen] = useState(null);
  const status = route.q.status || "";

  const list = useMemo(
    () => projects.filter((p) => (!status || p.status === status) && matches(p, q)).sort(SORTS.find((s) => s.key === sort).fn),
    [projects, status, q, sort]
  );

  const setStatus = (s) => go("library" + (s ? "?status=" + s : ""), { replace: true });

  if (!projects.length)
    return (
      <Empty
        title="הספריה ריקה"
        text={editing ? "מתחילים בפרויקט הראשון: נושא, תמונת לפני וחלופה אחת מספיקים." : "כדי להוסיף פרויקט, פותחים את תפריט A&I ובוחרים מצב עריכה."}
        action={editing && <button className="btn btn-primary" onClick={() => go("new")}>פרויקט ראשון</button>}
      />
    );

  return (
    <div className="library">
      <div className="toolbar panel">
        <label className="search">
          <span className="label">חיפוש</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="נושא, איש קשר, שידרוג או חלופה" />
        </label>
        <div className="chips" role="group" aria-label="סינון לפי שלב">
          <button className={"chip" + (!status ? " on" : "")} aria-pressed={!status} onClick={() => setStatus("")}>הכל · {projects.length}</button>
          {STATUSES.map((s) => {
            const n = projects.filter((p) => p.status === s.key).length;
            return (
              <button key={s.key} className={"chip st-" + s.key + (status === s.key ? " on" : "")} aria-pressed={status === s.key} disabled={!n} onClick={() => setStatus(s.key)}>
                {s.label} · {n}
              </button>
            );
          })}
        </div>
        <label className="sort">
          <span className="label">מיון</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
      </div>

      <p className="result-line label" aria-live="polite">{list.length === projects.length ? list.length + " פרויקטים" : list.length + " מתוך " + projects.length + " פרויקטים"}</p>

      {!list.length ? (
        <Empty title="אין תוצאות" text="נסו מילה אחרת או הסירו את הסינון." action={<button className="btn" onClick={() => { setQ(""); setStatus(""); }}>ניקוי חיפוש וסינון</button>} />
      ) : (
        <div className="grid">
          {list.map((p, i) => {
            const c = coverOf(p);
            const s = projectStats(p);
            const expanded = open === p.id;
            return (
              <article key={p.id} className={"card tilt" + (expanded ? " expanded" : "")}>
                <button className="card-cover" onClick={() => go("project/" + p.id)} aria-label={"פתיחת " + p.subject}>
                  <CompareThumb before={c.before} after={c.after} afterLabel={s.chosen ? "נבחרה" : "אחרי"} delay={i * 1.1} />
                </button>
                <div className="card-body">
                  <div className="card-top">
                    <span className={"status st-" + p.status}>{statusLabel(p.status)}</span>
                    <span className="label">{formatDate(p)}</span>
                  </div>
                  <h3><button className="link-plain" onClick={() => go("project/" + p.id)}>{p.subject || "ללא נושא"}</button></h3>
                  {p.requirement && <p className="card-req">{p.requirement}</p>}
                  {p.contact && <p className="card-contact">{p.contact}</p>}
                  <div className="card-foot">
                    <button className={"chip" + (expanded ? " on" : "")} aria-expanded={expanded} onClick={() => setOpen(expanded ? null : p.id)}>
                      {s.upgrades} שידרוגים · {s.alts} חלופות
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => shareProject(p, flash)}>שיתוף</button>
                  </div>
                </div>
                {expanded && (
                  <div className="card-upgrades">
                    {p.upgrades.map((u, ui) => (
                      <div key={u.id} className="cu">
                        <span className="cu-title">{u.title}</span>
                        <div className="cu-strip">
                          {u.beforeSrc && (
                            <button className="cu-thumb before" onClick={() => go(`project/${p.id}/${ui}/0`)}>
                              <img src={u.beforeSrc} alt={"לפני: " + u.title} loading="lazy" />
                              <span className="label">לפני</span>
                            </button>
                          )}
                          {u.alternatives.map((a, ai) => (
                            <button key={a.id} className={"cu-thumb" + (u.chosenAltId === a.id ? " chosen" : "")} onClick={() => go(`project/${p.id}/${ui}/${ai}`)}>
                              <img src={a.afterSrc} alt={a.label} loading="lazy" />
                              <span className="label">{a.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
