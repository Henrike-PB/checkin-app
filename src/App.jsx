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

const SLACK_CHAR_LIMIT = 4000;
const STORAGE_KEY = "checkin-data";
const STORAGE_KEY_WEEKLY = "checkin-data-weekly";
const CATEGORIES_KEY = "checkin-categories";
const HISTORY_KEY = "checkin-history";
const MODE_KEY = "checkin-mode";
const COLLAPSED_KEY = "checkin-collapsed";

function getToday() { return new Date().toISOString().slice(0, 10); }
function getWeekId() {
  const d = new Date(), s = new Date(d.getFullYear(), 0, 1);
  return `${d.getFullYear()}-W${String(Math.ceil((d - s) / 604800000)).padStart(2, "0")}`;
}
function getMonday() {
  const d = new Date(), day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return d.toISOString().slice(0, 10);
}
function getFriday() {
  const d = new Date(), day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1) + 4);
  return d.toISOString().slice(0, 10);
}
function migrateTasks(tasks) {
  const m = {};
  for (const [k, items] of Object.entries(tasks))
    m[k] = items.map((t) => typeof t === "string" ? { text: t, level: 0 } : t);
  return m;
}
function ls(key, fb) { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fb; } catch { return fb; } }
function lsSet(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} }
function loadStorage(key, dateCheck) {
  const p = ls(key, null);
  if (!p || (dateCheck && p.date !== dateCheck)) return null;
  if (p.tasks) p.tasks = migrateTasks(p.tasks);
  return p;
}
function loadHistory() { return ls(HISTORY_KEY, []); }
function saveToHistory(entry) {
  const h = loadHistory();
  const i = h.findIndex((x) => x.date === entry.date && x.mode === entry.mode);
  if (i >= 0) h[i] = entry; else h.push(entry);
  lsSet(HISTORY_KEY, h.slice(-30));
}

function useToast() {
  const [msg, setMsg] = useState(null);
  const t = useRef(null);
  const show = useCallback((text, ms = 2000) => {
    clearTimeout(t.current); setMsg(text);
    t.current = setTimeout(() => setMsg(null), ms);
  }, []);
  return [msg, show];
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
  const [showImport, setShowImport] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [editingTaskValue, setEditingTaskValue] = useState("");
  const [toast, showToast] = useToast();
  const [installPrompt, setInstallPrompt] = useState(null);
  const inputRefs = useRef({});
  const clearTimer = useRef(null);

  // PWA install prompt
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === "accepted") showToast("App instalado!");
    setInstallPrompt(null);
  };

  // Load data
  useEffect(() => {
    if (mode === "daily") {
      const s = loadStorage(STORAGE_KEY, getToday());
      setTasks(s?.tasks || {}); setPriorities({});
    } else {
      const s = loadStorage(STORAGE_KEY_WEEKLY, getWeekId());
      setTasks(s?.tasks || {}); setPriorities(s?.priorities || {});
    }
  }, [mode]);

  // Save data
  useEffect(() => {
    if (mode === "daily") lsSet(STORAGE_KEY, { tasks, date: getToday() });
    else lsSet(STORAGE_KEY_WEEKLY, { tasks, priorities, date: getWeekId() });
  }, [tasks, priorities, mode]);

  useEffect(() => { lsSet(CATEGORIES_KEY, categories); }, [categories]);
  useEffect(() => { lsSet(COLLAPSED_KEY, collapsed); }, [collapsed]);

  const switchMode = (m) => {
    if (m === mode) return;
    const total = Object.values(tasks).reduce((s, a) => s + a.length, 0);
    if (total > 0) saveToHistory({
      date: mode === "daily" ? getToday() : getWeekId(), mode, tasks,
      priorities: mode === "weekly" ? priorities : undefined,
    });
    setMode(m); localStorage.setItem(MODE_KEY, m);
    setShowOutput(false); setInputLevels({});
  };

  // Import from history
  const getImportableDays = () => {
    const h = loadHistory();
    return h.filter((x) => x.mode === "daily" && x.date !== getToday()).slice(-7).reverse();
  };

  const importFromDay = (entry, mergeMode) => {
    if (mergeMode === "replace") {
      setTasks(migrateTasks(entry.tasks));
    } else {
      // merge: add tasks that don't exist yet
      setTasks((prev) => {
        const merged = { ...prev };
        for (const [catId, items] of Object.entries(entry.tasks)) {
          const existing = merged[catId] || [];
          const migrated = items.map((t) => typeof t === "string" ? { text: t, level: 0 } : t);
          const newItems = migrated.filter(
            (t) => !existing.some((e) => e.text === t.text)
          );
          if (newItems.length > 0) merged[catId] = [...existing, ...newItems];
        }
        return merged;
      });
    }
    setShowImport(false);
    setCollapsed({});
    showToast(`Importado de ${entry.date}!`);
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

  const removeTask = (catId, idx) => setTasks((p) => ({ ...p, [catId]: p[catId].filter((_, i) => i !== idx) }));
  const toggleTaskLevel = (catId, idx) => setTasks((p) => ({ ...p, [catId]: p[catId].map((t, i) => i === idx ? { ...t, level: t.level === 0 ? 1 : 0 } : t) }));

  const moveTask = (catId, idx, dir) => {
    setTasks((p) => {
      const arr = [...(p[catId] || [])]; const n = idx + dir;
      if (n < 0 || n >= arr.length) return p;
      [arr[idx], arr[n]] = [arr[n], arr[idx]];
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
          (tasks[cat.id] || []).forEach((t) => lines.push(`${t.level === 1 ? "\t\t\t" : "\t\t"}- ${t.text};`));
        });
      }
      normal.forEach((cat) => {
        lines.push(`-> ${cat.label}:`);
        (tasks[cat.id] || []).forEach((t) => lines.push(`${t.level === 1 ? "\t\t" : "\t"}- ${t.text};`));
      });
    } else {
      categories.forEach((cat) => {
        const ct = tasks[cat.id] || [];
        if (!ct.length) return;
        lines.push(`-> ${cat.label}:`);
        ct.forEach((t) => lines.push(`${t.level === 1 ? "\t\t" : "\t"}- ${t.text};`));
      });
    }
    return lines.join("\n");
  }, [mode, categories, tasks, priorities]);

  const copyToClipboard = () => {
    const text = generateOutput();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2200);
      showToast("Check-in copiado!");
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
    showToast("Limpo!");
  };

  const totalTasks = Object.values(tasks).reduce((s, a) => s + a.length, 0);
  const activeCats = categories.filter((c) => (tasks[c.id] || []).length > 0).length;
  const output = generateOutput();
  const charCount = output.length;
  const hasContent = totalTasks > 0;
  const isW = mode === "weekly";
  const accent = isW ? "#8b5cf6" : "#f59e0b";
  const accentDark = isW ? "#5b21b6" : "#78350f";
  const accentBg = isW ? "#1a1025" : "#1a1508";
  const dateLabel = isW ? `${getMonday()} → ${getFriday()}` : getToday();
  const history = loadHistory();
  const recentDaily = history.filter((h) => h.mode === "daily").slice(-7).reverse();
  const importableDays = getImportableDays();

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
  const moveCat = (idx, dir) => {
    setCategories((p) => {
      const arr = [...p]; const n = idx + dir;
      if (n < 0 || n >= arr.length) return p;
      [arr[idx], arr[n]] = [arr[n], arr[idx]];
      return arr;
    });
  };

  // Preview helper for history/import
  const buildPreview = (entryTasks) => {
    let lines = [];
    const cats = ls(CATEGORIES_KEY, DEFAULT_CATEGORIES);
    cats.forEach((cat) => {
      const t = entryTasks[cat.id] || [];
      if (!t.length) return;
      lines.push(`-> ${cat.label}:`);
      t.forEach((task) => {
        const txt = typeof task === "string" ? task : task.text;
        const l = typeof task === "string" ? 0 : (task.level || 0);
        lines.push(`${l === 1 ? "\t\t" : "\t"}- ${txt};`);
      });
    });
    return lines.join("\n");
  };

  const countTasks = (entryTasks) => Object.values(entryTasks).reduce((s, a) => s + a.length, 0);

  return (
    <div style={{ minHeight: "100dvh", background: "#0a0a0b", color: "#d4d4d8", fontFamily: "'JetBrains Mono','Fira Code',monospace" }}>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%;-webkit-tap-highlight-color:transparent}
input,button{-webkit-appearance:none;-moz-appearance:none}

.ci{background:#18181b;border:1px solid #27272a;color:#d4d4d8;font-family:'JetBrains Mono',monospace;font-size:16px;padding:12px 14px;border-radius:8px;outline:none;width:100%;transition:border-color .15s}
.ci:focus{border-color:${accent}}.ci::placeholder{color:#52525b}
.ci.sub{border-color:${accentDark};padding-left:32px}.ci.sub:focus{border-color:${accent}}

.cs{background:#111113;border:1px solid #1e1e22;border-radius:10px;padding:14px;margin-bottom:10px;transition:border-color .2s}
.cs.prio{border-color:${accentDark};background:#0f0d14}

.ch{display:flex;align-items:center;justify-content:space-between;padding:2px 0;cursor:pointer;-webkit-user-select:none;user-select:none;min-height:40px;gap:8px}
.ch-l{display:flex;align-items:center;gap:8px;min-width:0;flex:1;overflow:hidden}
.ch-r{display:flex;align-items:center;gap:6px;flex-shrink:0}
.chv{font-size:10px;color:#52525b;transition:transform .2s;flex-shrink:0}.chv.o{transform:rotate(90deg)}

.ti{display:flex;align-items:flex-start;gap:8px;padding:10px;border-radius:6px;margin:3px 0;background:#18181b;border:1px solid transparent;transition:all .15s;min-height:44px}
.ti:hover{border-color:#27272a}
.ti.si{margin-left:20px;background:#141416;border-left:2px solid #27272a;border-radius:0 6px 6px 0}
.ti.si:hover{border-left-color:${accent}}
.ta{display:flex;gap:2px;flex-shrink:0;opacity:0;transition:opacity .15s}.ti:hover .ta{opacity:1}

.ib{background:none;border:1px solid transparent;color:#52525b;cursor:pointer;padding:4px 8px;border-radius:6px;font-size:13px;font-family:'JetBrains Mono',monospace;transition:all .15s;min-width:36px;min-height:36px;display:flex;align-items:center;justify-content:center}
.ib:hover{color:#d4d4d8;border-color:#3f3f46;background:#27272a}
.ib.dng:hover{color:#ef4444;border-color:#7f1d1d;background:#1c0a0a}
.ib.ind:hover,.ib.mv:hover{color:${accent};border-color:${accentDark};background:${accentBg}}

.qt{display:inline-flex;background:#1a1a1f;border:1px dashed #27272a;color:#71717a;font-size:12px;font-family:'JetBrains Mono',monospace;padding:8px 12px;border-radius:6px;cursor:pointer;transition:all .15s;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.qt:hover{border-color:${accent};color:${accent};border-style:solid;background:${accentBg}}
.qt.u{opacity:.3;cursor:default;border-style:solid}

.bp{background:${accent};color:${isW ? "#fff" : "#0a0a0b"};border:none;font-family:'JetBrains Mono',monospace;font-weight:600;font-size:14px;padding:14px 20px;border-radius:8px;cursor:pointer;transition:all .15s;min-height:48px;width:100%}
.bp:hover{filter:brightness(1.15);transform:translateY(-1px)}.bp:active{transform:translateY(0)}.bp.cp{background:#22c55e}

.bg{background:none;border:1px solid #27272a;color:#71717a;font-family:'JetBrains Mono',monospace;font-size:12px;padding:10px 14px;border-radius:8px;cursor:pointer;transition:all .15s;min-height:48px}
.bg:hover{border-color:#3f3f46;color:#a1a1aa;background:#18181b}

.ob{background:#0f0f11;border:1px solid #27272a;border-radius:8px;padding:16px;font-size:13px;line-height:1.7;white-space:pre-wrap;word-break:break-word;color:#a1a1aa;max-height:50vh;overflow-y:auto;-webkit-overflow-scrolling:touch}

.bdg{display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;min-width:20px;height:20px;border-radius:10px;padding:0 6px;flex-shrink:0}

.hdr{background:#0f0f11;border-bottom:1px solid #1e1e22;padding:10px 16px;position:sticky;top:0;z-index:10}
.hdr-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.hdr-l{display:flex;align-items:center;gap:8px;min-width:0}
.hdr-r{display:flex;align-items:center;gap:8px}
.hdr-meta{display:flex;align-items:center;gap:12px;padding-top:8px;justify-content:space-between}
.hdr-r-desktop{display:none}

.mt{display:flex;background:#18181b;border:1px solid #27272a;border-radius:8px;overflow:hidden}
.mb{background:none;border:none;color:#52525b;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:600;padding:8px 14px;cursor:pointer;transition:all .15s;min-height:36px}
.mb:hover{color:#a1a1aa}.mb.on{background:#f59e0b;color:#0a0a0b}.mb.onw{background:#8b5cf6;color:#fff}

.st{display:flex;align-items:center;gap:6px;font-size:11px;color:#52525b}
.st b{color:${accent};font-size:14px;font-weight:700}

.ov{position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:flex-end;justify-content:center;z-index:100;backdrop-filter:blur(4px)}
.mdl{background:#111113;border:1px solid #27272a;border-radius:16px 16px 0 0;padding:20px;padding-bottom:max(20px,env(safe-area-inset-bottom));width:100%;max-width:560px;max-height:85vh;overflow-y:auto;-webkit-overflow-scrolling:touch;animation:su .25s ease-out}
.mdl-bar{width:40px;height:4px;border-radius:2px;background:#27272a;margin:0 auto 16px}

.ab{background:#18181b;border:1px solid #27272a;color:${accent};font-family:'JetBrains Mono',monospace;font-size:16px;font-weight:600;border-radius:8px;cursor:pointer;transition:all .15s;flex-shrink:0;width:48px;height:48px;display:flex;align-items:center;justify-content:center}
.ab:hover{background:${accentBg};border-color:${accent}}

.it{background:none;border:1px solid #27272a;color:#52525b;font-family:'JetBrains Mono',monospace;font-size:16px;font-weight:600;border-radius:8px;cursor:pointer;transition:all .15s;flex-shrink:0;width:48px;height:48px;display:flex;align-items:center;justify-content:center}
.it:hover{border-color:${accentDark};color:${accent};background:${accentBg}}
.it.on{border-color:${accent};color:${accent};background:${accentBg}}

.pb{background:none;border:1px solid #27272a;color:#52525b;font-size:11px;padding:4px 10px;border-radius:6px;cursor:pointer;transition:all .15s;min-height:32px;display:flex;align-items:center;gap:4px;font-family:'JetBrains Mono',monospace;white-space:nowrap}
.pb:hover{border-color:#8b5cf6;color:#8b5cf6}.pb.on{border-color:#8b5cf6;color:#8b5cf6;background:#1a1025}

.ei{background:#0a0a0b;border:1px solid ${accent};color:#d4d4d8;font-family:'JetBrains Mono',monospace;font-size:16px;padding:10px;border-radius:6px;outline:none;width:100%}

.iw{position:relative;flex:1;min-width:0}
.si-ind{position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:12px;color:${accent};pointer-events:none}
.ir{display:flex;gap:6px;margin-top:10px;align-items:center}

.th{font-size:10px;color:#3f3f46;margin-top:4px;display:none;align-items:center;gap:4px}
.th kbd{background:#1e1e22;border:1px solid #27272a;border-radius:3px;padding:1px 5px;font-family:'JetBrains Mono',monospace;font-size:9px;color:#52525b}

.acts{display:flex;flex-direction:column;gap:8px;margin-top:24px}
.acts-r{display:flex;gap:8px}

.hi{background:#18181b;border:1px solid #27272a;border-radius:8px;padding:12px;margin-bottom:8px;cursor:default}
.hd{font-size:11px;font-weight:600;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between}
.ht{font-size:11px;color:#71717a;line-height:1.5;white-space:pre-wrap;max-height:120px;overflow-y:auto;-webkit-overflow-scrolling:touch}

.cw{background:#7f1d1d!important;border-color:#ef4444!important;color:#fff!important}
.cc{display:flex;align-items:center;gap:6px;font-size:10px;color:#3f3f46}.cc.warn{color:#ef4444}

.toast{position:fixed;bottom:max(24px,env(safe-area-inset-bottom,24px));left:50%;transform:translateX(-50%);background:#22c55e;color:#fff;font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:600;padding:10px 24px;border-radius:10px;z-index:200;animation:su .2s ease-out;pointer-events:none;white-space:nowrap}

.set-item{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:8px;margin-bottom:4px;background:#18181b;gap:8px}
.set-l{display:flex;align-items:center;gap:8px;flex:1;min-width:0;overflow:hidden}
.set-r{display:flex;align-items:center;gap:2px;flex-shrink:0}

.imp-btn{background:none;border:1px solid #27272a;color:#71717a;font-family:'JetBrains Mono',monospace;font-size:11px;padding:6px 12px;border-radius:6px;cursor:pointer;transition:all .15s;min-height:36px}
.imp-btn:hover{border-color:${accent};color:${accent};background:${accentBg}}
.imp-btn.merge{border-color:#22c55e;color:#22c55e}.imp-btn.merge:hover{background:#0a1a0f}
.imp-btn.replace{border-color:#f59e0b;color:#f59e0b}.imp-btn.replace:hover{background:#1a1508}

.install-bar{background:#18181b;border:1px solid #27272a;border-radius:10px;padding:12px 14px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;animation:fi .3s ease-out}
.install-bar span{font-size:12px;color:#a1a1aa}
.install-btn{background:${accent};color:${isW ? "#fff" : "#0a0a0b"};border:none;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:600;padding:8px 16px;border-radius:6px;cursor:pointer;min-height:36px;white-space:nowrap}

.empty-state{text-align:center;padding:40px 20px;color:#3f3f46}
.empty-state .icon{font-size:32px;margin-bottom:12px;opacity:.5}
.empty-state .msg{font-size:13px;line-height:1.6}
.empty-state .imp-link{color:${accent};cursor:pointer;text-decoration:underline;text-underline-offset:3px}

@media(hover:none)and(pointer:coarse){.ta{opacity:1!important}}
@media(hover:hover)and(pointer:fine){
  .th{display:flex}.it{display:none}
  .ov{align-items:center;padding:16px}
  .mdl{border-radius:12px;animation:fs .2s ease-out}
  .mdl-bar{display:none}
}
@media(min-width:481px){
  .acts{flex-direction:row;justify-content:space-between;flex-wrap:wrap}
  .acts-r{flex:1}
  .bp{width:auto}
  .hdr{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;gap:16px}
  .hdr-top{flex:none;gap:12px}
  .hdr-meta{padding:0;gap:16px;flex:1;justify-content:flex-end}
  .hdr-r{display:none}
  .hdr-r-desktop{display:flex;align-items:center;gap:8px}
}
@media(max-width:480px){
  .mb{padding:6px 10px;font-size:11px}
  .ob{font-size:11px;padding:12px}
}
@media(max-width:360px){
  .st{display:none}
  .mb{padding:6px 8px;font-size:10px}
}

@keyframes fi{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes su{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}
@keyframes fs{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
.fi{animation:fi .2s ease-out}
      `}</style>

      {toast && <div className="toast">{toast}</div>}

      {/* Header */}
      <div className="hdr">
        <div className="hdr-top">
          <div className="hdr-l">
            <span style={{ color: accent, fontSize: 16 }}>▸</span>
            <span style={{ fontWeight: 700, fontSize: 15, color: "#e4e4e7", fontFamily: "'Space Mono',monospace" }}>check-in</span>
            <div className="mt">
              <button className={`mb ${mode === "daily" ? "on" : ""}`} onClick={() => switchMode("daily")}>Diário</button>
              <button className={`mb ${mode === "weekly" ? "onw" : ""}`} onClick={() => switchMode("weekly")}>Semanal</button>
            </div>
          </div>
          {/* Mobile-only buttons */}
          <div className="hdr-r">
            {isW && <button className="bg" onClick={() => setShowHistory(true)} style={{ padding: "6px 10px", minHeight: 36, fontSize: 12 }}>📋</button>}
            <button className="bg" onClick={() => setShowSettings(true)} style={{ padding: "6px 10px", minHeight: 36, fontSize: 12 }}>⚙</button>
          </div>
        </div>
        <div className="hdr-meta">
          <span style={{ fontSize: 10, color: "#52525b" }}>{dateLabel}</span>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span className="st"><b>{totalTasks}</b> tasks</span>
            <span className="st"><b>{activeCats}</b> seções</span>
            {hasContent && <span className={`cc ${charCount > SLACK_CHAR_LIMIT ? "warn" : ""}`}>{charCount}/{SLACK_CHAR_LIMIT}</span>}
          </div>
          {/* Desktop-only buttons */}
          <div className="hdr-r-desktop">
            {isW && <button className="bg" onClick={() => setShowHistory(true)} style={{ padding: "6px 10px", minHeight: 36, fontSize: 12 }}>📋</button>}
            <button className="bg" onClick={() => setShowSettings(true)} style={{ padding: "6px 10px", minHeight: 36, fontSize: 12 }}>⚙</button>
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "12px 12px 120px" }}>

        {/* PWA install banner */}
        {installPrompt && (
          <div className="install-bar">
            <span>📱 Instalar como app no seu dispositivo?</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="install-btn" onClick={handleInstall}>Instalar</button>
              <button className="ib" onClick={() => setInstallPrompt(null)} style={{ color: "#52525b" }}>✕</button>
            </div>
          </div>
        )}

        {/* Empty state with import CTA */}
        {!hasContent && mode === "daily" && importableDays.length > 0 && (
          <div className="empty-state fi">
            <div className="icon">📝</div>
            <div className="msg">
              Nenhuma task ainda hoje.<br />
              <span className="imp-link" onClick={() => setShowImport(true)}>
                Importar de um dia anterior?
              </span>
            </div>
          </div>
        )}

        {categories.map((cat) => {
          const ct = tasks[cat.id] || [];
          const qm = QUICK_TASKS[cat.id];
          const qts = qm ? (qm[mode] || qm.daily || []) : [];
          const lvl = getLevel(cat.id);
          const isPrio = isW && priorities[cat.id];
          const isCol = collapsed[cat.id] && ct.length > 0;

          return (
            <div key={cat.id} className={`cs ${isPrio ? "prio" : ""}`}>
              <div className="ch" onClick={() => ct.length > 0 && toggleCollapsed(cat.id)}>
                <div className="ch-l">
                  {ct.length > 0 && <span className={`chv ${!isCol ? "o" : ""}`}>▸</span>}
                  <span style={{ color: isPrio ? "#8b5cf6" : accent, fontSize: 14, flexShrink: 0 }}>{cat.icon}</span>
                  <span style={{ fontWeight: 600, fontSize: 13, color: "#e4e4e7", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat.label}</span>
                  {ct.length > 0 && <span className="bdg" style={{ background: isPrio ? "#8b5cf6" : accent, color: isPrio ? "#fff" : "#0a0a0b" }}>{ct.length}</span>}
                </div>
                <div className="ch-r" onClick={(e) => e.stopPropagation()}>
                  {isW && (
                    <button className={`pb ${isPrio ? "on" : ""}`} onClick={() => togglePriority(cat.id)}>
                      {isPrio ? "★" : "☆"} prio
                    </button>
                  )}
                </div>
              </div>

              {!isCol && (
                <div className="fi">
                  {qts.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "8px 0" }}>
                      {qts.map((q, i) => {
                        const used = ct.some((t) => t.text === q);
                        return <span key={i} className={`qt ${used ? "u" : ""}`} onClick={() => !used && addQuickTask(cat.id, q)} title={q}>
                          {used ? "✓ " : "+ "}{q.length > 45 ? q.slice(0, 45) + "…" : q}
                        </span>;
                      })}
                    </div>
                  )}

                  {ct.length === 0 && <div style={{ fontSize: 11, color: "#3f3f46", padding: "4px 0", fontStyle: "italic" }}>Nenhuma atividade</div>}

                  {ct.map((task, idx) => (
                    <div key={idx} className={`ti fi ${task.level === 1 ? "si" : ""}`}>
                      <span style={{ color: task.level === 1 ? "#78350f" : (isPrio ? "#8b5cf6" : accent), fontSize: 10, marginTop: 6, flexShrink: 0 }}>
                        {task.level === 1 ? "└" : "▸"}
                      </span>
                      {editingTask?.catId === cat.id && editingTask?.idx === idx ? (
                        <div style={{ flex: 1, display: "flex", gap: 6 }}>
                          <input className="ei" value={editingTaskValue} onChange={(e) => setEditingTaskValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") saveEditTask(); if (e.key === "Escape") { setEditingTask(null); setEditingTaskValue(""); } }} autoFocus />
                          <button className="ib" onClick={saveEditTask}>✓</button>
                        </div>
                      ) : (
                        <>
                          <span style={{ fontSize: 13, lineHeight: 1.5, flex: 1, wordBreak: "break-word" }}>{task.text}</span>
                          <div className="ta">
                            {idx > 0 && <button className="ib mv" onClick={() => moveTask(cat.id, idx, -1)} title="Subir">↑</button>}
                            {idx < ct.length - 1 && <button className="ib mv" onClick={() => moveTask(cat.id, idx, 1)} title="Descer">↓</button>}
                            <button className="ib ind" onClick={() => toggleTaskLevel(cat.id, idx)} title={task.level === 0 ? "Indentar" : "Des-indentar"}>
                              {task.level === 0 ? "→" : "←"}
                            </button>
                            <button className="ib" onClick={() => startEditTask(cat.id, idx, task.text)} title="Editar">✎</button>
                            <button className="ib dng" onClick={() => removeTask(cat.id, idx)} title="Remover">✕</button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {isCol && (
                <div style={{ fontSize: 11, color: "#3f3f46", padding: "2px 0", cursor: "pointer" }} onClick={() => toggleCollapsed(cat.id)}>
                  {ct.length} {ct.length === 1 ? "item" : "itens"} — expandir
                </div>
              )}

              <div className="ir">
                <button className={`it ${lvl === 1 ? "on" : ""}`} onClick={() => toggleInputLevel(cat.id)} title={lvl === 1 ? "Item normal" : "Sub-item"}>↳</button>
                <div className="iw">
                  {lvl === 1 && <span className="si-ind">└</span>}
                  <input ref={(el) => (inputRefs.current[cat.id] = el)}
                    className={`ci ${lvl === 1 ? "sub" : ""}`}
                    placeholder={lvl === 1 ? "Sub-item..." : isW ? `Planejar ${cat.label}...` : `Adicionar em ${cat.label}...`}
                    value={inputValues[cat.id] || ""}
                    onChange={(e) => setInputValues((p) => ({ ...p, [cat.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Tab") { e.preventDefault(); toggleInputLevel(cat.id); }
                      if (e.key === "Enter") addTask(cat.id);
                    }} />
                </div>
                <button className="ab" onClick={() => addTask(cat.id)}>+</button>
              </div>
              <div className="th">
                <kbd>Tab</kbd> {lvl === 1 ? "sub-item ativo" : "alternar sub-item"}
                {lvl === 1 && <span style={{ color: accent }}>●</span>}
              </div>
            </div>
          );
        })}

        {/* Actions */}
        <div className="acts">
          <button className={`bp ${copied ? "cp" : ""}`} onClick={copyToClipboard} disabled={!hasContent} style={{ opacity: hasContent ? 1 : 0.4 }}>
            {copied ? "✓ Copiado!" : isW ? "⎘ Copiar semanal" : "⎘ Copiar check-in"}
          </button>
          <div className="acts-r">
            <button className="bg" onClick={() => setShowOutput(!showOutput)} disabled={!hasContent} style={{ opacity: hasContent ? 1 : 0.4, flex: 1 }}>
              {showOutput ? "Esconder" : "Preview"}
            </button>
            {mode === "daily" && importableDays.length > 0 && (
              <button className="bg" onClick={() => setShowImport(true)} style={{ flex: 1 }}>
                📥 Importar
              </button>
            )}
            <button className={`bg ${confirmClear ? "cw" : ""}`} onClick={handleClear} disabled={!hasContent && !confirmClear}
              style={{ opacity: hasContent || confirmClear ? 1 : 0.3, flex: 1 }}>
              {confirmClear ? "Confirmar?" : `Limpar ${isW ? "semana" : "dia"}`}
            </button>
          </div>
        </div>

        {showOutput && hasContent && (
          <div style={{ marginTop: 16 }} className="fi">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: "#52525b", textTransform: "uppercase", letterSpacing: 1 }}>
                Output → Slack {isW ? "(semanal)" : "(diário)"}
              </span>
              <span className={`cc ${charCount > SLACK_CHAR_LIMIT ? "warn" : ""}`} style={{ fontSize: 11 }}>{charCount} chars</span>
            </div>
            <div className="ob">{output}</div>
          </div>
        )}
      </div>

      {/* Import Modal */}
      {showImport && (
        <div className="ov" onClick={() => setShowImport(false)}>
          <div className="mdl" onClick={(e) => e.stopPropagation()}>
            <div className="mdl-bar" />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: "#e4e4e7" }}>📥 Importar dia anterior</span>
              <button className="ib" onClick={() => setShowImport(false)}>✕</button>
            </div>
            <div style={{ fontSize: 11, color: "#52525b", marginBottom: 12 }}>
              Escolha um dia para importar as tasks. <b>Mesclar</b> adiciona sem duplicar, <b>Substituir</b> apaga o atual.
            </div>
            {importableDays.length === 0 ? (
              <div style={{ fontSize: 12, color: "#52525b", textAlign: "center", padding: 24 }}>Nenhum dia anterior salvo.</div>
            ) : importableDays.map((entry, i) => (
              <div key={i} className="hi">
                <div className="hd">
                  <span style={{ color: accent }}>{entry.date}</span>
                  <span style={{ fontSize: 10, color: "#52525b" }}>{countTasks(entry.tasks)} tasks</span>
                </div>
                <div className="ht">{buildPreview(entry.tasks)}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  <button className="imp-btn merge" onClick={() => importFromDay(entry, "merge")}>+ Mesclar</button>
                  <button className="imp-btn replace" onClick={() => importFromDay(entry, "replace")}>↻ Substituir</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && (
        <div className="ov" onClick={() => setShowHistory(false)}>
          <div className="mdl" onClick={(e) => e.stopPropagation()}>
            <div className="mdl-bar" />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: "#e4e4e7" }}>📋 Check-ins recentes</span>
              <button className="ib" onClick={() => setShowHistory(false)}>✕</button>
            </div>
            {recentDaily.length === 0 ? (
              <div style={{ fontSize: 12, color: "#52525b", textAlign: "center", padding: 24 }}>Nenhum check-in salvo ainda.</div>
            ) : recentDaily.map((entry, i) => (
              <div key={i} className="hi">
                <div className="hd">
                  <span style={{ color: accent }}>{entry.date}</span>
                  <span style={{ fontSize: 10, color: "#52525b" }}>{countTasks(entry.tasks)} tasks</span>
                </div>
                <div className="ht">{buildPreview(entry.tasks)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="ov" onClick={() => setShowSettings(false)}>
          <div className="mdl" onClick={(e) => e.stopPropagation()}>
            <div className="mdl-bar" />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: "#e4e4e7" }}>Categorias</span>
              <button className="ib" onClick={() => setShowSettings(false)}>✕</button>
            </div>
            {categories.map((cat, idx) => (
              <div key={cat.id} className="set-item">
                <div className="set-l">
                  <span style={{ color: accent }}>{cat.icon}</span>
                  <span style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat.label}</span>
                </div>
                <div className="set-r">
                  {idx > 0 && <button className="ib mv" onClick={() => moveCat(idx, -1)}>↑</button>}
                  {idx < categories.length - 1 && <button className="ib mv" onClick={() => moveCat(idx, 1)}>↓</button>}
                  <button className="ib dng" onClick={() => removeCategory(cat.id)}>✕</button>
                </div>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input className="ci" placeholder="Nova categoria..." value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addCategory(); }} />
              <button className="ab" onClick={addCategory}>+</button>
            </div>
            <div style={{ fontSize: 11, color: "#52525b", marginTop: 12 }}>Categorias ficam salvas no navegador. Use ↑↓ para reordenar.</div>
          </div>
        </div>
      )}
    </div>
  );
}