import { useState, useEffect, useRef, useCallback } from "react";

const DEFAULT_CATEGORIES = [
  { id: "meta", label: "Integração Meta", icon: "◈" },
  { id: "sustentacao", label: "Sustentação", icon: "⚙" },
  { id: "gestao", label: "Sistema de Gestão V2", icon: "◧" },
  { id: "listbuilding", label: "Listbuilding", icon: "◫" },
  { id: "onboarding", label: "Max Onboarding", icon: "◰" },
  { id: "outros", label: "Outros", icon: "◇" },
];

const QUICK_TASKS = {
  meta: {
    daily: ["Monitoramento e sustentação de templates e números Meta"],
    weekly: ["Monitoramento e sustentação de modelos de templates e números Meta"],
  },
  sustentacao: {
    daily: ["Acompanhei o canal de alertas e o banco do Airflow, garantindo a execução das rotinas e tratando as falhas identificadas ao longo do dia"],
    weekly: ["Acompanhar o canal de alertas e o banco do Airflow, garantindo a execução das rotinas e tratando as falhas identificadas ao longo do dia"],
  },
};

const STORAGE_KEY = "checkin-data";
const STORAGE_KEY_WEEKLY = "checkin-data-weekly";
const CATEGORIES_KEY = "checkin-categories";
const HISTORY_KEY = "checkin-history";
const MODE_KEY = "checkin-mode";
const COLLAPSED_KEY = "checkin-collapsed";

function getToday() { return new Date().toISOString().slice(0, 10); }

function getWeekId() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now - start;
  const weekNum = Math.ceil(diff / 604800000);
  return `${now.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function getMonday() {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return d.toISOString().slice(0, 10);
}

function getFriday() {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1) + 4);
  return d.toISOString().slice(0, 10);
}

function migrateTasks(tasks) {
  const m = {};
  for (const [k, items] of Object.entries(tasks))
    m[k] = items.map((t) => typeof t === "string" ? { text: t, level: 0 } : t);
  return m;
}

function ls(key, fallback) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; }
  catch { return fallback; }
}

function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

function loadStorage(key, dateCheck) {
  const parsed = ls(key, null);
  if (!parsed || (dateCheck && parsed.date !== dateCheck)) return null;
  if (parsed.tasks) parsed.tasks = migrateTasks(parsed.tasks);
  return parsed;
}

function loadHistory() { return ls(HISTORY_KEY, []); }

function saveToHistory(entry) {
  const history = loadHistory();
  const idx = history.findIndex((h) => h.date === entry.date && h.mode === entry.mode);
  if (idx >= 0) history[idx] = entry; else history.push(entry);
  lsSet(HISTORY_KEY, history.slice(-30));
}

export default function App() {
  const [mode, setMode] = useState(() => ls(MODE_KEY, "daily") || "daily");
  const [categories, setCategories] = useState(() => ls(CATEGORIES_KEY, DEFAULT_CATEGORIES));
  const [tasks, setTasks] = useState({});
  const [priorities, setPriorities] = useState({});
  const [collapsed, setCollapsed] = useState(() => ls(COLLAPSED_KEY, {}));
  const [inputValues, setInputValues] = useState({});
  const [inputLevels, setInputLevels] = useState({});
  const [copied, setCopied] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [editingTaskValue, setEditingTaskValue] = useState("");
  const inputRefs = useRef({});
  const clearTimer = useRef(null);

  useEffect(() => {
    if (mode === "daily") {
      const s = loadStorage(STORAGE_KEY, getToday());
      setTasks(s?.tasks || {}); setPriorities({});
    } else {
      const s = loadStorage(STORAGE_KEY_WEEKLY, getWeekId());
      setTasks(s?.tasks || {}); setPriorities(s?.priorities || {});
    }
  }, [mode]);

  useEffect(() => {
    if (mode === "daily") lsSet(STORAGE_KEY, { tasks, date: getToday() });
    else lsSet(STORAGE_KEY_WEEKLY, { tasks, priorities, date: getWeekId() });
  }, [tasks, priorities, mode]);

  useEffect(() => { lsSet(CATEGORIES_KEY, categories); }, [categories]);
  useEffect(() => { lsSet(COLLAPSED_KEY, collapsed); }, [collapsed]);

  const switchMode = (m) => {
    const total = Object.values(tasks).reduce((s, a) => s + a.length, 0);
    if (total > 0) saveToHistory({
      date: mode === "daily" ? getToday() : getWeekId(), mode, tasks,
      priorities: mode === "weekly" ? priorities : undefined,
    });
    setMode(m); localStorage.setItem(MODE_KEY, m);
    setShowOutput(false); setInputLevels({});
  };

  const getLevel = (id) => inputLevels[id] || 0;
  const toggleInputLevel = (id) => {
    setInputLevels((p) => ({ ...p, [id]: (p[id] || 0) === 0 ? 1 : 0 }));
    inputRefs.current[id]?.focus();
  };
  const toggleCollapsed = (id) => setCollapsed((p) => ({ ...p, [id]: !p[id] }));

  const addTask = (catId) => {
    const val = (inputValues[catId] || "").trim();
    if (!val) return;
    setTasks((p) => ({ ...p, [catId]: [...(p[catId] || []), { text: val, level: getLevel(catId) }] }));
    setInputValues((p) => ({ ...p, [catId]: "" }));
    if (collapsed[catId]) setCollapsed((p) => ({ ...p, [catId]: false }));
    inputRefs.current[catId]?.focus();
  };

  const addQuickTask = (catId, task) => {
    if ((tasks[catId] || []).some((t) => t.text === task)) return;
    setTasks((p) => ({ ...p, [catId]: [...(p[catId] || []), { text: task, level: 0 }] }));
    if (collapsed[catId]) setCollapsed((p) => ({ ...p, [catId]: false }));
  };

  const removeTask = (catId, idx) => {
    setTasks((p) => ({ ...p, [catId]: p[catId].filter((_, i) => i !== idx) }));
  };

  const toggleTaskLevel = (catId, idx) => {
    setTasks((p) => ({ ...p, [catId]: p[catId].map((t, i) => i === idx ? { ...t, level: t.level === 0 ? 1 : 0 } : t) }));
  };

  const moveTask = (catId, idx, dir) => {
    setTasks((p) => {
      const arr = [...(p[catId] || [])];
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= arr.length) return p;
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return { ...p, [catId]: arr };
    });
  };

  const togglePriority = (catId) => setPriorities((p) => ({ ...p, [catId]: !p[catId] }));

  const startEditTask = (catId, idx, value) => { setEditingTask({ catId, idx }); setEditingTaskValue(value); };
  const saveEditTask = () => {
    if (!editingTask) return;
    const { catId, idx } = editingTask;
    const val = editingTaskValue.trim();
    if (val) setTasks((p) => ({ ...p, [catId]: p[catId].map((t, i) => i === idx ? { ...t, text: val } : t) }));
    setEditingTask(null); setEditingTaskValue("");
  };

  const generateOutput = useCallback(() => {
    let lines = [];
    if (mode === "weekly") {
      const prio = categories.filter((c) => priorities[c.id] && (tasks[c.id] || []).length > 0);
      const normal = categories.filter((c) => !priorities[c.id] && (tasks[c.id] || []).length > 0);
      if (prio.length > 0) {
        lines.push("->> Prioridades:");
        prio.forEach((cat) => {
          lines.push(`\t-> ${cat.label}:`);
          (tasks[cat.id] || []).forEach((t) => {
            lines.push(`${t.level === 1 ? "\t\t\t" : "\t\t"}- ${t.text};`);
          });
        });
      }
      normal.forEach((cat) => {
        lines.push(`-> ${cat.label}:`);
        (tasks[cat.id] || []).forEach((t) => {
          lines.push(`${t.level === 1 ? "\t\t" : "\t"}- ${t.text};`);
        });
      });
    } else {
      categories.forEach((cat) => {
        const ct = tasks[cat.id] || [];
        if (!ct.length) return;
        lines.push(`-> ${cat.label}:`);
        ct.forEach((t) => { lines.push(`${t.level === 1 ? "\t\t" : "\t"}- ${t.text};`); });
      });
    }
    return lines.join("\n");
  }, [mode, categories, tasks, priorities]);

  const copyToClipboard = () => {
    const text = generateOutput();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
      saveToHistory({
        date: mode === "daily" ? getToday() : getWeekId(), mode, tasks,
        priorities: mode === "weekly" ? priorities : undefined,
      });
    });
  };

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      clearTimer.current = setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    clearTimeout(clearTimer.current);
    setTasks({}); setPriorities({}); setShowOutput(false); setConfirmClear(false);
  };

  const totalTasks = Object.values(tasks).reduce((s, a) => s + a.length, 0);
  const activeCats = categories.filter((c) => (tasks[c.id] || []).length > 0).length;

  const addCategory = () => {
    const name = newCatName.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (categories.find((c) => c.id === id)) return;
    setCategories((p) => [...p, { id, label: name, icon: "◆" }]);
    setNewCatName("");
  };

  const removeCategory = (id) => {
    setCategories((p) => p.filter((c) => c.id !== id));
    setTasks((p) => { const n = { ...p }; delete n[id]; return n; });
  };

  const output = generateOutput();
  const hasContent = totalTasks > 0;
  const isWeekly = mode === "weekly";
  const accent = isWeekly ? "#8b5cf6" : "#f59e0b";
  const accentBg = isWeekly ? "#1a1025" : "#1a1508";
  const dateLabel = isWeekly ? `${getMonday()} → ${getFriday()}` : getToday();
  const history = loadHistory();
  const recentDaily = history.filter((h) => h.mode === "daily").slice(-7).reverse();

  return (
    <div style={{ minHeight: "100vh", minHeight: "100dvh", background: "#0a0a0b", color: "#d4d4d8", fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        html{-webkit-text-size-adjust:100%;-webkit-tap-highlight-color:transparent}
        input,button{-webkit-appearance:none;-moz-appearance:none}

        .ci-input{background:#18181b;border:1px solid #27272a;color:#d4d4d8;font-family:'JetBrains Mono',monospace;font-size:16px;padding:12px 14px;border-radius:8px;outline:none;width:100%;transition:border-color .15s}
        .ci-input:focus{border-color:${accent}}
        .ci-input::placeholder{color:#52525b}
        .ci-input.sub{border-color:#78350f;padding-left:32px}
        .ci-input.sub:focus{border-color:${accent}}

        .cat-sec{background:#111113;border:1px solid #1e1e22;border-radius:10px;padding:14px;margin-bottom:10px;transition:border-color .2s}
        .cat-sec.prio{border-color:#5b21b6;background:#0f0d14}

        .cat-header{display:flex;align-items:center;justify-content:space-between;padding:2px 0;cursor:pointer;-webkit-user-select:none;user-select:none;min-height:36px}
        .cat-header-left{display:flex;align-items:center;gap:8px;min-width:0;flex:1}
        .cat-header-right{display:flex;align-items:center;gap:6px}
        .chevron{font-size:10px;color:#52525b;transition:transform .2s;flex-shrink:0}
        .chevron.open{transform:rotate(90deg)}

        .task-item{display:flex;align-items:flex-start;gap:8px;padding:10px;border-radius:6px;margin:3px 0;background:#18181b;border:1px solid transparent;transition:all .15s;min-height:44px}
        .task-item:hover{border-color:#27272a}
        .task-item.sub{margin-left:20px;background:#141416;border-left:2px solid #27272a;border-radius:0 6px 6px 0}
        .task-item.sub:hover{border-left-color:${accent}}
        .task-actions{display:flex;gap:2px;flex-shrink:0;opacity:0;transition:opacity .15s}
        .task-item:hover .task-actions{opacity:1}

        .ibtn{background:none;border:1px solid transparent;color:#52525b;cursor:pointer;padding:4px 8px;border-radius:6px;font-size:13px;font-family:'JetBrains Mono',monospace;transition:all .15s;min-width:36px;min-height:36px;display:flex;align-items:center;justify-content:center}
        .ibtn:hover{color:#d4d4d8;border-color:#3f3f46;background:#27272a}
        .ibtn.danger:hover{color:#ef4444;border-color:#7f1d1d;background:#1c0a0a}
        .ibtn.indent:hover{color:${accent};border-color:${isWeekly?"#5b21b6":"#78350f"};background:${accentBg}}
        .ibtn.move:hover{color:${accent};border-color:${isWeekly?"#5b21b6":"#78350f"};background:${accentBg}}

        .qtag{display:inline-flex;background:#1a1a1f;border:1px dashed #27272a;color:#71717a;font-size:12px;font-family:'JetBrains Mono',monospace;padding:8px 12px;border-radius:6px;cursor:pointer;transition:all .15s;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .qtag:hover{border-color:${accent};color:${accent};border-style:solid;background:${accentBg}}
        .qtag.used{opacity:.3;cursor:default;border-style:solid}

        .btn-primary{background:${accent};color:${isWeekly?"#fff":"#0a0a0b"};border:none;font-family:'JetBrains Mono',monospace;font-weight:600;font-size:14px;padding:14px 20px;border-radius:8px;cursor:pointer;transition:all .15s;min-height:48px;width:100%}
        .btn-primary:hover{filter:brightness(1.15);transform:translateY(-1px)}
        .btn-primary:active{transform:translateY(0)}
        .btn-primary.copied{background:#22c55e}

        .btn-ghost{background:none;border:1px solid #27272a;color:#71717a;font-family:'JetBrains Mono',monospace;font-size:12px;padding:10px 14px;border-radius:8px;cursor:pointer;transition:all .15s;min-height:48px}
        .btn-ghost:hover{border-color:#3f3f46;color:#a1a1aa;background:#18181b}

        .output-block{background:#0f0f11;border:1px solid #27272a;border-radius:8px;padding:16px;font-size:13px;line-height:1.7;white-space:pre-wrap;word-break:break-word;color:#a1a1aa;max-height:50vh;overflow-y:auto;-webkit-overflow-scrolling:touch}

        .badge{display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;min-width:20px;height:20px;border-radius:10px;padding:0 6px}

        .header{background:#0f0f11;border-bottom:1px solid #1e1e22;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10;gap:8px;flex-wrap:wrap}
        .h-left{display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap}
        .h-right{display:flex;align-items:center;gap:10px}

        .mode-tog{display:flex;background:#18181b;border:1px solid #27272a;border-radius:8px;overflow:hidden}
        .mode-btn{background:none;border:none;color:#52525b;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:600;padding:8px 14px;cursor:pointer;transition:all .15s;min-height:36px}
        .mode-btn:hover{color:#a1a1aa}
        .mode-btn.on{background:#f59e0b;color:#0a0a0b}
        .mode-btn.on-w{background:#8b5cf6;color:#fff}

        .stat{display:flex;flex-direction:column;align-items:center;gap:1px}
        .stat-v{font-size:16px;font-weight:700;color:${accent}}
        .stat-l{font-size:9px;color:#52525b;text-transform:uppercase;letter-spacing:.5px}

        .overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:flex-end;justify-content:center;z-index:100;backdrop-filter:blur(4px);padding:0}
        .modal{background:#111113;border:1px solid #27272a;border-radius:16px 16px 0 0;padding:20px;width:100%;max-width:560px;max-height:85vh;overflow-y:auto;-webkit-overflow-scrolling:touch;animation:slideUp .25s ease-out}

        .add-btn{background:#18181b;border:1px solid #27272a;color:${accent};font-family:'JetBrains Mono',monospace;font-size:16px;font-weight:600;border-radius:8px;cursor:pointer;transition:all .15s;flex-shrink:0;width:48px;height:48px;display:flex;align-items:center;justify-content:center}
        .add-btn:hover{background:${accentBg};border-color:${accent}}

        .indent-tog{background:none;border:1px solid #27272a;color:#52525b;font-family:'JetBrains Mono',monospace;font-size:16px;font-weight:600;border-radius:8px;cursor:pointer;transition:all .15s;flex-shrink:0;width:48px;height:48px;display:flex;align-items:center;justify-content:center}
        .indent-tog:hover{border-color:${isWeekly?"#5b21b6":"#78350f"};color:${accent};background:${accentBg}}
        .indent-tog.on{border-color:${accent};color:${accent};background:${accentBg}}

        .prio-btn{background:none;border:1px solid #27272a;color:#52525b;font-size:11px;padding:4px 10px;border-radius:6px;cursor:pointer;transition:all .15s;min-height:32px;display:flex;align-items:center;gap:4px;font-family:'JetBrains Mono',monospace;white-space:nowrap}
        .prio-btn:hover{border-color:#8b5cf6;color:#8b5cf6}
        .prio-btn.on{border-color:#8b5cf6;color:#8b5cf6;background:#1a1025}

        .edit-input{background:#0a0a0b;border:1px solid ${accent};color:#d4d4d8;font-family:'JetBrains Mono',monospace;font-size:16px;padding:10px;border-radius:6px;outline:none;width:100%}

        .input-wrap{position:relative;flex:1;min-width:0}
        .sub-ind{position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:12px;color:${accent};pointer-events:none}
        .input-row{display:flex;gap:6px;margin-top:10px;align-items:center}

        .tab-hint{font-size:10px;color:#3f3f46;margin-top:4px;display:none;align-items:center;gap:4px}
        .tab-hint kbd{background:#1e1e22;border:1px solid #27272a;border-radius:3px;padding:1px 5px;font-family:'JetBrains Mono',monospace;font-size:9px;color:#52525b}

        .actions{display:flex;flex-direction:column;gap:8px;margin-top:24px}
        .actions-row{display:flex;gap:8px}

        .hist-item{background:#18181b;border:1px solid #27272a;border-radius:8px;padding:12px;margin-bottom:8px}
        .hist-date{font-size:11px;color:${accent};font-weight:600;margin-bottom:6px}
        .hist-text{font-size:11px;color:#71717a;line-height:1.5;white-space:pre-wrap;max-height:120px;overflow-y:auto;-webkit-overflow-scrolling:touch}

        .clear-warn{background:#7f1d1d !important;border-color:#ef4444 !important;color:#fff !important}

        .empty-cat{font-size:11px;color:#3f3f46;padding:4px 0;font-style:italic}

        @media(hover:none)and(pointer:coarse){
          .task-actions{opacity:1!important}
        }
        @media(hover:hover)and(pointer:fine){
          .tab-hint{display:flex}
          .indent-tog{display:none}
          .overlay{align-items:center;padding:16px}
          .modal{border-radius:12px;animation:fadeScale .2s ease-out}
        }
        @media(min-width:481px){
          .actions{flex-direction:row;justify-content:space-between;flex-wrap:wrap}
          .actions-row{flex:1}
          .btn-primary{width:auto}
        }
        @media(max-width:480px){
          .header{padding:10px 12px}
          .h-title{font-size:13px!important}
          .h-date{display:none}
          .cat-sec{padding:12px 10px;border-radius:8px}
          .mode-btn{padding:6px 10px;font-size:11px}
          .output-block{font-size:11px;padding:12px}
        }
        @media(max-width:360px){
          .stat{display:none}
          .mode-btn{padding:6px 8px;font-size:10px}
        }

        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeScale{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
        .fade-in{animation:fadeIn .2s ease-out}
      `}</style>

      {/* Header */}
      <div className="header">
        <div className="h-left">
          <span style={{ color: accent, fontSize: 16 }}>▸</span>
          <span className="h-title" style={{ fontWeight: 700, fontSize: 15, color: "#e4e4e7", fontFamily: "'Space Mono', monospace" }}>check-in</span>
          <div className="mode-tog">
            <button className={`mode-btn ${mode === "daily" ? "on" : ""}`} onClick={() => switchMode("daily")}>Diário</button>
            <button className={`mode-btn ${mode === "weekly" ? "on-w" : ""}`} onClick={() => switchMode("weekly")}>Semanal</button>
          </div>
          <span className="h-date" style={{ fontSize: 10, color: "#52525b" }}>{dateLabel}</span>
        </div>
        <div className="h-right">
          <div className="stat">
            <span className="stat-v">{totalTasks}</span>
            <span className="stat-l">tasks</span>
          </div>
          <div className="stat">
            <span className="stat-v">{activeCats}</span>
            <span className="stat-l">seções</span>
          </div>
          {isWeekly && (
            <button className="btn-ghost" onClick={() => setShowHistory(true)} style={{ padding: "6px 10px", minHeight: 36, fontSize: 12 }}>📋</button>
          )}
          <button className="btn-ghost" onClick={() => setShowSettings(true)} style={{ padding: "6px 10px", minHeight: 36, fontSize: 12 }}>⚙</button>
        </div>
      </div>

      {/* Main */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px 12px 120px" }}>
        {categories.map((cat) => {
          const ct = tasks[cat.id] || [];
          const qm = QUICK_TASKS[cat.id];
          const qt = qm ? (qm[mode] || qm.daily || []) : [];
          const lvl = getLevel(cat.id);
          const isPrio = isWeekly && priorities[cat.id];
          const isCollapsed = collapsed[cat.id] && ct.length > 0;

          return (
            <div key={cat.id} className={`cat-sec ${isPrio ? "prio" : ""}`}>
              <div className="cat-header" onClick={() => ct.length > 0 && toggleCollapsed(cat.id)}>
                <div className="cat-header-left">
                  {ct.length > 0 && <span className={`chevron ${!isCollapsed ? "open" : ""}`}>▸</span>}
                  <span style={{ color: isPrio ? "#8b5cf6" : accent, fontSize: 14 }}>{cat.icon}</span>
                  <span style={{ fontWeight: 600, fontSize: 13, color: "#e4e4e7", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat.label}</span>
                  {ct.length > 0 && <span className="badge" style={{ background: isPrio ? "#8b5cf6" : accent, color: isPrio ? "#fff" : "#0a0a0b" }}>{ct.length}</span>}
                </div>
                <div className="cat-header-right" onClick={(e) => e.stopPropagation()}>
                  {isWeekly && (
                    <button className={`prio-btn ${isPrio ? "on" : ""}`} onClick={() => togglePriority(cat.id)}>
                      {isPrio ? "★" : "☆"} <span style={{ display: "inline" }}>prio</span>
                    </button>
                  )}
                </div>
              </div>

              {!isCollapsed && (
                <div className="fade-in">
                  {qt.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "8px 0" }}>
                      {qt.map((q, i) => {
                        const used = ct.some((t) => t.text === q);
                        return (
                          <span key={i} className={`qtag ${used ? "used" : ""}`} onClick={() => !used && addQuickTask(cat.id, q)} title={q}>
                            {used ? "✓ " : "+ "}{q.length > 45 ? q.slice(0, 45) + "…" : q}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {ct.map((task, idx) => (
                    <div key={idx} className={`task-item fade-in ${task.level === 1 ? "sub" : ""}`}>
                      <span style={{ color: task.level === 1 ? "#78350f" : (isPrio ? "#8b5cf6" : accent), fontSize: 10, marginTop: 6, flexShrink: 0 }}>
                        {task.level === 1 ? "└" : "▸"}
                      </span>
                      {editingTask?.catId === cat.id && editingTask?.idx === idx ? (
                        <div style={{ flex: 1, display: "flex", gap: 6 }}>
                          <input className="edit-input" value={editingTaskValue} onChange={(e) => setEditingTaskValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") saveEditTask(); if (e.key === "Escape") { setEditingTask(null); setEditingTaskValue(""); } }}
                            autoFocus />
                          <button className="ibtn" onClick={saveEditTask}>✓</button>
                        </div>
                      ) : (
                        <>
                          <span style={{ fontSize: 13, lineHeight: 1.5, flex: 1, wordBreak: "break-word" }}>{task.text}</span>
                          <div className="task-actions">
                            {idx > 0 && <button className="ibtn move" onClick={() => moveTask(cat.id, idx, -1)} title="Subir">↑</button>}
                            {idx < ct.length - 1 && <button className="ibtn move" onClick={() => moveTask(cat.id, idx, 1)} title="Descer">↓</button>}
                            <button className="ibtn indent" onClick={() => toggleTaskLevel(cat.id, idx)} title={task.level === 0 ? "Indentar" : "Remover indentação"}>
                              {task.level === 0 ? "→" : "←"}
                            </button>
                            <button className="ibtn" onClick={() => startEditTask(cat.id, idx, task.text)} title="Editar">✎</button>
                            <button className="ibtn danger" onClick={() => removeTask(cat.id, idx)} title="Remover">✕</button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}

                  {ct.length === 0 && <div className="empty-cat">Nenhuma atividade ainda</div>}
                </div>
              )}

              {isCollapsed && (
                <div style={{ fontSize: 11, color: "#3f3f46", padding: "2px 0", cursor: "pointer" }} onClick={() => toggleCollapsed(cat.id)}>
                  {ct.length} {ct.length === 1 ? "item" : "itens"} — toque pra expandir
                </div>
              )}

              <div className="input-row">
                <button className={`indent-tog ${lvl === 1 ? "on" : ""}`} onClick={() => toggleInputLevel(cat.id)} title={lvl === 1 ? "Item normal" : "Sub-item"}>↳</button>
                <div className="input-wrap">
                  {lvl === 1 && <span className="sub-ind">└</span>}
                  <input ref={(el) => (inputRefs.current[cat.id] = el)}
                    className={`ci-input ${lvl === 1 ? "sub" : ""}`}
                    placeholder={lvl === 1 ? "Sub-item..." : isWeekly ? `Planejar ${cat.label}...` : `Adicionar em ${cat.label}...`}
                    value={inputValues[cat.id] || ""}
                    onChange={(e) => setInputValues((p) => ({ ...p, [cat.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Tab") { e.preventDefault(); toggleInputLevel(cat.id); }
                      if (e.key === "Enter") addTask(cat.id);
                    }} />
                </div>
                <button className="add-btn" onClick={() => addTask(cat.id)}>+</button>
              </div>
              <div className="tab-hint">
                <kbd>Tab</kbd> {lvl === 1 ? "sub-item ativo" : "alternar sub-item"}
                {lvl === 1 && <span style={{ color: accent }}>●</span>}
              </div>
            </div>
          );
        })}

        {/* Actions */}
        <div className="actions">
          <button className={`btn-primary ${copied ? "copied" : ""}`} onClick={copyToClipboard} disabled={!hasContent} style={{ opacity: hasContent ? 1 : 0.4 }}>
            {copied ? "✓ Copiado!" : isWeekly ? "⎘ Copiar semanal" : "⎘ Copiar check-in"}
          </button>
          <div className="actions-row">
            <button className="btn-ghost" onClick={() => setShowOutput(!showOutput)} disabled={!hasContent} style={{ opacity: hasContent ? 1 : 0.4, flex: 1 }}>
              {showOutput ? "Esconder" : "Preview"}
            </button>
            <button className={`btn-ghost ${confirmClear ? "clear-warn" : ""}`} onClick={handleClear} disabled={!hasContent && !confirmClear}
              style={{ opacity: hasContent || confirmClear ? 1 : 0.3, flex: 1 }}>
              {confirmClear ? "Confirmar?" : `Limpar ${isWeekly ? "semana" : "dia"}`}
            </button>
          </div>
        </div>

        {showOutput && hasContent && (
          <div style={{ marginTop: 16 }} className="fade-in">
            <div style={{ fontSize: 11, color: "#52525b", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
              Output → Slack {isWeekly ? "(semanal)" : "(diário)"}
            </div>
            <div className="output-block">{output}</div>
          </div>
        )}
      </div>

      {/* History Modal */}
      {showHistory && (
        <div className="overlay" onClick={() => setShowHistory(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: "#e4e4e7" }}>📋 Check-ins recentes</span>
              <button className="ibtn" onClick={() => setShowHistory(false)}>✕</button>
            </div>
            {recentDaily.length === 0 ? (
              <div style={{ fontSize: 12, color: "#52525b", textAlign: "center", padding: 24 }}>
                Nenhum check-in diário salvo ainda.<br />Os check-ins são salvos ao copiar ou trocar de modo.
              </div>
            ) : (
              recentDaily.map((entry, i) => {
                let preview = [];
                const cats = ls(CATEGORIES_KEY, DEFAULT_CATEGORIES);
                cats.forEach((cat) => {
                  const t = entry.tasks[cat.id] || [];
                  if (!t.length) return;
                  preview.push(`-> ${cat.label}:`);
                  t.forEach((task) => {
                    const txt = typeof task === "string" ? task : task.text;
                    const l = typeof task === "string" ? 0 : (task.level || 0);
                    preview.push(`${l === 1 ? "\t\t" : "\t"}- ${txt};`);
                  });
                });
                return (
                  <div key={i} className="hist-item">
                    <div className="hist-date">{entry.date}</div>
                    <div className="hist-text">{preview.join("\n")}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="overlay" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: "#e4e4e7" }}>Categorias</span>
              <button className="ibtn" onClick={() => setShowSettings(false)}>✕</button>
            </div>
            {categories.map((cat) => (
              <div key={cat.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 8, marginBottom: 4, background: "#18181b" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: accent }}>{cat.icon}</span>
                  <span style={{ fontSize: 13 }}>{cat.label}</span>
                </div>
                <button className="ibtn danger" onClick={() => removeCategory(cat.id)}>✕</button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input className="ci-input" placeholder="Nova categoria..." value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addCategory(); }} />
              <button className="add-btn" onClick={addCategory}>+</button>
            </div>
            <div style={{ fontSize: 11, color: "#52525b", marginTop: 12 }}>Categorias ficam salvas no navegador.</div>
          </div>
        </div>
      )}
    </div>
  );
}