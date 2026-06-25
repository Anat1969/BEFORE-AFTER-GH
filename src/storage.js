const SUPABASE_URL = "https://slcpldoaaagkoozpbjsk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsY3BsZG9hYWFna29venBianNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3OTM0MjEsImV4cCI6MjA5NDM2OTQyMX0.g0iLhliFQNlD3Ey_mrvwMolppj-nV24Pj9klrFtsLWo";
const BUCKET = "before-after-images";

function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function isDataUrl(str) {
  return typeof str === "string" && str.startsWith("data:");
}

export async function uploadImage(dataUrl, email) {
  if (!isDataUrl(dataUrl)) return dataUrl;
  const blob = dataUrlToBlob(dataUrl);
  const ext = blob.type === "image/png" ? "png" : "jpg";
  const folder = email.replace(/[^a-zA-Z0-9]/g, "_");
  const name = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${name}`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": blob.type,
        "x-upsert": "true",
      },
      body: blob,
    }
  );
  if (!res.ok) throw new Error("Upload failed: " + res.status);
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${name}`;
}

export async function uploadProjectImages(project, email) {
  const uploaded = { ...project, upgrades: [] };
  for (const upg of project.upgrades) {
    let beforeSrc = upg.beforeSrc;
    if (isDataUrl(beforeSrc)) {
      beforeSrc = await uploadImage(beforeSrc, email);
    }
    const alts = [];
    for (const alt of upg.alternatives) {
      let afterSrc = alt.afterSrc;
      if (isDataUrl(afterSrc)) {
        afterSrc = await uploadImage(afterSrc, email);
      }
      alts.push({ ...alt, afterSrc });
    }
    uploaded.upgrades.push({ ...upg, beforeSrc, alternatives: alts });
  }
  return uploaded;
}

export async function uploadAllProjectsImages(projects, email) {
  const results = [];
  for (const p of projects) {
    results.push(await uploadProjectImages(p, email));
  }
  return results;
}
