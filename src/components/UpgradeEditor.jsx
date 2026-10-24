import { ImageDrop } from "./ui.jsx";
import { newId } from "../data/model.js";

// עריכת שידרוג אחד: כותרת, תמונת לפני, וחלופות אחרי (אפשר להעלות כמה בבת אחת).
export default function UpgradeEditor({ upgrade, index, total, onChange, onRemove, onMove, onError }) {
  const set = (patch) => onChange({ ...upgrade, ...patch });
  const alts = upgrade.alternatives;

  const addAlts = (srcs) =>
    set({ alternatives: [...alts, ...srcs.map((s, i) => ({ id: newId(), afterSrc: s, label: "חלופה " + (alts.length + i + 1) }))] });

  const ready = upgrade.beforeSrc && alts.length > 0;

  return (
    <section className={"upg-edit panel" + (ready ? " ready" : "")} aria-label={"שידרוג " + (index + 1)}>
      <header className="upg-edit-head">
        <span className="label">{"שידרוג " + String(index + 1).padStart(2, "0")}</span>
        <span className={"pill" + (ready ? " ok" : "")}>{ready ? "מוכן" : "חסרה תמונת לפני או חלופה"}</span>
        <div className="row-actions">
          {onMove && index > 0 && <button className="btn btn-ghost btn-sm" onClick={() => onMove(-1)}>הקדמה</button>}
          {onMove && index < total - 1 && <button className="btn btn-ghost btn-sm" onClick={() => onMove(1)}>הזזה אחורה</button>}
          {total > 1 && <button className="btn btn-ghost btn-sm danger" onClick={onRemove}>הסרת שידרוג</button>}
        </div>
      </header>

      <label className="field">
        <span className="label">כותרת השידרוג</span>
        <input type="text" value={upgrade.title} onChange={(e) => set({ title: e.target.value })} placeholder="למשל: חזית דרומית" />
      </label>

      <div className="upg-edit-grid">
        <div>
          <span className="label">לפני</span>
          <ImageDrop
            src={upgrade.beforeSrc}
            label={upgrade.beforeSrc ? "החלפת תמונת לפני" : "תמונת המצב הקיים"}
            hint="לחיצה, גרירה או הדבקה"
            onImages={([s]) => set({ beforeSrc: s })}
            onError={onError}
          />
        </div>
        <div>
          <span className="label">{"חלופות אחרי · " + alts.length}</span>
          <div className="alt-edit-list">
            {alts.map((a, i) => (
              <div key={a.id} className={"alt-edit" + (upgrade.chosenAltId === a.id ? " chosen" : "")}>
                <ImageDrop
                  compact
                  src={a.afterSrc}
                  label="החלפת תמונה"
                  onImages={([s]) => set({ alternatives: alts.map((x) => (x.id === a.id ? { ...x, afterSrc: s } : x)) })}
                  onError={onError}
                />
                <input
                  type="text"
                  value={a.label}
                  aria-label={"שם חלופה " + (i + 1)}
                  onChange={(e) => set({ alternatives: alts.map((x) => (x.id === a.id ? { ...x, label: e.target.value } : x)) })}
                />
                <div className="alt-edit-actions">
                  <button
                    className={"btn btn-sm" + (upgrade.chosenAltId === a.id ? " btn-on" : " btn-ghost")}
                    aria-pressed={upgrade.chosenAltId === a.id}
                    onClick={() => set({ chosenAltId: upgrade.chosenAltId === a.id ? null : a.id })}
                  >
                    {upgrade.chosenAltId === a.id ? "נבחרה" : "בחירה"}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm danger"
                    onClick={() => set({ alternatives: alts.filter((x) => x.id !== a.id), chosenAltId: upgrade.chosenAltId === a.id ? null : upgrade.chosenAltId })}
                  >
                    הסרה
                  </button>
                </div>
              </div>
            ))}
            <ImageDrop compact multiple label="הוספת חלופות" hint="אפשר כמה תמונות יחד" onImages={addAlts} onError={onError} />
          </div>
        </div>
      </div>
    </section>
  );
}
