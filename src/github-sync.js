const OWNER = "anat1969";
const REPO = "BEFORE-AFTER-GH";
const BRANCH = "data";
const FILE_PATH = "projects.json";
const TOKEN_KEY = "gh-sync-token";

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
}

export function setToken(token) {
  try { localStorage.setItem(TOKEN_KEY, token.trim()); } catch {}
}

export function hasToken() {
  return !!getToken();
}

export async function pullFromGitHub() {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}&t=${Date.now()}`;
  const headers = { Accept: "application/vnd.github.v3+json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error("GitHub read failed: " + res.status);

  const json = await res.json();
  const decoded = atob(json.content.replace(/\n/g, ""));
  const data = JSON.parse(decoded);
  return { data, sha: json.sha };
}

export async function pushToGitHub(projects) {
  const token = getToken();
  if (!token) throw new Error("No GitHub token configured");

  const getUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`;
  const headers = {
    Accept: "application/vnd.github.v3+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const getRes = await fetch(getUrl, { headers });
  if (!getRes.ok) throw new Error("GitHub read failed: " + getRes.status);
  const current = await getRes.json();

  const content = btoa(unescape(encodeURIComponent(JSON.stringify(projects, null, 0))));

  const putRes = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message: "Sync projects data",
        content,
        sha: current.sha,
        branch: BRANCH,
      }),
    }
  );

  if (!putRes.ok) {
    const err = await putRes.text();
    throw new Error("GitHub write failed: " + putRes.status + " " + err);
  }
  return true;
}

export function mergeProjects(local, remote) {
  const map = new Map();
  for (const p of remote) map.set(p.id, p);
  for (const p of local) map.set(p.id, p);
  return Array.from(map.values()).sort((a, b) => b.id - a.id);
}
