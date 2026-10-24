import { useCallback, useRef, useState } from "react";

// השוואת לפני/אחרי. "לפני" מימין (תחילת הקריאה), "אחרי" משמאל, ותמונת לפני שקופה מעט כדי שיהיה ברור מה ישן ומה חדש.
// מיקום הקו הוא משתנה CSS בשם --pos: במצב auto הוא נע לבד באנימציית CSS, ונעצר ברגע שנוגעים.
// גרירה, לחיצה, מקלדת (חיצים, Home, End).
export function CompareSlider({ before, after, beforeLabel = "לפני", afterLabel = "אחרי", auto = false, start = 50 }) {
  const box = useRef(null);
  const [pos, setPos] = useState(start);
  const [touched, setTouched] = useState(false);
  const dragging = useRef(false);

  const fromX = useCallback((x) => {
    const r = box.current.getBoundingClientRect();
    setPos(Math.max(0, Math.min(100, ((x - r.left) / r.width) * 100)));
  }, []);

  // נגיעה ראשונה: מתחילים מהמקום שבו האנימציה נמצאת עכשיו, בלי קפיצה
  const take = () => {
    if (touched) return;
    const live = parseFloat(getComputedStyle(box.current).getPropertyValue("--pos"));
    if (!Number.isNaN(live)) setPos(live);
    setTouched(true);
  };

  const down = (e) => {
    take();
    dragging.current = true;
    box.current.setPointerCapture?.(e.pointerId);
    fromX(e.clientX);
  };
  const move = (e) => { if (dragging.current) { e.preventDefault(); fromX(e.clientX); } };
  const up = () => { dragging.current = false; };
  const key = (e) => {
    const d = e.shiftKey ? 10 : 3;
    const map = { ArrowLeft: -d, ArrowRight: d, Home: -100, End: 100 };
    if (e.key in map) { e.preventDefault(); take(); setPos((p) => Math.max(0, Math.min(100, p + map[e.key]))); }
  };

  const moving = auto && !touched;
  return (
    <div
      ref={box}
      className={"cmp" + (moving ? " auto" : "")}
      style={moving ? undefined : { "--pos": pos + "%" }}
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
      <CompareLayers before={before} after={after} beforeLabel={beforeLabel} afterLabel={afterLabel} />
      {!touched && <span className="cmp-hint">{auto ? "גררו כדי לעצור ולהשוות" : "גררו את הקו או השתמשו בחיצים"}</span>}
    </div>
  );
}

function CompareLayers({ before, after, beforeLabel, afterLabel, small }) {
  return (
    <>
      {before ? <img className="cmp-before" src={before} alt={small ? "" : beforeLabel} draggable={false} loading={small ? "lazy" : undefined} /> : <span className="cmp-missing">אין תמונת לפני</span>}
      <span className="cmp-after">
        {after ? <img src={after} alt={small ? "" : afterLabel} draggable={false} loading={small ? "lazy" : undefined} /> : <span className="cmp-missing">אין תמונת אחרי</span>}
      </span>
      <span className="cmp-line"><span className="cmp-knob" aria-hidden="true" /></span>
      <span className="cmp-tag cmp-tag-before">{beforeLabel}</span>
      <span className="cmp-tag cmp-tag-after">{afterLabel}</span>
    </>
  );
}

// תמונה מונפשת לכרטיסים: אותה השוואה, בלי אינטראקציה. delay מפזר את הקצב בין כרטיסים.
export function CompareThumb({ before, after, afterLabel = "אחרי", delay = 0 }) {
  return (
    <span className="cmp cmp-thumb auto" style={{ animationDelay: -delay + "s" }} aria-hidden="true">
      <CompareLayers before={before} after={after} beforeLabel="לפני" afterLabel={afterLabel} small />
    </span>
  );
}

export function CompareSide({ before, after, afterLabel }) {
  return (
    <div className="cmp-side">
      <figure className="is-before"><img className="cmp-before" src={before} alt="לפני" /><figcaption className="label">לפני</figcaption></figure>
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
      <img src={before} alt="לפני" draggable={false} className={"cmp-before cmp-hold-before" + (showBefore ? " on" : "")} />
      <span className="cmp-tag cmp-tag-before">{showBefore ? "לפני" : afterLabel}</span>
      <span className="cmp-hint">החזיקו לחוץ כדי לראות את מצב לפני</span>
    </div>
  );
}
