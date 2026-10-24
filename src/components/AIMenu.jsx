import { useEffect, useRef, useState } from "react";

export const CHAT_URL = "https://claude.ai/code/session_016qk5x8DDp1RiGwuWfFAyX9";

/** כפתור הלוגו A&I (https://appofapp-gh.vercel.app/ai-menu.js). כל פעולות העריכה והפיתוח נמצאות בתוכו.
 *  אם הסקריפט החיצוני לא נטען (רשת חסומה, אופליין), מוצג תפריט מקומי זהה בתפקודו. */
export default function AIMenu({ items, status = "", chat = CHAT_URL, research }) {
  const ref = useRef(null);
  const [external, setExternal] = useState(() => !!window.customElements?.get("ai-menu"));

  useEffect(() => {
    if (external || !window.customElements) return;
    let alive = true;
    customElements.whenDefined("ai-menu").then(() => alive && setExternal(true));
    return () => { alive = false; };
  }, [external]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !external) return;
    el.items = items || [];
    el.status = status;
  }, [items, status, external]);

  if (external) return <ai-menu ref={ref} chat={chat} research={research} />;
  return <LocalMenu items={items} status={status} chat={chat} />;
}

function LocalMenu({ items, status, chat }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrap = useRef(null);

  useEffect(() => {
    if (!open) return;
    const out = (e) => !wrap.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === "Escape" && setOpen(false);
    const nav = () => setOpen(false);
    document.addEventListener("pointerdown", out);
    document.addEventListener("keydown", esc);
    window.addEventListener("hashchange", nav);
    return () => {
      document.removeEventListener("pointerdown", out);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("hashchange", nav);
    };
  }, [open]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(location.href); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* הדפדפן חסם */ }
  };

  return (
    <div className="ai-local" ref={wrap}>
      <button className="ai-logo" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((o) => !o)}>
        <span className="ai-logo-mark">A&amp;I</span>
        <span className="ai-logo-name">אד' ענת שטיבלמן</span>
      </button>
      {open && (
        <div className="ai-pop" role="menu">
          {status && <div className="ai-status label">{status}</div>}
          <button role="menuitem" onClick={copy}>{copied ? "הקישור הועתק" : "העתקת קישור"}<small>המצב הנוכחי</small></button>
          <a role="menuitem" href={chat} target="_blank" rel="noreferrer">שיחת הפיתוח<small>Claude Code</small></a>
          <div className="ai-sep" />
          {(items || []).map((it) => (
            <button
              key={it.label}
              role="menuitem"
              aria-pressed={it.pressed || undefined}
              className={it.pressed ? "on" : ""}
              disabled={it.disabled}
              onClick={() => { setOpen(false); it.onSelect?.(); }}
            >
              {it.label}
              {it.hint && <small>{it.hint}</small>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
