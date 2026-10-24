import { linkTo } from "./router.js";

// שיתוף קישור ישיר לפרויקט (ולשידרוג ולחלופה כשנבחרו). שיתוף מערכת בנייד, העתקה במחשב.
export async function shareProject(p, flash, path) {
  const url = linkTo(path || "project/" + p.id);
  const text = `פרויקט "${p.subject}": לפני ואחרי`;
  if (navigator.share) {
    try { await navigator.share({ title: p.subject, text, url }); return; } catch (e) { if (e.name === "AbortError") return; }
  }
  try {
    await navigator.clipboard.writeText(url);
    flash?.("saved", "הקישור לפרויקט הועתק");
  } catch {
    flash?.("error", "הדפדפן חסם העתקה. הקישור: " + url, 6000);
  }
}
