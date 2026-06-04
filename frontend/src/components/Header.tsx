import { useRef, useState, useEffect } from 'react';
import {
  FileCode, ArrowsClockwise, GearSix, X, FolderOpen,
} from '@phosphor-icons/react';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { useAppStore } from '../stores/app-store';
import { api } from '../lib/api';
import { Settings } from './Settings';
import { ToastContainer } from './Toast';
import { SegmentControl } from './ui/SegmentControl';
import { Button } from './ui/Button';
import { ConnectToggle } from './ui/ConnectToggle';
import type { DaqEntryType } from '../lib/types';
import { TraceIcon, DaqIcon, SequenceIcon } from './icons/TabIcons';

type MainTab = 'trace' | 'daq' | 'sequence';

function BroadcastCustom({ size, pulsing, pulseKey }: { size: number; pulsing: boolean; pulseKey: number }) {
  return (
    <svg viewBox="0 0 256 256" width={size} height={size} fill="currentColor" aria-hidden="true">
      <g key={`dot-${pulseKey}`}>
        <path
          fillRule="evenodd"
          className={pulsing ? 'broadcast-dot-pulse' : ''}
          d="M128,84a44,44,0,1,0,44,44A44.05,44.05,0,0,0,128,84Zm0,64a20,20,0,1,1,20-20A20,20,0,0,1,128,148Z"
        />
      </g>
      <g key={`inner-${pulseKey}`}>
        <path className={pulsing ? 'broadcast-arc-inner' : ''} d="M205.39,160.7A83.94,83.94,0,0,1,190.61,184a12,12,0,0,1-17.89-16,59.92,59.92,0,0,0,0-80,12,12,0,0,1,17.89-16,84.07,84.07,0,0,1,14.78,88.7Z" />
        <path className={pulsing ? 'broadcast-arc-inner' : ''} d="M83.28,168a12,12,0,0,1-17.89,16,83.94,83.94,0,0,1,0-112A12,12,0,0,1,83.28,88a59.92,59.92,0,0,0,0,80Z" />
      </g>
      <g key={`outer-${pulseKey}`}>
        <path className={pulsing ? 'broadcast-arc-outer' : ''} d="M252,128a123.63,123.63,0,0,1-35.43,86.78A12,12,0,1,1,199.43,198a99.88,99.88,0,0,0,0-140,12,12,0,0,1,17.14-16.8A123.63,123.63,0,0,1,252,128Z" />
        <path className={pulsing ? 'broadcast-arc-outer' : ''} d="M56.57,198a12,12,0,0,1-17.14,16.8,123.89,123.89,0,0,1,0-173.56A12,12,0,0,1,56.57,58a99.88,99.88,0,0,0,0,140Z" />
      </g>
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
  const [broadcastPulsing, setBroadcastPulsing] = useState(false);
  const [broadcastPulseKey, setBroadcastPulseKey] = useState(0);
  const [syncSpinning, setSyncSpinning] = useState(false);
  const [gearKey, setGearKey] = useState(0);
  const [gearReverse, setGearReverse] = useState(false);

  // ── Tab icon animKeys ─────────────────────────────────────────────
  const [traceAnimKey, setTraceAnimKey] = useState(0);
  const [daqAnimKey,   setDaqAnimKey]   = useState(0);
  const [seqAnimKey,   setSeqAnimKey]   = useState(0);
  const prevTabRef = useRef(activeMainTab);

  useEffect(() => {
    const prev = prevTabRef.current;
    prevTabRef.current = activeMainTab;
    if (activeMainTab === 'trace'    && prev !== 'trace')    setTraceAnimKey((k) => k + 1);
    if (activeMainTab === 'daq'      && prev !== 'daq')      setDaqAnimKey((k) => k + 1);
    if (activeMainTab === 'sequence' && prev !== 'sequence') setSeqAnimKey((k) => k + 1);
  }, [activeMainTab]);

  // Pulse trace icon on new packet
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    setTraceAnimKey((k) => k + 1);
  }, [txCount, rxCount]);

  const daqRunning = daqStatus === 'running';
  const seqRunning = seqRunResult?.status === 'running';

  const TAB_ITEMS = [
    { value: 'trace'    as MainTab, label: 'Trace',    icon: <TraceIcon    size={20} animKey={traceAnimKey} /> },
    { value: 'daq'      as MainTab, label: 'DAQ',      icon: <DaqIcon      size={20} animKey={daqAnimKey}   live={daqRunning} /> },
    { value: 'sequence' as MainTab, label: 'Sequence', icon: <SequenceIcon size={20} animKey={seqAnimKey}   live={seqRunning} /> },
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
    setBroadcastPulsing(true);
    setTimeout(() => setBroadcastPulsing(false), 750);
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
                    onClick={() => revealItemInDir(a2lFilePath).catch(() => {})}
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
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>TX</span>
              <span className="font-mono text-[11px]" style={{ color: 'var(--tx)' }}>{txCount}</span>
            </div>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>·</span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>RX</span>
              <span className="font-mono text-[11px]" style={{ color: 'var(--rx)' }}>{rxCount}</span>
            </div>
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
            <BroadcastCustom size={21} pulsing={broadcastPulsing} pulseKey={broadcastPulseKey} />
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
              <ArrowsClockwise size={21} />
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
              size={22}
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
