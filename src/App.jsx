import { useState, useEffect, useRef } from "react";

const DEFAULT_CATEGORIES = [
  { id: "meta", label: "Integração Meta", icon: "◈" },
  { id: "sustentacao", label: "Sustentação", icon: "⚙" },
  { id: "gestao", label: "Sistema de Gestão V2", icon: "◧" },
  { id: "listbuilding", label: "Listbuilding", icon: "◫" },
  { id: "onboarding", label: "Max Onboarding", icon: "◰" },
  { id: "outros", label: "Outros", icon: "◇" },
];

const QUICK_TASKS = {
  meta: [
    "Monitoramento e sustentação de templates e números Meta",
  ],
  sustentacao: [
    "Acompanhei o canal de alertas e o banco do Airflow, garantindo a execução das rotinas e tratando as falhas identificadas ao longo do dia",
  ],
};

const STORAGE_KEY = "checkin-data";
const CATEGORIES_KEY = "checkin-categories";

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.date !== getToday()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, date: getToday() }));
  } catch {}
}

function loadCategories() {
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_CATEGORIES;
}

function saveCategories(cats) {
  try {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(cats));
  } catch {}
}

export default function App() {
  const [categories, setCategories] = useState(loadCategories);
  const [tasks, setTasks] = useState({});
  const [inputValues, setInputValues] = useState({});
  const [copied, setCopied] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [newCatName, setNewCatName] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [editingTaskValue, setEditingTaskValue] = useState("");
  const inputRefs = useRef({});

  useEffect(() => {
    const saved = loadData();
    if (saved?.tasks) setTasks(saved.tasks);
  }, []);

  useEffect(() => {
    saveData({ tasks });
  }, [tasks]);

  useEffect(() => {
    saveCategories(categories);
  }, [categories]);

  const addTask = (catId) => {
    const val = (inputValues[catId] || "").trim();
    if (!val) return;
    setTasks((prev) => ({
      ...prev,
      [catId]: [...(prev[catId] || []), val],
    }));
    setInputValues((prev) => ({ ...prev, [catId]: "" }));
    inputRefs.current[catId]?.focus();
  };

  const addQuickTask = (catId, task) => {
    if ((tasks[catId] || []).includes(task)) return;
    setTasks((prev) => ({
      ...prev,
      [catId]: [...(prev[catId] || []), task],
    }));
  };

  const removeTask = (catId, idx) => {
    setTasks((prev) => ({
      ...prev,
      [catId]: prev[catId].filter((_, i) => i !== idx),
    }));
  };

  const startEditTask = (catId, idx, value) => {
    setEditingTask({ catId, idx });
    setEditingTaskValue(value);
  };

  const saveEditTask = () => {
    if (!editingTask) return;
    const { catId, idx } = editingTask;
    const val = editingTaskValue.trim();
    if (val) {
      setTasks((prev) => ({
        ...prev,
        [catId]: prev[catId].map((t, i) => (i === idx ? val : t)),
      }));
    }
    setEditingTask(null);
    setEditingTaskValue("");
  };

  const generateOutput = () => {
    let lines = [];
    categories.forEach((cat, catIdx) => {
      const catTasks = tasks[cat.id] || [];
      if (catTasks.length === 0) return;
      if (lines.length > 0) lines.push("");
      lines.push(`-> ${cat.label}:`);
      catTasks.forEach((t) => {
        lines.push(`\t- ${t};`);
      });
    });
    return lines.join("\n");
  };

  const copyToClipboard = () => {
    const text = generateOutput();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const clearDay = () => {
    setTasks({});
    setShowOutput(false);
  };

  const totalTasks = Object.values(tasks).reduce((sum, arr) => sum + arr.length, 0);
  const activeCategories = categories.filter((c) => (tasks[c.id] || []).length > 0).length;

  const addCategory = () => {
    const name = newCatName.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (categories.find((c) => c.id === id)) return;
    setCategories((prev) => [...prev, { id, label: name, icon: "◆" }]);
    setNewCatName("");
  };

  const removeCategory = (id) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setTasks((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const output = generateOutput();
  const hasContent = totalTasks > 0;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0b",
      color: "#d4d4d8",
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Source Code Pro', monospace",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .checkin-input {
          background: #18181b;
          border: 1px solid #27272a;
          color: #d4d4d8;
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          padding: 10px 14px;
          border-radius: 6px;
          outline: none;
          width: 100%;
          transition: border-color 0.15s;
        }
        .checkin-input:focus {
          border-color: #f59e0b;
        }
        .checkin-input::placeholder {
          color: #52525b;
        }

        .cat-section {
          background: #111113;
          border: 1px solid #1e1e22;
          border-radius: 8px;
          padding: 16px 18px;
          margin-bottom: 10px;
          transition: border-color 0.2s;
        }
        .cat-section:hover {
          border-color: #27272a;
        }

        .task-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 7px 10px;
          border-radius: 5px;
          margin: 4px 0;
          background: #18181b;
          border: 1px solid transparent;
          transition: all 0.15s;
          cursor: default;
        }
        .task-item:hover {
          border-color: #27272a;
        }
        .task-item:hover .task-actions {
          opacity: 1;
        }
        .task-actions {
          opacity: 0;
          transition: opacity 0.15s;
          display: flex;
          gap: 4px;
          flex-shrink: 0;
        }

        .icon-btn {
          background: none;
          border: 1px solid transparent;
          color: #52525b;
          cursor: pointer;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 12px;
          font-family: 'JetBrains Mono', monospace;
          transition: all 0.15s;
        }
        .icon-btn:hover {
          color: #d4d4d8;
          border-color: #3f3f46;
          background: #27272a;
        }
        .icon-btn.danger:hover {
          color: #ef4444;
          border-color: #7f1d1d;
          background: #1c0a0a;
        }

        .quick-tag {
          display: inline-block;
          background: #1a1a1f;
          border: 1px dashed #27272a;
          color: #71717a;
          font-size: 11px;
          font-family: 'JetBrains Mono', monospace;
          padding: 4px 10px;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .quick-tag:hover {
          border-color: #f59e0b;
          color: #f59e0b;
          border-style: solid;
          background: #1a1508;
        }
        .quick-tag.used {
          opacity: 0.3;
          cursor: default;
          border-style: solid;
        }

        .primary-btn {
          background: #f59e0b;
          color: #0a0a0b;
          border: none;
          font-family: 'JetBrains Mono', monospace;
          font-weight: 600;
          font-size: 13px;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .primary-btn:hover {
          background: #fbbf24;
          transform: translateY(-1px);
        }
        .primary-btn:active {
          transform: translateY(0);
        }
        .primary-btn.copied {
          background: #22c55e;
        }

        .ghost-btn {
          background: none;
          border: 1px solid #27272a;
          color: #71717a;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          padding: 8px 14px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .ghost-btn:hover {
          border-color: #3f3f46;
          color: #a1a1aa;
          background: #18181b;
        }

        .output-block {
          background: #0f0f11;
          border: 1px solid #27272a;
          border-radius: 8px;
          padding: 20px;
          font-size: 13px;
          line-height: 1.7;
          white-space: pre-wrap;
          word-break: break-word;
          color: #a1a1aa;
          max-height: 400px;
          overflow-y: auto;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #f59e0b;
          color: #0a0a0b;
          font-size: 10px;
          font-weight: 700;
          min-width: 18px;
          height: 18px;
          border-radius: 9px;
          padding: 0 5px;
        }

        .header-bar {
          background: #0f0f11;
          border-bottom: 1px solid #1e1e22;
          padding: 14px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }
        .stat-value {
          font-size: 18px;
          font-weight: 700;
          color: #f59e0b;
        }
        .stat-label {
          font-size: 10px;
          color: #52525b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          backdrop-filter: blur(4px);
        }
        .modal {
          background: #111113;
          border: 1px solid #27272a;
          border-radius: 12px;
          padding: 24px;
          width: 90%;
          max-width: 520px;
          max-height: 80vh;
          overflow-y: auto;
        }

        .add-btn-inline {
          background: #18181b;
          border: 1px solid #27272a;
          color: #f59e0b;
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          font-weight: 600;
          padding: 8px 14px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
          flex-shrink: 0;
        }
        .add-btn-inline:hover {
          background: #1a1508;
          border-color: #f59e0b;
        }

        .edit-input {
          background: #0a0a0b;
          border: 1px solid #f59e0b;
          color: #d4d4d8;
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          padding: 6px 10px;
          border-radius: 4px;
          outline: none;
          width: 100%;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>

      {/* Header */}
      <div className="header-bar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "#f59e0b", fontSize: 16 }}>▸</span>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#e4e4e7", fontFamily: "'Space Mono', monospace" }}>
            check-in
          </span>
          <span style={{ fontSize: 11, color: "#52525b", marginLeft: 4 }}>
            {getToday()}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div className="stat">
            <span className="stat-value">{totalTasks}</span>
            <span className="stat-label">tasks</span>
          </div>
          <div className="stat">
            <span className="stat-value">{activeCategories}</span>
            <span className="stat-label">seções</span>
          </div>
          <button className="ghost-btn" onClick={() => setShowSettings(true)} style={{ marginLeft: 8 }}>
            ⚙ categorias
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 16px 100px" }}>
        {/* Categories */}
        {categories.map((cat) => {
          const catTasks = tasks[cat.id] || [];
          const quickTasks = QUICK_TASKS[cat.id] || [];
          return (
            <div key={cat.id} className="cat-section">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "#f59e0b", fontSize: 14 }}>{cat.icon}</span>
                  <span style={{ fontWeight: 600, fontSize: 13, color: "#e4e4e7" }}>{cat.label}</span>
                  {catTasks.length > 0 && <span className="badge">{catTasks.length}</span>}
                </div>
              </div>

              {/* Quick tasks */}
              {quickTasks.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                  {quickTasks.map((qt, i) => {
                    const isUsed = catTasks.includes(qt);
                    return (
                      <span
                        key={i}
                        className={`quick-tag ${isUsed ? "used" : ""}`}
                        onClick={() => !isUsed && addQuickTask(cat.id, qt)}
                        title={qt}
                      >
                        {isUsed ? "✓ " : "+ "}{qt.length > 60 ? qt.slice(0, 60) + "…" : qt}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Task list */}
              {catTasks.map((task, idx) => (
                <div key={idx} className="task-item fade-in">
                  <span style={{ color: "#f59e0b", fontSize: 10, marginTop: 4, flexShrink: 0 }}>▸</span>
                  {editingTask?.catId === cat.id && editingTask?.idx === idx ? (
                    <div style={{ flex: 1, display: "flex", gap: 6 }}>
                      <input
                        className="edit-input"
                        value={editingTaskValue}
                        onChange={(e) => setEditingTaskValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEditTask();
                          if (e.key === "Escape") { setEditingTask(null); setEditingTaskValue(""); }
                        }}
                        autoFocus
                      />
                      <button className="icon-btn" onClick={saveEditTask} title="Salvar">✓</button>
                    </div>
                  ) : (
                    <>
                      <span style={{ fontSize: 12, lineHeight: 1.5, flex: 1, wordBreak: "break-word" }}>{task}</span>
                      <div className="task-actions">
                        <button className="icon-btn" onClick={() => startEditTask(cat.id, idx, task)} title="Editar">✎</button>
                        <button className="icon-btn danger" onClick={() => removeTask(cat.id, idx)} title="Remover">✕</button>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {/* Input */}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input
                  ref={(el) => (inputRefs.current[cat.id] = el)}
                  className="checkin-input"
                  placeholder={`Adicionar em ${cat.label}...`}
                  value={inputValues[cat.id] || ""}
                  onChange={(e) => setInputValues((prev) => ({ ...prev, [cat.id]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") addTask(cat.id); }}
                />
                <button className="add-btn-inline" onClick={() => addTask(cat.id)}>+</button>
              </div>
            </div>
          );
        })}

        {/* Actions */}
        <div style={{
          display: "flex", gap: 10, marginTop: 20, justifyContent: "space-between",
          flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              className={`primary-btn ${copied ? "copied" : ""}`}
              onClick={copyToClipboard}
              disabled={!hasContent}
              style={{ opacity: hasContent ? 1 : 0.4 }}
            >
              {copied ? "✓ Copiado!" : "⎘ Copiar check-in"}
            </button>
            <button
              className="ghost-btn"
              onClick={() => setShowOutput(!showOutput)}
              disabled={!hasContent}
              style={{ opacity: hasContent ? 1 : 0.4 }}
            >
              {showOutput ? "Esconder" : "Preview"}
            </button>
          </div>
          <button
            className="ghost-btn"
            onClick={clearDay}
            disabled={!hasContent}
            style={{ opacity: hasContent ? 1 : 0.3 }}
          >
            Limpar dia
          </button>
        </div>

        {/* Output preview */}
        {showOutput && hasContent && (
          <div style={{ marginTop: 16 }} className="fade-in">
            <div style={{ fontSize: 11, color: "#52525b", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
              Output → Slack
            </div>
            <div className="output-block">{output}</div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: "#e4e4e7" }}>Categorias</span>
              <button className="icon-btn" onClick={() => setShowSettings(false)}>✕</button>
            </div>
            {categories.map((cat) => (
              <div
                key={cat.id}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 10px", borderRadius: 6, marginBottom: 4,
                  background: "#18181b",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "#f59e0b" }}>{cat.icon}</span>
                  <span style={{ fontSize: 13 }}>{cat.label}</span>
                </div>
                <button className="icon-btn danger" onClick={() => removeCategory(cat.id)}>✕</button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input
                className="checkin-input"
                placeholder="Nova categoria..."
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addCategory(); }}
              />
              <button className="add-btn-inline" onClick={addCategory}>+</button>
            </div>
            <div style={{ fontSize: 11, color: "#52525b", marginTop: 12 }}>
              As categorias ficam salvas no navegador.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
