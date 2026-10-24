import { useEffect, useRef, useState } from "react";
import UpgradeEditor from "../components/UpgradeEditor.jsx";
import { Empty } from "../components/ui.jsx";
import { STATUSES, emptyUpgrade, newId, touch } from "../data/model.js";
import { loadDraft, saveDraft } from "../data/db.js";
import { go } from "../lib/router.js";

const blank = () => ({ id: null, subject: "", requirement: "", contact: "", status: "design", upgrades: [emptyUpgrade()] });

// טופס מלא. בפרויקט קיים כל שינוי נשמר אוטומטית; בפרויקט חדש נשמרת טיוטה עד ליצירה.
export default function ProjectForm({ projects, route, editing, commit, flash }) {
  const isNew = route.page === "new";
  const existing = !isNew ? projects.find((p) => p.id === route.id) : null;
  const [form, setForm] = useState(() => (existing ? structuredClone(existing) : blank()));
  const [draftLoaded, setDraftLoaded] = useState(!isNew);
  const timer = useRef(null);
  const first = useRef(true);

  useEffect(() => {
    if (!isNew) return;
    loadDraft().then((d) => { if (d && Array.isArray(d.upgrades)) setForm(d); setDraftLoaded(true); });
  }, [isNew]);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!draftLoaded) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (isNew) saveDraft(form).catch((e) => flash("error", "שמירת הטיוטה נכשלה: " + e.message, 0));
      else if (form.subject.trim()) commit((list) => list.map((p) => (p.id === form.id ? touch({ ...form, subject: form.subject.trim() }) : p)));
    }, isNew ? 300 : 700);
    return () => clearTimeout(timer.current);
  }, [form, isNew, draftLoaded, commit, flash]);

  if (!editing)
    return <Empty title="העריכה סגורה" text="כדי לערוך או להוסיף, פותחים את תפריט A&I ובוחרים מצב עריכה." action={<button className="btn" onClick={() => history.back()}>חזרה</button>} />;
  if (!isNew && !existing) return <Empty title="הפרויקט לא נמצא" action={<button className="btn" onClick={() => go("library")}>לספריה</button>} />;

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setUpg = (id, nu) => setForm((f) => ({ ...f, upgrades: f.upgrades.map((u) => (u.id === id ? nu : u)) }));
  const moveUpg = (i, d) =>
    setForm((f) => {
      const ups = [...f.upgrades];
      [ups[i], ups[i + d]] = [ups[i + d], ups[i]];
      return { ...f, upgrades: ups };
    });
  const onError = (m) => flash("error", m, 5000);

  const create = async () => {
    const id = newId();
    const proj = touch({
      ...form,
      id,
      subject: form.subject.trim(),
      requirement: form.requirement.trim(),
      contact: form.contact.trim(),
      date: new Date().toLocaleDateString("he-IL"),
      createdAt: Date.now(),
      upgrades: form.upgrades.filter((u) => u.beforeSrc || u.alternatives.length).map((u, i) => ({ ...u, title: u.title.trim() || "שידרוג " + (i + 1) })),
    });
    const ok = await commit((list) => [proj, ...list]);
    if (ok) {
      await saveDraft(null).catch(() => {});
      go("project/" + id, { replace: true });
    }
  };

  const discard = async () => {
    await saveDraft(null).catch(() => {});
    setForm(blank());
    go("library");
  };

  const readyCount = form.upgrades.filter((u) => u.beforeSrc && u.alternatives.length).length;

  return (
    <div className="form">
      <nav className="crumbs" aria-label="פירורי לחם">
        <button className="link-plain" onClick={() => go("library")}>ספריה</button>
        <span aria-hidden="true">/</span>
        {existing && <><button className="link-plain" onClick={() => go("project/" + existing.id)}>{existing.subject}</button><span aria-hidden="true">/</span></>}
        <span aria-current="page">{isNew ? "פרויקט חדש" : "עריכה מלאה"}</span>
      </nav>
      <header className="form-head">
        <h1>{isNew ? "פרויקט חדש" : "עריכת פרויקט"}</h1>
        <p className="muted">{isNew ? "הטיוטה נשמרת בכל שינוי. אפשר לסגור ולחזור אליה מאוחר יותר." : "כל שינוי נשמר אוטומטית, במכשיר ובענן."}</p>
      </header>

      <section className="panel form-main">
        <div className="field-row">
          <label className="field">
            <span className="label">נושא *</span>
            <input type="text" value={form.subject} onChange={(e) => set({ subject: e.target.value })} placeholder="למשל: חידוש חזית בניין" autoFocus={isNew} />
          </label>
          <label className="field">
            <span className="label">איש קשר</span>
            <input type="text" value={form.contact} onChange={(e) => set({ contact: e.target.value })} placeholder="שם, טלפון או מייל" />
          </label>
        </div>
        <label className="field">
          <span className="label">דרישה ותיאור</span>
          <textarea value={form.requirement} onChange={(e) => set({ requirement: e.target.value })} placeholder="למשל: שיפוץ טיח, החלפת חלונות" />
        </label>
        <div className="field">
          <span className="label">שלב</span>
          <div className="chips" role="group" aria-label="שלב">
            {STATUSES.map((s) => (
              <button key={s.key} className={"chip st-" + s.key + (form.status === s.key ? " on" : "")} aria-pressed={form.status === s.key} onClick={() => set({ status: s.key })}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {form.upgrades.map((u, i) => (
        <UpgradeEditor
          key={u.id}
          upgrade={u}
          index={i}
          total={form.upgrades.length}
          onChange={(nu) => setUpg(u.id, nu)}
          onRemove={() => setForm((f) => ({ ...f, upgrades: f.upgrades.filter((x) => x.id !== u.id) }))}
          onMove={(d) => moveUpg(i, d)}
          onError={onError}
        />
      ))}

      <div className="form-actions">
        <button className="btn" onClick={() => setForm((f) => ({ ...f, upgrades: [...f.upgrades, emptyUpgrade()] }))}>שידרוג נוסף</button>
        <span className="spacer" />
        {isNew ? (
          <>
            <button className="btn btn-ghost" onClick={discard}>מחיקת הטיוטה</button>
            <button className="btn btn-primary" disabled={!form.subject.trim()} onClick={create} title={form.subject.trim() ? "" : "חסר נושא"}>
              יצירת הפרויקט{readyCount ? " · " + readyCount + " שידרוגים מוכנים" : ""}
            </button>
          </>
        ) : (
          <button className="btn btn-primary" onClick={() => go("project/" + form.id)}>סיום וחזרה לפרויקט</button>
        )}
      </div>
    </div>
  );
}
