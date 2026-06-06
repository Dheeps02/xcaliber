import { useRef, useState, useEffect } from 'react';
import { FileCode, ArrowsClockwise, GearSix, X, FolderOpen } from '@phosphor-icons/react';
import { useAppStore } from '../stores/app-store';
import { api } from '../lib/api';
import { Settings } from './Settings';
import { ToastContainer } from './Toast';
import { SegmentControl } from './ui/SegmentControl';
import { Button } from './ui/Button';
import { ConnectToggle } from './ui/ConnectToggle';
import type { DaqEntryType } from '../lib/types';
import { TraceIcon, DaqIcon, SequenceIcon } from './icons/TabIcons';
import { AnimatedCount } from './AnimatedCount';

type MainTab = 'trace' | 'daq' | 'sequence';

// Phosphor "regular" Broadcast paths split into 3 layers for independent animation.
// Regular weight: r=40 outer dot / r=24 inner, 8-unit arc fills (~half bold's 12-unit).
// Inner arc start: m73.71,7.14 from dot close (128,152) → M201.71,159.14 (absolute).
const BC_DOT   = 'M128,88a40,40,0,1,0,40,40A40,40,0,0,0,128,88Zm0,64a24,24,0,1,1,24-24A24,24,0,0,1,128,152Z';
const BC_INNER = 'M201.71,159.14a80,80,0,0,1-14.08,22.2,8,8,0,0,1-11.92-10.67,63.95,63.95,0,0,0,0-85.33,8,8,0,1,1,11.92-10.67,80.08,80.08,0,0,1,14.08,84.47ZM69,103.09a64,64,0,0,0,11.26,67.58,8,8,0,0,1-11.92,10.67,79.93,79.93,0,0,1,0-106.67A8,8,0,1,1,80.29,85.34,63.77,63.77,0,0,0,69,103.09Z';
const BC_OUTER = 'M248,128a119.58,119.58,0,0,1-34.29,84,8,8,0,1,1-11.42-11.2,103.9,103.9,0,0,0,0-145.56A8,8,0,1,1,213.71,44,119.58,119.58,0,0,1,248,128ZM53.71,200.78A8,8,0,1,1,42.29,212a119.87,119.87,0,0,1,0-168,8,8,0,1,1,11.42,11.2,103.9,103.9,0,0,0,0,145.56Z';

function BroadcastCustom({ size, pulseKey }: { size: number; pulseKey: number }) {
  return (
    <svg
      key={pulseKey}
      viewBox="0 0 256 256"
      style={{ width: size, height: size, flexShrink: 0 }}
      fill="currentColor"
      aria-hidden
    >
      <path fillRule="evenodd" d={BC_DOT}   className={pulseKey > 0 ? 'broadcast-dot-pulse' : ''} />
      <path                    d={BC_INNER} className={pulseKey > 0 ? 'broadcast-arc-inner' : ''} />
      <path                    d={BC_OUTER} className={pulseKey > 0 ? 'broadcast-arc-outer' : ''} />
    </svg>
  );
}

export function Header() {
  const connected          = useAppStore((s) => s.connected);
  const setConnected       = useAppStore((s) => s.setConnected);
  const setSlaveDropped    = useAppStore((s) => s.setSlaveDropped);
  const showToast          = useAppStore((s) => s.showToast);
  const txCount            = useAppStore((s) => s.txCount);
  const rxCount            = useAppStore((s) => s.rxCount);
  const a2lVariables       = useAppStore((s) => s.a2lVariables);
  const setA2lVariables    = useAppStore((s) => s.setA2lVariables);
  const settingsOpen       = useAppStore((s) => s.settingsOpen);
  const settingsInitialTab = useAppStore((s) => s.settingsInitialTab);
  const openSettings       = useAppStore((s) => s.openSettings);
  const closeSettings      = useAppStore((s) => s.closeSettings);
  const activeMainTab      = useAppStore((s) => s.activeMainTab);
  const setActiveMainTab   = useAppStore((s) => s.setActiveMainTab);
  const daqStatus          = useAppStore((s) => s.daqStatus);
  const seqRunResult       = useAppStore((s) => s.seqRunResult);

  const a2lInputRef = useRef<HTMLInputElement>(null);
  const [a2lFileName, setA2lFileName] = useState<string | null>(null);
  const [a2lFilePath, setA2lFilePath] = useState<string | null>(null);
  const [broadcastPulseKey, setBroadcastPulseKey] = useState(0);
  const [syncSpinning, setSyncSpinning] = useState(false);
  const [gearKey, setGearKey] = useState(0);
  const [gearReverse, setGearReverse] = useState(false);

  // ── Tab icon animKeys ─────────────────────────────────────────────
  const [traceAnimKey, setTraceAnimKey] = useState(0);
  const [daqAnimKey,   setDaqAnimKey]   = useState(0);
  const [seqAnimKey,   setSeqAnimKey]   = useState(0);
  const prevTabRef        = useRef(activeMainTab);
  const mountedRef        = useRef(false);
  const traceThrottleRef  = useRef(false);

  useEffect(() => {
    const prev = prevTabRef.current;
    prevTabRef.current = activeMainTab;
    if (activeMainTab === 'trace'    && prev !== 'trace')    setTraceAnimKey((k) => k + 1);
    if (activeMainTab === 'daq'      && prev !== 'daq')      setDaqAnimKey((k) => k + 1);
    if (activeMainTab === 'sequence' && prev !== 'sequence') setSeqAnimKey((k) => k + 1);
  }, [activeMainTab]);

  // Animate trace on new packets — only when on the trace tab, throttled to one play per animation
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    if (prevTabRef.current !== 'trace') return;
    if (traceThrottleRef.current) return;
    setTraceAnimKey((k) => k + 1);
    traceThrottleRef.current = true;
    setTimeout(() => { traceThrottleRef.current = false; }, 600);
  }, [rxCount]);

  const daqRunning = daqStatus === 'running';
  const seqRunning = seqRunResult?.status === 'running';

  const TAB_ITEMS = [
    { value: 'trace'    as MainTab, label: 'Trace',    icon: <TraceIcon    size={18} animKey={traceAnimKey} /> },
    { value: 'daq'      as MainTab, label: 'DAQ',      icon: <DaqIcon      size={18} animKey={daqAnimKey}   live={daqRunning} /> },
    { value: 'sequence' as MainTab, label: 'Sequence', icon: <SequenceIcon size={18} animKey={seqAnimKey}   live={seqRunning} /> },
  ];

  async function handleToggle() {
    if (connected) {
      setSlaveDropped(false);
      setConnected(false);
      await api.disconnect().catch(() => {});
    } else {
      try {
        const r = await api.connect();
        setConnected(true, r.slave);
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Connection failed', 'error');
      }
    }
  }

  async function handleLoadA2l(file: File) {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as unknown;
      const arr = Array.isArray(data) ? data
        : (data as Record<string, unknown>).variables ?? [];
      if (!Array.isArray(arr)) throw new Error();
      setA2lVariables(arr as { name: string; addr: number; type?: DaqEntryType }[]);
      setA2lFileName(file.name);
      setA2lFilePath((file as File & { path?: string }).path ?? null);
      showToast(`Loaded ${(arr as unknown[]).length} A2L variable(s)`, 'success');
    } catch {
      showToast('Invalid A2L JSON. Expected [{name, addr, type?}]', 'error');
    }
  }

  function handleGetStatus() {
    setBroadcastPulseKey((k) => k + 1);
    api.getStatus().catch(() => {});
  }

  function handleSync() {
    setSyncSpinning(true);
    setTimeout(() => setSyncSpinning(false), 600);
    api.sync().catch((e: Error) => showToast(e.message, 'error'));
  }

  function handleUnloadA2l() {
    setA2lVariables([]);
    setA2lFileName(null);
    setA2lFilePath(null);
  }

  return (
    <>
      <input
        ref={a2lInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) { handleLoadA2l(file); e.target.value = ''; }
        }}
      />

      <header
        data-tauri-drag-region
        className="xcb-glass flex items-center h-11 px-3.5 gap-3 shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        {/* ── Left: branding + connection ──────────────────────────── */}
        <div className="flex items-center gap-2.5 min-w-0" style={{ minWidth: 200 }}>
          <span
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: 'var(--text-primary)', letterSpacing: '0.1em' }}
          >
            xcaliber
          </span>

          <ConnectToggle checked={connected} onChange={handleToggle} />

          <div className="xcb-vdiv" />

          {/* A2L loader */}
          <div className="flex items-center gap-1 min-w-0">
            <Button
              variant="ghost"
              className={`!px-1.5 !py-0.5 !text-[11px] !gap-1 ${a2lFileName ? '!text-[color:var(--status-ok)]' : ''}`}
              onClick={() => a2lInputRef.current?.click()}
              title={a2lFileName ? `${a2lFileName} · ${a2lVariables.length} variables` : 'Load A2L JSON'}
            >
              <FileCode size={18} />
              {a2lFileName ? 'A2L' : 'A2L'}
            </Button>
            {a2lFileName && (
              <>
                {a2lFilePath ? (
                  <button
                    className="flex items-center gap-1 text-[10px] truncate max-w-[120px] transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    title="Reveal in file explorer"
                    onClick={() => window.electron?.revealInFolder(a2lFilePath)}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
                  >
                    <FolderOpen size={15} />
                    {a2lFileName}
                  </button>
                ) : (
                  <span className="text-[10px] truncate max-w-[120px]" style={{ color: 'var(--text-muted)' }}>
                    {a2lFileName}
                  </span>
                )}
                <button
                  className="transition-colors shrink-0"
                  style={{ color: 'var(--text-muted)' }}
                  title="Unload A2L"
                  onClick={handleUnloadA2l}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--status-err)')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
                >
                  <X size={16} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Center: main tab selector ─────────────────────────────── */}
        <div className="flex-1 flex justify-center">
          <SegmentControl
            items={TAB_ITEMS}
            value={activeMainTab}
            onChange={setActiveMainTab}
            variant="icon"
          />
        </div>

        {/* ── Right: counters + actions ─────────────────────────────── */}
        <div className="flex items-center gap-2" style={{ minWidth: 200, justifyContent: 'flex-end' }}>
          {/* TX / RX counters */}
          <div className="flex items-center gap-1.5">
            <AnimatedCount value={txCount} label="TX" color="var(--tx)" />
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>·</span>
            <AnimatedCount value={rxCount} label="RX" color="var(--rx)" />
          </div>

          <div className="xcb-vdiv" />

          {/* Get Status */}
          <Button
            variant="ghost"
            disabled={!connected}
            className="!px-2 !py-1 !w-7 !h-7 !p-0"
            title="Get Status"
            onClick={handleGetStatus}
          >
            <BroadcastCustom size={22} pulseKey={broadcastPulseKey} />
          </Button>

          {/* Sync */}
          <Button
            variant="ghost"
            disabled={!connected}
            className="!px-2 !py-1 !w-7 !h-7 !p-0"
            title="Sync"
            onClick={handleSync}
          >
            <span className={syncSpinning ? 'icon-spin-once' : ''}>
              <ArrowsClockwise size={18} />
            </span>
          </Button>

          <div className="xcb-vdiv" />

          {/* Settings */}
          <Button
            variant="ghost"
            className="!px-0 !w-7 !h-7 !p-0"
            title="Settings"
            onClick={() => { setGearKey((k) => k + 1); setGearReverse(false); openSettings(); }}
          >
            <GearSix
              key={gearKey}
              size={18}
              className={gearKey > 0 ? (gearReverse ? 'icon-spin-90-reverse' : 'icon-spin-90') : ''}
            />
          </Button>
        </div>
      </header>

      {settingsOpen && (
        <Settings
          onClose={() => { setGearKey((k) => k + 1); setGearReverse(true); closeSettings(); }}
          initialTab={settingsInitialTab}
        />
      )}
      <ToastContainer />
    </>
  );
}
