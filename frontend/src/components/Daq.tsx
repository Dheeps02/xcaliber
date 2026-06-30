import {
  useRef, useState, useEffect, useLayoutEffect,
  memo,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Trash, Wrench, ArrowSquareOut, FolderOpen,
  Plus, X, DotsSixVertical, CaretDown,
} from '@phosphor-icons/react';
import { useAppStore, SPARK_ZOOM_MIN_MS, SPARK_ZOOM_MAX_MS } from '../stores/app-store';
import { AnimatedCount } from './AnimatedCount';
import { api } from '../lib/api';
import type { DaqList, DaqOdt, DaqEntry, DaqEntryType, A2lVariable } from '../lib/types';
import { ExportDialog } from './ExportDialog';
import { Button } from './ui/Button';
import { RunStopButton } from './ui/RunStopButton';
import { DialInput } from './ui/DialInput';
import { Toggle } from './ui/Toggle';
import { FieldLabel } from './ui/FieldLabel';
import { Select } from './ui/Select';

// ── constants ────────────────────────────────────────────────────
const TYPE_SIZES: Record<DaqEntryType, number> = {
  u8: 1, i8: 1, u16: 2, i16: 2, u32: 4, i32: 4, f32: 4, f64: 8,
};
const ODT_COLORS = ['#10b981','#3b82f6','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#ec4899','#84cc16'];
// Stagger between each DAQ entry's enter animation within an ODT. ODT-to-ODT
// stagger derives from this: an ODT's entries finish staggering in after
// entries.length * ENTRY_STAGGER_MS, at which point the next ODT begins.
const ENTRY_STAGGER_MS = 40;
const SPARK_H = 22;
const SPARK_REVEAL_MS = 380;
const LIVE_THRESHOLD_MS = 3000;

// ── DAQ list run mode (START_STOP_DAQ_LIST) ────────────────────────
const RUN_MODES: { value: number; label: string }[] = [
  { value: 0x00, label: 'Stop' },
  { value: 0x01, label: 'Start' },
  { value: 0x03, label: 'Select' },
];
const RUN_MODE_COLORS: Record<number, string> = {
  0x00: 'var(--text-muted)',
  0x01: 'var(--status-ok)',
  0x03: 'var(--accent)',
};

// ── SET_DAQ_LIST_MODE bitfield ──────────────────────────────────────
const DAQ_LIST_MODE_BITS: { bit: number; label: string }[] = [
  { bit: 0x01, label: 'Alternating ODTs' },
  { bit: 0x02, label: 'STIM direction' },
  { bit: 0x10, label: 'Timestamp' },
  { bit: 0x20, label: 'PID off' },
  { bit: 0x80, label: 'Resume' },
];

// ── zoom helpers ──────────────────────────────────────────────────
const LOG_MIN = Math.log2(SPARK_ZOOM_MIN_MS);
const LOG_MAX = Math.log2(SPARK_ZOOM_MAX_MS);
const sliderToMs = (v: number) => Math.round(Math.pow(2, LOG_MIN + (v / 100) * (LOG_MAX - LOG_MIN)));
const msToSlider = (ms: number) => ((Math.log2(ms) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 100;
function fmtZoom(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  return `${s % 1 === 0 ? s : s.toFixed(1)}s`;
}

// ── Sparkline ────────────────────────────────────────────────────
const Sparkline = memo(function Sparkline({
  liveKey, color, revealDelayMs, revealEpoch,
}: {
  liveKey: string;
  color: string;
  revealDelayMs: number;
  revealEpoch: number;
}) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const rafRef     = useRef<number>(0);
  const colorRef   = useRef(color);
  const yRangeRef  = useRef<{ mn: number; mx: number } | null>(null);
  useEffect(() => { colorRef.current = color; }, [color]);

  // Non-passive wheel listener so we can preventDefault and avoid page scroll
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      e.stopPropagation();
      const { sparkWindowMs, setSparkWindowMs } = useAppStore.getState();
      const next = Math.max(SPARK_ZOOM_MIN_MS, Math.min(SPARK_ZOOM_MAX_MS,
        Math.round(sparkWindowMs * (e.deltaY > 0 ? 1.25 : 1 / 1.25))
      ));
      setSparkWindowMs(next);
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    yRangeRef.current = null;
    const mountTime = performance.now();
    // Paused while the canvas has no visible area — collapsed ODT/list
    // sections and off-screen rows would otherwise keep redrawing (and
    // forcing a layout read via offsetWidth) at 60fps for nothing.
    let visible = true;

    function render() {
      if (!visible) return;

      const canvas = canvasRef.current;
      if (!canvas) { rafRef.current = requestAnimationFrame(render); return; }

      const W   = canvas.offsetWidth;
      const H   = SPARK_H;
      if (W === 0) { rafRef.current = requestAnimationFrame(render); return; }

      const dpr = window.devicePixelRatio || 1;
      const pw  = Math.round(W * dpr);
      const ph  = Math.round(H * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width  = pw;
        canvas.height = ph;
      }

      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, pw, ph);
      ctx.save();
      ctx.scale(dpr, dpr);

      // Entrance wipe — draw only up to a progressively widening edge instead
      // of animating CSS clip-path, so the reveal stays perfectly in sync
      // with the canvas's own render loop (no separate compositor layer or
      // per-frame clip-region cost).
      let revealW = W;
      if (useAppStore.getState().animationsEnabled) {
        const revealElapsed = performance.now() - mountTime - revealDelayMs;
        const t = Math.max(0, Math.min(1, revealElapsed / SPARK_REVEAL_MS));
        if (t < 1) revealW = (1 - (1 - t) * (1 - t)) * W;
      }

      const col = colorRef.current;
      const r   = parseInt(col.slice(1, 3), 16);
      const g   = parseInt(col.slice(3, 5), 16);
      const b   = parseInt(col.slice(5, 7), 16);

      const now           = Date.now();
      const sparkWindowMs = useAppStore.getState().sparkWindowMs;
      const hist = useAppStore.getState().daqLiveValues.get(liveKey)?.history ?? [];
      const winStart = hist.length > 0
        ? Math.max(hist[0].ts, now - sparkWindowMs)
        : now - sparkWindowMs;

      function flatLine(y: number, muted: boolean, toX: number) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(toX, y);
        ctx.strokeStyle = muted ? 'rgba(255,255,255,0.12)' : col;
        ctx.lineWidth   = 1;
        ctx.stroke();
      }

      if (hist.length === 0) {
        flatLine(H / 2, true, revealW);
        ctx.restore();
        rafRef.current = requestAnimationFrame(render);
        return;
      }

      // Single pass over the full history: track min/max for Y-scaling and
      // split into the visible window — `hist` can be thousands of points,
      // so this used to be two separate O(n) passes per sparkline per frame.
      let mn = hist[0].value, mx = hist[0].value;
      const inWindow: { value: number; ts: number }[] = [];
      let lastBefore: { value: number; ts: number } | undefined;
      for (const p of hist) {
        if (p.value < mn) mn = p.value;
        if (p.value > mx) mx = p.value;
        if (p.ts < winStart) lastBefore = p;
        else                 inWindow.push(p);
      }
      if (!yRangeRef.current) {
        yRangeRef.current = { mn, mx };
      } else {
        const EXPAND = 0.2;   // ~10 frames to 90% — brief edge-clip on new extremes
        const SHRINK = 0.03;  // ~75 frames to 90% — slow drift as old extremes age out
        const mnRate = mn < yRangeRef.current.mn ? EXPAND : SHRINK;
        const mxRate = mx > yRangeRef.current.mx ? EXPAND : SHRINK;
        yRangeRef.current.mn += (mn - yRangeRef.current.mn) * mnRate;
        yRangeRef.current.mx += (mx - yRangeRef.current.mx) * mxRate;
      }
      const dispMn = yRangeRef.current.mn;
      const dispMx = yRangeRef.current.mx;
      const range  = Math.max(dispMx - dispMn, 1);
      const norm   = (v: number) => Math.max(1, Math.min(H - 1, (H - 4) - ((v - dispMn) / range) * (H - 8) + 2));

      // Left-edge interpolation for smooth entry
      if (lastBefore !== undefined) {
        if (inWindow.length > 0) {
          const next = inWindow[0];
          const t = next.ts > lastBefore.ts
            ? (winStart - lastBefore.ts) / (next.ts - lastBefore.ts) : 0;
          inWindow.unshift({ value: lastBefore.value + t * (next.value - lastBefore.value), ts: winStart });
        } else {
          inWindow.push({ value: lastBefore.value, ts: winStart });
        }
      }

      if (inWindow.length < 2) {
        flatLine(norm(hist[hist.length - 1].value), false, revealW);
        ctx.restore();
        rafRef.current = requestAnimationFrame(render);
        return;
      }

      const pts = inWindow.map(p => ({
        x: ((p.ts - winStart) / sparkWindowMs) * W,
        y: norm(p.value),
      }));

      // Right edge tracks "now" every frame so the line advances smoothly at
      // render rate rather than jumping only when new samples arrive (pinned
      // to W once the window is full), additionally capped by the entrance
      // wipe's reveal width so the line is only drawn up to that point.
      const windowFull = hist[0].ts <= now - sparkWindowMs;
      const nowX = windowFull ? W : ((now - winStart) / sparkWindowMs) * W;
      const cap  = Math.min(nowX, revealW);

      let cutIdx = pts.length - 1;
      while (cutIdx > 0 && pts[cutIdx].x > cap) cutIdx--;
      if (cutIdx < pts.length - 1) {
        const a = pts[cutIdx], b = pts[cutIdx + 1];
        const segT = b.x > a.x ? (cap - a.x) / (b.x - a.x) : 0;
        pts.length = cutIdx + 1;
        pts.push({ x: cap, y: a.y + segT * (b.y - a.y) });
      } else if (pts[cutIdx].x < cap) {
        pts.push({ x: cap, y: pts[cutIdx].y });
      }

      const first = pts[0];
      const tail  = pts[pts.length - 1];

      // Fill
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, `rgba(${r},${g},${b},0.25)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.lineTo(tail.x, H);
      ctx.lineTo(first.x, H);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Line — canvas rasterises as one path, no per-segment alpha accumulation
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.strokeStyle = col;
      ctx.lineWidth   = 1.5;
      ctx.lineJoin    = 'round';
      ctx.lineCap     = 'butt';
      ctx.stroke();

      ctx.restore();
      rafRef.current = requestAnimationFrame(render);
    }

    const canvasEl = canvasRef.current;
    const observer = new IntersectionObserver(([e]) => {
      const justBecameVisible = e.isIntersecting && !visible;
      visible = e.isIntersecting;
      if (justBecameVisible) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(render);
      }
    }, { threshold: 0 });
    if (canvasEl) observer.observe(canvasEl);

    rafRef.current = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(rafRef.current);
      observer.disconnect();
    };
  }, [liveKey, revealEpoch]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: SPARK_H }}
    />
  );
});

// ── DaqToolbar ───────────────────────────────────────────────────
interface ToolbarProps {
  lists: DaqList[];
  configuring: boolean;
  onConfigure: () => void;
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
  onFree: () => void;
  onSave: () => void;
  onLoad: (file: File) => void;
}

function DaqToolbar({
  lists, configuring,
  onConfigure, onStart, onStop, onFree, onSave, onLoad,
}: ToolbarProps) {
  const daqStatus     = useAppStore(s => s.daqStatus);
  const connected     = useAppStore(s => s.connected);
  const daqDtoRate    = useAppStore(s => s.daqDtoRate);
  const showToast     = useAppStore(s => s.showToast);
  const sparkWindowMs = useAppStore(s => s.sparkWindowMs);
  const setSparkWindowMs = useAppStore(s => s.setSparkWindowMs);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sliderRef    = useRef<HTMLInputElement>(null);
  const [wrenchKey,      setWrenchKey]      = useState(0);
  const [runPending,       setRunPending]       = useState(false);
  const [runJiggling,      setRunJiggling]      = useState(false);
  const [configJiggling,   setConfigJiggling]   = useState(false);
  const [confirmOpen,    setConfirmOpen]    = useState(false);
  const [confirmExiting, setConfirmExiting] = useState(false);
  const prevStatusRef = useRef(daqStatus);

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = daqStatus;
    if (prev === 'idle' && daqStatus === 'configured') setWrenchKey(k => k + 1);
    // Clear pending once the status actually changes
    if (prev === 'configured' && daqStatus === 'running')    setRunPending(false);
    if (prev === 'running'    && daqStatus === 'configured') setRunPending(false);
  }, [daqStatus]);

  useEffect(() => {
    const el = sliderRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const { sparkWindowMs, setSparkWindowMs } = useAppStore.getState();
      const next = Math.max(0, Math.min(100, msToSlider(sparkWindowMs) + (e.deltaY > 0 ? -4 : 4)));
      setSparkWindowMs(sliderToMs(next));
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  function closeConfirm() {
    setConfirmExiting(true);
    setTimeout(() => { setConfirmOpen(false); setConfirmExiting(false); }, 130);
  }

  const canStart     = daqStatus === 'configured';
  const canStop      = daqStatus === 'running';
  const canFree      = daqStatus !== 'idle';

  const ledClass     = daqStatus === 'running' ? 'blinker-on' : daqStatus === 'configured' ? 'blinker-yellow' : 'blinker-grey';
  const stateLabel   = daqStatus === 'running' ? 'Running' : daqStatus === 'configured' ? 'Configured' : 'Idle';
  const stateColor   = daqStatus === 'running' ? 'var(--status-ok)' : daqStatus === 'configured' ? 'var(--status-warn)' : 'var(--text-muted)';

  return (
    <div
      className="xcb-glass flex items-center gap-2 px-3 h-9 shrink-0"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <input ref={fileInputRef} type="file" accept=".daq,.json" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) { onLoad(f); e.target.value = ''; } }}
      />

      <span className={`w-2 h-2 rounded-full shrink-0 ${ledClass}`} />
      <span className="text-[10px] w-16 shrink-0" style={{ color: stateColor }}>{stateLabel}</span>
      <div className="xcb-vdiv-fade" />

      <Button variant="ghost" intent="danger" className="!px-2 !py-0.5 !text-[10px] !gap-1" disabled={!canFree} onClick={() => setConfirmOpen(true)}>
        <Trash size={13} />Free All
      </Button>
      <div className="xcb-vdiv-fade" />

      <Button
        variant="default"
        className={`!px-2 !py-0.5 !text-[10px] !gap-1${configJiggling ? ' btn-jiggle' : ''}`}
        disabled={configuring}
        onClick={() => {
          if (!connected) {
            setConfigJiggling(true); setTimeout(() => setConfigJiggling(false), 380);
            showToast('Not connected to slave', 'error'); return;
          }
          if (daqStatus !== 'idle') {
            setConfigJiggling(true); setTimeout(() => setConfigJiggling(false), 380);
            showToast('Free the DAQ lists before reconfiguring', 'warning'); return;
          }
          if (!lists.some(l => l.odts.some(o => o.entries.length > 0))) {
            setConfigJiggling(true); setTimeout(() => setConfigJiggling(false), 380);
            showToast('Add at least one entry to a DAQ list first', 'warning'); return;
          }
          onConfigure();
        }}
      >
        {configuring ? (
          <>
            <svg className="animate-spin" width="10" height="10" viewBox="0 0 10 10" fill="none">
              <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.3" />
              <path d="M5 1a4 4 0 0 1 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Configuring…
          </>
        ) : (
          <><Wrench key={wrenchKey} size={13} className={wrenchKey > 0 ? 'icon-wrench-crank' : ''} />Configure</>
        )}
      </Button>

      <RunStopButton
        running={daqStatus === 'running'}
        pending={runPending}
        canRun={canStart}
        canStop={canStop}
        className={runJiggling ? 'btn-jiggle' : ''}
        onRun={async () => {
          if (!connected) {
            setRunJiggling(true);
            setTimeout(() => setRunJiggling(false), 380);
            showToast('Not connected to slave', 'error');
            return;
          }
          setRunPending(true);
          try { await onStart(); }
          catch { setRunPending(false); }
        }}
        onStop={async () => {
          setRunPending(true);
          try { await onStop(); }
          catch { setRunPending(false); }
        }}
      />

      <div className="flex-1" />

      {/* Zoom / time-window slider */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[9px] uppercase tracking-wider select-none" style={{ color: 'var(--text-muted)' }}>Window</span>
        <input
          ref={sliderRef}
          type="range"
          min={0} max={100} step={0.5}
          value={msToSlider(sparkWindowMs)}
          onChange={e => setSparkWindowMs(sliderToMs(Number(e.target.value)))}
          className="xcb-slider"
          style={{ '--fill': `${msToSlider(sparkWindowMs).toFixed(1)}%`, width: 72 } as React.CSSProperties}
          title={`Spark window: ${fmtZoom(sparkWindowMs)}`}
        />
        <span className="text-[10px] font-mono tabular-nums shrink-0" style={{ width: 28, textAlign: 'right', color: 'var(--text-primary)' }}>
          {fmtZoom(sparkWindowMs)}
        </span>
      </div>
      <div className="xcb-vdiv-fade" />

      {/* LCD-style DTO rate display */}
      <div style={{
        background: 'var(--input-bg)',
        border: '1px solid var(--input-border)',
        borderTopColor: 'var(--input-border-top)',
        borderRadius: 4,
        boxShadow: 'inset 0 2px 4px var(--shadow-8), inset 0 1px 2px var(--shadow-6)',
        padding: '2px 7px',
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1,
        userSelect: 'none',
      }}>
        <div style={{ position: 'relative' }}>
          {/* ghost: block layout sizes the container, monospace width matches live digits */}
          <span aria-hidden style={{
            display: 'block', textAlign: 'right',
            fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1,
            color: 'var(--status-ok)',
            opacity: daqStatus === 'running' && daqDtoRate > 0 ? 0 : 0.18,
            transition: 'opacity 400ms ease',
            pointerEvents: 'none', userSelect: 'none',
          }}>8888</span>
          {/* live count: always mounted, fades in when data starts flowing */}
          <span style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            textShadow: '0 0 8px color-mix(in srgb, var(--status-ok) 50%, transparent)',
            opacity: daqStatus === 'running' && daqDtoRate > 0 ? 1 : 0,
            transition: 'opacity 400ms ease',
          }}>
            <AnimatedCount value={daqDtoRate} color="var(--status-ok)" className="!text-[13px] !leading-none" pad={4} />
          </span>
        </div>
        <span style={{ fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: 1 }}>
          DTOs/s
        </span>
      </div>
      <div className="xcb-vdiv-fade" />

      <Button variant="default" className="!px-2 !py-0.5 !text-[10px] !gap-1" title="Export" onClick={onSave}>
        <ArrowSquareOut size={13} />Export
      </Button>
      <Button variant="default" className="!px-2 !py-0.5 !text-[10px] !gap-1" title="Import" onClick={() => fileInputRef.current?.click()}>
        <FolderOpen size={13} />Import
      </Button>

      {confirmOpen && createPortal(
        <div
          className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 ${confirmExiting ? 'modal-backdrop-exit' : 'modal-backdrop-enter'}`}
          onMouseDown={e => { if (e.target === e.currentTarget) closeConfirm(); }}
        >
          <div
            className={`xcb-glass-panel w-72 p-5 flex flex-col gap-4 rounded-lg ${confirmExiting ? 'modal-panel-exit' : 'modal-panel-enter'}`}
            style={{ border: '1px solid var(--border-strong)', boxShadow: '0 16px 48px var(--shadow-8)' }}
          >
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
              Free all DAQ resources on the slave? This stops acquisition and releases all configured lists.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={closeConfirm}>Cancel</Button>
              <Button variant="primary" intent="danger" onClick={() => { closeConfirm(); onFree(); }}>
                <Trash size={13} />Free All
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Inline entry editor ───────────────────────────────────────────
interface InlineEditProps {
  listId: number;
  odtId: number;
  onSave: (entry: DaqEntry) => void;
  onCancel: () => void;
}

function DaqInlineEdit({ onSave, onCancel }: InlineEditProps) {
  const a2lVars   = useAppStore(s => s.a2lVariables);
  const showToast = useAppStore(s => s.showToast);
  const [name, setName]         = useState('');
  const [addr, setAddr]         = useState('');
  const [typeName, setTypeName] = useState<DaqEntryType>('u32');
  const [ext,  setExt]          = useState('0');
  const [suggs, setSuggs]       = useState<A2lVariable[]>([]);
  const [suggOpen, setSuggOpen] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  useEffect(() => {
    if (!name.trim() || a2lVars.length === 0) { setSuggs([]); return; }
    const q = name.toLowerCase();
    setSuggs(a2lVars.filter(v => v.name.toLowerCase().includes(q)).slice(0, 6));
  }, [name, a2lVars]);

  function pickSugg(v: A2lVariable) {
    setName(v.name);
    setAddr(`0x${v.addr.toString(16).padStart(8, '0').toUpperCase()}`);
    if (v.type) setTypeName(v.type);
    setSuggs([]); setSuggOpen(false);
  }

  function commit() {
    const t = addr.trim();
    const resolved = /^(?:0x)?[0-9a-fA-F]+$/i.test(t)
      ? parseInt(t.replace(/^0x/i, ''), 16)
      : a2lVars.find(v => v.name === t)?.addr ?? null;
    if (!name.trim()) { showToast('Label is required', 'error'); return; }
    if (resolved === null) {
      showToast(a2lVars.length === 0 ? 'No A2L loaded — load one to resolve variable names' : 'Unknown variable', 'error');
      return;
    }
    onSave({ name: name.trim(), addr: resolved, addr_ext: Number(ext) || 0, size: TYPE_SIZES[typeName], type_name: typeName });
  }

  const fieldStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: 'none', outline: 'none',
    border: 'none', borderBottom: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
    color: 'var(--text-muted)', padding: '1px 2px',
    ...extra,
  });

  return (
    <div
      className="flex items-center h-[30px]"
      style={{
        borderTop: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
        borderBottom: '1px solid var(--border)',
        background: 'color-mix(in srgb, var(--accent) 4%, transparent)',
        paddingLeft: 36, paddingRight: 12, position: 'relative',
      }}
    >
      {/* waveform slot */}
      <span className="shrink-0 mr-2" style={{ color: 'var(--accent)', lineHeight: 0 }}>
        <Plus size={12} />
      </span>

      {/* Signal column */}
      <div style={{ position: 'relative', width: 148, flexShrink: 0 }}>
        <input
          ref={nameRef}
          value={name}
          onChange={e => { setName(e.target.value); setSuggOpen(true); }}
          onFocus={() => setSuggOpen(true)}
          onBlur={() => setTimeout(() => setSuggOpen(false), 120)}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onCancel(); }}
          placeholder="signal_name"
          style={fieldStyle({ width: '100%', fontSize: 11, color: 'var(--text-primary)', fontFamily: 'inherit' })}
        />
        {suggOpen && suggs.length > 0 && (
          <div style={{
            position: 'absolute', bottom: '100%', left: 0, marginBottom: 2, width: 240,
            background: 'var(--surface-overlay)', border: '1px solid var(--border-strong)',
            borderRadius: 4, boxShadow: '0 -8px 24px rgba(0,0,0,0.4)', zIndex: 100,
            maxHeight: 160, overflowY: 'auto',
          }}>
            {suggs.map(v => (
              <div
                key={v.name}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', cursor: 'pointer' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--surface-raised)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '')}
                onMouseDown={e => { e.preventDefault(); pickSugg(v); }}
              >
                <span style={{ fontSize: 11, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace', marginLeft: 8, flexShrink: 0 }}>
                  0x{v.addr.toString(16).toUpperCase().padStart(8, '0')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Value column — no value for a new entry */}
      <span
        className="font-mono text-[12px] tabular-nums"
        style={{ width: 90, flexShrink: 0, color: 'var(--text-muted)' }}
      >
        —
      </span>

      {/* Type column */}
      <Select<DaqEntryType>
        value={typeName}
        onChange={setTypeName}
        options={(['u8','u16','u32','i8','i16','i32','f32','f64'] as DaqEntryType[]).map(t => ({ value: t, label: t }))}
        onKeyDown={e => { if (e.key === 'Escape') onCancel(); }}
        style={{ width: 60, flexShrink: 0, fontSize: 10, fontFamily: 'monospace' }}
      />

      {/* Address column */}
      <input
        value={addr}
        onChange={e => setAddr(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onCancel(); }}
        placeholder="0x00000000"
        spellCheck={false}
        style={fieldStyle({ width: 96, flexShrink: 0, fontSize: 10, fontFamily: 'monospace' })}
      />

      {/* Sparkline slot: ext + actions */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '0 4px' }}>
        <span
          style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}
          title="XCP address extension — normally 0 unless the target uses segmented addressing"
        >
          Ext
        </span>
        <input
          value={ext}
          onChange={e => setExt(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onCancel(); }}
          placeholder="0"
          style={fieldStyle({ width: 28, flexShrink: 0, fontSize: 10, fontFamily: 'monospace' })}
        />
        <div style={{ flex: 1 }} />
        <Button variant="primary" className="!px-2 !py-0.5 !text-[10px]" onClick={commit}>Save</Button>
        <button
          onClick={onCancel}
          style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--status-err)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

// ── WaveformBars ─────────────────────────────────────────────────
// 5 bars, 2px wide, 0.5px gap → total 12px wide; viewBox 12×12
const BAR_DELAYS = [0, 0.3, 0.15, 0.45, 0.22]; // s — organic stagger, not sequential

function WaveformBars({ size = 12, active = false }: { size?: number; active?: boolean }) {
  const [phase, setPhase] = useState<'idle' | 'resetting' | 'zero' | 'active'>(active ? 'active' : 'idle');
  const prevActiveRef = useRef(active);

  useEffect(() => {
    if (active === prevActiveRef.current) return;
    prevActiveRef.current = active;

    if (active) {
      // idle → active: bars are at scaleY(0.42), collapse then animate
      setPhase('zero');
      const t = setTimeout(() => setPhase('active'), 200);
      return () => clearTimeout(t);
    } else {
      // active → idle: snap to known base first (one frame), then collapse, then expand to idle
      setPhase('resetting');
      const t1 = setTimeout(() => setPhase('zero'), 16);
      const t2 = setTimeout(() => setPhase('idle'), 216);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [active]);

  const base: React.CSSProperties = { transformBox: 'fill-box', transformOrigin: 'center' };

  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      {BAR_DELAYS.map((delay, i) => {
        let style: React.CSSProperties;
        if (phase === 'resetting') {
          style = { ...base, transform: 'scaleY(0.42)' };
        } else if (phase === 'zero') {
          style = { ...base, transform: 'scaleY(0)', transition: 'transform 200ms ease' };
        } else if (phase === 'active') {
          style = { ...base, animation: `waveform-enter 200ms ease forwards, waveform-bar 0.9s ease-in-out ${0.2 + delay}s infinite` };
        } else {
          style = { ...base, transform: 'scaleY(0.42)', transition: 'transform 200ms ease' };
        }
        return <rect key={i} x={i * 2.5} y={0} width={2} height={12} rx={1} style={style} />;
      })}
    </svg>
  );
}

// ── DaqEntryRow ───────────────────────────────────────────────────
interface EntryRowProps {
  entry: DaqEntry;
  color: string;
  liveKey: string;
  exiting: boolean;
  recentlyMoved: boolean;
  entryIndex: number;
  enterDelayMs: number;
  revealEpoch: number;
  onDelete: () => void;
  onPointerDown: (e: React.PointerEvent) => void;
  entryRef: (el: HTMLElement | null) => void;
  dataAttrs: Record<string, string | number>;
}

function DaqEntryRow({
  entry, color, liveKey,
  exiting, recentlyMoved, entryIndex, enterDelayMs, revealEpoch, onDelete, onPointerDown, entryRef, dataAttrs,
}: EntryRowProps) {
  const daqRunning = useAppStore(s => s.daqStatus === 'running');
  const [isLive, setIsLive] = useState(false);
  const valueRef    = useRef<HTMLSpanElement>(null);
  const minRef      = useRef<HTMLSpanElement>(null);
  const maxRef      = useRef<HTMLSpanElement>(null);
  const avgRef      = useRef<HTMLSpanElement>(null);
  const waveIconRef = useRef<HTMLSpanElement>(null);

  // Drives the live value text + waveform color directly via the DOM,
  // bypassing React re-renders — at DAQ rates this would otherwise
  // re-render the whole row (and its WaveformBars SVG) up to 60x/sec
  // per signal.
  useEffect(() => {
    const typeName = entry.type_name;
    let raf = 0;
    const isFloat = typeName === 'f32' || typeName === 'f64';

    function fmt(v: number | null): string {
      if (v === null) return '—';
      return isFloat ? v.toFixed(4) : String(v);
    }

    function fmtAvg(sum: number, count: number): string {
      if (count === 0) return '—';
      return (sum / count).toFixed(isFloat ? 4 : 2);
    }

    function tick() {
      const dv     = useAppStore.getState().daqLiveValues.get(liveKey);
      const value  = dv?.value ?? null;
      const lastTs = dv?.history.at(-1)?.ts;
      const live   = daqRunning && lastTs !== undefined && (Date.now() - lastTs) < LIVE_THRESHOLD_MS;

      if (valueRef.current) {
        valueRef.current.textContent = fmt(value);
        valueRef.current.style.color = value !== null ? 'var(--status-ok)' : 'var(--text-muted)';
      }
      if (minRef.current) minRef.current.textContent = fmt(dv?.min ?? null);
      if (maxRef.current) maxRef.current.textContent = fmt(dv?.max ?? null);
      if (avgRef.current) avgRef.current.textContent = fmtAvg(dv?.sum ?? 0, dv?.count ?? 0);
      if (waveIconRef.current) {
        waveIconRef.current.style.color = live ? color : 'var(--text-muted)';
      }
      setIsLive(prev => prev === live ? prev : live);

      if (daqRunning) raf = requestAnimationFrame(tick);
    }

    tick();
    return () => cancelAnimationFrame(raf);
  }, [liveKey, daqRunning, color, entry.type_name]);

  return (
    <div
      ref={entryRef}
      className={`group flex items-center h-[30px] transition-colors daq-row-enter${exiting ? ' daq-exiting' : ''}${recentlyMoved ? ' daq-moved' : ''}`}
      style={{ borderBottom: '1px solid var(--border)', paddingLeft: 36, paddingRight: 12, position: 'relative', animationDelay: `${enterDelayMs + 60 + entryIndex * ENTRY_STAGGER_MS}ms` }}
      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--surface-raised)')}
      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '')}
      {...dataAttrs}
    >
      {/* drag handle */}
      <span
        className="absolute opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing select-none"
        style={{ left: 14, color: 'var(--text-muted)' }}
        onPointerDown={onPointerDown}
      >
        <DotsSixVertical size={13} />
      </span>

      {/* waveform icon */}
      <span
        ref={waveIconRef}
        className="shrink-0 mr-2"
        style={{ color: 'var(--text-muted)', lineHeight: 0, transition: 'color 280ms ease' }}
      >
        <WaveformBars size={12} active={isLive} />
      </span>

      {/* name */}
      <span className="text-[11px] truncate" style={{ width: 148, flexShrink: 0, color: 'var(--text-primary)' }}>
        {entry.name}
      </span>

      {/* value */}
      <span
        ref={valueRef}
        className="font-mono text-[12px] tabular-nums"
        style={{ width: 90, flexShrink: 0, color: 'var(--text-muted)' }}
      />

      {/* min */}
      <span
        ref={minRef}
        title="Min"
        className="font-mono text-[10px] tabular-nums truncate"
        style={{ width: 64, flexShrink: 0, color: 'var(--text-muted)' }}
      />

      {/* max */}
      <span
        ref={maxRef}
        title="Max"
        className="font-mono text-[10px] tabular-nums truncate"
        style={{ width: 64, flexShrink: 0, color: 'var(--text-muted)' }}
      />

      {/* avg */}
      <span
        ref={avgRef}
        title="Average"
        className="font-mono text-[10px] tabular-nums truncate"
        style={{ width: 64, flexShrink: 0, color: 'var(--text-muted)' }}
      />

      {/* type */}
      <span className="font-mono text-[10px]" style={{ width: 48, flexShrink: 0, color: 'var(--text-muted)' }}>
        {entry.type_name}
      </span>

      {/* address */}
      <span className="font-mono text-[10px]" style={{ width: 96, flexShrink: 0, color: 'var(--text-muted)' }}>
        0x{entry.addr.toString(16).padStart(8, '0').toUpperCase()}
      </span>

      {/* sparkline */}
      <div style={{ flex: 1, minWidth: 0, padding: '0 4px' }}>
        <Sparkline liveKey={liveKey} color={color} revealDelayMs={enterDelayMs + 60 + entryIndex * ENTRY_STAGGER_MS + 280} revealEpoch={revealEpoch} />
      </div>

      {/* delete */}
      <button
        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 flex items-center"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--status-err)')}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
        onClick={e => { e.stopPropagation(); onDelete(); }}
      >
        <X size={13} />
      </button>
    </div>
  );
}

// ── DaqOdtSection ─────────────────────────────────────────────────
interface OdtSectionProps {
  list: DaqList;
  odt: DaqOdt;
  enterDelayMs: number;
  color: string;
  exiting: boolean;
  listExpandEpoch: number;
  onColorChange: (color: string) => void;
  onDelete: () => void;
  onSaveEntry: (entry: DaqEntry, idx: number | null) => void;
  onDeleteEntry: (idx: number) => void;
  onMoveEntry: (fromOdtId: number, fromIdx: number, toListId: number, toOdtId: number, toIdx: number) => void;
}

function DaqOdtSection({
  list, odt, enterDelayMs, color, exiting, listExpandEpoch,
  onColorChange, onDelete, onSaveEntry, onDeleteEntry, onMoveEntry,
}: OdtSectionProps) {
  const [collapsed,      setCollapsed]      = useState(false);
  const [revealEpoch,    setRevealEpoch]    = useState(0);
  const prevCollapsedRef = useRef(false);
  const prevListEpochRef = useRef(listExpandEpoch);
  const [addingEntry,    setAddingEntry]    = useState(false);
  const [colorPickerPos, setColorPickerPos] = useState<{ x: number; y: number } | null>(null);
  const [exitingEntries, setExitingEntries] = useState<Set<number>>(new Set());
  const [recentlyMoved,  setRecentlyMoved]  = useState<string | null>(null);
  const [dragEntry,      setDragEntry]      = useState<{ odtId: number; fromIdx: number } | null>(null);
  const dragRef     = useRef<{ odtId: number; fromIdx: number } | null>(null);
  const dropRef     = useRef<{ listId: number; odtId: number; toIdx: number; above: boolean } | null>(null);
  const entryElsRef = useRef<Map<string, HTMLElement>>(new Map());
  const snapshotRef = useRef<Map<string, number>>(new Map());

  // Replay each sparkline's entrance wipe when this section (re-)expands —
  // restarts only the canvas render-loop effect (cheap), not the row itself.
  useEffect(() => {
    if (prevCollapsedRef.current && !collapsed) setRevealEpoch(k => k + 1);
    prevCollapsedRef.current = collapsed;
  }, [collapsed]);

  // Same, when the parent list group (re-)expands.
  useEffect(() => {
    if (prevListEpochRef.current !== listExpandEpoch) {
      prevListEpochRef.current = listExpandEpoch;
      if (!collapsed) setRevealEpoch(k => k + 1);
    }
  }, [listExpandEpoch, collapsed]);

  useEffect(() => {
    if (!colorPickerPos) return;
    function onDown(e: MouseEvent) {
      if (!(e.target as Element).closest('#daq-color-picker')) setColorPickerPos(null);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [colorPickerPos]);

  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      if (!dragRef.current) return;
      const els = document.elementsFromPoint(e.clientX, e.clientY);
      const target = els.find(el => (el as HTMLElement).dataset?.entryIdx !== undefined) as HTMLElement | undefined;
      if (target) {
        const lId  = parseInt(target.dataset.entryList ?? '');
        const oId  = parseInt(target.dataset.entryOdt  ?? '');
        const eIdx = parseInt(target.dataset.entryIdx  ?? '');
        if (isNaN(lId) || isNaN(oId) || isNaN(eIdx)) return;
        const rect  = target.getBoundingClientRect();
        dropRef.current = { listId: lId, odtId: oId, toIdx: eIdx, above: e.clientY < rect.top + rect.height / 2 };
      }
    }

    function onPointerUp() {
      if (!dragRef.current) return;
      const de  = dragRef.current;
      const dov = dropRef.current;
      dragRef.current = null; dropRef.current = null;
      document.body.style.cursor = document.body.style.userSelect = '';
      setDragEntry(null);
      if (!dov) return;

      const isSameOdt = dov.listId === list.id && dov.odtId === de.odtId;
      const raw   = dov.above ? dov.toIdx : dov.toIdx + 1;
      const toIdx = isSameOdt && raw > de.fromIdx ? raw - 1 : raw;
      if (isSameOdt && toIdx === de.fromIdx) return;

      const name = odt.entries[de.fromIdx]?.name ?? '';
      setRecentlyMoved(`${de.odtId}:${name}`);
      setTimeout(() => setRecentlyMoved(null), 450);

      const snap = new Map<string, number>();
      odt.entries.forEach(e => {
        const k  = `${de.odtId}:${e.name}`;
        const el = entryElsRef.current.get(k);
        if (el) snap.set(k, el.getBoundingClientRect().top);
      });
      snapshotRef.current = snap;
      onMoveEntry(de.odtId, de.fromIdx, dov.listId, dov.odtId, toIdx);
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup',   onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup',   onPointerUp);
    };
  }, [list.id, odt, onMoveEntry]);

  useLayoutEffect(() => {
    if (snapshotRef.current.size === 0) return;
    for (const [key, prevY] of snapshotRef.current) {
      const el = entryElsRef.current.get(key);
      if (!el) continue;
      const dy = prevY - el.getBoundingClientRect().top;
      if (Math.abs(dy) < 1) continue;
      el.style.transition = 'none';
      el.style.transform  = `translateY(${dy}px)`;
      void el.offsetHeight;
      el.style.transition = 'transform 220ms cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      el.style.transform  = '';
      el.addEventListener('transitionend', function onEnd(ev: Event) {
        if ((ev as TransitionEvent).propertyName !== 'transform') return;
        el.style.transition = '';
        el.removeEventListener('transitionend', onEnd);
      });
    }
    snapshotRef.current = new Map();
  }, [odt.entries]);

  function handleDeleteEntry(idx: number) {
    setExitingEntries(s => new Set(s).add(idx));
    setTimeout(() => {
      onDeleteEntry(idx);
      setExitingEntries(s => { const n = new Set(s); n.delete(idx); return n; });
    }, 160);
  }

  return (
    <div className={exiting ? 'daq-exiting' : ''} style={{ animation: exiting ? undefined : `daq-enter 160ms ease-out ${enterDelayMs}ms both` }}>
      {/* ODT header */}
      <div
        className="group flex items-center gap-2 h-[26px] cursor-pointer select-none"
        style={{ paddingLeft: 24, paddingRight: 12, borderBottom: '1px solid var(--border)' }}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--surface-raised)')}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '')}
        onClick={e => { if (!(e.target as Element).closest('[data-no-collapse]')) setCollapsed(c => !c); }}
      >
        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 8, flexShrink: 0 }}>{collapsed ? '▸' : '▾'}</span>
        <button
          data-no-collapse=""
          className="shrink-0 transition-transform hover:scale-125"
          style={{ width: 8, height: 8, borderRadius: 2, background: color, border: 'none', cursor: 'pointer', flexShrink: 0 }}
          title="Change color"
          onClick={e => { e.stopPropagation(); setColorPickerPos(p => p ? null : { x: e.clientX + 6, y: e.clientY + 6 }); }}
        />
        <span className="text-[10px] flex-1 truncate" style={{ color: 'var(--text-muted)' }}>
          {odt.name ?? `ODT 0x${odt.id.toString(16).padStart(2, '0').toUpperCase()}`}
        </span>
        <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{odt.entries.length}</span>
        <button
          data-no-collapse=""
          className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center shrink-0"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--status-err)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
          onClick={e => { e.stopPropagation(); onDelete(); }}
        >
          <X size={12} />
        </button>
      </div>

      {/* entries */}
      <div style={{ display: 'grid', gridTemplateRows: collapsed ? '0fr' : '1fr', transition: 'grid-template-rows 180ms ease' }}>
        <div style={{ minHeight: 0, overflow: 'hidden' }}>
          {odt.entries.map((entry, ei) => {
            const liveKey = `${list.id}:${odt.id}:${entry.name}`;

            return (
              <DaqEntryRow
                key={entry.name}
                entry={entry}
                color={color}
                liveKey={liveKey}
                exiting={exitingEntries.has(ei)}
                recentlyMoved={recentlyMoved === `${odt.id}:${entry.name}`}
                entryIndex={ei}
                enterDelayMs={enterDelayMs}
                revealEpoch={revealEpoch}
                onDelete={() => handleDeleteEntry(ei)}
                onPointerDown={e => {
                  if (e.button !== 0) return;
                  e.preventDefault(); e.stopPropagation();
                  const val = { odtId: odt.id, fromIdx: ei };
                  dragRef.current = val;
                  setDragEntry(val);
                  document.body.style.cursor = 'grabbing';
                  document.body.style.userSelect = 'none';
                }}
                entryRef={el => {
                  const k = `${odt.id}:${entry.name}`;
                  if (el) entryElsRef.current.set(k, el);
                  else    entryElsRef.current.delete(k);
                }}
                dataAttrs={{
                  'data-entry-list': list.id,
                  'data-entry-odt':  odt.id,
                  'data-entry-idx':  ei,
                  ...(dragEntry?.odtId === odt.id && dragEntry?.fromIdx === ei ? { 'data-dragging': '1' } : {}),
                }}
              />
            );
          })}

          {/* Add entry button / inline edit */}
          {addingEntry ? (
            <DaqInlineEdit
              listId={list.id}
              odtId={odt.id}
              onSave={entry => { onSaveEntry(entry, null); setAddingEntry(false); }}
              onCancel={() => setAddingEntry(false)}
            />
          ) : (
            <div style={{ borderBottom: '1px solid var(--border)' }}>
              <button
                className="flex items-center gap-1 text-[10px] w-full transition-colors"
                style={{ padding: '4px 12px 4px 36px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--accent) 5%, transparent)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = ''; }}
                onClick={() => setAddingEntry(true)}
              >
                <Plus size={11} />Add entry
              </button>
            </div>
          )}
        </div>
      </div>

      {/* color picker portal */}
      {colorPickerPos && createPortal(
        <div
          id="daq-color-picker"
          style={{
            position: 'fixed', top: colorPickerPos.y, left: colorPickerPos.x,
            background: 'var(--surface-raised)', border: '1px solid var(--border-strong)',
            borderRadius: 8, padding: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.5)', zIndex: 9999,
          }}
        >
          <p style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>ODT Color</p>
          <div style={{ display: 'flex', gap: 6 }}>
            {ODT_COLORS.map(c => (
              <button
                key={c}
                className="w-5 h-5 rounded-full transition-transform hover:scale-110"
                style={{ background: c, border: c === color ? '2px solid white' : '2px solid transparent' }}
                onClick={() => { onColorChange(c); setColorPickerPos(null); }}
              />
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ── DaqModeButton ────────────────────────────────────────────────
function DaqModeButton({ mode, onChange }: { mode: number; onChange: (mode: number) => void }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef          = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!rect) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Element;
      if (!t.closest('#daq-mode-popover') && !btnRef.current?.contains(t)) setRect(null);
    }
    function onScroll() { setRect(null); }
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [rect]);

  return (
    <>
      <button
        ref={btnRef}
        data-no-collapse=""
        className={`xcb-select-trigger${rect ? ' open' : ''}`}
        style={{ fontSize: 9, fontFamily: 'monospace', flexShrink: 0 }}
        title="SET_DAQ_LIST_MODE bitfield"
        onClick={e => { e.stopPropagation(); const el = btnRef.current; setRect(r => r ? null : el?.getBoundingClientRect() ?? null); }}
      >
        <span className="xcb-select-value">Mode 0x{mode.toString(16).padStart(2, '0').toUpperCase()}</span>
        <CaretDown size={9} className={`xcb-select-caret${rect ? ' open' : ''}`} />
      </button>
      {rect && createPortal(
        <div
          id="daq-mode-popover"
          className="xcb-glass-panel"
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed', top: rect.bottom + 2, left: rect.left,
            border: '1px solid var(--border-strong)',
            borderRadius: 8, padding: 10,
            boxShadow: '0 8px 32px var(--shadow-7), inset 0 1px 0 var(--shine-2)',
            zIndex: 9999, minWidth: 170,
            animation: 'xcb-select-drop 130ms var(--ease-out) both',
          }}
        >
          <p style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            DAQ List Mode
          </p>
          {DAQ_LIST_MODE_BITS.map(({ bit, label }) => (
            <div key={bit} className="flex items-center justify-between gap-3" style={{ padding: '3px 0' }}>
              <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{label}</span>
              <Toggle checked={(mode & bit) !== 0} onChange={() => onChange(mode ^ bit)} />
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6, textAlign: 'right', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-primary)' }}>
            0x{mode.toString(16).padStart(2, '0').toUpperCase()}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// ── DaqListGroup ──────────────────────────────────────────────────
interface ListGroupProps {
  list: DaqList;
  odtColors: Record<string, string>;
  exiting: boolean;
  onOdtColorChange: (odtId: number, color: string) => void;
  onDeleteList: () => void;
  onAddOdt: () => void;
  onDeleteOdt: (odtId: number) => void;
  onSetEvent: (ch: number) => void;
  onSetRunMode: (mode: number) => void;
  onSetListMode: (mode: number) => void;
  onSetPrescaler: (prescaler: number) => void;
  onSaveEntry: (odtId: number, entry: DaqEntry, idx: number | null) => void;
  onDeleteEntry: (odtId: number, idx: number) => void;
  onMoveEntry: (fromOdtId: number, fromIdx: number, toListId: number, toOdtId: number, toIdx: number) => void;
}

function DaqListGroup({
  list, odtColors, exiting,
  onOdtColorChange, onDeleteList, onAddOdt, onDeleteOdt, onSetEvent,
  onSetRunMode, onSetListMode, onSetPrescaler,
  onSaveEntry, onDeleteEntry, onMoveEntry,
}: ListGroupProps) {
  const storeEvents = useAppStore(s => s.events);
  const events = storeEvents.length > 0 ? storeEvents : [
    { id: 1, name: '1 ms' }, { id: 2, name: '10 ms' }, { id: 3, name: '100 ms' },
    { id: 4, name: '1 s'  }, { id: 5, name: '10 s'  },
  ];
  const [collapsed,    setCollapsed]    = useState(false);
  const [expandEpoch,  setExpandEpoch]  = useState(0);
  const [exitingOdts,  setExitingOdts]  = useState<Set<number>>(new Set());
  const prevListCollapsedRef = useRef(false);

  useEffect(() => {
    if (prevListCollapsedRef.current && !collapsed) setExpandEpoch(k => k + 1);
    prevListCollapsedRef.current = collapsed;
  }, [collapsed]);

  function handleDeleteOdt(odtId: number) {
    setExitingOdts(s => new Set(s).add(odtId));
    setTimeout(() => {
      onDeleteOdt(odtId);
      setExitingOdts(s => { const n = new Set(s); n.delete(odtId); return n; });
    }, 160);
  }

  const totalSignals = list.odts.reduce((s, o) => s + o.entries.length, 0);
  const eventHex = `0x${list.event_channel.toString(16).padStart(2, '0').toUpperCase()}`;
  const eventName = events.find(e => e.id === list.event_channel)?.name ?? '';

  // Each ODT's entrance begins once the previous ODT's entries have finished
  // staggering in (entries.length * ENTRY_STAGGER_MS).
  const odtEnterDelays: number[] = [];
  list.odts.reduce((delay, odt) => {
    odtEnterDelays.push(delay);
    return delay + odt.entries.length * ENTRY_STAGGER_MS;
  }, 0);

  return (
    <div
      className={exiting ? 'daq-exiting' : ''}
      style={{ borderBottom: '1px solid var(--border-strong)', animation: exiting ? undefined : 'daq-enter 180ms ease-out' }}
    >
      {/* list header */}
      <div
        className="group flex items-center gap-2 cursor-pointer select-none"
        style={{ padding: '4px 12px', background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)' }}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--surface-overlay)')}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'var(--surface-raised)')}
        onClick={e => { if (!(e.target as Element).closest('[data-no-collapse]')) setCollapsed(c => !c); }}
      >
        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{collapsed ? '▸' : '▾'}</span>
        <span className="text-[12px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
          {list.name ?? `List ${list.id}`}
        </span>
        <Button
          data-no-collapse=""
          variant="ghost"
          className="!px-2 !py-0.5 !text-[10px] !gap-1 shrink-0"
          onClick={e => { e.stopPropagation(); onAddOdt(); }}
        >
          <Plus size={11} />ODT
        </Button>
        <div style={{ flex: 1 }} />
        {/* per-list run mode (START_STOP_DAQ_LIST) */}
        <div data-no-collapse="" className="flex flex-col gap-0.5" onClick={e => e.stopPropagation()}>
          <FieldLabel>Run</FieldLabel>
          <Select<number>
            value={list.run_mode}
            onChange={onSetRunMode}
            options={RUN_MODES}
            valueColor={RUN_MODE_COLORS[list.run_mode] ?? 'var(--text-muted)'}
            title="START_STOP_DAQ_LIST — per-list run state"
            style={{ fontSize: 9, fontFamily: 'monospace', flexShrink: 0 }}
          />
        </div>
        {/* event channel */}
        <div data-no-collapse="" className="flex flex-col gap-0.5" onClick={e => e.stopPropagation()}>
          <FieldLabel>Event</FieldLabel>
          <Select<number>
            value={list.event_channel}
            onChange={onSetEvent}
            options={events.map(ev => ({
              value: ev.id,
              label: `0x${ev.id.toString(16).padStart(2,'0').toUpperCase()} — ${ev.name}`,
            }))}
            style={{ fontSize: 9, fontFamily: 'monospace', flexShrink: 0 }}
          />
        </div>
        {/* prescaler */}
        <div data-no-collapse="" className="flex flex-col gap-0.5" onClick={e => e.stopPropagation()} title="SET_DAQ_LIST_MODE — prescaler">
          <FieldLabel>Presc</FieldLabel>
          <DialInput value={list.prescaler} onChange={onSetPrescaler} min={1} max={255} digits={3} style={{ height: 24 }} />
        </div>
        {/* SET_DAQ_LIST_MODE bitfield */}
        <div data-no-collapse="" className="flex flex-col gap-0.5">
          <FieldLabel>Mode</FieldLabel>
          <DaqModeButton mode={list.daq_list_mode} onChange={onSetListMode} />
        </div>
        <span className="text-[9px] shrink-0" style={{ color: 'var(--text-muted)' }}>
          {eventHex} · {eventName} · {totalSignals} sig
        </span>
        <button
          data-no-collapse=""
          className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center shrink-0"
          style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--status-err)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
          onClick={e => { e.stopPropagation(); onDeleteList(); }}
        >
          <X size={13} />
        </button>
      </div>

      {/* ODT sections */}
      <div style={{ display: 'grid', gridTemplateRows: collapsed ? '0fr' : '1fr', transition: 'grid-template-rows 200ms ease' }}>
        <div style={{ minHeight: 0, overflow: 'hidden' }}>
          {list.odts.map((odt, index) => (
            <DaqOdtSection
              key={odt.id}
              list={list}
              odt={odt}
              enterDelayMs={odtEnterDelays[index]}
              color={odtColors[`${list.id}:${odt.id}`] ?? ODT_COLORS[0]}
              exiting={exitingOdts.has(odt.id)}
              listExpandEpoch={expandEpoch}
              onColorChange={color => onOdtColorChange(odt.id, color)}
              onDelete={() => handleDeleteOdt(odt.id)}
              onSaveEntry={(entry, idx) => onSaveEntry(odt.id, entry, idx)}
              onDeleteEntry={idx => onDeleteEntry(odt.id, idx)}
              onMoveEntry={onMoveEntry}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Root DAQ component ───────────────────────────────────────────
export function Daq() {
  const daqLists           = useAppStore(s => s.daqLists);
  const setDaqLists        = useAppStore(s => s.setDaqLists);
  const setDaqStatus       = useAppStore(s => s.setDaqStatus);
  const clearDaqLiveValues = useAppStore(s => s.clearDaqLiveValues);
  const showToast          = useAppStore(s => s.showToast);

  const [configuring,   setConfiguring]   = useState(false);
  const [exportContent, setExportContent] = useState<string | null>(null);
  const [exitingLists,  setExitingLists]  = useState<Set<number>>(new Set());
  const [odtColors, setOdtColors] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    let idx = 0;
    daqLists.forEach(list => {
      list.odts.forEach(odt => { init[`${list.id}:${odt.id}`] = ODT_COLORS[idx++ % ODT_COLORS.length]; });
    });
    return init;
  });

  useEffect(() => {
    setOdtColors(prev => {
      const next = { ...prev };
      let idx = Object.keys(next).length;
      daqLists.forEach(list => {
        list.odts.forEach(odt => {
          const key = `${list.id}:${odt.id}`;
          if (!(key in next)) next[key] = ODT_COLORS[idx++ % ODT_COLORS.length];
        });
      });
      return next;
    });
  }, [daqLists]);

  // ── list mutations ──────────────────────────────────────────────

  function handleAddList() {
    const id = daqLists.length > 0 ? Math.max(...daqLists.map(l => l.id)) + 1 : 0;
    setDaqLists([...daqLists, {
      id, event_channel: 1, odts: [{ id: 0, entries: [] }],
      run_mode: 0x03, daq_list_mode: 0x10, prescaler: 1,
    }]);
  }

  function handleDeleteList(listId: number) {
    setExitingLists(s => new Set(s).add(listId));
    setTimeout(() => {
      setDaqLists(daqLists.filter(l => l.id !== listId));
      setExitingLists(s => { const n = new Set(s); n.delete(listId); return n; });
    }, 160);
  }

  function handleSetEvent(listId: number, ch: number) {
    setDaqLists(daqLists.map(l => l.id === listId ? { ...l, event_channel: ch } : l));
  }

  function handleSetListMode(listId: number, mode: number) {
    setDaqLists(daqLists.map(l => l.id === listId ? { ...l, daq_list_mode: mode } : l));
  }

  function handleSetPrescaler(listId: number, prescaler: number) {
    setDaqLists(daqLists.map(l => l.id === listId ? { ...l, prescaler } : l));
  }

  async function handleSetRunMode(listId: number, mode: number) {
    try {
      await api.daqSetRunMode(listId, mode);
      setDaqLists(daqLists.map(l => l.id === listId ? { ...l, run_mode: mode } : l));
    } catch (e) { showToast((e as Error).message, 'error'); }
  }

  function handleAddOdt(listId: number) {
    setDaqLists(daqLists.map(l => {
      if (l.id !== listId) return l;
      const nextId = l.odts.length > 0 ? Math.max(...l.odts.map(o => o.id)) + 1 : 0;
      return { ...l, odts: [...l.odts, { id: nextId, entries: [] }] };
    }));
  }

  function handleDeleteOdt(listId: number, odtId: number) {
    setDaqLists(daqLists.map(l =>
      l.id !== listId ? l : { ...l, odts: l.odts.filter(o => o.id !== odtId) }
    ));
  }

  function handleSaveEntry(listId: number, odtId: number, entry: DaqEntry, entryIdx: number | null) {
    setDaqLists(daqLists.map(l => {
      if (l.id !== listId) return l;
      return {
        ...l,
        odts: l.odts.map(o => {
          if (o.id !== odtId) return o;
          const entries = entryIdx === null
            ? [...o.entries, entry]
            : o.entries.map((e, i) => i === entryIdx ? entry : e);
          return { ...o, entries };
        }),
      };
    }));
  }

  function handleDeleteEntry(listId: number, odtId: number, idx: number) {
    setDaqLists(daqLists.map(l =>
      l.id !== listId ? l : { ...l, odts: l.odts.map(o => o.id !== odtId ? o : { ...o, entries: o.entries.filter((_, i) => i !== idx) }) }
    ));
  }

  function handleMoveEntry(listId: number, fromOdtId: number, fromIdx: number, toListId: number, toOdtId: number, toIdx: number) {
    if (listId === toListId && fromOdtId === toOdtId) {
      setDaqLists(daqLists.map(l => {
        if (l.id !== listId) return l;
        return {
          ...l,
          odts: l.odts.map(o => {
            if (o.id !== fromOdtId) return o;
            const entries = [...o.entries];
            const [removed] = entries.splice(fromIdx, 1);
            entries.splice(toIdx, 0, removed);
            return { ...o, entries };
          }),
        };
      }));
    } else {
      const entry = daqLists.find(l => l.id === listId)?.odts.find(o => o.id === fromOdtId)?.entries[fromIdx];
      if (!entry) return;
      setDaqLists(daqLists.map(l => {
        if (l.id === listId && l.id === toListId) {
          return {
            ...l,
            odts: l.odts.map(o => {
              if (o.id === fromOdtId) return { ...o, entries: o.entries.filter((_, i) => i !== fromIdx) };
              if (o.id === toOdtId)   { const e = [...o.entries]; e.splice(toIdx, 0, entry); return { ...o, entries: e }; }
              return o;
            }),
          };
        }
        if (l.id === listId)  return { ...l, odts: l.odts.map(o => o.id !== fromOdtId ? o : { ...o, entries: o.entries.filter((_, i) => i !== fromIdx) }) };
        if (l.id === toListId) return { ...l, odts: l.odts.map(o => { if (o.id !== toOdtId) return o; const e = [...o.entries]; e.splice(toIdx, 0, entry); return { ...o, entries: e }; }) };
        return l;
      }));
    }
  }

  function handleSaveDaq() {
    const colors: Record<string, string> = {};
    daqLists.forEach((list, li) => {
      list.odts.forEach((odt, oi) => {
        const c = odtColors[`${list.id}:${odt.id}`];
        if (c) colors[`${li}:${oi}`] = c;
      });
    });
    setExportContent(JSON.stringify({ version: 1, lists: daqLists, colors }, null, 2));
  }

  async function handleLoadDaq(file: File) {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as { version: number; lists: DaqList[]; colors?: Record<string, string> };
      if (data.version !== 1 || !Array.isArray(data.lists)) { showToast('Invalid .daq file', 'error'); return; }
      const reIndexed: DaqList[] = data.lists.map((l: DaqList, li: number) => ({
        ...l, id: li,
        odts: (l.odts ?? []).map((o: DaqOdt, oi: number) => ({ ...o, id: oi })),
        run_mode: l.run_mode ?? 0x03,
        daq_list_mode: l.daq_list_mode ?? 0x10,
        prescaler: l.prescaler ?? 1,
      }));
      setDaqLists(reIndexed);
      if (data.colors) setOdtColors(data.colors);
      showToast(`Loaded ${reIndexed.length} DAQ list(s)`, 'success');
    } catch { showToast('Failed to parse .daq file', 'error'); }
  }

  async function handleConfigure() {
    setConfiguring(true);
    clearDaqLiveValues();
    await new Promise<void>(r => setTimeout(r, 0));
    try {
      await api.daqReplaceLists(daqLists);
      await api.daqConfigure();
      setDaqStatus('configured');
    } catch (e) { showToast((e as Error).message, 'error'); }
    finally { setConfiguring(false); }
  }

  async function handleStart() {
    clearDaqLiveValues();
    try { await api.daqStart(); setDaqStatus('running'); }
    catch (e) { showToast((e as Error).message, 'error'); throw e; }
  }

  async function handleStop() {
    try { await api.daqStop(); setDaqStatus('configured'); }
    catch (e) { showToast((e as Error).message, 'error'); throw e; }
  }

  async function handleFree() {
    try { await api.daqFree(); setDaqStatus('idle'); clearDaqLiveValues(); }
    catch (e) { showToast((e as Error).message, 'error'); }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <DaqToolbar
        lists={daqLists}
        configuring={configuring}
        onConfigure={handleConfigure}
        onStart={handleStart}
        onStop={handleStop}
        onFree={handleFree}
        onSave={handleSaveDaq}
        onLoad={handleLoadDaq}
      />

      {/* sticky column header */}
      <div
        className="flex items-center h-[26px] shrink-0 sticky top-0 z-10"
        style={{ paddingLeft: 36, paddingRight: 12, background: 'var(--surface-base)', borderBottom: '1px solid var(--border-strong)' }}
      >
        {[['Signal', 148 + 12 + 12], ['Value', 90], ['Min', 64], ['Max', 64], ['Avg', 64], ['Type', 48], ['Address', 96]].map(([label, w]) => (
          <span key={label as string} className="text-[9px] font-semibold uppercase tracking-wider" style={{ width: w as number, flexShrink: 0, color: 'var(--text-muted)' }}>
            {label}
          </span>
        ))}
        <span className="text-[9px] font-semibold uppercase tracking-wider flex-1" style={{ color: 'var(--text-muted)' }}>Plot</span>
      </div>

      {/* scrollable body */}
      <div className="flex-1 overflow-y-auto" style={{ background: 'var(--surface-base)' }}>
        {daqLists.map(list => (
          <DaqListGroup
            key={list.id}
            list={list}
            odtColors={odtColors}
            exiting={exitingLists.has(list.id)}
            onOdtColorChange={(odtId, color) => setOdtColors(prev => ({ ...prev, [`${list.id}:${odtId}`]: color }))}
            onDeleteList={() => handleDeleteList(list.id)}
            onAddOdt={() => handleAddOdt(list.id)}
            onDeleteOdt={odtId => handleDeleteOdt(list.id, odtId)}
            onSetEvent={ch => handleSetEvent(list.id, ch)}
            onSetRunMode={mode => handleSetRunMode(list.id, mode)}
            onSetListMode={mode => handleSetListMode(list.id, mode)}
            onSetPrescaler={prescaler => handleSetPrescaler(list.id, prescaler)}
            onSaveEntry={(odtId, entry, idx) => handleSaveEntry(list.id, odtId, entry, idx)}
            onDeleteEntry={(odtId, idx) => handleDeleteEntry(list.id, odtId, idx)}
            onMoveEntry={(fromOdtId, fromIdx, toListId, toOdtId, toIdx) =>
              handleMoveEntry(list.id, fromOdtId, fromIdx, toListId, toOdtId, toIdx)
            }
          />
        ))}

        <div style={{ padding: 12 }}>
          <button
            className="text-[10px] w-full flex items-center justify-center gap-1.5 rounded-md transition-colors"
            style={{ padding: '6px 0', color: 'var(--text-muted)', background: 'none', border: '1px dashed var(--border-strong)', cursor: 'pointer' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLElement).style.borderColor = 'color-mix(in srgb, var(--accent) 40%, transparent)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'; }}
            onClick={handleAddList}
          >
            <Plus size={12} />Add DAQ List
          </button>
        </div>
      </div>

      {exportContent !== null && (
        <ExportDialog
          defaultFilename="daq_config.daq"
          content={exportContent}
          onClose={() => setExportContent(null)}
          onSuccess={() => showToast('DAQ config exported', 'success')}
        />
      )}
    </div>
  );
}
