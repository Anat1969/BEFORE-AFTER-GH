import { useEffect, useRef } from "react";

/** The A&I logo button (https://appofapp-gh.vercel.app/ai-menu.js). Every editing and development action lives inside it. */
export default function AIMenu({ items, status = "", chat, research }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.items = items || [];
    el.status = status;
  }, [items, status]);
  return <ai-menu ref={ref} chat={chat} research={research} />;
}
