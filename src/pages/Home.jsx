import { CompareSlider, CompareThumb } from "../components/Compare.jsx";
import { Stat } from "../components/ui.jsx";
import { coverOf, totals, STATUSES, byNewest } from "../data/model.js";
import { go } from "../lib/router.js";

// דף הבית: חזון, מפת התוכן, והדגמה חיה מתוך הפרויקטים עצמם.
export default function Home({ projects, editing }) {
  const t = totals(projects);
  // ההדגמה תמיד מהפרויקט האחרון שעלה (שיש בו גם לפני וגם חלופה)
  const newest = byNewest(projects);
  const featured = newest.find((p) => { const c = coverOf(p); return c.before && c.after; });
  const cover = featured ? coverOf(featured) : null;
  const recent = newest.slice(0, 6);
  const byStatus = STATUSES.map((s) => ({ ...s, n: projects.filter((p) => p.status === s.key).length }));
  const max = Math.max(1, ...byStatus.map((s) => s.n));

  // במחשב: מסך אחד בלי גלילה (טקסט ומספרים מימין, הדגמה ופרויקטים אחרונים משמאל). בנייד: ערימה רגילה.
  return (
    <div className="home">
      <section className="home-text">
        <span className="label">ארכיון שידרוגים · לפני ואחרי</span>
        <h1>
          כל שינוי במרחב,
          <br />
          <em>מתועד, מושווה ונבחר.</em>
        </h1>
        <p className="lead">
          מאגר אחד לכל פרויקט: המצב הקיים, החלופות וההחלטה שהתקבלה. משווים בגרירה, מסמנים חלופה נבחרת ומשתפים קישור ישיר.
        </p>
        <div className="hero-actions">
          <button className="btn btn-primary" onClick={() => go("library")}>לספריית הפרויקטים</button>
          <button className="btn" onClick={() => go("table")}>לטבלת אנשי הקשר</button>
          {editing && <button className="btn" onClick={() => go("new")}>פרויקט חדש</button>}
        </div>
        <ol className="flow" aria-label="איך זה עובד">
          {[
            ["01", "מתעדים", "צילום המצב הקיים"],
            ["02", "מציעים", "חלופות והדמיות"],
            ["03", "משווים", "גרירה, זו לצד זו, החזקה"],
            ["04", "מחליטים", "חלופה נבחרת ושלב"],
          ].map(([n, h, p]) => (
            <li key={n} className="flow-step">
              <span className="flow-n">{n}</span>
              <strong>{h}</strong>
              <span className="flow-p">{p}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="home-stage hero-stage" aria-label="הדגמה">
        <div className="stage-3d">
          {cover ? (
            <>
              <CompareSlider key={featured.id} before={cover.before} after={cover.after} auto />
              <button className="stage-cap" onClick={() => go("project/" + featured.id)}>
                <span className="label">הפרויקט האחרון שעלה</span>
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
      </section>

      <section className="home-info">
        <div className="stats-band panel" aria-label="תמונת מצב">
          <Stat n={t.projects} label="פרויקטים" />
          <Stat n={t.upgrades} label="שידרוגים" />
          <Stat n={t.alts} label="חלופות" />
          <Stat n={t.chosen} label="החלטות" />
          <Stat n={t.contacts} label="אנשי קשר" />
          <Stat n={t.images} label="תמונות" />
        </div>
        <div className="status-chart panel" aria-label="פרויקטים לפי שלב">
          {byStatus.map((s) => (
            <button key={s.key} className="bar-row" onClick={() => go("library?status=" + s.key)}>
              <span className="bar-l">{s.label}</span>
              <span className="bar"><span className={"bar-fill st-" + s.key} style={{ width: (s.n / max) * 100 + "%" }} /></span>
              <span className="bar-n">{s.n}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="home-recent">
        <div className="section-head">
          <h2>נוספו לאחרונה</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => go("library")}>כל הספריה</button>
        </div>
        {recent.length ? (
          <div className="recent-strip">
            {recent.map((p, i) => {
              const c = coverOf(p);
              return (
                <button key={p.id} className="recent tilt" onClick={() => go("project/" + p.id)} title={p.subject}>
                  <span className="recent-img">{c.after || c.before ? <CompareThumb before={c.before} after={c.after} delay={i * 1.3} /> : null}</span>
                  <span className="recent-t">{p.subject}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="muted">עדיין אין פרויקטים. פותחים מצב עריכה בתפריט A&amp;I ומוסיפים את הראשון.</p>
        )}
      </section>
    </div>
  );
}
