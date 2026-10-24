// גיבוי מלא לקובץ (טקסט + כל התמונות) ושחזור ממנו. השחזור ממזג ולא מוחק דבר.
import { mergeProjects } from "./cloud.js";

export function downloadBackup(projects) {
  const payload = { app: "before-after", version: 2, exportedAt: new Date().toISOString(), projects };
  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "שידרוגים-גיבוי-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function readBackup(file) {
  const data = JSON.parse(await file.text());
  const list = Array.isArray(data) ? data : data?.projects;
  if (!Array.isArray(list)) throw new Error("הקובץ אינו גיבוי של אפליקציית השידרוגים");
  return list.filter((p) => p && p.id && Array.isArray(p.upgrades));
}

export const mergeBackup = (current, incoming) => mergeProjects(current, incoming);
