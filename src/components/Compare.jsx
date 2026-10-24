import { useCallback, useEffect, useRef, useState } from "react";

// השוואת לפני/אחרי. "לפני" מימין (תחילת הקריאה), "אחרי" משמאל.
// גרירה, לחיצה, מקלדת (חיצים, Home, End), ומצב הדגמה שנע לבד.
export function CompareSlider({ before, after, beforeLabel = "לפני", afterLabel = "אחרי", demo = false, start = 50 }) {
  const box = useRef(null);
  const [pos, setPos] = useState(start);
  const [touched, setTouched] = useState(false);
  const dragging = useRef(false);

  const fromX = useCallback((x) => {
    const r = box.current.getBoundingClientRect();
    setPos(Math.max(0, Math.min(100, ((x - r.left) / r.width) * 100)));
  }, []);

  useEffect(() => {
    if (!demo || touched || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf, t0;
    const step = (t) => {
      t0 ??= t;
      setPos(50 + Math.sin((t - t0) / 1400) * 32);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [demo, touched]);

  const down = (e) => {
    dragging.current = true;
    setTouched(true);
    box.current.setPointerCapture?.(e.pointerId);
    fromX(e.clientX);
  };
  const move = (e) => { if (dragging.current) { e.preventDefault(); fromX(e.clientX); } };
  const up = () => { dragging.current = false; };
  const key = (e) => {
    const d = e.shiftKey ? 10 : 3;
    const map = { ArrowLeft: -d, ArrowRight: d, Home: -100, End: 100 };
    if (e.key in map) { e.preventDefault(); setTouched(true); setPos((p) => Math.max(0, Math.min(100, p + map[e.key]))); }
  };

  return (
    <div
      ref={box}
      className="cmp"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      role="slider"
      tabIndex={0}
      aria-label={"השוואה בין " + beforeLabel + " ל" + afterLabel + ". חיצים מזיזים את הקו"}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pos)}
      onKeyDown={key}
    >
      {before ? <img src={before} alt={beforeLabel} draggable={false} /> : <div className="cmp-missing">אין תמונת לפני</div>}
      <div className="cmp-after" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        {after ? <img src={after} alt={afterLabel} draggable={false} /> : <div className="cmp-missing">אין תמונת אחרי</div>}
      </div>
      <div className="cmp-line" style={{ left: pos + "%" }}>
        <span className="cmp-knob" aria-hidden="true" />
      </div>
      <span className="cmp-tag cmp-tag-before">{beforeLabel}</span>
      <span className="cmp-tag cmp-tag-after">{afterLabel}</span>
      {!touched && !demo && <span className="cmp-hint">גררו את הקו או השתמשו בחיצים</span>}
    </div>
  );
}

export function CompareSide({ before, after, afterLabel }) {
  return (
    <div className="cmp-side">
      <figure><img src={before} alt="לפני" /><figcaption className="label">לפני</figcaption></figure>
      <figure><img src={after} alt={afterLabel} /><figcaption className="label">{afterLabel}</figcaption></figure>
    </div>
  );
}

// לחיצה ממושכת מציגה את "לפני"; שחרור מחזיר ל"אחרי"
export function CompareHold({ before, after, afterLabel }) {
  const [showBefore, setShowBefore] = useState(false);
  return (
    <div
      className="cmp cmp-hold"
      onPointerDown={() => setShowBefore(true)}
      onPointerUp={() => setShowBefore(false)}
      onPointerLeave={() => setShowBefore(false)}
      onKeyDown={(e) => e.key === " " && (e.preventDefault(), setShowBefore(true))}
      onKeyUp={(e) => e.key === " " && setShowBefore(false)}
      tabIndex={0}
      role="button"
      aria-pressed={showBefore}
      aria-label="החזיקו כדי לראות את מצב לפני"
    >
      <img src={after} alt={afterLabel} draggable={false} />
      <img src={before} alt="לפני" draggable={false} className={"cmp-hold-before" + (showBefore ? " on" : "")} />
      <span className="cmp-tag cmp-tag-before">{showBefore ? "לפני" : afterLabel}</span>
      <span className="cmp-hint">החזיקו לחוץ כדי לראות את מצב לפני</span>
    </div>
  );
}
