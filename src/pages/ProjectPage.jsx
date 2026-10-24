import { useEffect, useRef, useState } from "react";
import { CompareSlider, CompareSide, CompareHold } from "../components/Compare.jsx";
import { ConfirmButton, Editable, Empty, ImageDrop } from "../components/ui.jsx";
import { STATUSES, statusLabel, updateProject, updateUpgrade, newId, emptyUpgrade, formatDate } from "../data/model.js";
import { go } from "../lib/router.js";
import { shareProject } from "../lib/share.js";

const MODES = [
  { key: "slider", label: "גרירה" },
  { key: "side", label: "זו לצד זו" },
  { key: "hold", label: "החזקה" },
  { key: "all", label: "כל החלופות" },
];
const MODE_KEY = "before-after-compare-mode";

export default function ProjectPage({ projects, route, editing, commit, flash }) {
  const p = projects.find((x) => x.id === route.id);
  const [mode, setMode] = useState(() => { try { return localStorage.getItem(MODE_KEY) || "slider"; } catch { return "slider"; } });
  const stage = useRef(null);

  useEffect(() => { try { localStorage.setItem(MODE_KEY, mode); } catch { /* לא קריטי */ } }, [mode]);

  if (!p)
    return <Empty title="הפרויקט לא נמצא" text="ייתכן שנמחק, או שהקישור שגוי. הנתונים בענן נטענים מחדש בכל פתיחה." action={<button className="btn" onClick={() => go("library")}>לספריה</button>} />;

  const ui = Math.min(route.u, Math.max(0, p.upgrades.length - 1));
  const u = p.upgrades[ui];
  const ai = u ? Math.min(route.a, Math.max(0, u.alternatives.length - 1)) : 0;
  const alt = u?.alternatives[ai];
  const at = (uu, aa) => go(`project/${p.id}/${uu}/${aa}`, { replace: true });

  const saveProject = (fn) => commit((list) => updateProject(list, p.id, fn));
  const saveUpgrade = (fn) => commit((list) => updateUpgrade(list, p.id, u.id, fn));

  const fullscreen = () => {
    const el = stage.current;
    if (document.fullscreenElement) document.exitFullscreen();
    else el?.requestFullscreen?.().catch(() => flash("error", "הדפדפן לא מאפשר מסך מלא כאן", 3000));
  };

  const addUpgrade = async (srcs) => {
    const nu = { ...emptyUpgrade(), title: "שידרוג " + (p.upgrades.length + 1), beforeSrc: srcs[0] };
    await saveProject((x) => ({ ...x, upgrades: [...x.upgrades, nu] }));
    at(p.upgrades.length, 0);
  };

  return (
    <div className="project">
      <nav className="crumbs" aria-label="פירורי לחם">
        <button className="link-plain" onClick={() => go("")}>בית</button>
        <span aria-hidden="true">/</span>
        <button className="link-plain" onClick={() => go("library")}>ספריה</button>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{p.subject}</span>
      </nav>

      <header className="project-head">
        <div>
          <span className="label">{formatDate(p)} · {p.upgrades.length} שידרוגים</span>
          {editing ? (
            <Editable editing value={p.subject} placeholder="נושא הפרויקט" className="h1-edit" onSave={(v) => v && saveProject((x) => ({ ...x, subject: v }))} />
          ) : (
            <h1>{p.subject}</h1>
          )}
        </div>
        <div className="project-head-side">
          {editing ? (
            <div className="chips" role="group" aria-label="שלב הפרויקט">
              {STATUSES.map((s) => (
                <button key={s.key} className={"chip st-" + s.key + (p.status === s.key ? " on" : "")} aria-pressed={p.status === s.key} onClick={() => saveProject((x) => ({ ...x, status: s.key }))}>
                  {s.label}
                </button>
              ))}
            </div>
          ) : (
            <span className={"status st-" + p.status}>{statusLabel(p.status)}</span>
          )}
          <button className="btn btn-sm" onClick={() => shareProject(p, flash, `project/${p.id}/${ui}/${ai}`)}>שיתוף התצוגה</button>
        </div>
      </header>

      {p.upgrades.length > 1 && (
        <div className="tabs" role="tablist" aria-label="שידרוגים">
          {p.upgrades.map((x, i) => (
            <button key={x.id} role="tab" aria-selected={i === ui} className={"tab" + (i === ui ? " on" : "")} onClick={() => at(i, 0)}>
              <span className="label">{String(i + 1).padStart(2, "0")}</span> {x.title}
            </button>
          ))}
        </div>
      )}

      {!u ? (
        <Empty
          title="אין שידרוגים בפרויקט"
          text={editing ? "מעלים תמונת לפני כדי לפתוח שידרוג ראשון." : "פותחים מצב עריכה בתפריט A&I כדי להוסיף."}
          action={editing && <ImageDrop label="תמונת לפני לשידרוג חדש" onImages={addUpgrade} onError={(m) => flash("error", m, 5000)} />}
        />
      ) : (
        <div className="project-body">
          <section className="stage panel" ref={stage}>
            <div className="stage-bar">
              <div className="seg" role="group" aria-label="אופן ההשוואה">
                {MODES.map((m) => (
                  <button key={m.key} className={"seg-btn" + (mode === m.key ? " on" : "")} aria-pressed={mode === m.key} onClick={() => setMode(m.key)} disabled={m.key === "all" && u.alternatives.length < 2}>
                    {m.label}
                  </button>
                ))}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={fullscreen}>מסך מלא</button>
            </div>

            {!u.beforeSrc || !alt ? (
              <div className="stage-missing">
                <p>{!u.beforeSrc ? "חסרה תמונת לפני לשידרוג הזה." : "אין עדיין חלופות לשידרוג הזה."}</p>
                {editing ? (
                  !u.beforeSrc ? (
                    <ImageDrop label="העלאת תמונת לפני" onImages={([s]) => saveUpgrade((x) => ({ ...x, beforeSrc: s }))} onError={(m) => flash("error", m, 5000)} />
                  ) : null
                ) : (
                  <p className="muted">פותחים מצב עריכה בתפריט A&amp;I כדי להשלים.</p>
                )}
              </div>
            ) : mode === "side" ? (
              <CompareSide before={u.beforeSrc} after={alt.afterSrc} afterLabel={alt.label} />
            ) : mode === "hold" ? (
              <CompareHold before={u.beforeSrc} after={alt.afterSrc} afterLabel={alt.label} />
            ) : mode === "all" ? (
              <div className="all-grid">
                <figure className="all-item before"><img className="cmp-before" src={u.beforeSrc} alt="לפני" /><figcaption className="label">לפני</figcaption></figure>
                {u.alternatives.map((a, i) => (
                  <button key={a.id} className={"all-item" + (u.chosenAltId === a.id ? " chosen" : "")} onClick={() => { at(ui, i); setMode("slider"); }}>
                    <img src={a.afterSrc} alt={a.label} loading="lazy" />
                    <span className="label">{a.label}{u.chosenAltId === a.id ? " · נבחרה" : ""}</span>
                  </button>
                ))}
              </div>
            ) : (
              <CompareSlider key={u.id + "-" + alt.id} before={u.beforeSrc} after={alt.afterSrc} afterLabel={alt.label} auto />
            )}

            {u.alternatives.length > 0 && (
              <div className="alts" role="tablist" aria-label="חלופות">
                {u.alternatives.map((a, i) => (
                  <div key={a.id} className={"alt" + (i === ai ? " on" : "") + (u.chosenAltId === a.id ? " chosen" : "")}>
                    <button className="alt-btn" role="tab" aria-selected={i === ai} onClick={() => at(ui, i)}>
                      <img src={a.afterSrc} alt="" loading="lazy" />
                      <span className="alt-name">{a.label}</span>
                      {u.chosenAltId === a.id && <span className="alt-chosen label">נבחרה</span>}
                    </button>
                  </div>
                ))}
                {editing && (
                  <ImageDrop
                    compact
                    multiple
                    label="הוספת חלופות"
                    hint="כמה תמונות יחד"
                    onError={(m) => flash("error", m, 5000)}
                    onImages={(srcs) =>
                      saveUpgrade((x) => ({
                        ...x,
                        alternatives: [...x.alternatives, ...srcs.map((s, i) => ({ id: newId(), afterSrc: s, label: "חלופה " + (x.alternatives.length + i + 1) }))],
                      }))
                    }
                  />
                )}
              </div>
            )}
          </section>

          <aside className="info panel">
            <div className="info-block">
              <span className="label">שידרוג</span>
              {editing ? (
                <Editable editing value={u.title} placeholder="כותרת השידרוג" onSave={(v) => saveUpgrade((x) => ({ ...x, title: v || x.title }))} />
              ) : (
                <h2>{u.title}</h2>
              )}
            </div>
            {alt && (
              <div className="info-block">
                <span className="label">חלופה מוצגת</span>
                {editing ? (
                  <Editable editing value={alt.label} placeholder="שם החלופה" onSave={(v) => saveUpgrade((x) => ({ ...x, alternatives: x.alternatives.map((a) => (a.id === alt.id ? { ...a, label: v || a.label } : a)) }))} />
                ) : (
                  <p className="info-strong">{alt.label}</p>
                )}
                {editing ? (
                  <button
                    className={"btn btn-sm" + (u.chosenAltId === alt.id ? " btn-on" : "")}
                    aria-pressed={u.chosenAltId === alt.id}
                    onClick={() => saveUpgrade((x) => ({ ...x, chosenAltId: x.chosenAltId === alt.id ? null : alt.id }))}
                  >
                    {u.chosenAltId === alt.id ? "החלופה הנבחרת" : "סימון כחלופה נבחרת"}
                  </button>
                ) : (
                  u.chosenAltId && <p className="muted">{u.chosenAltId === alt.id ? "זו החלופה שנבחרה." : "נבחרה חלופה אחרת: " + (u.alternatives.find((a) => a.id === u.chosenAltId)?.label || "")}</p>
                )}
              </div>
            )}
            <div className="info-block">
              <span className="label">דרישה ותיאור</span>
              {editing ? (
                <Editable editing multiline value={p.requirement} placeholder="מה נדרש בפרויקט" onSave={(v) => saveProject((x) => ({ ...x, requirement: v }))} />
              ) : (
                <p>{p.requirement || <span className="muted">לא נכתב תיאור</span>}</p>
              )}
            </div>
            <div className="info-block">
              <span className="label">איש קשר</span>
              {editing ? (
                <Editable editing value={p.contact} placeholder="שם, טלפון או מייל" onSave={(v) => saveProject((x) => ({ ...x, contact: v }))} />
              ) : (
                <p>{p.contact ? <ContactLink value={p.contact} /> : <span className="muted">לא צוין</span>}</p>
              )}
            </div>
          </aside>
        </div>
      )}

      {editing && (
        <div className="edit-bar" role="toolbar" aria-label="פעולות עריכה">
          <span className="label">מצב עריכה</span>
          <button className="btn btn-sm" onClick={() => go("edit/" + p.id)}>עריכה מלאה</button>
          <ImageDrop compact label="שידרוג חדש" hint="תמונת לפני" onImages={addUpgrade} onError={(m) => flash("error", m, 5000)} />
          {u && u.alternatives.length > 0 && alt && (
            <ConfirmButton className="btn btn-sm btn-danger" onConfirm={() => { saveUpgrade((x) => ({ ...x, alternatives: x.alternatives.filter((a) => a.id !== alt.id), chosenAltId: x.chosenAltId === alt.id ? null : x.chosenAltId })); at(ui, 0); }}>
              מחיקת החלופה
            </ConfirmButton>
          )}
          <ConfirmButton
            className="btn btn-sm btn-danger"
            confirmText="למחוק את כל הפרויקט?"
            onConfirm={async () => { await commit((list) => list.filter((x) => x.id !== p.id), { deletedIds: [p.id] }); go("library"); }}
          >
            מחיקת הפרויקט
          </ConfirmButton>
        </div>
      )}
    </div>
  );
}

function ContactLink({ value }) {
  const phone = value.match(/0\d[\d-]{7,}/)?.[0];
  const mail = value.match(/[^\s]+@[^\s]+\.[^\s]+/)?.[0];
  if (mail) return <a href={"mailto:" + mail}>{value}</a>;
  if (phone) return <a href={"tel:" + phone.replace(/-/g, "")}>{value}</a>;
  return value;
}
