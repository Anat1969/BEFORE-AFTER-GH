import { useRef, useState } from "react";
import { compressAll } from "../lib/image.js";

// אזור העלאה: לחיצה, גרירת קבצים או הדבקה. מקבל כמה תמונות בבת אחת ודוחס כל אחת לפני השמירה.
export function ImageDrop({ onImages, multiple = false, label, hint, src, compact = false, onError }) {
  const input = useRef(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const take = async (files) => {
    const list = Array.from(files || []).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return onError?.("לא נמצאה תמונה. בחרו קובץ JPG, PNG או HEIC שהדפדפן תומך בו");
    setBusy(true);
    try {
      const out = await compressAll(multiple ? list : list.slice(0, 1));
      await onImages(out);
    } catch (e) {
      onError?.(e.message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div
      className={"drop" + (over ? " over" : "") + (src ? " has" : "") + (compact ? " compact" : "") + (busy ? " busy" : "")}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files); }}
      onPaste={(e) => take(e.clipboardData.files)}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), input.current?.click())}
      role="button"
      tabIndex={0}
      aria-label={label}
    >
      {src && <img src={src} alt={label} />}
      <div className="drop-text">
        <span className="drop-label">{busy ? "דוחס ושומר..." : label}</span>
        {hint && !busy && <span className="drop-hint">{hint}</span>}
      </div>
      <input ref={input} type="file" accept="image/*" multiple={multiple} hidden onChange={(e) => take(e.target.files)} />
    </div>
  );
}

// כפתור עם אישור בלחיצה שנייה, למחיקות
export function ConfirmButton({ children, confirmText = "לחצו שוב לאישור", onConfirm, className = "btn btn-danger" }) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      className={className + (armed ? " armed" : "")}
      onClick={() => {
        if (armed) { setArmed(false); onConfirm(); }
        else { setArmed(true); setTimeout(() => setArmed(false), 3500); }
      }}
    >
      {armed ? confirmText : children}
    </button>
  );
}

// טקסט שנערך במקום: במצב תצוגה טקסט, במצב עריכה שדה שנשמר ביציאה או ב-Enter
export function Editable({ value, onSave, editing, placeholder, multiline, className = "", as: Tag = "span" }) {
  if (!editing) return value ? <Tag className={className}>{value}</Tag> : null;
  const Field = multiline ? "textarea" : "input";
  return (
    <Field
      className={"inline-edit " + className}
      defaultValue={value}
      placeholder={placeholder}
      aria-label={placeholder}
      onBlur={(e) => e.target.value.trim() !== (value || "") && onSave(e.target.value.trim())}
      onKeyDown={(e) => { if (e.key === "Enter" && !multiline) e.target.blur(); if (e.key === "Escape") { e.target.value = value || ""; e.target.blur(); } }}
    />
  );
}

export function Toast({ save, onClose }) {
  if (!save) return null;
  return (
    <div className={"toast toast-" + save.state} role={save.state === "error" ? "alert" : "status"} aria-live="polite">
      <span className="toast-dot" aria-hidden="true" />
      <span>{save.text}</span>
      {save.state === "error" && <button className="toast-x" onClick={onClose} aria-label="סגירה">סגירה</button>}
    </div>
  );
}

export function Empty({ title, text, action }) {
  return (
    <div className="empty">
      <div className="empty-art" aria-hidden="true"><span /><span /><i /></div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function Stat({ n, label }) {
  return (
    <div className="stat">
      <span className="stat-n">{n}</span>
      <span className="stat-l label">{label}</span>
    </div>
  );
}
