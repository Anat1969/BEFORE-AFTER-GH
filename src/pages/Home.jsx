import { CompareSlider, CompareThumb } from "../components/Compare.jsx";
import { Stat } from "../components/ui.jsx";
import { coverOf, totals, statusLabel, STATUSES } from "../data/model.js";
import { go } from "../lib/router.js";

// דף הבית: חזון, מפת התוכן, והדגמה חיה מתוך הפרויקטים עצמם.
export default function Home({ projects, editing }) {
  const t = totals(projects);
  const featured = projects.find((p) => { const c = coverOf(p); return c.before && c.after; });
  const cover = featured ? coverOf(featured) : null;
  const recent = projects.slice(0, 6);
  const byStatus = STATUSES.map((s) => ({ ...s, n: projects.filter((p) => p.status === s.key).length }));
  const max = Math.max(1, ...byStatus.map((s) => s.n));

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-text">
          <span className="label">ארכיון שידרוגים · לפני ואחרי</span>
          <h1>
            כל שינוי במרחב,
            <br />
            <em>מתועד, מושווה ונבחר.</em>
          </h1>
          <p className="lead">
            מאגר אחד לכל פרויקט: המצב הקיים, החלופות המוצעות וההחלטה שהתקבלה. משווים בגרירה, מסמנים חלופה נבחרת, ומשתפים קישור ישיר
            עם כל מי שצריך לראות.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary" onClick={() => go("library")}>לספריית הפרויקטים</button>
            <button className="btn" onClick={() => go("table")}>לטבלת אנשי הקשר</button>
            {editing && <button className="btn" onClick={() => go("new")}>פרויקט חדש</button>}
          </div>
        </div>
        <div className="hero-stage" aria-label="הדגמה">
          <div className="stage-3d">
            {cover ? (
              <>
                <CompareSlider before={cover.before} after={cover.after} auto />
                <button className="stage-cap" onClick={() => go("project/" + featured.id)}>
                  <span className="label">פרויקט נבחר</span>
                  <strong>{featured.subject}</strong>
                </button>
              </>
            ) : (
              <div className="stage-placeholder">
                <span className="label">לפני</span>
                <span className="label">אחרי</span>
                <p>{projects.length ? "הוסיפו תמונות לפרויקט כדי לראות כאן הדגמה חיה" : "הפרויקט הראשון יופיע כאן כהדגמה חיה"}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="stats-band panel" aria-label="תמונת מצב">
        <Stat n={t.projects} label="פרויקטים" />
        <Stat n={t.upgrades} label="שידרוגים" />
        <Stat n={t.alts} label="חלופות" />
        <Stat n={t.chosen} label="החלטות" />
        <Stat n={t.contacts} label="אנשי קשר" />
        <Stat n={t.images} label="תמונות שמורות" />
      </section>

      <section className="flow" aria-label="איך זה עובד">
        {[
          ["01", "מתעדים", "צילום של המצב הקיים לכל שידרוג. התמונה נדחסת ונשמרת מיד, במכשיר ובענן."],
          ["02", "מציעים", "כמה חלופות לכל שידרוג: הדמיות, סקיצות או צילום אחרי ביצוע."],
          ["03", "משווים", "גרירת קו, תצוגה זו לצד זו, או החזקה לחוצה כדי לראות את ההבדל."],
          ["04", "מחליטים", "מסמנים חלופה נבחרת ומעדכנים סטטוס. ההחלטה מופיעה בספריה, בטבלה ובשיתוף."],
        ].map(([n, h, p]) => (
          <article key={n} className="flow-step panel">
            <span className="flow-n">{n}</span>
            <h3>{h}</h3>
            <p>{p}</p>
          </article>
        ))}
      </section>

      <section className="home-map">
        <div className="map-col">
          <div className="section-head">
            <h2>נוספו לאחרונה</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => go("library")}>כל הספריה</button>
          </div>
          {recent.length ? (
            <div className="recent-strip">
              {recent.map((p, i) => {
                const c = coverOf(p);
                return (
                  <button key={p.id} className="recent tilt" onClick={() => go("project/" + p.id)}>
                    <span className="recent-img">{c.after || c.before ? <CompareThumb before={c.before} after={c.after} delay={i * 1.3} /> : null}</span>
                    <span className="recent-t">{p.subject}</span>
                    <span className="label">{statusLabel(p.status)}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="muted">עדיין אין פרויקטים. פותחים מצב עריכה בתפריט A&amp;I ומוסיפים את הראשון.</p>
          )}
        </div>
        <div className="map-col panel status-chart" aria-label="פרויקטים לפי שלב">
          <h2>לפי שלב</h2>
          {byStatus.map((s) => (
            <button key={s.key} className="bar-row" onClick={() => go("library?status=" + s.key)}>
              <span className="bar-l">{s.label}</span>
              <span className="bar"><span className={"bar-fill st-" + s.key} style={{ width: (s.n / max) * 100 + "%" }} /></span>
              <span className="bar-n">{s.n}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
