// דחיסה לפני שמירה: עד 1200x1200, JPEG באיכות 0.6. תמונה בגודל מלא לא נשמרת לעולם.
const MAX = 1200;
const QUALITY = 0.6;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("לא ניתן לקרוא את הקובץ כתמונה: " + file.name)); };
    img.src = url;
  });
}

export async function compressImage(file) {
  if (!file.type.startsWith("image/")) throw new Error("הקובץ " + file.name + " אינו תמונה");
  const img = await loadImage(file);
  let { naturalWidth: w, naturalHeight: h } = img;
  const ratio = Math.min(1, MAX / w, MAX / h);
  w = Math.round(w * ratio);
  h = Math.round(h * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", QUALITY);
}

export const compressAll = (files) => Promise.all(Array.from(files).map(compressImage));

export const dataUrlBytes = (src) => (src ? Math.round((src.length - src.indexOf(",") - 1) * 0.75) : 0);
