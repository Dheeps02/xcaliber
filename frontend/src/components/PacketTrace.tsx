import {
  useState, useRef, useEffect, useMemo, Fragment,
  type MouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Funnel, Eraser } from '@phosphor-icons/react';
import { useAppStore } from '../stores/app-store';
import { formatLabel, formatTime } from '../lib/utils';
import type { PacketEntry } from '../lib/types';
import { flattenDecoded, formatValue } from './PacketDetail';
import { Button } from './ui/Button';
import { SegmentControl } from './ui/SegmentControl';

// ── types ─────────────────────────────────────────────────────────────────

type DirFilter = 'all' | 'tx' | 'rx';

// ── helpers ──────────────────────────────────────────────────────────────

function getCommandName(p: PacketEntry): string {
  const d = p.decoded as Record<string, unknown>;
  if (typeof d.command === 'string') return formatLabel(d.command);
  return `0x${p.pid}`;
}

function dirColor(dir: string): string {
  if (dir === 'tx') return 'var(--tx)';
  if (dir === 'rx') return 'var(--rx)';
  return 'var(--status-err)';
}

function dirBgColor(dir: string): string {
  if (dir === 'tx') return 'color-mix(in srgb, var(--tx) 5%, transparent)';
  if (dir === 'rx') return 'color-mix(in srgb, var(--rx) 4%, transparent)';
  return 'color-mix(in srgb, var(--status-err) 5%, transparent)';
}

function dirBgHover(dir: string): string {
  if (dir === 'tx') return 'color-mix(in srgb, var(--tx) 10%, transparent)';
  if (dir === 'rx') return 'color-mix(in srgb, var(--rx) 8%, transparent)';
  return 'color-mix(in srgb, var(--status-err) 10%, transparent)';
}

// ── ExpandPanel ──────────────────────────────────────────────────────────

function ExpandPanel({ p, open }: { p: PacketEntry; open: boolean }) {
  const isErr  = p.pid === 'FE';
  const effectiveDir = isErr ? 'err' : p.direction;
  const color  = dirColor(effectiveDir);
  const label  = p.direction === 'tx' ? 'TX' : isErr ? 'ERR' : 'RX';
  const allFields = flattenDecoded(p.decoded);
  const rows   = p.direction === 'tx'
    ? allFields.filter(([k]) => k !== 'command')
    : allFields;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: open ? '1fr' : '0fr',
        transition: 'grid-template-rows 160ms ease',
        borderLeft: `3px solid ${color}`,
        background: 'var(--surface-overlay)',
        borderBottom: open ? '1px solid var(--border)' : 'none',
      }}
    >
      <div style={{ minHeight: 0, overflow: 'hidden' }}>
        <div className="px-4 py-2.5">
          <div
            className="text-[10px] font-semibold uppercase tracking-[0.08em] mb-2"
            style={{ color }}
          >
            {label} · PID 0x{p.pid}
          </div>
          <div
            className="grid gap-y-1 text-[11px] font-mono"
            style={{ gridTemplateColumns: '150px 1fr' }}
          >
            {rows.length > 0 ? rows.map(([k, v]) => (
              <Fragment key={k}>
                <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                <span style={{ color }}>{formatValue(v)}</span>
              </Fragment>
            )) : (
              <span className="col-span-2 italic" style={{ color: 'var(--text-muted)' }}>
                no field data
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PID filter popover ────────────────────────────────────────────────────

interface PidPopoverProps {
  anchor: HTMLElement;
  pids: string[];
  selected: Set<string>;
  onToggle: (pid: string) => void;
  onAll: () => void;
  onClose: () => void;
}

function PidPopover({ anchor, pids, selected, onToggle, onAll, onClose }: PidPopoverProps) {
  const [search, setSearch] = useState('');
  const popRef = useRef<HTMLDivElement>(null);
  const rect = anchor.getBoundingClientRect();
  let x = rect.left;
  if (x + 192 > window.innerWidth - 8) x = Math.max(8, window.innerWidth - 192 - 8);

  useEffect(() => {
    const onDown = (e: globalThis.MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current && !popRef.current.contains(t) && !anchor.contains(t)) onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [anchor, onClose]);

  const visible = pids.filter((p) => !search || p.toUpperCase().includes(search.toUpperCase()));

  return createPortal(
    <div
      ref={popRef}
      className="xcb-glass fixed rounded-lg shadow-2xl z-[9998]"
      style={{
        top: rect.bottom + 4, left: x, width: 192,
        border: '1px solid var(--border-strong)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.35)',
      }}
    >
      <div className="p-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <input
          autoFocus
          placeholder="Search PID…"
          maxLength={2}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="xcb-input w-full px-2 py-1 rounded text-xs font-mono"
        />
      </div>
      <div className="p-1 max-h-44 overflow-y-auto">
        {visible.map((pid) => {
          const active = selected.has(pid);
          return (
            <div
              key={pid}
              className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors"
              style={{ color: active ? 'var(--accent)' : 'var(--text-secondary)' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
              onClick={() => onToggle(pid)}
            >
              <span
                className="w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 text-[8px]"
                style={{
                  background: active ? 'var(--accent)' : 'transparent',
                  borderColor: active ? 'var(--accent)' : 'var(--border-strong)',
                  color: active ? '#03101a' : 'transparent',
                }}
              >✓</span>
              <span className="font-mono text-xs">0x{pid}</span>
            </div>
          );
        })}
      </div>
      <div className="p-1.5 flex gap-1" style={{ borderTop: '1px solid var(--border)' }}>
        <Button variant="ghost" className="flex-1 !justify-center !text-[10px] !py-0.5" onClick={onAll}>
          All
        </Button>
        <Button variant="ghost" className="flex-1 !justify-center !text-[10px] !py-0.5" onClick={onAll}>
          Clear
        </Button>
      </div>
    </div>,
    document.body
  );
}

// ── PacketTrace ───────────────────────────────────────────────────────────

const DIR_ITEMS: { value: DirFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'tx',  label: 'TX' },
  { value: 'rx',  label: 'RX' },
];

export function PacketTrace() {
  const packets          = useAppStore((s) => s.packets);
  const autoScroll       = useAppStore((s) => s.autoScroll);
  const setAutoScroll    = useAppStore((s) => s.setAutoScroll);
  const clearPackets     = useAppStore((s) => s.clearPackets);
  const animationWatermark = useAppStore((s) => s.animationWatermark);

  const [dirFilter, setDirFilter]     = useState<DirFilter>('all');
  const [selectedPids, setSelectedPids] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds]   = useState<Set<number>>(new Set());
  const [isClearing, setIsClearing]     = useState(false);
  const [pidAnchor, setPidAnchor]       = useState<HTMLElement | null>(null);
  const [eraserHovered, setEraserHovered] = useState(false);
  const [eraserWiggling, setEraserWiggling] = useState(false);
  const [, setVersion] = useState(0);

  const bottomRef  = useRef<HTMLDivElement>(null);
  const scrollRef  = useRef<HTMLDivElement>(null);
  const cleanedUpIds = useRef<Set<number>>(new Set());
  const staggerDelays = useRef<Map<number, number>>(new Map());
  const staggerCounter = useRef(0);
  const lastWatermarkRef = useRef<number | null>(null);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [packets, autoScroll]);

  // Remove animation class after it completes
  useEffect(() => {
    if (animationWatermark === null) return;
    const liveIds = packets
      .filter((p) => p.id > animationWatermark && !cleanedUpIds.current.has(p.id))
      .map((p) => p.id);
    if (liveIds.length === 0) return;

    let maxDelay = 0;
    for (const p of filtered) {
      if (p.id > animationWatermark && !cleanedUpIds.current.has(p.id)) {
        maxDelay = Math.max(maxDelay, staggerDelays.current.get(p.id) ?? 0);
      }
    }
    const t = setTimeout(() => {
      liveIds.forEach((id) => cleanedUpIds.current.add(id));
      setVersion((v) => v + 1);
    }, maxDelay + 400);
    return () => clearTimeout(t);
  }, [packets, animationWatermark]); // eslint-disable-line react-hooks/exhaustive-deps

  const allPids = useMemo(() => [...new Set(packets.map((p) => p.pid))].sort(), [packets]);

  const filtered = useMemo(
    () => packets.filter((p) => {
      const dirOk = dirFilter === 'all' || p.direction === dirFilter;
      const pidOk = selectedPids.size === 0 || selectedPids.has(p.pid);
      return dirOk && pidOk;
    }),
    [packets, dirFilter, selectedPids]
  );

  function toggleRow(p: PacketEntry) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(p.id)) next.delete(p.id); else next.add(p.id);
      return next;
    });
  }

  function togglePid(pid: string) {
    setSelectedPids((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid); else next.add(pid);
      return next;
    });
  }

  function handleClear() {
    if (packets.length === 0) return;
    setIsClearing(true);
    setTimeout(() => {
      clearPackets();
      setIsClearing(false);
      setExpandedIds(new Set());
      cleanedUpIds.current.clear();
      staggerDelays.current.clear();
      staggerCounter.current = 0;
      lastWatermarkRef.current = null;
    }, 220);
  }

  if (animationWatermark !== lastWatermarkRef.current) {
    staggerCounter.current = 0;
    lastWatermarkRef.current = animationWatermark;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* ── Toolbar ───────────────────────────────────────────────── */}
      <div
        className="xcb-glass flex items-center justify-between px-3.5 shrink-0"
        style={{ height: 36, borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <SegmentControl items={DIR_ITEMS} value={dirFilter} onChange={setDirFilter} size="sm" />

          {/* PID filter */}
          <Button
            variant="ghost"
            className={`!px-2 !py-1 !text-[11px] !gap-1.5 ${selectedPids.size > 0 ? '!text-[color:var(--accent)]' : ''}`}
            title="Filter by PID"
            onClick={(e: MouseEvent<HTMLButtonElement>) =>
              setPidAnchor((prev) => (prev ? null : e.currentTarget))
            }
          >
            <Funnel size={12} weight={selectedPids.size > 0 ? 'fill' : 'regular'} />
            PID{selectedPids.size > 0 ? ` (${selectedPids.size})` : ''}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            on={autoScroll}
            className="!px-2 !py-1 !text-[11px]"
            onClick={() => setAutoScroll(!autoScroll)}
          >
            Auto-scroll
          </Button>

          <Button
            variant="ghost"
            className="!px-2 !py-1 !w-7 !h-7 !p-0"
            title="Clear"
            onClick={() => {
              setEraserWiggling(true);
              setTimeout(() => setEraserWiggling(false), 400);
              handleClear();
            }}
            onMouseEnter={() => setEraserHovered(true)}
            onMouseLeave={() => setEraserHovered(false)}
          >
            <span className={eraserWiggling ? 'icon-wiggle' : ''}>
              <Eraser size={14} weight={eraserHovered || eraserWiggling ? 'fill' : 'regular'} />
            </span>
          </Button>
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">

        {/* Sticky column headers */}
        <div
          className="xcb-glass sticky top-0 z-10 grid text-[10px] font-semibold uppercase tracking-[0.09em]"
          style={{
            gridTemplateColumns: 'minmax(160px,1.2fr) 110px 1fr',
            paddingLeft: 20,
            paddingTop: 5,
            paddingBottom: 5,
            paddingRight: 16,
            borderBottom: '1px solid var(--border)',
            color: 'var(--text-muted)',
          }}
        >
          <span>Command</span>
          <span>Time</span>
          <span>Hex</span>
        </div>

        {/* Rows */}
        {filtered.map((p) => {
          const isNew = animationWatermark !== null && p.id > animationWatermark && !cleanedUpIds.current.has(p.id);
          if (isNew && !staggerDelays.current.has(p.id)) {
            staggerDelays.current.set(p.id, Math.min(staggerCounter.current, 3) * 60);
            staggerCounter.current++;
          }
          const delay = staggerDelays.current.get(p.id) ?? 0;
          const isExpanded = expandedIds.has(p.id);
          const isErr = p.pid === 'FE';
          const effectiveDir = isErr ? 'err' : p.direction;
          const cmdName = getCommandName(p);

          return (
            <div key={p.id} className={isClearing ? 'row-out' : ''}>
              {/* Row */}
              <TraceRow
                p={p}
                isNew={isNew}
                delay={delay}
                isExpanded={isExpanded}
                effectiveDir={effectiveDir}
                cmdName={cmdName}
                onClick={() => toggleRow(p)}
              />
              {/* Inline expand */}
              <ExpandPanel p={p} open={isExpanded} />
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {pidAnchor && (
        <PidPopover
          anchor={pidAnchor}
          pids={allPids}
          selected={selectedPids}
          onToggle={togglePid}
          onAll={() => setSelectedPids(new Set())}
          onClose={() => setPidAnchor(null)}
        />
      )}
    </div>
  );
}

// ── TraceRow ──────────────────────────────────────────────────────────────

interface TraceRowProps {
  p: PacketEntry;
  isNew: boolean;
  delay: number;
  isExpanded: boolean;
  effectiveDir: string;
  cmdName: string;
  onClick: () => void;
}

function TraceRow({ p, isNew, delay, isExpanded, effectiveDir, cmdName, onClick }: TraceRowProps) {
  const [hovered, setHovered] = useState(false);
  const bg = isExpanded
    ? 'var(--surface-overlay)'
    : hovered
    ? dirBgHover(effectiveDir)
    : dirBgColor(effectiveDir);

  return (
    <div
      className={`relative grid cursor-pointer ${isNew ? 'packet-new' : ''}`}
      style={{
        gridTemplateColumns: 'minmax(160px,1.2fr) 110px 1fr',
        paddingRight: 16,
        paddingLeft: 0,
        borderBottom: '1px solid var(--border)',
        background: bg,
        transition: 'background 70ms',
        ...(isNew ? { animationDelay: `${delay}ms` } : {}),
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Direction stripe */}
      <div
        className="absolute left-0 top-0 bottom-0"
        style={{
          width: 3,
          borderRadius: '0 2px 2px 0',
          background: dirColor(effectiveDir),
        }}
      />

      {/* Command */}
      <div
        className="flex items-center gap-2 py-2 min-w-0 overflow-hidden"
        style={{ paddingLeft: 20 }}
      >
        <span className="font-medium text-[12px] truncate" style={{ color: 'var(--text-primary)' }}>
          {cmdName}
        </span>
        <span className="text-[10px] font-mono shrink-0" style={{ color: 'var(--text-muted)' }}>
          #{p.counter}
        </span>
      </div>

      {/* Time */}
      <div
        className="flex items-center py-2 font-mono text-[11px]"
        style={{ color: 'var(--text-muted)' }}
      >
        {formatTime(p.timestamp_ms)}
      </div>

      {/* Hex */}
      <div className="flex items-center gap-1 py-2 font-mono text-[11px] flex-wrap min-w-0">
        <HexCells hex={p.hex} dir={effectiveDir} />
      </div>
    </div>
  );
}

// ── HexCells ──────────────────────────────────────────────────────────────

function HexCells({ hex, dir }: { hex: string; dir: string }) {
  const color = dirColor(dir);
  return (
    <>
      {hex.trim().split(/\s+/).map((b, i) => (
        <span key={i} style={{ color }}>{b}</span>
      ))}
    </>
  );
}
