import { useEffect, useState } from "react";

// מצב "מסך אחד": במחשב כל דף ממלא בדיוק את גובה המסך, בלי גלילת דף. בנייד: גלילה רגילה.
export const FIT_QUERY = "(min-width: 1025px) and (min-height: 560px)";

export function useFitMode() {
  const [fit, setFit] = useState(() => window.matchMedia(FIT_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(FIT_QUERY);
    const on = () => setFit(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return fit;
}

// בוחר מספר עמודות וגובה שורה כך שכל הכרטיסים ייכנסו במיכל, עם תמונה גדולה ככל האפשר.
// מחזיר [ref, layout]; layout הוא null כשאין התאמה סבירה (אז הרשת חוזרת לגלילה).
export function useFitGrid(count, { enabled = true, gap = 16, body = 112, ratio = 16 / 10, minWidth = 170, minCover = 80 } = {}) {
  const [el, setEl] = useState(null);
  const [size, setSize] = useState(null);

  useEffect(() => {
    if (!el || !enabled) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el, enabled]);

  let layout = null;
  if (enabled && size && count > 0) {
    let best = null;
    for (let cols = 1; cols <= count; cols++) {
      const w = (size.w - (cols - 1) * gap) / cols;
      if (w < minWidth) break;
      const rows = Math.ceil(count / cols);
      const h = (size.h - (rows - 1) * gap) / rows;
      const cover = h - body;
      if (cover < minCover) continue;
      const score = Math.min(w, cover * ratio);
      if (!best || score > best.score) best = { score, cols, rowH: Math.floor(Math.min(h, w / ratio + body)) };
    }
    if (best) layout = { cols: best.cols, rowH: best.rowH };
  }
  return [setEl, layout];
}
