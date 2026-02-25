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

function migrateTasks(tasks) {
  const migrated = {};
  for (const [catId, items] of Object.entries(tasks)) {
    migrated[catId] = items.map((t) =>
      typeof t === "string" ? { text: t, level: 0 } : t
    );
  }
  return migrated;
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.date !== getToday()) return null;
    if (parsed.tasks) parsed.tasks = migrateTasks(parsed.tasks);
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
  const [inputLevels, setInputLevels] = useState({});
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

  const getLevel = (catId) => inputLevels[catId] || 0;

  const toggleInputLevel = (catId) => {
    setInputLevels((prev) => ({ ...prev, [catId]: (prev[catId] || 0) === 0 ? 1 : 0 }));
    inputRefs.current[catId]?.focus();
  };

  const addTask = (catId) => {
    const val = (inputValues[catId] || "").trim();
    if (!val) return;
    const level = getLevel(catId);
    setTasks((prev) => ({
      ...prev,
      [catId]: [...(prev[catId] || []), { text: val, level }],
    }));
    setInputValues((prev) => ({ ...prev, [catId]: "" }));
    inputRefs.current[catId]?.focus();
  };

  const addQuickTask = (catId, task) => {
    if ((tasks[catId] || []).some((t) => t.text === task)) return;
    setTasks((prev) => ({
      ...prev,
      [catId]: [...(prev[catId] || []), { text: task, level: 0 }],
    }));
  };

  const removeTask = (catId, idx) => {
    setTasks((prev) => ({
      ...prev,
      [catId]: prev[catId].filter((_, i) => i !== idx),
    }));
  };

  const toggleTaskLevel = (catId, idx) => {
    setTasks((prev) => ({
      ...prev,
      [catId]: prev[catId].map((t, i) =>
        i === idx ? { ...t, level: t.level === 0 ? 1 : 0 } : t
      ),
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
        [catId]: prev[catId].map((t, i) => (i === idx ? { ...t, text: val } : t)),
      }));
    }
    setEditingTask(null);
    setEditingTaskValue("");
  };

  const generateOutput = () => {
    let lines = [];
    categories.forEach((cat) => {
      const catTasks = tasks[cat.id] || [];
      if (catTasks.length === 0) return;
      if (lines.length > 0) lines.push("");
      lines.push(`-> ${cat.label}:`);
      catTasks.forEach((t) => {
        const indent = t.level === 1 ? "\t\t" : "\t";
        lines.push(`${indent}- ${t.text};`);
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
          font-size: 14px;
          padding: 12px 14px;
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
        .checkin-input.sub-level {
          border-color: #78350f;
          padding-left: 32px;
        }
        .checkin-input.sub-level:focus {
          border-color: #f59e0b;
        }

        .cat-section {
          background: #111113;
          border: 1px solid #1e1e22;
          border-radius: 8px;
          padding: 14px;
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
          padding: 9px 10px;
          border-radius: 5px;
          margin: 4px 0;
          background: #18181b;
          border: 1px solid transparent;
          transition: all 0.15s;
          cursor: default;
          min-height: 40px;
        }
        .task-item:hover {
          border-color: #27272a;
        }
        .task-item:hover .task-actions {
          opacity: 1;
        }
        .task-item.sub-item {
          margin-left: 20px;
          background: #141416;
          border-left: 2px solid #27272a;
          border-radius: 0 5px 5px 0;
        }
        .task-item.sub-item:hover {
          border-left-color: #f59e0b;
        }
        .task-actions {
          opacity: 0;
          transition: opacity 0.15s;
          display: flex;
          gap: 2px;
          flex-shrink: 0;
        }

        .icon-btn {
          background: none;
          border: 1px solid transparent;
          color: #52525b;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 13px;
          font-family: 'JetBrains Mono', monospace;
          transition: all 0.15s;
          min-width: 32px;
          min-height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
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
        .icon-btn.indent-btn:hover {
          color: #f59e0b;
          border-color: #78350f;
          background: #1a1508;
        }

        .quick-tag {
          display: inline-block;
          background: #1a1a1f;
          border: 1px dashed #27272a;
          color: #71717a;
          font-size: 12px;
          font-family: 'JetBrains Mono', monospace;
          padding: 6px 10px;
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
          padding: 12px 20px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
          min-height: 44px;
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
          padding: 10px 14px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
          min-height: 44px;
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
          padding: 16px;
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
          padding: 12px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 10;
          gap: 8px;
          flex-wrap: wrap;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1px;
        }
        .stat-value {
          font-size: 16px;
          font-weight: 700;
          color: #f59e0b;
        }
        .stat-label {
          font-size: 9px;
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
          padding: 16px;
        }
        .modal {
          background: #111113;
          border: 1px solid #27272a;
          border-radius: 12px;
          padding: 20px;
          width: 100%;
          max-width: 520px;
          max-height: 80vh;
          overflow-y: auto;
        }

        .add-btn-inline {
          background: #18181b;
          border: 1px solid #27272a;
          color: #f59e0b;
          font-family: 'JetBrains Mono', monospace;
          font-size: 14px;
          font-weight: 600;
          padding: 10px 14px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
          flex-shrink: 0;
          min-width: 44px;
          min-height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .add-btn-inline:hover {
          background: #1a1508;
          border-color: #f59e0b;
        }

        .indent-toggle {
          background: none;
          border: 1px solid #27272a;
          color: #52525b;
          font-family: 'JetBrains Mono', monospace;
          font-size: 14px;
          font-weight: 600;
          padding: 10px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
          flex-shrink: 0;
          min-width: 44px;
          min-height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .indent-toggle:hover {
          border-color: #78350f;
          color: #f59e0b;
          background: #1a1508;
        }
        .indent-toggle.active {
          border-color: #f59e0b;
          color: #f59e0b;
          background: #1a1508;
        }

        .edit-input {
          background: #0a0a0b;
          border: 1px solid #f59e0b;
          color: #d4d4d8;
          font-family: 'JetBrains Mono', monospace;
          font-size: 14px;
          padding: 8px 10px;
          border-radius: 4px;
          outline: none;
          width: 100%;
        }

        .input-wrapper {
          position: relative;
          flex: 1;
          min-width: 0;
        }
        .sub-indicator {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 12px;
          color: #f59e0b;
          pointer-events: none;
        }

        .input-row {
          display: flex;
          gap: 6px;
          margin-top: 8px;
          align-items: center;
        }

        .tab-hint {
          font-size: 10px;
          color: #3f3f46;
          margin-top: 4px;
          display: none;
          align-items: center;
          gap: 4px;
        }
        .tab-hint kbd {
          background: #1e1e22;
          border: 1px solid #27272a;
          border-radius: 3px;
          padding: 1px 5px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 9px;
          color: #52525b;
        }

        .actions-bar {
          display: flex;
          gap: 8px;
          margin-top: 20px;
          justify-content: space-between;
          flex-wrap: wrap;
        }
        .actions-left {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        /* ---- MOBILE TOUCH: always show actions ---- */
        @media (hover: none) and (pointer: coarse) {
          .task-actions {
            opacity: 1 !important;
          }
        }

        /* ---- DESKTOP: show tab hint, hide indent button ---- */
        @media (hover: hover) and (pointer: fine) {
          .tab-hint {
            display: flex;
          }
          .indent-toggle {
            display: none;
          }
        }

        /* ---- SMALL SCREENS ---- */
        @media (max-width: 480px) {
          .header-bar {
            padding: 10px 12px;
          }
          .header-title {
            font-size: 13px !important;
          }
          .header-date {
            display: none;
          }
          .cat-section {
            padding: 12px 10px;
          }
          .cat-label {
            font-size: 12px !important;
          }
          .task-text {
            font-size: 12px !important;
          }
          .output-block {
            font-size: 11px;
            padding: 12px;
          }
          .primary-btn {
            font-size: 12px;
            padding: 10px 14px;
            flex: 1;
          }
          .ghost-btn {
            font-size: 11px;
            padding: 8px 10px;
          }
          .actions-bar {
            gap: 6px;
          }
          .actions-left {
            flex: 1;
          }
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
        <div className="header-left">
          <span style={{ color: "#f59e0b", fontSize: 16 }}>▸</span>
          <span className="header-title" style={{ fontWeight: 700, fontSize: 15, color: "#e4e4e7", fontFamily: "'Space Mono', monospace" }}>
            check-in
          </span>
          <span className="header-date" style={{ fontSize: 11, color: "#52525b" }}>
            {getToday()}
          </span>
        </div>
        <div className="header-right">
          <div className="stat">
            <span className="stat-value">{totalTasks}</span>
            <span className="stat-label">tasks</span>
          </div>
          <div className="stat">
            <span className="stat-value">{activeCategories}</span>
            <span className="stat-label">seções</span>
          </div>
          <button className="ghost-btn" onClick={() => setShowSettings(true)} style={{ padding: "6px 10px", minHeight: 36, fontSize: 11 }}>
            ⚙
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px 12px 100px" }}>
        {categories.map((cat) => {
          const catTasks = tasks[cat.id] || [];
          const quickTasks = QUICK_TASKS[cat.id] || [];
          const currentLevel = getLevel(cat.id);
          return (
            <div key={cat.id} className="cat-section">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "#f59e0b", fontSize: 14 }}>{cat.icon}</span>
                  <span className="cat-label" style={{ fontWeight: 600, fontSize: 13, color: "#e4e4e7" }}>{cat.label}</span>
                  {catTasks.length > 0 && <span className="badge">{catTasks.length}</span>}
                </div>
              </div>

              {quickTasks.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                  {quickTasks.map((qt, i) => {
                    const isUsed = catTasks.some((t) => t.text === qt);
                    return (
                      <span
                        key={i}
                        className={`quick-tag ${isUsed ? "used" : ""}`}
                        onClick={() => !isUsed && addQuickTask(cat.id, qt)}
                        title={qt}
                      >
                        {isUsed ? "✓ " : "+ "}{qt.length > 50 ? qt.slice(0, 50) + "…" : qt}
                      </span>
                    );
                  })}
                </div>
              )}

              {catTasks.map((task, idx) => (
                <div key={idx} className={`task-item fade-in ${task.level === 1 ? "sub-item" : ""}`}>
                  <span style={{ color: task.level === 1 ? "#78350f" : "#f59e0b", fontSize: 10, marginTop: 5, flexShrink: 0 }}>
                    {task.level === 1 ? "└" : "▸"}
                  </span>
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
                      <span className="task-text" style={{ fontSize: 13, lineHeight: 1.5, flex: 1, wordBreak: "break-word" }}>{task.text}</span>
                      <div className="task-actions">
                        <button
                          className="icon-btn indent-btn"
                          onClick={() => toggleTaskLevel(cat.id, idx)}
                          title={task.level === 0 ? "Indentar" : "Remover indentação"}
                        >
                          {task.level === 0 ? "→" : "←"}
                        </button>
                        <button className="icon-btn" onClick={() => startEditTask(cat.id, idx, task.text)} title="Editar">✎</button>
                        <button className="icon-btn danger" onClick={() => removeTask(cat.id, idx)} title="Remover">✕</button>
                      </div>
                    </>
                  )}
                </div>
              ))}

              <div className="input-row">
                {/* Indent toggle button (visible on mobile, hidden on desktop) */}
                <button
                  className={`indent-toggle ${currentLevel === 1 ? "active" : ""}`}
                  onClick={() => toggleInputLevel(cat.id)}
                  title={currentLevel === 1 ? "Voltar pra item normal" : "Adicionar como sub-item"}
                >
                  ↳
                </button>
                <div className="input-wrapper">
                  {currentLevel === 1 && <span className="sub-indicator">└</span>}
                  <input
                    ref={(el) => (inputRefs.current[cat.id] = el)}
                    className={`checkin-input ${currentLevel === 1 ? "sub-level" : ""}`}
                    placeholder={currentLevel === 1 ? `Sub-item...` : `Adicionar em ${cat.label}...`}
                    value={inputValues[cat.id] || ""}
                    onChange={(e) => setInputValues((prev) => ({ ...prev, [cat.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Tab") {
                        e.preventDefault();
                        toggleInputLevel(cat.id);
                      }
                      if (e.key === "Enter") addTask(cat.id);
                    }}
                  />
                </div>
                <button className="add-btn-inline" onClick={() => addTask(cat.id)}>+</button>
              </div>
              <div className="tab-hint">
                <kbd>Tab</kbd> {currentLevel === 1 ? "sub-item ativo" : "alternar sub-item"}
                {currentLevel === 1 && <span style={{ color: "#f59e0b" }}>●</span>}
              </div>
            </div>
          );
        })}

        <div className="actions-bar">
          <div className="actions-left">
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

        {showOutput && hasContent && (
          <div style={{ marginTop: 16 }} className="fade-in">
            <div style={{ fontSize: 11, color: "#52525b", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
              Output → Slack
            </div>
            <div className="output-block">{output}</div>
          </div>
        )}
      </div>

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
                  padding: "10px 12px", borderRadius: 6, marginBottom: 4,
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