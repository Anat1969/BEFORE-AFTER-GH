import { useCallback, useEffect, useRef, useState } from "react";
import { loadProjects, saveProjects, getDeleted, setDeleted } from "./db.js";
import { cloudPull, cloudPush, mergeProjects, sameContent } from "./cloud.js";
import { normalizeProject } from "./model.js";

const PUSH_DELAY = 900;

// מקור הנתונים היחיד של האפליקציה.
// כל מוטציה נשמרת מקומית מיד (await), ואז נדחפת לענן אחרי משיכה ומיזוג, כך שמכשיר אחד לא דורס מכשיר אחר.
export default function useStore() {
  const [projects, setProjects] = useState([]);
  const [ready, setReady] = useState(false);
  const [save, setSave] = useState(null); // { state: saving|saved|error|offline, text }
  const [cloud, setCloud] = useState({ state: "idle", at: null }); // idle|syncing|synced|error
  const current = useRef([]);
  const deleted = useRef(getDeleted());
  const pushTimer = useRef(null);
  const pushing = useRef(null);

  const flash = useCallback((state, text, ms = 1800) => {
    setSave({ state, text });
    if (ms) setTimeout(() => setSave((s) => (s && s.text === text ? null : s)), ms);
  }, []);

  const apply = useCallback((list) => {
    const norm = list.map(normalizeProject);
    current.current = norm;
    setProjects(norm);
    return norm;
  }, []);

  // משיכה, מיזוג, ודחיפה רק אם יש מה לעדכן בענן
  const sync = useCallback(async ({ silent } = {}) => {
    if (pushing.current) return pushing.current;
    const run = (async () => {
      setCloud((c) => ({ ...c, state: "syncing" }));
      try {
        const remote = await cloudPull();
        const gone = Array.from(new Set([...deleted.current, ...remote.deleted]));
        deleted.current = gone;
        setDeleted(gone);
        const merged = mergeProjects(current.current, remote.projects, gone);
        if (!sameContent(merged, current.current)) {
          apply(merged);
          await saveProjects(current.current);
        }
        const remoteNorm = mergeProjects([], remote.projects, gone);
        if (!sameContent(merged, remoteNorm) || remote.projects.length !== remoteNorm.length || gone.length > remote.deleted.length) {
          await cloudPush(current.current, gone);
        }
        setCloud({ state: "synced", at: Date.now() });
        if (!silent) flash("saved", "סונכרן עם הענן");
      } catch (e) {
        console.warn("Sync failed:", e);
        setCloud((c) => ({ ...c, state: "error", error: e.message }));
        flash("offline", "נשמר במכשיר. הענן לא זמין כרגע, ננסה שוב בשמירה הבאה", 4000);
      } finally {
        pushing.current = null;
      }
    })();
    pushing.current = run;
    return run;
  }, [apply, flash]);

  const schedulePush = useCallback(() => {
    clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => sync({ silent: true }), PUSH_DELAY);
  }, [sync]);

  // כל שינוי עובר כאן: מעדכן מצב, שומר מקומית ב-await, ומתזמן דחיפה לענן
  const commit = useCallback(async (updater, { deletedIds } = {}) => {
    const next = apply(typeof updater === "function" ? updater(current.current) : updater);
    if (deletedIds?.length) {
      deleted.current = Array.from(new Set([...deleted.current, ...deletedIds]));
      setDeleted(deleted.current);
    }
    setSave({ state: "saving", text: "שומר..." });
    const res = await saveProjects(next);
    if (!res.ok) {
      flash("error", "שגיאה בשמירה: " + (res.error?.message || "האחסון מלא") + ". הורידו גיבוי מתפריט A&I", 0);
      return false;
    }
    flash("saved", "נשמר");
    schedulePush();
    return true;
  }, [apply, flash, schedulePush]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const local = await loadProjects().catch(() => []);
      if (!alive) return;
      apply(mergeProjects(local, [], deleted.current));
      // מכשיר חדש בלי נתונים מקומיים: מחכים לענן כדי לא להבזיק ספריה ריקה
      if (!local.length) await Promise.race([sync({ silent: true }), new Promise((r) => setTimeout(r, 8000))]);
      if (!alive) return;
      setReady(true);
      if (local.length) await sync({ silent: true });
    })();
    const onOnline = () => sync({ silent: true });
    const onVisible = () => document.visibilityState === "visible" && sync({ silent: true });
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [apply, sync]);

  return { projects, ready, save, cloud, commit, sync, flash, dismissSave: () => setSave(null) };
}
