import { useState, useRef, useCallback, useEffect } from "react";
import { loadProjects as dbLoad, saveProjects as dbSave } from "./db.js";
import { cloudPull, cloudPush, mergeProjects } from "./cloud.js";

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
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setPosition(pct);
  }, []);

  const onDown = useCallback((e) => {
    e.preventDefault();
    dragging.current = true;
    containerRef.current.setPointerCapture(e.pointerId);
    updatePosition(e.clientX);
  }, [updatePosition]);

  const onMove = useCallback((e) => {
    if (dragging.current) { e.preventDefault(); updatePosition(e.clientX); }
  }, [updatePosition]);

  const onUp = useCallback(() => { dragging.current = false; }, []);

  return (
    <div
      className="compare-container"
      ref={containerRef}
      style={{ touchAction: "none" }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <img src={beforeSrc} alt="before" draggable={false} />
      <div className="compare-after-wrap" style={{ clipPath: `inset(0 0 0 ${position}%)` }}>
        <img src={afterSrc} alt="after" draggable={false} />
      </div>
      <div className="compare-handle" style={{ left: `${position}%` }}>
        <div className="compare-handle-circle">
          <div className="handle-arrows"><span>◀</span><span>▶</span></div>
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
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState(null); // null | "saving" | "saved" | "error"

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
  const [editingProjectId, setEditingProjectId] = useState(null);

  const [syncStatus, setSyncStatus] = useState(null);

  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) || "dark"; } catch { return "dark"; }
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch {}
  }, [theme]);

  useEffect(() => {
    (async () => {
      let localData = [];
      try {
        const d = await dbLoad();
        if (d && d.length > 0) localData = d;
      } catch {}

      try {
        const remoteData = await cloudPull();
        if (remoteData && remoteData.length > 0) {
          const merged = mergeProjects(localData, remoteData);
          setProjects(merged);
          await dbSave(merged);
          if (localData.length > 0 && localData.length > remoteData.length) {
            try { await cloudPush(merged); } catch {}
          }
          loaded.current = true;
          setIsLoading(false);
          return;
        }
      } catch {}

      if (localData.length > 0) {
        setProjects(localData);
        try { await cloudPush(localData); } catch {}
      }
      loaded.current = true;
      setIsLoading(false);
    })();
  }, []);

  const doSave = useCallback(async (data) => {
    setSaveStatus("saving");
    const ok = await dbSave(data);
    try { await cloudPush(data); } catch (e) { console.warn("Cloud push failed:", e); }
    setSaveStatus(ok ? "saved" : "error");
    setTimeout(() => setSaveStatus(null), 2000);
    return ok;
  }, []);

  const syncNow = useCallback(async () => {
    setSyncStatus("syncing");
    try {
      const remoteData = await cloudPull();
      const merged = mergeProjects(projects, remoteData || []);
      setProjects(merged);
      await dbSave(merged);
      await cloudPush(merged);
      setSyncStatus("synced");
    } catch (e) {
      console.error("Sync failed:", e);
      setSyncStatus("error");
    }
    setTimeout(() => setSyncStatus(null), 2000);
  }, [projects]);

  useEffect(() => {
    if (!loaded.current) return;
    doSave(projects);
  }, [projects, doSave]);

  const resetForm = () => {
    setSubject(""); setRequirement(""); setContact("");
    setUpgrades([{ id: Date.now(), title: "", beforeSrc: null, alternatives: [] }]);
  };

  const addUpgradeSlot = () => {
    setUpgrades((u) => [...u, { id: Date.now(), title: "", beforeSrc: null, alternatives: [] }]);
  };

  const canSubmit = subject.trim() && upgrades.some((u) => u.beforeSrc && u.alternatives.length > 0);

  const handleSubmit = async () => {
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
    const newProjects = [proj, ...projects];
    setProjects(newProjects);
    await doSave(newProjects);
    resetForm();
    setView("library");
  };

  const deleteProject = async (id) => {
    const newProjects = projects.filter((pr) => pr.id !== id);
    setProjects(newProjects);
    await doSave(newProjects);
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

  const saveExtraUpgrade = async () => {
    if (!extraUpgrade.beforeSrc || !extraUpgrade.alternatives.length) return;
    const newProjects = projects.map((p) => {
      if (p.id !== addingToProject) return p;
      return { ...p, upgrades: [...p.upgrades, { ...extraUpgrade, title: extraUpgrade.title.trim() || "שידרוג " + (p.upgrades.length + 1) }] };
    });
    setProjects(newProjects);
    await doSave(newProjects);
    setAddingToProject(null); setExtraUpgrade(null);
  };

  const addAltToExisting = async (projId, upgradeId, file) => {
    const src = await readAndCompress(file);
    const newProjects = projects.map((p) => {
      if (p.id !== projId) return p;
      return {
        ...p,
        upgrades: p.upgrades.map((u) => {
          if (u.id !== upgradeId) return u;
          return { ...u, alternatives: [...u.alternatives, { id: Date.now(), afterSrc: src, label: "חלופה " + (u.alternatives.length + 1) }] };
        }),
      };
    });
    setProjects(newProjects);
    await doSave(newProjects);
  };

  const startEditProject = (proj) => {
    setEditingProjectId(proj.id);
    setSubject(proj.subject);
    setRequirement(proj.requirement || "");
    setContact(proj.contact || "");
    setUpgrades(proj.upgrades.map((u) => ({ ...u })));
    setView("edit");
  };

  const handleEditSave = async () => {
    const validUpgrades = upgrades.filter((u) => u.beforeSrc && u.alternatives.length > 0).map((u, i) => ({
      ...u,
      title: u.title.trim() || "שידרוג " + (i + 1),
    }));
    if (!validUpgrades.length) return;
    const newProjects = projects.map((p) => {
      if (p.id !== editingProjectId) return p;
      return { ...p, subject: subject.trim(), requirement: requirement.trim(), contact: contact.trim(), upgrades: validUpgrades };
    });
    setProjects(newProjects);
    await doSave(newProjects);
    setEditingProjectId(null);
    resetForm();
    setView("library");
  };

  const cancelEdit = () => {
    setEditingProjectId(null);
    resetForm();
    setView("library");
  };

  if (isLoading) {
    return (
      <div className="app">
        <div className="bg-orbs">
          <div className="orb orb-1" />
          <div className="orb orb-2" />
          <div className="orb orb-3" />
          <div className="orb orb-4" />
        </div>
        <div className="loading-screen">
          <div className="loading-spinner" />
          <p>טוען נתונים...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="app">
        <div className="bg-orbs">
          <div className="orb orb-1" />
          <div className="orb orb-2" />
          <div className="orb orb-3" />
          <div className="orb orb-4" />
        </div>

        {saveStatus && (
          <div className={`save-indicator ${saveStatus}`}>
            {saveStatus === "saving" && "שומר..."}
            {saveStatus === "saved" && "נשמר ✓"}
            {saveStatus === "error" && "שגיאה בשמירה ✗"}
          </div>
        )}

        <div className="header">
          <h1>שידרוגים</h1>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button className="sync-btn" onClick={syncNow} title="סנכרון ענן">
              {syncStatus === "syncing" ? "⟳" : syncStatus === "synced" ? "✓" : syncStatus === "error" ? "✗" : "☁"}
            </button>
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

          {view === "edit" && (
            <div className="form-section glass-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2>עריכת פרויקט</h2>
                <button className="btn-secondary" onClick={cancelEdit}>ביטול</button>
              </div>
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

              <button className="btn-primary" disabled={!canSubmit} onClick={handleEditSave}>שמירת שינויים</button>
            </div>
          )}

          {view === "library" && (
            <>
              {projects.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">
                    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                      <rect x="4" y="12" width="24" height="40" rx="4" stroke="rgba(255,255,255,0.25)" strokeWidth="2" fill="rgba(255,255,255,0.03)"/>
                      <rect x="36" y="12" width="24" height="40" rx="4" stroke="rgba(255,255,255,0.25)" strokeWidth="2" fill="rgba(255,255,255,0.03)"/>
                      <line x1="32" y1="8" x2="32" y2="56" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeDasharray="4 4"/>
                    </svg>
                  </div>
                  <p>הספריה ריקה</p>
                  <p style={{ fontSize: 12, marginBottom: 16 }}>הוסיפו פרויקט ראשון כדי להתחיל</p>
                  <button className="nav-btn" onClick={() => setView("add")}>פרויקט ראשון</button>
                </div>
              ) : (
                <>
                <div className="library-hint">
                  <span className="hint-icon">👆</span>
                  <span>לחצו על פרויקט כדי להפעיל את סליידר ההשוואה לפני / אחרי</span>
                </div>
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
                            <span className="card-badge alt-badge">{proj.upgrades.reduce((s, u) => s + u.alternatives.length, 0) + " חלופות"}</span>
                          </div>
                          <div className="card-date">{proj.date}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                </>
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

                    <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                      <button className="btn-primary" style={{ fontSize: 13, padding: "8px 18px" }} onClick={() => startEditProject(selectedProject)}>עריכת פרויקט</button>
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
