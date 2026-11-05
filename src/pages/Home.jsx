import { useEffect, useState } from "react";
import { CompareSlider, CompareStage } from "../components/Compare.jsx";
import { coverOf, totals, STATUSES, byNewest, statusLabel, projectStats } from "../data/model.js";
import { go } from "../lib/router.js";
import { useFitMode } from "../lib/useFit.js";

const ROTATE_MS = 10000;
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// דף הבית כאולם הקרנה: מתחיל בפרויקט האחרון שעלה, ומתחלף לבד כל 10 שניות.
// מימין העדשה (מה מחכה להחלטה, מה מוצג עכשיו), במרכז הבמה, ולמטה סרט עם כל הפרויקטים.
export default function Home({ projects, editing }) {
  const fit = useFitMode();
  const t = totals(projects);
  const reel = byNewest(projects).filter((p) => { const c = coverOf(p); return c.before && c.after; });
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = reel.length;
  const i = n ? idx % n : 0;
  const cur = reel[i];

  useEffect(() => {
    if (paused || n < 2 || reduced()) return;
    const id = setTimeout(() => setIdx((x) => (x + 1) % n), ROTATE_MS);
    return () => clearTimeout(id);
  }, [idx, paused, n]);

  const pending = projects.filter((p) => p.upgrades.some((u) => u.alternatives.length && !u.chosenAltId)).length;
  const byStatus = STATUSES.map((s) => ({ ...s, n: projects.filter((p) => p.status === s.key).length }));
  const max = Math.max(1, ...byStatus.map((s) => s.n));
  const pick = (k) => { setIdx(k); setPaused(true); };

  if (!projects.length)
    return (
      <div className="home home-empty">
        <section className="home-lens">
          <span className="label">ארכיון שידרוגים · לפני ואחרי</span>
          <h1>כל שינוי במרחב, לפני ואחרי.</h1>
          <p className="lead">הספריה ריקה. פותחים את תפריט A&amp;I ובוחרים <b>פרויקט חדש</b>.</p>
        </section>
      </div>
    );

  const c = cur ? coverOf(cur) : null;
  const s = cur ? projectStats(cur) : null;

  return (
    <div className="home">
      <section className="home-lens">
        <span className="label">ארכיון שידרוגים · לפני ואחרי</span>
        <h1>
          {pending ? (
            <><b className="num">{pending}</b> מתוך {t.projects} פרויקטים מחכים להחלטה</>
          ) : (
            <>כל {t.projects} הפרויקטים הוכרעו</>
          )}
        </h1>
        <p className="lead">
          <b>{t.alts}</b> חלופות ו-<b>{t.images}</b> תמונות. גוררים את הקו, משווים, ובוחרים חלופה בכל פרויקט.
        </p>

        {cur && (
          <div className="now panel" onMouseEnter={() => setPaused(true)}>
            <div className="now-top">
              <span className="label">מוצג עכשיו · {i + 1} מתוך {n}</span>
              <span className={"status st-" + cur.status}>{statusLabel(cur.status)}</span>
            </div>
            <h2>{cur.subject}</h2>
            <p className="muted">
              {[cur.contact, s.alts + " חלופות", s.chosen ? "נבחרה חלופה" : "טרם נבחרה חלופה"].filter(Boolean).join(" · ")}
            </p>
            <div className="now-actions">
              <button className="btn btn-primary" onClick={() => go("project/" + cur.id)}>פתיחת הפרויקט</button>
              <button className="btn" onClick={() => pick((i - 1 + n) % n)} disabled={n < 2}>הקודם</button>
              <button className="btn" onClick={() => pick((i + 1) % n)} disabled={n < 2}>הבא</button>
            </div>
            {n > 1 && (
              <span className={"now-timer" + (paused ? " paused" : "")} key={cur.id + String(paused)} aria-hidden="true">
                <i style={{ animationDuration: ROTATE_MS + "ms" }} />
              </span>
            )}
          </div>
        )}

        <div className="status-chart" aria-label="פרויקטים לפי שלב">
          <span className="label">פרויקטים לפי שלב · לחיצה מסננת את הספריה</span>
          {byStatus.map((b) => (
            <button key={b.key} className="bar-row" onClick={() => go("library?status=" + b.key)}>
              <span className="bar-l">{b.label}</span>
              <span className="bar"><span className={"bar-fill st-" + b.key} style={{ width: (b.n / max) * 100 + "%" }} /></span>
              <span className="bar-n">{b.n}</span>
            </button>
          ))}
        </div>

        <div className="home-links">
          <button className="btn btn-ghost" onClick={() => go("library")}>כל הספריה</button>
          <button className="btn btn-ghost" onClick={() => go("table")}>טבלת אנשי קשר</button>
          {editing && <button className="btn btn-ghost" onClick={() => go("new")}>פרויקט חדש</button>}
        </div>
      </section>

      <section className="home-stage" aria-label={cur ? "השוואה: " + cur.subject : "הדגמה"}>
        {cur ? (
          fit ? (
            <CompareStage key={cur.id} before={c.before} after={c.after} auto />
          ) : (
            <CompareSlider key={cur.id} before={c.before} after={c.after} auto />
          )
        ) : (
          <p className="muted">הוסיפו תמונת לפני וחלופה לפרויקט כדי לראות כאן השוואה חיה.</p>
        )}
      </section>

      <section className="reel" aria-label="כל הפרויקטים">
        {reel.map((p, k) => {
          const cc = coverOf(p);
          return (
            <button key={p.id} className={"reel-item" + (k === i ? " on" : "")} aria-pressed={k === i} onClick={() => pick(k)} title={p.subject}>
              <img src={cc.after} alt="" loading="lazy" />
              <span className="reel-name">{p.subject}</span>
            </button>
          );
        })}
      </section>
    </div>
  );
}
