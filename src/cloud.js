const SUPABASE_URL = "https://slcpldoaaagkoozpbjsk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsY3BsZG9hYWFna29venBianNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3OTM0MjEsImV4cCI6MjA5NDM2OTQyMX0.g0iLhliFQNlD3Ey_mrvwMolppj-nV24Pj9klrFtsLWo";
const TABLE = "before_after_projects";
const ROW_ID = "all";

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

export async function cloudPull() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${ROW_ID}&select=data`,
    { headers }
  );
  if (!res.ok) return [];
  const rows = await res.json();
  if (rows.length === 0) return [];
  return rows[0].data || [];
}

export async function cloudPush(projects) {
  const body = { id: ROW_ID, data: projects, updated_at: new Date().toISOString() };

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${ROW_ID}`,
    { method: "PATCH", headers, body: JSON.stringify(body) }
  );

  if (res.status === 404 || (await res.json()).length === 0) {
    const ins = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}`,
      { method: "POST", headers, body: JSON.stringify(body) }
    );
    return ins.ok;
  }
  return res.ok;
}

export function mergeProjects(local, remote) {
  const map = new Map();
  for (const p of remote) map.set(p.id, p);
  for (const p of local) map.set(p.id, p);
  return Array.from(map.values()).sort((a, b) => b.id - a.id);
}
