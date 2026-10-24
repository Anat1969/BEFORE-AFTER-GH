import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useStore from "./data/useStore.js";
import { listSnapshots } from "./data/db.js";
import { downloadBackup, readBackup, mergeBackup } from "./data/backup.js";
import { totals } from "./data/model.js";
import { useRoute, go } from "./lib/router.js";
import AIMenu from "./components/AIMenu.jsx";
import { Toast } from "./components/ui.jsx";
import Home from "./pages/Home.jsx";
import Library from "./pages/Library.jsx";
import ProjectPage from "./pages/ProjectPage.jsx";
import ProjectForm from "./pages/ProjectForm.jsx";
import TablePage from "./pages/TablePage.jsx";

const THEME_KEY = "before-after-theme";
const EDIT_KEY = "before-after-editing";
const NAV = [
  { page: "home", path: "", label: "בית" },
  { page: "library", path: "library", label: "ספריה" },
  { page: "table", path: "table", label: "טבלה" },
];
const TITLES = { home: "בית", library: "ספריה", table: "טבלת אנשי קשר", project: "פרויקט", new: "פרויקט חדש", edit: "עריכה" };

const readLS = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const writeLS = (k, v) => { try { localStorage.setItem(k, v); } catch { /* מצב פרטי */ } };

export default function App() {
  const store = useStore();
  const { projects, ready, save, cloud, commit, sync, flash } = store;
  const route = useRoute();
  const [theme, setTheme] = useState(() => readLS(THEME_KEY, matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"));
  const [editing, setEditing] = useState(() => readLS(EDIT_KEY, "0") === "1");
  const [install, setInstall] = useState(null);
  const [snaps, setSnaps] = useState(null);
  const restoreInput = useRef(null);

  useEffect(() => { document.documentElement.dataset.theme = theme; writeLS(THEME_KEY, theme); }, [theme]);
  useEffect(() => { writeLS(EDIT_KEY, editing ? "1" : "0"); document.documentElement.classList.toggle("is-editing", editing); }, [editing]);

  useEffect(() => {
    const on = (e) => { e.preventDefault(); setInstall(e); };
    window.addEventListener("beforeinstallprompt", on);
    return () => window.removeEventListener("beforeinstallprompt", on);
  }, []);

  const currentTitle = route.page === "project" ? projects.find((x) => x.id === route.id)?.subject : null;
  useEffect(() => {
    document.title = (currentTitle || TITLES[route.page] || "שידרוגים") + " · שידרוגים לפני ואחרי";
  }, [route.page, currentTitle]);
  useEffect(() => { window.scrollTo(0, 0); }, [route.page, route.id]);

  const restoreFile = useCallback(async (file) => {
    try {
      const incoming = await readBackup(file);
      await commit((list) => mergeBackup(list, incoming));
      flash("saved", "שוחזרו " + incoming.length + " פרויקטים מהגיבוי. שום דבר קיים לא נמחק", 4000);
    } catch (e) {
      flash("error", "השחזור נכשל: " + e.message, 0);
    }
  }, [commit, flash]);

  const t = totals(projects);
  const cloudText = { syncing: "מסנכרן עם הענן...", synced: "מסונכרן · " + t.images + " תמונות", error: "הענן לא זמין, הכל שמור במכשיר" }[cloud.state] || "";

  const items = useMemo(() => [
    { label: editing ? "יציאה ממצב עריכה" : "מצב עריכה", hint: editing ? "פעיל" : "הוספה, תיקון ומחיקה", pressed: editing, onSelect: () => setEditing((e) => !e) },
    ...(editing ? [{ label: "פרויקט חדש", onSelect: () => go("new") }] : []),
    { label: "סנכרון ענן", hint: "עכשיו", onSelect: () => sync() },
    { label: "הורדת גיבוי מלא", hint: t.projects + " פרויקטים, " + t.images + " תמונות", onSelect: () => downloadBackup(projects) },
    { label: "שחזור מקובץ גיבוי", hint: "ממזג, לא מוחק", onSelect: () => restoreInput.current?.click() },
    { label: "צילומי מצב אוטומטיים", hint: "שחזור גרסה קודמת", onSelect: async () => setSnaps(await listSnapshots().catch(() => [])) },
    { label: theme === "dark" ? "מצב בהיר" : "מצב כהה", onSelect: () => setTheme((x) => (x === "dark" ? "light" : "dark")) },
    ...(install ? [{ label: "התקנת האפליקציה", hint: "במסך הבית", onSelect: async () => { install.prompt(); await install.userChoice; setInstall(null); } }] : []),
  ], [editing, sync, projects, t.projects, t.images, theme, install]);

  if (!ready)
    return (
      <div className="boot" role="status">
        <div className="boot-mark"><span /><span /></div>
        <p>טוען את הספריה ואת התמונות...</p>
      </div>
    );

  const page = route.page;
  const props = { projects, route, editing, commit, flash };

  return (
    <div className="app">
      <div className="bg" aria-hidden="true"><i className="orb o1" /><i className="orb o2" /><i className="orb o3" /><i className="grid-floor" /></div>

      <header className="topbar">
        <a className="brand" href="#/" aria-label="שידרוגים, לדף הבית">
          <img src={import.meta.env.BASE_URL + "icon.svg"} alt="" width="30" height="30" />
          <span className="brand-name">שידרוגים</span>
          <span className="brand-sub label">לפני · אחרי</span>
        </a>
        <nav className="nav" aria-label="ניווט ראשי">
          {NAV.map((n) => (
            <a key={n.page} href={"#/" + n.path} className={"nav-link" + (page === n.page || (n.page === "library" && page === "project") ? " on" : "")} aria-current={page === n.page ? "page" : undefined}>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="topbar-end">
          <span className={"cloud-dot c-" + cloud.state} title={cloudText} role="img" aria-label={cloudText || "מצב ענן"} />
          <AIMenu items={items} status={cloudText} />
        </div>
      </header>

      {editing && page !== "project" && (
        <div className="edit-ribbon" role="status">
          <span className="label">מצב עריכה פעיל</span>
          <button className="btn btn-sm" onClick={() => go("new")}>פרויקט חדש</button>
          <button className="btn btn-sm btn-ghost" onClick={() => setEditing(false)}>סיום עריכה</button>
        </div>
      )}

      <main className="main" key={page + (route.id || "")}>
        {page === "home" && <Home projects={projects} editing={editing} />}
        {page === "library" && <Library {...props} />}
        {page === "table" && <TablePage {...props} />}
        {page === "project" && <ProjectPage {...props} />}
        {(page === "new" || page === "edit") && <ProjectForm {...props} />}
        {!["home", "library", "table", "project", "new", "edit"].includes(page) && (
          <div className="empty"><h3>הדף לא נמצא</h3><button className="btn" onClick={() => go("")}>לדף הבית</button></div>
        )}
      </main>

      <footer className="foot">
        <span className="label">{t.projects} פרויקטים · {t.images} תמונות · נשמר במכשיר ובענן</span>
      </footer>

      <Toast save={save} onClose={store.dismissSave} />
      <input ref={restoreInput} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files[0]; e.target.value = ""; if (f) restoreFile(f); }} />

      {snaps && <Snapshots snaps={snaps} onClose={() => setSnaps(null)} onRestore={async (s) => { await commit((l) => mergeBackup(l, s.projects)); setSnaps(null); flash("saved", "צילום המצב שוחזר", 3000); }} />}
    </div>
  );
}

function Snapshots({ snaps, onClose, onRestore }) {
  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="צילומי מצב" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box panel">
        <h2>צילומי מצב אוטומטיים</h2>
        <p className="muted">המכשיר שומר עותק של כל הספריה, כולל התמונות, פעם בעשר דקות עבודה. שחזור ממזג את העותק לספריה: מחזיר פרויקטים ותמונות שנמחקו, ולא מוחק דבר.</p>
        {!snaps.length ? (
          <p>עדיין אין צילומי מצב במכשיר הזה.</p>
        ) : (
          <ul className="snap-list">
            {snaps.map((s) => {
              const st = totals(s.projects.map((p) => ({ contact: "", ...p, upgrades: (p.upgrades || []).map((u) => ({ alternatives: [], ...u })) })));
              return (
                <li key={s.at}>
                  <span>{new Date(s.at).toLocaleString("he-IL")}</span>
                  <span className="label">{st.projects} פרויקטים · {st.images} תמונות</span>
                  <button className="btn btn-sm" onClick={() => onRestore(s)}>שחזור</button>
                </li>
              );
            })}
          </ul>
        )}
        <button className="btn" autoFocus onClick={onClose}>סגירה</button>
      </div>
    </div>
  );
}
