import { useState, useRef, useCallback, useEffect } from "react";
import { loadProjects as dbLoad, saveProjects as dbSave } from "./db.js";

const THEME_KEY = "before-after-theme";

function fileToDataUrl(file) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = (e) => resolve(e.target.result);
    r.readAsDataURL(file);
  });
}

function compressImage(dataUrl, maxSize = 1200, quality = 0.6) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = dataUrl;
  });
}

async function readAndCompress(file) {
  const raw = await fileToDataUrl(file);
  return compressImage(raw);
}

function ImageCompareSlider({ beforeSrc, afterSrc }) {
  const containerRef = useRef(null);
  const [position, setPosition] = useState(50);
  const dragging = useRef(false);

  const updatePosition = useCallback((clientX) => {
    const rect = containerRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setPosition(pct);
  }, []);

  return (
    <div
      className="compare-container"
      ref={containerRef}
      onPointerDown={(e) => { dragging.current = true; containerRef.current.setPointerCapture(e.pointerId); updatePosition(e.clientX); }}
      onPointerMove={(e) => { if (dragging.current) updatePosition(e.clientX); }}
      onPointerUp={() => { dragging.current = false; }}
    >
      <img src={beforeSrc} alt="before" />
      <div className="compare-after-wrap" style={{ clipPath: `inset(0 0 0 ${position}%)` }}>
        <img src={afterSrc} alt="after" />
      </div>
      <div className="compare-handle" style={{ left: `${position}%` }}>
        <div className="compare-handle-circle">
          <div className="handle-arrows"><span>&#9664;</span><span>&#9654;</span></div>
        </div>
      </div>
      <div className="compare-labels">
        <span className="compare-label">לפני</span>
        <span className="compare-label">אחרי</span>
      </div>
    </div>
  );
}

function UpgradeFormBlock({ upgrade, index, onChange, onRemove, total }) {
  const handleBeforeFile = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const src = await readAndCompress(f);
    onChange({ ...upgrade, beforeSrc: src });
  };

  const handleAltFile = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const src = await readAndCompress(f);
    const newAlts = [...upgrade.alternatives, { id: Date.now(), afterSrc: src, label: "חלופה " + (upgrade.alternatives.length + 1) }];
    onChange({ ...upgrade, alternatives: newAlts });
  };

  const removeAlt = (altId) => {
    onChange({ ...upgrade, alternatives: upgrade.alternatives.filter((a) => a.id !== altId) });
  };

  const updateAltLabel = (altId, label) => {
    onChange({ ...upgrade, alternatives: upgrade.alternatives.map((a) => a.id === altId ? { ...a, label } : a) });
  };

  return (
    <div className="upgrade-block">
      <div className="upgrade-block-header">
        <span>{"שידרוג " + (index + 1)}</span>
        {total > 1 && <button className="remove-upgrade-btn" onClick={onRemove}>הסרה</button>}
      </div>

      <div className="field-group">
        <label>כותרת שידרוג</label>
        <input type="text" value={upgrade.title} onChange={(e) => onChange({ ...upgrade, title: e.target.value })} placeholder="למשל: חזית דרומית" />
      </div>

      <div className="upload-area">
        <div className="upload-area-title">תמונת לפני</div>
        <div className="upload-row">
          <div className={"upload-box" + (upgrade.beforeSrc ? " has-image" : "")}>
            {upgrade.beforeSrc ? (
              <>
                <img src={upgrade.beforeSrc} alt="before" />
                <div className="upload-overlay">לפני</div>
              </>
            ) : (
              <>
                <div className="upload-title-sm">בחירת תמונה</div>
                <div className="upload-hint">לפני</div>
              </>
            )}
            <input type="file" accept="image/*" onChange={handleBeforeFile} />
          </div>
        </div>
      </div>

      <div className="upload-area">
        <div className="upload-area-title">חלופות אחרי</div>
        <div className="upload-row">
          {upgrade.alternatives.map((alt) => (
            <div key={alt.id} style={{ position: "relative" }}>
              <div className="upload-box has-image">
                <img src={alt.afterSrc} alt={alt.label} />
                <div className="upload-overlay">{alt.label}</div>
                <button className="remove-img-btn" onClick={(e) => { e.stopPropagation(); removeAlt(alt.id); }}>&times;</button>
              </div>
              <input
                type="text" value={alt.label} onChange={(e) => updateAltLabel(alt.id, e.target.value)}
                className="alt-label-input"
                placeholder="שם חלופה"
              />
            </div>
          ))}
          <div className="upload-box add-alt-box">
            <div className="upload-title-sm" style={{ color: "var(--cyan)" }}>+ חלופה</div>
            <div className="upload-hint">אחרי</div>
            <input type="file" accept="image/*" onChange={handleAltFile} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState("library");
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const loaded = useRef(false);

  const [subject, setSubject] = useState("");
  const [requirement, setRequirement] = useState("");
  const [contact, setContact] = useState("");
  const [upgrades, setUpgrades] = useState([
    { id: Date.now(), title: "", beforeSrc: null, alternatives: [] },
  ]);

  const [activeUpgradeIdx, setActiveUpgradeIdx] = useState(0);
  const [activeAltIdx, setActiveAltIdx] = useState(0);

  const [addingToProject, setAddingToProject] = useState(null);
  const [extraUpgrade, setExtraUpgrade] = useState(null);

  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) || "dark"; } catch { return "dark"; }
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch {}
  }, [theme]);

  useEffect(() => {
    dbLoad().then((data) => {
      setProjects(data);
      loaded.current = true;
    });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    dbSave(projects);
  }, [projects]);

  useEffect(() => {
    const projectsRef = { current: projects };
    projectsRef.current = projects;
    const onBeforeUnload = () => dbSave(projectsRef.current);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [projects]);

  const resetForm = () => {
    setSubject(""); setRequirement(""); setContact("");
    setUpgrades([{ id: Date.now(), title: "", beforeSrc: null, alternatives: [] }]);
  };

  const addUpgradeSlot = () => {
    setUpgrades((u) => [...u, { id: Date.now(), title: "", beforeSrc: null, alternatives: [] }]);
  };

  const canSubmit = subject.trim() && upgrades.some((u) => u.beforeSrc && u.alternatives.length > 0);

  const handleSubmit = () => {
    const validUpgrades = upgrades.filter((u) => u.beforeSrc && u.alternatives.length > 0).map((u, i) => ({
      ...u,
      title: u.title.trim() || "שידרוג " + (i + 1),
    }));
    if (!validUpgrades.length) return;
    const proj = {
      id: Date.now(),
      subject: subject.trim(),
      requirement: requirement.trim(),
      contact: contact.trim(),
      date: new Date().toLocaleDateString("he-IL"),
      upgrades: validUpgrades,
    };
    setProjects((p) => [proj, ...p]);
    resetForm();
    setView("library");
  };

  const deleteProject = (id) => {
    setProjects((p) => p.filter((pr) => pr.id !== id));
    setView("library"); setSelectedProjectId(null);
  };

  const openProject = (id) => {
    setSelectedProjectId(id); setActiveUpgradeIdx(0); setActiveAltIdx(0); setView("compare");
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const startAddUpgrade = (projId) => {
    setAddingToProject(projId);
    setExtraUpgrade({ id: Date.now(), title: "", beforeSrc: null, alternatives: [] });
  };

  const saveExtraUpgrade = () => {
    if (!extraUpgrade.beforeSrc || !extraUpgrade.alternatives.length) return;
    setProjects((ps) => ps.map((p) => {
      if (p.id !== addingToProject) return p;
      return { ...p, upgrades: [...p.upgrades, { ...extraUpgrade, title: extraUpgrade.title.trim() || "שידרוג " + (p.upgrades.length + 1) }] };
    }));
    setAddingToProject(null); setExtraUpgrade(null);
  };

  const addAltToExisting = async (projId, upgradeId, file) => {
    const src = await readAndCompress(file);
    setProjects((ps) => ps.map((p) => {
      if (p.id !== projId) return p;
      return {
        ...p,
        upgrades: p.upgrades.map((u) => {
          if (u.id !== upgradeId) return u;
          return { ...u, alternatives: [...u.alternatives, { id: Date.now(), afterSrc: src, label: "חלופה " + (u.alternatives.length + 1) }] };
        }),
      };
    }));
  };

  return (
    <>
      <div className="app">
        <div className="bg-orbs">
          <div className="orb orb-1" />
          <div className="orb orb-2" />
          <div className="orb orb-3" />
        </div>

        <div className="header">
          <h1>שידרוגים</h1>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              className="theme-toggle"
              onClick={() => setTheme((t) => t === "dark" ? "light" : "dark")}
              title={theme === "dark" ? "מצב בהיר" : "מצב כהה"}
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            <button className={"nav-btn" + (view === "library" ? " active" : "")} onClick={() => { setView("library"); setSelectedProjectId(null); setAddingToProject(null); }}>ספריה</button>
            <button className={"nav-btn" + (view === "add" ? " active" : "")} onClick={() => { setView("add"); setAddingToProject(null); }}>פרויקט חדש</button>
          </div>
        </div>

        <div className="container">
          {view === "add" && (
            <div className="form-section glass-card">
              <h2>פרויקט חדש</h2>
              <div className="field-row">
                <div className="field-group" style={{ marginBottom: 0 }}>
                  <label>נושא</label>
                  <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="למשל: חידוש חזית בניין" />
                </div>
                <div className="field-group" style={{ marginBottom: 0 }}>
                  <label>איש קשר</label>
                  <input type="text" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="שם, טלפון או מייל" />
                </div>
              </div>
              <div className="field-group">
                <label>דרישה / תיאור</label>
                <textarea value={requirement} onChange={(e) => setRequirement(e.target.value)} placeholder="למשל: שיפוץ טיח, החלפת חלונות" />
              </div>

              {upgrades.map((u, i) => (
                <UpgradeFormBlock
                  key={u.id} upgrade={u} index={i} total={upgrades.length}
                  onChange={(updated) => setUpgrades((us) => us.map((uu) => uu.id === u.id ? updated : uu))}
                  onRemove={() => setUpgrades((us) => us.filter((uu) => uu.id !== u.id))}
                />
              ))}

              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <button className="btn-secondary" onClick={addUpgradeSlot}>+ שידרוג נוסף</button>
              </div>

              <button className="btn-primary" disabled={!canSubmit} onClick={handleSubmit}>שמירה בספריה</button>
            </div>
          )}

          {view === "library" && (
            <>
              {projects.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">
                    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                      <rect x="4" y="12" width="24" height="40" rx="4" stroke="rgba(77,232,224,0.3)" strokeWidth="2" fill="rgba(77,232,224,0.05)"/>
                      <rect x="36" y="12" width="24" height="40" rx="4" stroke="rgba(75,123,245,0.3)" strokeWidth="2" fill="rgba(75,123,245,0.05)"/>
                      <line x1="32" y1="8" x2="32" y2="56" stroke="rgba(77,232,224,0.4)" strokeWidth="2" strokeDasharray="4 4"/>
                    </svg>
                  </div>
                  <p>הספריה ריקה</p>
                  <p style={{ fontSize: 12, marginBottom: 16 }}>הוסיפו פרויקט ראשון כדי להתחיל</p>
                  <button className="nav-btn" onClick={() => setView("add")}>פרויקט ראשון</button>
                </div>
              ) : (
                <div className="library-grid">
                  {projects.map((proj) => {
                    const firstUpgrade = proj.upgrades[0];
                    const firstAlt = firstUpgrade?.alternatives[0];
                    return (
                      <div key={proj.id} className="library-card glass-card" onClick={() => openProject(proj.id)}>
                        <div className="card-preview">
                          {firstUpgrade?.beforeSrc && <img src={firstUpgrade.beforeSrc} alt="before" />}
                          <div className="divider-line" />
                          {firstAlt?.afterSrc && <img src={firstAlt.afterSrc} alt="after" />}
                          <div className="card-labels">
                            <span className="card-label">לפני</span>
                            <span className="card-label">אחרי</span>
                          </div>
                        </div>
                        <div className="card-info">
                          <h3>{proj.subject}</h3>
                          {proj.requirement && <p>{proj.requirement}</p>}
                          {proj.contact && <p style={{ color: "var(--text-muted)", marginTop: 2 }}>{proj.contact}</p>}
                          <div className="card-badges">
                            <span className="card-badge">{proj.upgrades.length + " שידרוגים"}</span>
                            <span className="card-badge">{proj.upgrades.reduce((s, u) => s + u.alternatives.length, 0) + " חלופות"}</span>
                          </div>
                          <div className="card-date">{proj.date}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {view === "compare" && selectedProject && (() => {
            const upg = selectedProject.upgrades[activeUpgradeIdx];
            if (!upg) return null;
            const alt = upg.alternatives[activeAltIdx];
            return (
              <>
                <button className="compare-back" onClick={() => { setView("library"); setSelectedProjectId(null); }}>← חזרה לספריה</button>

                {selectedProject.upgrades.length > 1 && (
                  <div className="upgrade-tabs-wrapper glass-card" style={{ borderBottom: "none", borderRadius: "var(--radius) var(--radius) 0 0" }}>
                    <div className="upgrade-tabs">
                      {selectedProject.upgrades.map((u, i) => (
                        <button key={u.id} className={"upgrade-tab" + (activeUpgradeIdx === i ? " active" : "")}
                          onClick={() => { setActiveUpgradeIdx(i); setActiveAltIdx(0); }}>
                          {u.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="compare-wrapper glass-card" style={selectedProject.upgrades.length > 1 ? { borderRadius: "0 0 var(--radius) var(--radius)" } : {}}>
                  {upg.alternatives.length > 1 && (
                    <div className="alt-tabs">
                      {upg.alternatives.map((a, i) => (
                        <button key={a.id} className={"alt-tab" + (activeAltIdx === i ? " active" : "")}
                          onClick={() => setActiveAltIdx(i)}>
                          {a.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {upg.beforeSrc && alt && (
                    <ImageCompareSlider key={upg.id + "-" + alt.id} beforeSrc={upg.beforeSrc} afterSrc={alt.afterSrc} />
                  )}

                  <div className="add-alt-inline">
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>הוספת חלופה:</span>
                    <label className="btn-secondary" style={{ position: "relative", cursor: "pointer", fontSize: 12, padding: "5px 14px" }}>
                      + העלאת תמונה
                      <input type="file" accept="image/*" style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
                        onChange={(e) => { if (e.target.files[0]) addAltToExisting(selectedProject.id, upg.id, e.target.files[0]); }} />
                    </label>
                  </div>

                  <div className="compare-meta">
                    <h2>{selectedProject.subject}</h2>
                    {upg.title && selectedProject.upgrades.length <= 1 && <p style={{ fontWeight: 500, marginBottom: 4 }}>{upg.title}</p>}
                    {selectedProject.requirement && <p>{selectedProject.requirement}</p>}
                    {selectedProject.contact && <div className="compare-contact">איש קשר: {selectedProject.contact}</div>}

                    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                      <button className="btn-secondary" onClick={() => startAddUpgrade(selectedProject.id)}>+ שידרוג נוסף</button>
                      <button className="delete-btn" onClick={() => deleteProject(selectedProject.id)}>מחיקת פרויקט</button>
                    </div>
                  </div>
                </div>

                {addingToProject === selectedProject.id && extraUpgrade && (
                  <div className="form-section glass-card" style={{ marginTop: 20 }}>
                    <h2>שידרוג נוסף לפרויקט</h2>
                    <UpgradeFormBlock
                      upgrade={extraUpgrade} index={0} total={1}
                      onChange={(updated) => setExtraUpgrade(updated)}
                      onRemove={() => { setAddingToProject(null); setExtraUpgrade(null); }}
                    />
                    <button className="btn-primary"
                      disabled={!extraUpgrade.beforeSrc || !extraUpgrade.alternatives.length}
                      onClick={saveExtraUpgrade}>
                      שמירה
                    </button>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>
    </>
  );
}
