import { useEffect, useState } from "react";

// ניתוב בכתובת (#/...), כך שכל מצב ניתן להעתקה ולשיתוף ונשמר ברענון.
export function parse(hash) {
  const [path, query = ""] = hash.replace(/^#\/?/, "").split("?");
  const parts = path.split("/").filter(Boolean);
  const q = Object.fromEntries(new URLSearchParams(query));
  const page = parts[0] || "home";
  return { page, id: parts[1] ? Number(parts[1]) : null, u: Number(parts[2] || 0), a: Number(parts[3] || 0), q };
}

export function go(path, { replace } = {}) {
  const h = "#/" + path.replace(/^\/+/, "");
  if (replace) history.replaceState(null, "", h);
  else if (location.hash !== h) location.hash = h;
  if (replace) window.dispatchEvent(new HashChangeEvent("hashchange"));
}

export function useRoute() {
  const [route, setRoute] = useState(() => parse(location.hash));
  useEffect(() => {
    const on = () => setRoute(parse(location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export const linkTo = (path) => location.origin + location.pathname + "#/" + path;
