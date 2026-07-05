import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Play, Pause, RotateCcw, Settings as SettingsIcon, ListTodo, BarChart2,
  X, Plus, Trash2, Image as ImageIcon, Check, Download, Upload, SkipForward,
  Star,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from "recharts";

/* ----------------------------- constants ----------------------------- */

const PHASES = {
  focus: { label: "집중" },
  short: { label: "짧은 휴식" },
  long: { label: "긴 휴식" },
};
const PHASE_ORDER = ["focus", "short", "long"];

const DEFAULT_DURATIONS = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };

const DEFAULT_SETTINGS = {
  cyclesBeforeLong: 4,
  autoLongBreak: true,
  autoStartNext: false,
  soundEnabled: true,
  customSoundName: null,
  customSoundDataUrl: null,
  customSoundDuration: 4,
  accentColor: "#2B4C7E",
  bgColor: "#F5F6F3",
  fontFamily: "",
  customFontName: null,
  customFontDataUrl: null,
  bottomSentence: "오늘도 집중하는 나, 꽤 멋지다",
  showBottomSentence: true,
  reflectionEnabled: true,
  wakeLockEnabled: false,
  hideNumbers: false,
  hideText: false,
  habitStarColor: "#F2C641",
};

const ACCENT_SWATCHES = [
  "#FFFFFF", "#2B4C7E", "#3E7C59", "#B5533C", "#6B4FA0", "#C98A2B", "#1F2937", "#0E7C86", "#9C3B5E",
  "#D64545", "#2F8F4E", "#3F6FD1", "#E0A73E", "#7A5CC7", "#1B7F79", "#C2528B", "#556B2F",
  "#B8860B", "#4A5568", "#8E4162", "#2E86AB", "#C74B50", "#3D5A80", "#EE6C4D", "#606C38",
];
const STAR_COLOR_PRESETS = [
  { label: "노랑", value: "#F2C641" },
  { label: "은색", value: "#C0C0C0" },
];

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x) => Math.round(255 * x).toString(16).padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}
function hexToHsl(hex) {
  if (!isValidHex(hex)) return { h: 210, s: 50, l: 40 };
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

const pad2 = (n) => String(Math.floor(n)).padStart(2, "0");
const formatClock = (totalSeconds) => `${pad2(Math.floor(totalSeconds / 60))}:${pad2(Math.floor(totalSeconds % 60))}`;
const formatMinutesLabel = (mins) => {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h > 0) return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
  return `${m}분`;
};
const todayISO = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 10);
const isValidHex = (v) => /^#([0-9A-Fa-f]{6})$/.test(v);

const STORAGE_KEY = "pomodoro-app-state-v2";
const APP_MAX_WIDTH = 640;

/* ------------------------------- Dial ---------------------------------- */

function Dial({ size, durationSec, remainingSec, draggable, accent, trackColor, onChange, onTapCenter, centerLabel, centerSub, hideNumbers, pulse, fontFamily }) {
  const maxValue = 3600;
  const svgRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [liveSec, setLiveSec] = useState(durationSec);
  const cx = size / 2, cy = size / 2;
  const r = size * 0.42;
  const tickOuter = size * 0.485, tickInner = size * 0.44;

  useEffect(() => { if (!dragging) setLiveSec(draggable ? durationSec : remainingSec); }, [durationSec, remainingSec, draggable, dragging]);

  const valueToAngle = (v) => (Math.min(v, maxValue) / maxValue) * 360;
  const angleToPoint = (deg, radius) => {
    const theta = (deg * Math.PI) / 180;
    return { x: cx + radius * Math.sin(theta), y: cy - radius * Math.cos(theta) };
  };
  const pointerToValueSec = (clientX, clientY) => {
    const rect = svgRef.current.getBoundingClientRect();
    const x = clientX - rect.left - cx;
    const y = clientY - rect.top - cy;
    let deg = (Math.atan2(x, -y) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    let v = Math.round((deg / 360) * maxValue);
    if (v >= maxValue) v = maxValue - 1;
    if (v < 0) v = 0;
    return v;
  };
  const handlePointerDown = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const dx = e.clientX - rect.left - cx;
    const dy = e.clientY - rect.top - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < r * 0.55) {
      if (draggable) onTapCenter && onTapCenter();
      return;
    }
    if (!draggable) return;
    setDragging(true);
    e.target.setPointerCapture?.(e.pointerId);
    setLiveSec(pointerToValueSec(e.clientX, e.clientY));
  };
  const handlePointerMove = (e) => { if (dragging) setLiveSec(pointerToValueSec(e.clientX, e.clientY)); };
  const handlePointerUp = () => { if (!dragging) return; setDragging(false); onChange && onChange(liveSec); };

  // arcValue represents what the pie should currently show:
  // - while dragging: the live drag value
  // - while editing (draggable/fresh): the selected duration (full pie = chosen length)
  // - while running/paused mid-session: the *remaining* time, so the pie shrinks as time passes
  const arcValue = dragging ? liveSec : draggable ? durationSec : remainingSec;
  const arcDeg = valueToAngle(arcValue);
  const handlePoint = angleToPoint(arcDeg, r);
  const largeArc = arcDeg > 180 ? 1 : 0;
  const start = angleToPoint(0, r);
  const arcPath =
    arcDeg <= 0 ? "" :
    arcDeg >= 359.999 ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z` :
    `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${handlePoint.x} ${handlePoint.y} Z`;

  const ticks = [];
  for (let v = 0; v < 60; v += 5) {
    const deg = (v / 60) * 360;
    const p1 = angleToPoint(deg, tickInner), p2 = angleToPoint(deg, tickOuter), lp = angleToPoint(deg, tickOuter + size * 0.06);
    ticks.push(
      <g key={v}>
        <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#C7CCD6" strokeWidth={size * 0.006} />
        <text x={lp.x} y={lp.y} fontSize={size * 0.032} fill="#9AA1AE" textAnchor="middle" dominantBaseline="middle">{v}</text>
      </g>
    );
  }

  return (
    <svg ref={svgRef} width={size} height={size}
      onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}
      style={{ touchAction: "none", cursor: draggable ? "grab" : "default", overflow: "visible", filter: pulse ? `drop-shadow(0 0 14px ${accent})` : "none", transition: "filter .4s ease" }}
    >
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={trackColor} strokeWidth={size * 0.09} />
      {arcPath && <path d={arcPath} fill={accent} opacity={0.92} />}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#EAEAE6" strokeWidth={1} />
      {ticks}
      {draggable && <circle cx={handlePoint.x} cy={handlePoint.y} r={size * 0.045} fill="#fff" stroke={accent} strokeWidth={size * 0.012} />}
      {!hideNumbers && (
        <text x={cx} y={cy - size * 0.02} fontSize={size * 0.13} fontWeight="600" fill="#20242B" textAnchor="middle" dominantBaseline="middle" fontFamily={fontFamily || "'Space Grotesk', inherit"}>
          {centerLabel}
        </text>
      )}
      {centerSub && (
        <text x={cx} y={cy + size * 0.1} fontSize={size * 0.045} fill="#8A8F98" textAnchor="middle" dominantBaseline="middle">{centerSub}</text>
      )}
    </svg>
  );
}

/* ------------------------------ App ------------------------------------ */

export default function PomodoroApp() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [phase, setPhase] = useState("focus");
  const [customDurations, setCustomDurations] = useState(DEFAULT_DURATIONS);
  const durationSec = customDurations[phase];

  const [timeLeft, setTimeLeft] = useState(durationSec);
  const [running, setRunning] = useState(false);
  const [cycleCount, setCycleCount] = useState(0);
  const [accumulatedFocusMin, setAccumulatedFocusMin] = useState(0);
  const [history, setHistory] = useState([]); // {id, dateISO, type, minutes, partial?}
  const [todos, setTodos] = useState([]);
  const [activeTodoId, setActiveTodoId] = useState(null);
  const [reflections, setReflections] = useState([]);
  const [showReflection, setShowReflection] = useState(false);
  const [pendingReflection, setPendingReflection] = useState(null);
  const [addReflectionOpen, setAddReflectionOpen] = useState(false);
  const [tab, setTab] = useState("timer");
  const [isLandscapeViewport, setIsLandscapeViewport] = useState(false);
  const [storageStatus, setStorageStatus] = useState("loading");
  const [importMessage, setImportMessage] = useState(null);
  const [visitDates, setVisitDates] = useState([]);
  const [pulse, setPulse] = useState(false);

  const audioCtxRef = useRef(null);
  const intervalRef = useRef(null);
  const reflectionTimeoutRef = useRef(null);
  const hydrated = useRef(false);

  const fresh = timeLeft === durationSec && !running;
  const elapsedSec = Math.max(0, durationSec - timeLeft);

  // font used for numbers/headings so a custom uploaded font actually shows up there too
  const numFontFamily = settings.customFontDataUrl ? "'UserCustomFont', 'Space Grotesk', inherit" : "'Space Grotesk', inherit";

  /* orientation */
  useEffect(() => {
    const check = () => setIsLandscapeViewport(window.innerWidth > window.innerHeight);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  const isLandscape = isLandscapeViewport;

  /* custom font: load an actual font FILE the user picked (re-register on every load, since
     document.fonts registrations don't persist across page reloads) */
  useEffect(() => {
    if (!settings.customFontDataUrl) return;
    let cancelled = false;
    try {
      const face = new FontFace("UserCustomFont", `url(${settings.customFontDataUrl})`);
      face.load().then((loaded) => {
        if (cancelled) return;
        document.fonts.add(loaded);
      }).catch(() => {});
    } catch (e) {}
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.customFontDataUrl]);

  /* keep the mobile browser/PWA status bar color in sync with the accent color */
  useEffect(() => {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", settings.accentColor);
  }, [settings.accentColor]);

  /* load from persistent storage (localStorage — works on any normal website) */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.settings) setSettings((s) => ({ ...s, ...data.settings }));
        if (data.customDurations) setCustomDurations(data.customDurations);
        if (typeof data.accumulatedFocusMin === "number") setAccumulatedFocusMin(data.accumulatedFocusMin);
        if (data.history) setHistory(data.history);
        if (data.todos) setTodos(data.todos);
        if (data.reflections) setReflections(data.reflections);
        if (typeof data.cycleCount === "number") setCycleCount(data.cycleCount);
        if (data.visitDates) setVisitDates(data.visitDates);
      }
      setStorageStatus("saved");
    } catch (e) {
      setStorageStatus("unavailable");
    } finally {
      hydrated.current = true;
      markVisitToday();
    }
  }, []);

  function markVisitToday() {
    const t = todayISO();
    setVisitDates((prev) => (prev.includes(t) ? prev : [...prev, t]));
  }
  const toggleVisitDate = (iso) => {
    setVisitDates((prev) => (prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso]));
  };

  /* auto-save (debounced), PLUS an immediate flush when the app is backgrounded/closed so
     settings/text never silently roll back to defaults on the next launch */
  useEffect(() => {
    if (!hydrated.current) return;
    const buildPayload = () => JSON.stringify({ settings, customDurations, accumulatedFocusMin, history, todos, reflections, cycleCount, visitDates });
    const flush = () => {
      try {
        window.localStorage.setItem(STORAGE_KEY, buildPayload());
        setStorageStatus("saved");
      } catch (e) {
        setStorageStatus("unavailable");
      }
    };
    const t = setTimeout(flush, 600);
    const onVisibility = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    window.addEventListener("blur", flush);
    return () => {
      clearTimeout(t);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("blur", flush);
    };
  }, [settings, customDurations, accumulatedFocusMin, history, todos, reflections, cycleCount, visitDates]);

  /* keep timeLeft synced when idle & fresh */
  useEffect(() => {
    if (!running && fresh) setTimeLeft(durationSec);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationSec]);

  /* countdown */
  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(intervalRef.current);
          handlePhaseComplete();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  /* wake lock */
  useEffect(() => {
    let lock;
    async function req() {
      try {
        if (settings.wakeLockEnabled && running && "wakeLock" in navigator) lock = await navigator.wakeLock.request("screen");
      } catch (e) {}
    }
    req();
    return () => { if (lock) lock.release?.().catch(() => {}); };
  }, [settings.wakeLockEnabled, running]);

  /* ---- persistent, reusable audio context (fixes "sound plays sometimes" issue) ---- */
  const ensureAudioCtx = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
      return audioCtxRef.current;
    } catch (e) { return null; }
  };
  // unlock/create the audio context on the first real user tap anywhere (browsers require a user gesture)
  useEffect(() => {
    const unlock = () => { ensureAudioCtx(); window.removeEventListener("pointerdown", unlock); };
    window.addEventListener("pointerdown", unlock);
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  const playChime = useCallback(() => {
    if (settings.customSoundDataUrl) {
      try {
        const audio = new Audio(settings.customSoundDataUrl);
        audio.currentTime = 0;
        audio.play().catch(() => {});
        const ms = Math.max(1, settings.customSoundDuration || 4) * 1000;
        setTimeout(() => { try { audio.pause(); } catch (e) {} }, ms);
        return;
      } catch (e) { /* fall through to the built-in tone */ }
    }
    const ctx = ensureAudioCtx();
    if (!ctx) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 720;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.65);
      o.start(); o.stop(ctx.currentTime + 0.65);
    } catch (e) {}
  }, [settings.customSoundDataUrl, settings.customSoundDuration]);

  const triggerFlash = () => { setPulse(true); setTimeout(() => setPulse(false), 1200); };

  const notifyPhaseEdge = useCallback(() => {
    if (settings.soundEnabled) {
      playChime();
    } else {
      try { navigator.vibrate?.([250, 100, 250]); } catch (e) {}
      triggerFlash();
    }
  }, [settings.soundEnabled, playChime]);

  function handlePhaseComplete() {
    notifyPhaseEdge();
    setRunning(false);
    const finishedPhase = phase;
    const minutes = durationSec / 60;
    setHistory((h) => [...h, { id: uid(), dateISO: todayISO(), type: finishedPhase, minutes }]);

    if (finishedPhase === "focus") {
      setAccumulatedFocusMin((m) => m + minutes);
      if (activeTodoId) setTodos((list) => list.map((t) => (t.id === activeTodoId ? { ...t, done: t.done + 1 } : t)));
      const nextCycle = cycleCount + 1;
      setCycleCount(nextCycle);
      if (settings.reflectionEnabled) {
        // wait a beat after the completion sound/flash before popping the reflection sheet up
        const draft = { id: uid(), dateISO: todayISO(), time: new Date().toTimeString().slice(0, 5), text: "", photo: null };
        if (reflectionTimeoutRef.current) clearTimeout(reflectionTimeoutRef.current);
        reflectionTimeoutRef.current = setTimeout(() => {
          setPendingReflection(draft);
          setShowReflection(true);
        }, 1400);
      }
      const goLong = settings.autoLongBreak && nextCycle % settings.cyclesBeforeLong === 0;
      goToPhase(goLong ? "long" : "short");
    } else {
      goToPhase("focus");
    }
  }

  function goToPhase(next) {
    setPhase(next);
    setTimeLeft(customDurations[next]);
    if (settings.autoStartNext) setTimeout(() => setRunning(true), 300);
  }

  /* commit a partial focus session (>= 60s) if the user resets/skips before it finishes */
  function commitPartialFocusIfEligible() {
    if (phase === "focus" && elapsedSec >= 60 && !fresh) {
      const minutes = elapsedSec / 60;
      setHistory((h) => [...h, { id: uid(), dateISO: todayISO(), type: "focus", minutes, partial: true }]);
      setAccumulatedFocusMin((m) => m + minutes);
      if (activeTodoId) setTodos((list) => list.map((t) => (t.id === activeTodoId ? { ...t, done: t.done + 1 } : t)));
      setCycleCount((c) => c + 1);
    }
  }

  const toggleRun = () => { ensureAudioCtx(); setRunning((r) => !r); };
  const resetTimer = () => { commitPartialFocusIfEligible(); setRunning(false); setTimeLeft(durationSec); };
  const skipPhase = () => {
    commitPartialFocusIfEligible();
    setRunning(false);
    if (phase === "focus") {
      const goLong = settings.autoLongBreak && cycleCount > 0 && cycleCount % settings.cyclesBeforeLong === 0;
      goToPhase(goLong ? "long" : "short");
    } else {
      goToPhase("focus");
    }
  };
  const selectPhasePreview = (p) => {
    if (running) return;
    setPhase(p);
    setTimeLeft(customDurations[p]);
  };

  const handleDialChange = (sec) => {
    setCustomDurations((d) => ({ ...d, [phase]: Math.max(1, sec) }));
    setTimeLeft(Math.max(1, sec));
  };

  const activeTodo = todos.find((t) => t.id === activeTodoId);
  const resetStats = () => { setAccumulatedFocusMin(0); setHistory([]); };
  const deleteHistoryEntry = (id) => {
    const entry = history.find((h) => h.id === id);
    if (!entry) return;
    setHistory((h) => h.filter((x) => x.id !== id));
    if (entry.type === "focus") setAccumulatedFocusMin((m) => Math.max(0, m - entry.minutes));
  };
  const deleteTodoEntry = (id) => {
    setTodos((list) => list.filter((t) => t.id !== id));
    if (activeTodoId === id) setActiveTodoId(null);
  };

  const saveReflection = () => {
    if (pendingReflection && (pendingReflection.text.trim() || pendingReflection.photo)) setReflections((r) => [pendingReflection, ...r]);
    setShowReflection(false); setPendingReflection(null);
  };
  const skipReflection = () => { setShowReflection(false); setPendingReflection(null); };
  const writePastReflection = () => {
    // close the just-finished-session reflection sheet and open the "write a past reflection"
    // flow on the stats tab instead, so the user can log an earlier session any time
    setShowReflection(false);
    setPendingReflection(null);
    setTab("stats");
    setAddReflectionOpen(true);
  };
  const addPastReflection = (entry) => setReflections((r) => [entry, ...r]);
  const updateReflection = (id, patch) => setReflections((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const deleteReflection = (id) => setReflections((list) => list.filter((r) => r.id !== id));

  const exportData = () => {
    const payload = JSON.stringify({ settings, customDurations, accumulatedFocusMin, history, todos, reflections, cycleCount, visitDates }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `pomodoro-backup-${todayISO()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };
  const importData = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.settings) setSettings((s) => ({ ...s, ...data.settings }));
        if (data.customDurations) setCustomDurations(data.customDurations);
        if (typeof data.accumulatedFocusMin === "number") setAccumulatedFocusMin(data.accumulatedFocusMin);
        if (data.history) setHistory(data.history);
        if (data.todos) setTodos(data.todos);
        if (data.reflections) setReflections(data.reflections);
        if (typeof data.cycleCount === "number") setCycleCount(data.cycleCount);
        if (data.visitDates) setVisitDates(data.visitDates);
        setImportMessage({ type: "success", text: "백업 파일을 불러왔어요." });
      } catch (e) {
        setImportMessage({ type: "error", text: "파일을 읽을 수 없어요. 올바른 백업 파일인지 확인해주세요." });
      }
      setTimeout(() => setImportMessage(null), 4000);
    };
    reader.readAsText(file);
  };

  const accent = settings.accentColor;

  return (
    <div style={{ background: settings.bgColor, minHeight: "100vh", fontFamily: settings.fontFamily ? `'${settings.fontFamily}', Inter, sans-serif` : "Inter, sans-serif", color: "#20242B", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        ::selection { background: ${accent}33; }
      `}</style>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", maxWidth: APP_MAX_WIDTH, margin: "0 auto", width: "100%", paddingBottom: tab === "timer" ? 0 : 76 }}>
        {tab === "timer" && (
          <TimerScreen
            isLandscape={isLandscape} phase={phase} durationSec={durationSec}
            fresh={fresh} running={running} timeLeft={timeLeft} accent={accent} pulse={pulse}
            accumulatedFocusMin={accumulatedFocusMin}
            bottomSentence={settings.showBottomSentence ? settings.bottomSentence : null}
            activeTodoTitle={activeTodo?.title}
            todos={todos} activeTodoId={activeTodoId} setActiveTodoId={setActiveTodoId}
            onDialChange={handleDialChange} toggleRun={toggleRun} resetTimer={resetTimer} skipPhase={skipPhase}
            onSelectPhase={selectPhasePreview}
            hideNumbers={settings.hideNumbers} hideText={settings.hideText}
            fontFamily={numFontFamily}
          />
        )}
        {tab === "todos" && (
          <TodosScreen todos={todos} setTodos={setTodos} activeTodoId={activeTodoId} setActiveTodoId={setActiveTodoId} accent={accent} fontFamily={numFontFamily} />
        )}
        {tab === "stats" && (
          <StatsScreen history={history} todos={todos} reflections={reflections} accumulatedFocusMin={accumulatedFocusMin} accent={accent}
            onUpdateReflection={updateReflection} onDeleteReflection={deleteReflection} onDeleteHistoryEntry={deleteHistoryEntry}
            onDeleteTodo={deleteTodoEntry} fontFamily={numFontFamily}
            addReflectionOpen={addReflectionOpen} setAddReflectionOpen={setAddReflectionOpen} onAddReflection={addPastReflection} />
        )}
        {tab === "settings" && (
          <SettingsScreen
            settings={settings} setSettings={setSettings}
            customDurations={customDurations} setCustomDurations={setCustomDurations}
            onResetStats={resetStats} accent={accent} fontFamily={numFontFamily}
            storageStatus={storageStatus} onExport={exportData} onImport={importData} importMessage={importMessage}
            visitDates={visitDates} onToggleVisit={toggleVisitDate}
          />
        )}
      </div>

      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: "1px solid #EAEAE6", display: "flex", justifyContent: "center" }}>
        <div style={{ display: "flex", width: "100%", maxWidth: APP_MAX_WIDTH }}>
          {[
            { key: "timer", icon: Play, label: "타이머" },
            { key: "todos", icon: ListTodo, label: "할 일" },
            { key: "stats", icon: BarChart2, label: "통계" },
            { key: "settings", icon: SettingsIcon, label: "설정" },
          ].map(({ key, icon: Icon, label }) => (
            <button key={key} onClick={() => setTab(key)} style={{
              flex: 1, padding: "10px 0 8px", background: "none", border: "none",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              color: tab === key ? accent : "#9AA1AE", cursor: "pointer",
            }}>
              <Icon size={20} strokeWidth={tab === key ? 2.4 : 2} />
              <span style={{ fontSize: 11, fontWeight: tab === key ? 600 : 500 }}>{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {showReflection && pendingReflection && (
        <ReflectionModal data={pendingReflection} setData={setPendingReflection} onSave={saveReflection} onSkip={skipReflection} onWritePast={writePastReflection} accent={accent} />
      )}
    </div>
  );
}

/* --------------------------- Timer screen ------------------------------ */

function useViewportSize() {
  const [size, setSize] = useState({ w: typeof window !== "undefined" ? window.innerWidth : 400, h: typeof window !== "undefined" ? window.innerHeight : 800 });
  useEffect(() => {
    const check = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => { window.removeEventListener("resize", check); window.removeEventListener("orientationchange", check); };
  }, []);
  return size;
}

function TimerScreen({ isLandscape, phase, durationSec, fresh, running, timeLeft, accent, pulse, accumulatedFocusMin, bottomSentence, activeTodoTitle, todos, activeTodoId, setActiveTodoId, onDialChange, toggleRun, resetTimer, skipPhase, onSelectPhase, hideNumbers, hideText, fontFamily }) {
  const { w: vw, h: vh } = useViewportSize();
  // reserve space for nav bar (~68px) + surrounding chrome, then size the dial to whatever's left
  const navReserve = 68;
  const dialSize = isLandscape
    ? Math.max(170, Math.min(vh - navReserve - 90, vw * 0.4, 300))
    : Math.max(220, Math.min(vw * 0.72, vh - navReserve - 190, 340));

  const clock = formatClock(timeLeft);
  const [showPicker, setShowPicker] = useState(false);
  const [showTimeEdit, setShowTimeEdit] = useState(false);
  const accLabel = hideNumbers ? "--" : formatMinutesLabel(accumulatedFocusMin);

  const taskLabel = (
    <button onClick={() => setShowPicker(true)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
      <Bracketed small>{hideText ? "•••" : (activeTodoTitle || "할 일을 선택하세요")}</Bracketed>
    </button>
  );

  const phaseTabs = (
    <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
      {PHASE_ORDER.map((p) => (
        <button key={p} onClick={() => onSelectPhase(p)} disabled={running} style={{
          border: "none", borderRadius: 999, padding: "6px 14px", fontSize: 13, cursor: running ? "default" : "pointer",
          background: phase === p ? accent : "#EDEEEA", color: phase === p ? "#fff" : "#8A8F98", fontWeight: 600,
        }}>
          {PHASES[p].label}
        </button>
      ))}
    </div>
  );

  const dial = (
    <Dial size={dialSize} durationSec={durationSec} remainingSec={timeLeft} draggable={fresh} accent={accent}
      trackColor="#EDEEEA" onChange={onDialChange} onTapCenter={() => setShowTimeEdit(true)}
      centerLabel={clock} centerSub={hideText ? null : PHASES[phase].label}
      hideNumbers={hideNumbers} pulse={pulse} fontFamily={fontFamily} />
  );

  const controls = (
    <div style={{ display: "flex", gap: 16, alignItems: "center", justifyContent: "center" }}>
      <button onClick={resetTimer} style={iconBtnStyle(44)}><RotateCcw size={20} color="#6B7280" /></button>
      <button onClick={toggleRun} style={{ ...iconBtnStyle(60), background: accent, color: "#fff" }}>
        {running ? <Pause size={26} /> : <Play size={26} style={{ marginLeft: 3 }} />}
      </button>
      <button onClick={skipPhase} style={iconBtnStyle(44)}><SkipForward size={20} color="#6B7280" /></button>
    </div>
  );

  const timeEditModal = showTimeEdit && (
    <TimeQuickEditModal
      totalSec={durationSec}
      phaseLabel={PHASES[phase].label}
      onCancel={() => setShowTimeEdit(false)}
      onConfirm={(sec) => { onDialChange(sec); setShowTimeEdit(false); }}
    />
  );

  if (isLandscape) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: `calc(100dvh - ${navReserve}px)`, padding: "10px 18px 6px", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <Bracketed small>titik</Bracketed>
          {taskLabel}
        </div>
        <div style={{ flexShrink: 0, margin: "10px 0 6px" }}>{phaseTabs}</div>
        <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 36 }}>
          {dial}
          {controls}
        </div>
        {!hideText && bottomSentence != null && (
          <div style={{ display: "flex", justifyContent: "space-between", flexShrink: 0, gap: 12, paddingBottom: 10 }}>
            <Bracketed small>{accLabel}</Bracketed>
            <Bracketed small>{clock}</Bracketed>
            <Bracketed small>{bottomSentence}</Bracketed>
          </div>
        )}
        {showPicker && (
          <TaskPickerModal todos={todos} activeTodoId={activeTodoId} accent={accent}
            onSelect={(id) => { setActiveTodoId(id); setShowPicker(false); }}
            onClear={() => { setActiveTodoId(null); setShowPicker(false); }}
            onClose={() => setShowPicker(false)} />
        )}
        {timeEditModal}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", height: `calc(100dvh - ${navReserve}px)`, padding: "10px 20px 8px", textAlign: "center", overflow: "hidden" }}>
      <div style={{ flexShrink: 0 }}>{taskLabel}</div>
      <div style={{ flexShrink: 0, margin: "16px 0 10px" }}>{phaseTabs}</div>
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 28 }}>
        {dial}
        {controls}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0, paddingBottom: 16 }}>
        <Bracketed small>{accLabel}</Bracketed>
        {!hideText && bottomSentence != null && <Bracketed small>{bottomSentence}</Bracketed>}
      </div>
      {showPicker && (
        <TaskPickerModal todos={todos} activeTodoId={activeTodoId} accent={accent}
          onSelect={(id) => { setActiveTodoId(id); setShowPicker(false); }}
          onClear={() => { setActiveTodoId(null); setShowPicker(false); }}
          onClose={() => setShowPicker(false)} />
      )}
      {timeEditModal}
    </div>
  );
}

function TimeQuickEditModal({ totalSec, phaseLabel, onCancel, onConfirm }) {
  const [min, setMin] = useState(Math.floor(totalSec / 60));
  const [sec, setSec] = useState(totalSec % 60);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,22,26,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 65, padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 22, width: "100%", maxWidth: 320 }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>{phaseLabel} 시간 설정</h3>
        <p style={{ margin: "0 0 16px", fontSize: 12.5, color: "#9AA1AE" }}>다이얼을 드래그하지 않고 직접 입력할 수 있어요.</p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 18 }}>
          <input type="number" min={0} value={min} onChange={(e) => setMin(Math.max(0, Number(e.target.value) || 0))}
            style={{ ...inputStyle(), width: 64, textAlign: "center", flex: "none" }} />
          <span style={{ fontSize: 13, color: "#9AA1AE" }}>분</span>
          <input type="number" min={0} max={59} value={sec} onChange={(e) => setSec(Math.max(0, Math.min(59, Number(e.target.value) || 0)))}
            style={{ ...inputStyle(), width: 64, textAlign: "center", flex: "none" }} />
          <span style={{ fontSize: 13, color: "#9AA1AE" }}>초</span>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={() => { setMin(0); setSec(0); }} style={smallBtnStyle()}>00:00으로 초기화</button>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onCancel} style={smallBtnStyle()}>취소</button>
            <button onClick={() => onConfirm(Math.max(0, min * 60 + sec))} style={smallBtnStyle(true)}>확인</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskPickerModal({ todos, activeTodoId, accent, onSelect, onClear, onClose }) {
  const openTodos = todos.filter((t) => !t.completed);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,22,26,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }} onClick={onClose}>
      <div style={{ background: "#fff", width: "100%", maxWidth: APP_MAX_WIDTH, borderRadius: "20px 20px 0 0", padding: 22, maxHeight: "70vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>할 일 선택</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={18} color="#9AA1AE" /></button>
        </div>
        {openTodos.length === 0 ? (
          <p style={{ color: "#9AA1AE", fontSize: 13.5, marginBottom: 16 }}>등록된 할 일이 없어요. '할 일' 탭에서 먼저 추가해주세요.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
            {openTodos.map((t) => (
              <button key={t.id} onClick={() => onSelect(t.id)} style={{
                textAlign: "left", padding: "12px 14px", borderRadius: 12, cursor: "pointer",
                border: `1px solid ${activeTodoId === t.id ? accent : "#EAEAE6"}`,
                background: activeTodoId === t.id ? `${accent}0D` : "#fff", fontSize: 14,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span>{t.title}</span>
                <span style={{ fontSize: 12, color: "#9AA1AE" }}>{t.done}/{t.est}</span>
              </button>
            ))}
          </div>
        )}
        {activeTodoId && <button onClick={onClear} style={{ ...smallBtnStyle(), width: "100%" }}>선택 해제</button>}
      </div>
    </div>
  );
}

function Bracketed({ children, small }) {
  return (
    <div style={{ fontSize: small ? 15 : 17, color: "#5B6270", fontWeight: 500, letterSpacing: 0.2 }}>
      <span style={{ opacity: 0.55 }}>(</span> {children} <span style={{ opacity: 0.55 }}>)</span>
    </div>
  );
}

function iconBtnStyle(sizePx = 40) {
  return { width: sizePx, height: sizePx, borderRadius: "50%", border: "1px solid #E4E4E0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
}

/* --------------------------- Todos screen ------------------------------ */

function TodosScreen({ todos, setTodos, activeTodoId, setActiveTodoId, accent, fontFamily }) {
  const [title, setTitle] = useState("");
  const [est, setEst] = useState(1);
  const add = () => {
    if (!title.trim()) return;
    setTodos((list) => [...list, { id: uid(), title: title.trim(), est: Math.max(1, est), done: 0, completed: false }]);
    setTitle(""); setEst(1);
  };
  const toggleComplete = (id) => setTodos((list) => list.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
  const remove = (id) => { setTodos((list) => list.filter((t) => t.id !== id)); if (activeTodoId === id) setActiveTodoId(null); };
  // tapping the already-active todo again cancels/deselects it
  const selectOrCancel = (id) => setActiveTodoId((cur) => (cur === id ? null : id));

  return (
    <div style={{ padding: "24px 20px" }}>
      <h2 style={headingStyle(fontFamily)}>할 일</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="할 일을 입력하세요" style={inputStyle()} />
        <input type="number" min={1} value={est} onChange={(e) => setEst(Number(e.target.value))} style={{ ...inputStyle(), width: 56, textAlign: "center", flex: "none" }} />
        <button onClick={add} style={{ ...iconBtnStyle(40), background: accent, border: "none", color: "#fff" }}><Plus size={18} /></button>
      </div>
      {todos.length === 0 && <p style={{ color: "#9AA1AE", fontSize: 14 }}>아직 등록된 할 일이 없어요.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {todos.map((t) => (
          <div key={t.id} onClick={() => selectOrCancel(t.id)} style={{
            border: `1px solid ${activeTodoId === t.id ? accent : "#EAEAE6"}`, background: activeTodoId === t.id ? `${accent}0D` : "#fff",
            borderRadius: 12, padding: "12px 14px", cursor: "pointer",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button onClick={(e) => { e.stopPropagation(); toggleComplete(t.id); }} style={{
                  width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${t.completed ? accent : "#C7CCD6"}`,
                  background: t.completed ? accent : "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                }}>{t.completed && <Check size={13} color="#fff" />}</button>
                <span style={{ fontSize: 14.5, textDecoration: t.completed ? "line-through" : "none", color: t.completed ? "#B0B5BE" : "#20242B" }}>{t.title}</span>
              </div>
              <button onClick={(e) => { e.stopPropagation(); remove(t.id); }} style={{ background: "none", border: "none", cursor: "pointer" }}><Trash2 size={15} color="#C7CCD6" /></button>
            </div>
            <div style={{ fontSize: 12, color: "#9AA1AE", marginTop: 6, marginLeft: 30 }}>
              뽀모도로 {t.done} / {t.est}
              {activeTodoId === t.id && <span style={{ color: accent, marginLeft: 8, fontWeight: 600 }}>진행 중 (다시 탭하면 취소)</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------- Stats screen ------------------------------ */

function StatsScreen({ history, todos, reflections, accumulatedFocusMin, accent, onUpdateReflection, onDeleteReflection, onDeleteHistoryEntry, onDeleteTodo, fontFamily, addReflectionOpen, setAddReflectionOpen, onAddReflection }) {
  const [rangeDays, setRangeDays] = useState(7);
  const [showTodayLog, setShowTodayLog] = useState(false);
  const focusSessions = history.filter((h) => h.type === "focus");
  const today = todayISO();
  const todayEntries = focusSessions.filter((h) => h.dateISO === today);
  const todayCount = todayEntries.length;

  const days = [];
  for (let i = rangeDays - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    const minutes = focusSessions.filter((h) => h.dateISO === iso).reduce((a, h) => a + h.minutes, 0);
    days.push({ iso, label, minutes });
  }
  const last7 = days.slice(Math.max(0, days.length - 7));
  const weekCount = focusSessions.filter((h) => last7.some((d) => d.iso === h.dateISO)).length;
  const completedTodos = todos.filter((t) => t.completed);

  return (
    <div style={{ padding: "24px 20px" }}>
      <h2 style={headingStyle(fontFamily)}>통계</h2>

      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <StatCard label="오늘 완료" value={`${todayCount}개`} accent={accent} fontFamily={fontFamily} />
        <StatCard label="이번 주 완료" value={`${weekCount}개`} accent={accent} fontFamily={fontFamily} />
        <StatCard label="누적 시간" value={formatMinutesLabel(accumulatedFocusMin)} accent={accent} fontFamily={fontFamily} />
      </div>
      <button onClick={() => setShowTodayLog((v) => !v)} style={{ background: "none", border: "none", color: accent, fontSize: 12.5, padding: 0, marginBottom: 22, cursor: "pointer" }}>
        {showTodayLog ? "오늘 기록 숨기기 ▲" : "잘못 기록된 게 있나요? 오늘 기록 보기 ▼"}
      </button>
      {showTodayLog && (
        <div style={{ marginBottom: 22, display: "flex", flexDirection: "column", gap: 6 }}>
          {todayEntries.length === 0 ? (
            <p style={{ color: "#9AA1AE", fontSize: 13 }}>오늘 기록이 없어요.</p>
          ) : todayEntries.map((h) => (
            <div key={h.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #EAEAE6", borderRadius: 10, padding: "8px 12px" }}>
              <span style={{ fontSize: 13 }}>{formatMinutesLabel(h.minutes)} 집중 {h.partial && <span style={{ color: "#9AA1AE" }}>(중간에 멈춤)</span>}</span>
              <button onClick={() => onDeleteHistoryEntry(h.id)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <Trash2 size={14} color="#C7CCD6" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <p style={{ ...subHeadingStyle(), margin: 0 }}>날짜별 집중 시간</p>
        <div style={{ display: "flex", gap: 4, background: "#EDEEEA", borderRadius: 8, padding: 3 }}>
          {[7, 30].map((n) => (
            <button key={n} onClick={() => setRangeDays(n)} style={{
              border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11.5, cursor: "pointer",
              background: rangeDays === n ? "#fff" : "transparent", color: rangeDays === n ? "#20242B" : "#9AA1AE", fontWeight: rangeDays === n ? 600 : 500,
            }}>{n}일</button>
          ))}
        </div>
      </div>
      <div style={{ height: 160, marginBottom: 26 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={days}>
            <CartesianGrid vertical={false} stroke="#EDEEEA" />
            <XAxis dataKey="label" tick={{ fontSize: rangeDays === 30 ? 9 : 11, fill: "#9AA1AE" }} axisLine={false} tickLine={false} interval={rangeDays === 30 ? 3 : 0} />
            <YAxis tick={{ fontSize: 11, fill: "#9AA1AE" }} axisLine={false} tickLine={false} width={34}
              domain={[0, (dataMax) => Math.max(60, Math.ceil((dataMax * 1.15) / 30) * 30)]}
              tickFormatter={(v) => (v >= 60 ? `${(v / 60).toFixed(v % 60 === 0 ? 0 : 1)}h` : `${v}m`)} />
            <Tooltip cursor={{ fill: "#F5F6F3" }} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #EAEAE6" }} formatter={(value) => [formatMinutesLabel(value), "집중 시간"]} />
            <Bar dataKey="minutes" fill={accent} radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p style={subHeadingStyle()}>완료한 할 일</p>
      {completedTodos.length === 0 ? (
        <p style={{ color: "#9AA1AE", fontSize: 13.5, marginBottom: 22 }}>아직 완료한 할 일이 없어요.</p>
      ) : (
        <ul style={{ margin: "0 0 22px", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
          {completedTodos.map((t) => (
            <li key={t.id} style={{ fontSize: 13.5, color: "#5B6270", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}><Check size={13} color={accent} /> {t.title}</span>
              <button onClick={() => onDeleteTodo(t.id)} style={{ background: "none", border: "none", cursor: "pointer" }}><Trash2 size={13} color="#C7CCD6" /></button>
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <p style={{ ...subHeadingStyle(), margin: 0 }}>회고 기록</p>
        <button onClick={() => setAddReflectionOpen(true)} style={{ background: "none", border: "none", color: accent, fontSize: 12.5, cursor: "pointer", fontWeight: 600 }}>+ 새 회고 작성</button>
      </div>
      <ReflectionArchive reflections={reflections} accent={accent} onUpdate={onUpdateReflection} onDelete={onDeleteReflection} />

      {addReflectionOpen && (
        <PastReflectionModal accent={accent} onCancel={() => setAddReflectionOpen(false)}
          onSave={(entry) => { onAddReflection(entry); setAddReflectionOpen(false); }} />
      )}
    </div>
  );
}

function PastReflectionModal({ accent, onSave, onCancel }) {
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5));
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState(null);
  const onPickPhoto = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result);
    reader.readAsDataURL(f);
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,22,26,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 55 }}>
      <div style={{ background: "#fff", width: "100%", maxWidth: APP_MAX_WIDTH, borderRadius: "20px 20px 0 0", padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>지난 회고 작성하기</h3>
          <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={18} color="#9AA1AE" /></button>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle()} />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ ...inputStyle(), flex: "none", width: 110 }} />
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="그날의 집중은 어땠나요?" rows={4}
          style={{ width: "100%", border: "1px solid #EAEAE6", borderRadius: 12, padding: 12, fontSize: 14, fontFamily: "inherit", resize: "none", marginBottom: 12 }} />
        {photo && <img src={photo} alt="" style={{ width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 12, marginBottom: 12 }} />}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <FileLabel accept="image/*" onFile={onPickPhoto}><ImageIcon size={15} /> 사진 추가</FileLabel>
          <div style={{ flex: 1 }} />
          <button onClick={onCancel} style={smallBtnStyle()}>취소</button>
          <button onClick={() => onSave({ id: uid(), dateISO: date, time, text, photo })} style={{ ...smallBtnStyle(true), background: accent, borderColor: accent }}>저장</button>
        </div>
      </div>
    </div>
  );
}

function ReflectionArchive({ reflections, accent, onUpdate, onDelete }) {
  const grouped = {};
  reflections.forEach((r) => { (grouped[r.dateISO] = grouped[r.dateISO] || []).push(r); });
  const dateKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
  const [openDate, setOpenDate] = useState(dateKeys[0] || null);
  const [editingId, setEditingId] = useState(null);
  if (reflections.length === 0) return <p style={{ color: "#9AA1AE", fontSize: 13.5 }}>아직 남긴 회고가 없어요.</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {dateKeys.map((dateISO) => {
        const items = grouped[dateISO];
        const isOpen = openDate === dateISO;
        return (
          <div key={dateISO} style={{ border: "1px solid #EAEAE6", borderRadius: 12, overflow: "hidden" }}>
            <button onClick={() => setOpenDate(isOpen ? null : dateISO)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "#fff", border: "none", cursor: "pointer" }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: "#20242B" }}>{dateISO}</span>
              <span style={{ fontSize: 12, color: "#9AA1AE" }}>{items.length}개 {isOpen ? "▲" : "▼"}</span>
            </button>
            {isOpen && (
              <div style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((r) =>
                  editingId === r.id ? (
                    <ReflectionEditCard key={r.id} data={r} accent={accent} onCancel={() => setEditingId(null)} onSave={(patch) => { onUpdate(r.id, patch); setEditingId(null); }} />
                  ) : (
                    <div key={r.id} style={{ border: "1px solid #EAEAE6", borderRadius: 10, padding: 10, display: "flex", gap: 10 }}>
                      {r.photo && <img src={r.photo} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11.5, color: "#9AA1AE", marginBottom: 4 }}>{r.time}</div>
                        <div style={{ fontSize: 13.5, color: "#20242B", wordBreak: "break-word" }}>{r.text || <span style={{ color: "#C7CCD6" }}>(글 없음)</span>}</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                        <button onClick={() => setEditingId(r.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: accent }}>수정</button>
                        <button onClick={() => onDelete(r.id)} style={{ background: "none", border: "none", cursor: "pointer" }}><Trash2 size={13} color="#C7CCD6" /></button>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ReflectionEditCard({ data, accent, onCancel, onSave }) {
  const [text, setText] = useState(data.text);
  const [photo, setPhoto] = useState(data.photo);
  const onPickPhoto = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result);
    reader.readAsDataURL(f);
  };
  return (
    <div style={{ border: `1px solid ${accent}`, borderRadius: 10, padding: 10 }}>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} style={{ width: "100%", border: "1px solid #EAEAE6", borderRadius: 8, padding: 8, fontSize: 13, fontFamily: "inherit", resize: "none", marginBottom: 8 }} />
      {photo && <img src={photo} alt="" style={{ width: "100%", maxHeight: 120, objectFit: "cover", borderRadius: 8, marginBottom: 8 }} />}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <FileLabel accept="image/*" onFile={onPickPhoto}>사진 변경</FileLabel>
        <div style={{ flex: 1 }} />
        <button onClick={onCancel} style={smallBtnStyle()}>취소</button>
        <button onClick={() => onSave({ text, photo })} style={{ ...smallBtnStyle(true), background: accent, borderColor: accent }}>저장</button>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent, fontFamily }) {
  return (
    <div style={{ flex: 1, border: "1px solid #EAEAE6", borderRadius: 12, padding: "12px 10px", textAlign: "center", background: "#fff" }}>
      <div style={{ fontSize: 17, fontWeight: 700, color: accent, fontFamily: fontFamily || "'Space Grotesk', inherit" }}>{value}</div>
      <div style={{ fontSize: 11, color: "#9AA1AE", marginTop: 2 }}>{label}</div>
    </div>
  );
}

/* --------------------- FileLabel: sandbox-safe file input --------------------- */
/* Using a <label>+hidden <input> instead of a ref.click() call, since programmatic
   .click() on file inputs is unreliable inside this artifact's sandboxed iframe. */
function FileLabel({ accept, onFile, children, style }) {
  return (
    <label style={{ ...smallBtnStyle(), display: "inline-flex", alignItems: "center", gap: 6, position: "relative", cursor: "pointer", ...style }}>
      {children}
      <input
        type="file"
        accept={accept}
        onChange={(e) => { onFile(e); e.target.value = ""; }}
        style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}
      />
    </label>
  );
}

/* -------------------------- Settings screen ----------------------------- */

function SettingsScreen({ settings, setSettings, customDurations, setCustomDurations, onResetStats, accent, fontFamily, storageStatus, onExport, onImport, importMessage, visitDates, onToggleVisit }) {
  const update = (patch) => setSettings((s) => ({ ...s, ...patch }));
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [colorModal, setColorModal] = useState(null); // 'accent' | 'bg' | 'star' | null

  const previewAudioRef = useRef(null);
  const previewTimeoutRef = useRef(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const stopPreview = () => {
    if (previewTimeoutRef.current) { clearTimeout(previewTimeoutRef.current); previewTimeoutRef.current = null; }
    if (previewAudioRef.current) { try { previewAudioRef.current.pause(); } catch (e) {} previewAudioRef.current = null; }
    setIsPreviewing(false);
  };
  const playPreview = () => {
    stopPreview();
    const a = new Audio(settings.customSoundDataUrl);
    previewAudioRef.current = a;
    a.play().catch(() => {});
    setIsPreviewing(true);
    previewTimeoutRef.current = setTimeout(stopPreview, (settings.customSoundDuration || 4) * 1000);
  };

  const setDurationPart = (key, part, val) => {
    const n = Math.max(0, Math.min(part === "min" ? 999 : 59, Number(val) || 0));
    setCustomDurations((d) => {
      const cur = d[key];
      const curMin = Math.floor(cur / 60), curSec = cur % 60;
      const nextMin = part === "min" ? n : curMin, nextSec = part === "sec" ? n : curSec;
      return { ...d, [key]: Math.max(0, nextMin * 60 + nextSec) };
    });
  };

  return (
    <div style={{ padding: "24px 20px 40px" }}>
      <h2 style={headingStyle(fontFamily)}>설정</h2>

      <SettingSection title="시간">
        <MinSecRow label="집중" totalSec={customDurations.focus} onChangeMin={(v) => setDurationPart("focus", "min", v)} onChangeSec={(v) => setDurationPart("focus", "sec", v)} onReset={() => setCustomDurations((d) => ({ ...d, focus: 0 }))} />
        <MinSecRow label="짧은 휴식" totalSec={customDurations.short} onChangeMin={(v) => setDurationPart("short", "min", v)} onChangeSec={(v) => setDurationPart("short", "sec", v)} onReset={() => setCustomDurations((d) => ({ ...d, short: 0 }))} />
        <MinSecRow label="긴 휴식" totalSec={customDurations.long} onChangeMin={(v) => setDurationPart("long", "min", v)} onChangeSec={(v) => setDurationPart("long", "sec", v)} onReset={() => setCustomDurations((d) => ({ ...d, long: 0 }))} />
        <NumberRow label="긴 휴식 전 집중 횟수" value={settings.cyclesBeforeLong} onChange={(v) => update({ cyclesBeforeLong: Math.max(1, Number(v) || 1) })} />
        <ToggleRow label="긴 휴식 자동 전환" checked={settings.autoLongBreak} onChange={(v) => update({ autoLongBreak: v })} accent={accent} />
        <ToggleRow label="휴식 후 자동 시작" checked={settings.autoStartNext} onChange={(v) => update({ autoStartNext: v })} accent={accent} />
        <p style={{ fontSize: 11.5, color: "#9AA1AE", margin: 0 }}>타이머 화면에서 집중/짧은 휴식/긴 휴식 탭을 눌러 각 시간을 미리 보고 다이얼로 직접 드래그 조절할 수 있어요. 옆의 초기화 버튼으로 00:00으로 되돌릴 수 있어요.</p>
      </SettingSection>

      <SettingSection title="알림">
        <ToggleRow label="알림음 사용" checked={settings.soundEnabled} onChange={(v) => update({ soundEnabled: v })} accent={accent} />
        <RowShell label="알림음 파일">
          <FileLabel accept="audio/*" onFile={(e) => {
            const f = e.target.files?.[0]; if (!f) return;
            const reader = new FileReader();
            reader.onload = () => update({ customSoundDataUrl: reader.result, customSoundName: f.name });
            reader.readAsDataURL(f);
          }}>
            {settings.customSoundName || "파일 선택"}
          </FileLabel>
        </RowShell>
        {settings.customSoundDataUrl && (
          <>
            <NumberRow label="재생 길이 (초)" value={settings.customSoundDuration} onChange={(v) => update({ customSoundDuration: Math.max(1, Math.min(30, Number(v) || 1)) })} />
            <RowShell label="미리 듣기">
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={playPreview} disabled={isPreviewing} style={{ ...smallBtnStyle(), opacity: isPreviewing ? 0.5 : 1 }}>재생</button>
                <button onClick={stopPreview} disabled={!isPreviewing} style={{ ...smallBtnStyle(), opacity: isPreviewing ? 1 : 0.5 }}>정지</button>
              </div>
            </RowShell>
            <button onClick={() => { stopPreview(); update({ customSoundDataUrl: null, customSoundName: null }); }} style={{ background: "none", border: "none", color: "#B5533C", fontSize: 12, padding: 0, textAlign: "left", cursor: "pointer" }}>
              알림음 파일 제거 (기본음으로 되돌리기)
            </button>
          </>
        )}
        <p style={{ fontSize: 11.5, color: "#9AA1AE", margin: 0 }}>알림음을 껐을 때는 대신 진동(지원 기기) 또는 타이머가 잠깐 빛나는 효과로 알려드려요.</p>
      </SettingSection>

      <SettingSection title="화면">
        <RowShell label="포인트 색상">
          <ColorPreviewButton color={settings.accentColor} onClick={() => setColorModal("accent")} />
        </RowShell>
        <RowShell label="배경 색상">
          <ColorPreviewButton color={settings.bgColor} onClick={() => setColorModal("bg")} />
        </RowShell>
        <RowShell label="앱 폰트 (기기의 폰트 파일)" full>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <FileLabel accept=".ttf,.otf,.woff,.woff2" onFile={(e) => {
              const f = e.target.files?.[0]; if (!f) return;
              const reader = new FileReader();
              reader.onload = () => {
                const dataUrl = reader.result;
                try {
                  const face = new FontFace("UserCustomFont", `url(${dataUrl})`);
                  face.load().then((loaded) => {
                    document.fonts.add(loaded);
                    update({ fontFamily: "UserCustomFont", customFontDataUrl: dataUrl, customFontName: f.name });
                  }).catch(() => update({ fontFamily: "", customFontDataUrl: null, customFontName: null }));
                } catch (err) {}
              };
              reader.readAsDataURL(f);
            }}>
              {settings.customFontName || "폰트 파일 선택 (.ttf, .otf, .woff)"}
            </FileLabel>
            {settings.customFontName && (
              <button onClick={() => update({ fontFamily: "", customFontDataUrl: null, customFontName: null })} style={{ background: "none", border: "none", color: "#B5533C", fontSize: 12, cursor: "pointer" }}>
                제거
              </button>
            )}
          </div>
        </RowShell>
        <ToggleRow label="하단 문장 표시" checked={settings.showBottomSentence} onChange={(v) => update({ showBottomSentence: v })} accent={accent} />
        {settings.showBottomSentence && (
          <RowShell label="하단 문장 내용" full>
            <input value={settings.bottomSentence} onChange={(e) => update({ bottomSentence: e.target.value })} style={inputStyle()} />
          </RowShell>
        )}
        <ToggleRow label="화면 자동 꺼짐 방지" checked={settings.wakeLockEnabled} onChange={(v) => update({ wakeLockEnabled: v })} accent={accent} />
        <ToggleRow label="타이머 숫자 숨기기" checked={settings.hideNumbers} onChange={(v) => update({ hideNumbers: v })} accent={accent} />
        <ToggleRow label="타이머 텍스트 숨기기" checked={settings.hideText} onChange={(v) => update({ hideText: v })} accent={accent} />
      </SettingSection>

      <SettingSection title="회고">
        <ToggleRow label="타이머 종료 후 회고창 자동 팝업" checked={settings.reflectionEnabled} onChange={(v) => update({ reflectionEnabled: v })} accent={accent} />
      </SettingSection>

      <SettingSection title="연속 방문 기록">
        <HabitTracker visitDates={visitDates} starColor={settings.habitStarColor} onToggle={onToggleVisit} />
        <div>
          <span style={{ fontSize: 12.5, color: "#9AA1AE", display: "block", marginBottom: 8 }}>별 색상</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {STAR_COLOR_PRESETS.map((p) => (
              <button key={p.value} onClick={() => update({ habitStarColor: p.value })} style={{
                display: "flex", alignItems: "center", gap: 6, border: `1px solid ${settings.habitStarColor === p.value ? accent : "#EAEAE6"}`,
                borderRadius: 10, padding: "6px 10px", background: "#fff", cursor: "pointer", fontSize: 12.5,
              }}>
                <Star size={13} fill={p.value} color={p.value} /> {p.label}
              </button>
            ))}
            <ColorPreviewButton color={settings.habitStarColor} onClick={() => setColorModal("star")} label="직접 선택" />
          </div>
        </div>
      </SettingSection>

      <SettingSection title="백업">
        <RowShell label="자동 저장 상태">
          <span style={{ fontSize: 12.5, color: storageStatus === "saved" ? "#3E7C59" : "#B5533C" }}>
            {storageStatus === "saved" ? "이 브라우저에 저장됨" : storageStatus === "loading" ? "확인 중..." : "저장 불가 (브라우저 설정 확인)"}
          </span>
        </RowShell>
        <RowShell label="파일로 내보내기">
          <button onClick={onExport} style={{ ...smallBtnStyle(), display: "flex", alignItems: "center", gap: 6 }}><Download size={14} /> 내보내기</button>
        </RowShell>
        <RowShell label="파일에서 가져오기">
          <FileLabel accept="application/json" onFile={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); }}>
            <Upload size={14} /> 가져오기
          </FileLabel>
        </RowShell>
        {importMessage && <p style={{ fontSize: 12, color: importMessage.type === "error" ? "#B5533C" : "#3E7C59", margin: 0 }}>{importMessage.text}</p>}
      </SettingSection>

      <SettingSection title="기록">
        <RowShell label="오늘·이번 주 완료 개수, 누적 시간, 그래프 초기화">
          <button onClick={() => setShowResetConfirm(true)} style={smallBtnStyle(true)}>초기화</button>
        </RowShell>
        <p style={{ fontSize: 11.5, color: "#9AA1AE", margin: 0 }}>실수로 기록이 잘못 쌓였다면, 통계 탭의 '오늘 기록 보기'에서 개별 기록만 지울 수도 있어요.</p>
      </SettingSection>

      {showResetConfirm && (
        <ConfirmModal title="통계 초기화" message="누적 시간, 날짜별 그래프, 오늘/이번 주 완료 개수가 모두 0으로 초기화돼요. 되돌릴 수 없어요." confirmLabel="초기화" danger
          onCancel={() => setShowResetConfirm(false)} onConfirm={() => { onResetStats(); setShowResetConfirm(false); }} />
      )}

      {colorModal === "accent" && (
        <ColorPickerModal title="포인트 색상" value={settings.accentColor} defaultValue={DEFAULT_SETTINGS.accentColor}
          onConfirm={(hex) => { update({ accentColor: hex }); setColorModal(null); }} onCancel={() => setColorModal(null)} />
      )}
      {colorModal === "bg" && (
        <ColorPickerModal title="배경 색상" value={settings.bgColor} defaultValue={DEFAULT_SETTINGS.bgColor}
          onConfirm={(hex) => { update({ bgColor: hex }); setColorModal(null); }} onCancel={() => setColorModal(null)} />
      )}
      {colorModal === "star" && (
        <ColorPickerModal title="별 색상" value={settings.habitStarColor} defaultValue={DEFAULT_SETTINGS.habitStarColor}
          onConfirm={(hex) => { update({ habitStarColor: hex }); setColorModal(null); }} onCancel={() => setColorModal(null)} />
      )}
    </div>
  );
}

function ColorPreviewButton({ color, onClick, label = "변경" }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 8, border: "1px solid #EAEAE6", borderRadius: 10,
      padding: "6px 10px", background: "#fff", cursor: "pointer",
    }}>
      <span style={{ width: 20, height: 20, borderRadius: "50%", background: color, border: "1px solid #EAEAE6", flexShrink: 0 }} />
      <span style={{ fontSize: 12.5, color: "#5B6270" }}>{label}</span>
    </button>
  );
}

function HabitTracker({ visitDates, starColor, onToggle }) {
  const days = [];
  for (let i = 34; i >= -6; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    days.push({ iso, visited: visitDates.includes(iso), dayNum: d.getDate(), isFuture: i < 0 });
  }
  const todayIso = todayISO();
  const todayIdx = days.findIndex((d) => d.iso === todayIso);
  let streak = 0;
  for (let i = todayIdx; i >= 0; i--) { if (days[i].visited) streak++; else break; }

  return (
    <div style={{ marginBottom: 4 }}>
      <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>🔥 연속 {streak}일 방문 중</p>
      <p style={{ fontSize: 11.5, color: "#9AA1AE", margin: "0 0 10px" }}>날짜를 눌러 별을 직접 찍거나 지울 수 있어요. 앞으로 며칠도 미리 찍을 수 있어요.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
        {days.map((d) => (
          <button key={d.iso} onClick={() => onToggle(d.iso)} title={d.iso} style={{
            aspectRatio: "1", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            background: d.visited ? `${starColor}1A` : "#F5F6F3",
            border: d.iso === todayIso ? `1.5px solid ${starColor}` : d.isFuture ? "1px dashed #DDE0E5" : "1px solid #EAEAE6",
          }}>
            {d.visited ? <Star size={14} fill={starColor} color={starColor} /> : <span style={{ fontSize: 9, color: "#C7CCD6" }}>{d.dayNum}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function ColorPicker({ value, onChange }) {
  const [hexInput, setHexInput] = useState(value);
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  useEffect(() => setHexInput(value), [value]);

  const hueFromPointer = (clientX) => {
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return Math.round(ratio * 360);
  };
  const handleDown = (e) => { setDragging(true); e.target.setPointerCapture?.(e.pointerId); onChange(hslToHex(hueFromPointer(e.clientX), 62, 42)); };
  const handleMove = (e) => { if (dragging) onChange(hslToHex(hueFromPointer(e.clientX), 62, 42)); };
  const handleUp = () => setDragging(false);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {ACCENT_SWATCHES.map((c) => (
          <button key={c} onClick={() => onChange(c)} style={{
            width: 26, height: 26, borderRadius: "50%", background: c, cursor: "pointer",
            border: value.toLowerCase() === c.toLowerCase() ? "2px solid #20242B" : "1px solid #EAEAE6",
            boxShadow: value.toLowerCase() === c.toLowerCase() ? "0 0 0 2px #fff inset" : "none",
          }} />
        ))}
      </div>
      <span style={{ fontSize: 12, color: "#9AA1AE", display: "block", marginBottom: 6 }}>자유롭게 고르기</span>
      <div ref={trackRef} onPointerDown={handleDown} onPointerMove={handleMove} onPointerUp={handleUp} onPointerCancel={handleUp} style={{
        height: 22, borderRadius: 11, marginBottom: 12, cursor: "pointer", touchAction: "none",
        background: "linear-gradient(to right, hsl(0,62%,42%), hsl(60,62%,42%), hsl(120,62%,42%), hsl(180,62%,42%), hsl(240,62%,42%), hsl(300,62%,42%), hsl(360,62%,42%))",
      }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: isValidHex(hexInput) ? hexInput : value, border: "1px solid #EAEAE6", flexShrink: 0 }} />
        <input value={hexInput} onChange={(e) => { const v = e.target.value; setHexInput(v); if (isValidHex(v)) onChange(v); }} placeholder="#2B4C7E" style={{ ...inputStyle(), fontFamily: "monospace", textTransform: "uppercase" }} />
      </div>
    </div>
  );
}

function ColorPickerModal({ title, value, defaultValue, onConfirm, onCancel }) {
  const init = hexToHsl(value);
  const [h, setH] = useState(init.h);
  const [s, setS] = useState(init.s);
  const [l, setL] = useState(init.l);
  const [hexText, setHexText] = useState(value);

  useEffect(() => { setHexText(hslToHex(h, s, l)); }, [h, s, l]);

  const applySwatch = (hex) => {
    const hsl = hexToHsl(hex);
    setH(hsl.h); setS(hsl.s); setL(hsl.l); setHexText(hex);
  };
  const applyHexInput = (v) => {
    setHexText(v);
    if (isValidHex(v)) { const hsl = hexToHsl(v); setH(hsl.h); setS(hsl.s); setL(hsl.l); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,22,26,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 70 }}>
      <div style={{ background: "#fff", width: "100%", maxWidth: APP_MAX_WIDTH, borderRadius: "20px 20px 0 0", padding: 22, maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h3>
          <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={18} color="#9AA1AE" /></button>
        </div>

        <div style={{ width: "100%", height: 52, borderRadius: 12, background: hexText, border: "1px solid #EAEAE6", marginBottom: 16 }} />

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
          {ACCENT_SWATCHES.map((c) => (
            <button key={c} onClick={() => applySwatch(c)} style={{
              width: 26, height: 26, borderRadius: "50%", background: c, cursor: "pointer",
              border: hexText.toLowerCase() === c.toLowerCase() ? "2px solid #20242B" : "1px solid #EAEAE6",
            }} />
          ))}
        </div>

        <SliderRow label="색조" value={h} max={360} onChange={setH}
          gradient="linear-gradient(to right, hsl(0,80%,50%), hsl(60,80%,50%), hsl(120,80%,50%), hsl(180,80%,50%), hsl(240,80%,50%), hsl(300,80%,50%), hsl(360,80%,50%))" />
        <SliderRow label="채도" value={s} max={100} onChange={setS} gradient={`linear-gradient(to right, hsl(${h},0%,${l}%), hsl(${h},100%,${l}%))`} />
        <SliderRow label="명도" value={l} max={100} onChange={setL} gradient={`linear-gradient(to right, hsl(${h},${s}%,0%), hsl(${h},${s}%,50%), hsl(${h},${s}%,100%))`} />

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, marginBottom: 18 }}>
          <span style={{ fontSize: 12.5, color: "#9AA1AE" }}>HEX</span>
          <input value={hexText} onChange={(e) => applyHexInput(e.target.value)} style={{ ...inputStyle(), fontFamily: "monospace", textTransform: "uppercase" }} />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => applySwatch(defaultValue)} style={smallBtnStyle()}>기본값으로</button>
          <div style={{ flex: 1 }} />
          <button onClick={onCancel} style={smallBtnStyle()}>취소</button>
          <button onClick={() => onConfirm(hexText)} style={{ ...smallBtnStyle(true) }}>확인</button>
        </div>
      </div>
    </div>
  );
}

function SliderRow({ label, value, max, onChange, gradient }) {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const valFromPointer = (clientX) => {
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return Math.round(ratio * max);
  };
  const down = (e) => { setDragging(true); e.target.setPointerCapture?.(e.pointerId); onChange(valFromPointer(e.clientX)); };
  const move = (e) => { if (dragging) onChange(valFromPointer(e.clientX)); };
  const up = () => setDragging(false);
  const pct = (value / max) * 100;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#9AA1AE", marginBottom: 6 }}>
        <span>{label}</span><span>{value}</span>
      </div>
      <div ref={trackRef} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        style={{ position: "relative", height: 20, borderRadius: 10, background: gradient, cursor: "pointer", touchAction: "none" }}>
        <div style={{ position: "absolute", left: `calc(${pct}% - 9px)`, top: 1, width: 18, height: 18, borderRadius: "50%", background: "#fff", border: "2px solid #20242B", boxShadow: "0 1px 3px rgba(0,0,0,.25)" }} />
      </div>
    </div>
  );
}

function SettingSection({ title, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <p style={subHeadingStyle()}>{title}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
    </div>
  );
}
function RowShell({ label, children, full }) {
  return (
    <div style={{ display: "flex", flexDirection: full ? "column" : "row", alignItems: full ? "stretch" : "center", justifyContent: "space-between", gap: 8 }}>
      <span style={{ fontSize: 14, color: "#5B6270" }}>{label}</span>
      {children}
    </div>
  );
}
function NumberRow({ label, value, onChange }) {
  return (
    <RowShell label={label}>
      <input type="number" min={1} value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle(), width: 64, textAlign: "center" }} />
    </RowShell>
  );
}
function MinSecRow({ label, totalSec, onChangeMin, onChangeSec, onReset }) {
  const min = Math.floor(totalSec / 60), sec = totalSec % 60;
  return (
    <RowShell label={label}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input type="number" min={0} value={min} onChange={(e) => onChangeMin(e.target.value)} style={{ ...inputStyle(), width: 52, textAlign: "center", flex: "none" }} />
        <span style={{ fontSize: 12.5, color: "#9AA1AE" }}>분</span>
        <input type="number" min={0} max={59} value={sec} onChange={(e) => onChangeSec(e.target.value)} style={{ ...inputStyle(), width: 52, textAlign: "center", flex: "none" }} />
        <span style={{ fontSize: 12.5, color: "#9AA1AE" }}>초</span>
        {onReset && (
          <button onClick={onReset} title="00:00으로 초기화" style={{ ...iconBtnStyle(28), marginLeft: 4 }}>
            <RotateCcw size={13} color="#9AA1AE" />
          </button>
        )}
      </div>
    </RowShell>
  );
}
function ToggleRow({ label, checked, onChange, accent }) {
  return (
    <RowShell label={label}>
      <button onClick={() => onChange(!checked)} style={{ width: 42, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: checked ? accent : "#DDE0E5", position: "relative", transition: "background .15s" }}>
        <span style={{ position: "absolute", top: 2, left: checked ? 20 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .15s", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />
      </button>
    </RowShell>
  );
}

/* --------------------------- Confirm modal ------------------------------ */

function ConfirmModal({ title, message, confirmLabel = "확인", onConfirm, onCancel, danger }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,22,26,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 22, width: "100%", maxWidth: 340 }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700 }}>{title}</h3>
        <p style={{ margin: "0 0 18px", fontSize: 13.5, color: "#5B6270", lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={smallBtnStyle()}>취소</button>
          <button onClick={onConfirm} style={{ ...smallBtnStyle(true), background: danger ? "#B5533C" : "#20242B" }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------- Reflection modal ---------------------------- */

function ReflectionModal({ data, setData, onSave, onSkip, onWritePast, accent }) {
  const onPickPhoto = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setData((d) => ({ ...d, photo: reader.result }));
    reader.readAsDataURL(f);
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,22,26,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}>
      <div style={{ background: "#fff", width: "100%", maxWidth: APP_MAX_WIDTH, borderRadius: "20px 20px 0 0", padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>집중 회고</h3>
          <button onClick={onSkip} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={18} color="#9AA1AE" /></button>
        </div>
        <p style={{ fontSize: 12.5, color: "#9AA1AE", margin: "0 0 14px" }}>{data.dateISO} · {data.time}</p>
        <textarea value={data.text} onChange={(e) => setData((d) => ({ ...d, text: e.target.value }))} placeholder="이번 집중 시간은 어땠나요?" rows={4}
          style={{ width: "100%", border: "1px solid #EAEAE6", borderRadius: 12, padding: 12, fontSize: 14, fontFamily: "inherit", resize: "none", marginBottom: 12 }} />
        {data.photo && <img src={data.photo} alt="" style={{ width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 12, marginBottom: 12 }} />}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <FileLabel accept="image/*" onFile={onPickPhoto}><ImageIcon size={15} /> 사진 추가</FileLabel>
          <div style={{ flex: 1 }} />
          <button onClick={onWritePast} style={smallBtnStyle()}>지난 회고 작성하기</button>
          <button onClick={onSkip} style={smallBtnStyle()}>건너뛰기</button>
          <button onClick={onSave} style={{ ...smallBtnStyle(true), background: accent, borderColor: accent }}>저장</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ shared UI ------------------------------- */

function headingStyle(fontFamily) { return { fontSize: 20, fontWeight: 700, margin: "0 0 20px", fontFamily: fontFamily || "'Space Grotesk', inherit" }; }
function subHeadingStyle() { return { fontSize: 12.5, color: "#9AA1AE", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, margin: "0 0 10px" }; }
function inputStyle() { return { flex: 1, border: "1px solid #EAEAE6", borderRadius: 10, padding: "9px 12px", fontSize: 14, fontFamily: "inherit", outline: "none" }; }
function smallBtnStyle(filled) {
  return { border: `1px solid ${filled ? "transparent" : "#EAEAE6"}`, borderRadius: 10, padding: "8px 14px", background: filled ? "#20242B" : "#fff", color: filled ? "#fff" : "#5B6270", fontSize: 13, cursor: "pointer" };
}
