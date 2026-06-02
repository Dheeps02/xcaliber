import {
  useState,
  useRef,
  useEffect,
  useMemo,
  Fragment,
  type MouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  PaperPlaneTilt,
  DownloadSimple,
  WarningCircle,
  Funnel,
  CornersOut,
  CornersIn,
  Eraser,
  CaretDown,
  CaretUp,
  CaretRight,
  Timer,
} from '@phosphor-icons/react';
import { useAppStore } from '../stores/app-store';
import { formatLabel, toTitleCase, formatTime } from '../lib/utils';
import type { PacketEntry, UserCmdDef } from '../lib/types';
import { AnimatedCount } from './AnimatedCount';
import { Toggle } from './Toggle';

type DirFilter = 'all' | 'tx' | 'rx';

type PairGroup = { kind: 'pair'; tx: PacketEntry; rx: PacketEntry | null; key: number };
type SoloGroup = { kind: 'solo'; packet: PacketEntry; key: number };
type Group = PairGroup | SoloGroup;

function buildGroups(packets: PacketEntry[]): Group[] {
  const groups: Group[] = [];
  let i = 0;
  while (i < packets.length) {
    const p = packets[i];
    if (p.direction === 'tx') {
      const next = packets[i + 1];
      if (next && next.direction === 'rx') {
        groups.push({ kind: 'pair', tx: p, rx: next, key: p.id });
        i += 2;
      } else {
        groups.push({ kind: 'pair', tx: p, rx: null, key: p.id });
        i += 1;
      }
    } else {
      groups.push({ kind: 'solo', packet: p, key: p.id });
      i += 1;
    }
  }
  return groups;
}

function getCommandLabel(p: PacketEntry): string {
  const d = p.decoded as Record<string, unknown>;
  if (typeof d.command === 'string') return formatLabel(d.command);
  return `0x${p.pid}`;
}

function flattenDecoded(decoded: Record<string, unknown>): [string, unknown][] {
  if (!decoded || typeof decoded !== 'object') return [];
  const type = decoded.type as string | undefined;
  const data = decoded.data;
  if (type && data && typeof data === 'object') {
    return [['type', type], ...Object.entries(data as Record<string, unknown>)];
  }
  return Object.entries(decoded);
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'number')
    return Number.isInteger(v)
      ? `0x${v.toString(16).toUpperCase().padStart(2, '0')} (${v})`
      : String(v);
  if (typeof v === 'string') return v;
  if (Array.isArray(v))
    return v.map((b) => (typeof b === 'number' ? b.toString(16).toUpperCase().padStart(2, '0') : String(b))).join(' ');
  return JSON.stringify(v);
}

// ── USER_CMD response decoder ─────────────────────────────────────

function hexToBytes(hex: string): number[] {
  return hex.trim().split(/\s+/).map((b) => parseInt(b, 16)).filter((n) => !isNaN(n));
}

function decodeUserCmdRx(
  tx: PacketEntry,
  rx: PacketEntry,
  userCmds: UserCmdDef[]
): [string, unknown][] | null {
  // TX decoded.command should match the UserCmdDef name
  const cmdName = (tx.decoded as Record<string, unknown>)?.command;
  const def = typeof cmdName === 'string'
    ? userCmds.find((c) => c.name === cmdName)
    : null;
  if (!def) return null;

  const txBytes = hexToBytes(tx.hex);  // [F1, ...requestBytes]
  const rxBytes = hexToBytes(rx.hex);  // response bytes

  // Evaluate variant conditions — txBytes[1+] are the user request bytes
  const reqBytes = txBytes.slice(1);
  const matchedVariant = def.responseVariants.find((v) => {
    if (v.conditions.length === 0) return true;  // default/fallback — always last
    return v.conditions.every((cond) => {
      const actual = reqBytes[cond.reqByteOffset] ?? 0;
      switch (cond.op) {
        case '==': return actual === cond.value;
        case '!=': return actual !== cond.value;
        case '<':  return actual <  cond.value;
        case '>':  return actual >  cond.value;
        case '<=': return actual <= cond.value;
        case '>=': return actual >= cond.value;
      }
    });
  });
  if (!matchedVariant) return null;

  return matchedVariant.bytes
    .map((b): [string, unknown] => [b.label || `byte[${b.offset}]`, rxBytes[b.offset] ?? null]);
}

function HexCell({ hex, dir }: { hex: string; dir: 'tx' | 'rx' }) {
  const cls = dir === 'tx' ? 'text-blue-400' : 'text-green-400';
  if (!hex) return <span className="text-gray-600 italic">—</span>;
  return (
    <>
      {hex.split(' ').map((b, i) => (
        <span key={i} className={cls}>{b} </span>
      ))}
    </>
  );
}

function ExpandDetail({ p, colSpan, open }: { p: PacketEntry; colSpan: number; open: boolean }) {
  const isErr = p.pid === 'FE';
  const valueCls = isErr
    ? 'text-red-400'
    : p.direction === 'tx'
    ? 'text-blue-400'
    : 'text-green-400';
  const allFields = flattenDecoded(p.decoded);
  const rows = p.direction === 'tx'
    ? allFields.filter(([k]) => k !== 'command')
    : allFields;

  return (
    <tr className="bg-gray-900/60">
      <td colSpan={colSpan} className="overflow-hidden p-0">
        <div className={`expand-content ${open ? 'px-6 pb-3 pt-1' : 'closed'}`} style={{ maxHeight: open ? '300px' : undefined }}>
          <div className={`text-[10px] mb-1.5 uppercase tracking-wider ${isErr ? 'text-red-500' : 'text-gray-500'}`}>
            {p.direction === 'tx'
            ? <><PaperPlaneTilt size={11} className="inline mr-1" />TX · PID 0x{p.pid}</>
            : isErr
            ? <><WarningCircle size={11} className="inline mr-1" />ERR · PID 0x{p.pid}</>
            : <><DownloadSimple size={11} className="inline mr-1" />RX · PID 0x{p.pid}</>
          }
          </div>
          <div className="space-y-0.5 text-xs">
            {rows.length > 0 ? (
              rows.map(([k, v]) => (
                <div key={k}>
                  <span className="w-36 inline-block text-gray-500">{toTitleCase(k)}</span>
                  <span className={valueCls}>{formatValue(v)}</span>
                </div>
              ))
            ) : (
              <span className="text-gray-700 italic">no field data</span>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

function ExpandDetailFlat({ p, open, extraFields }: { p: PacketEntry; open: boolean; extraFields?: [string, unknown][] }) {
  const isErr = p.pid === 'FE';
  const valueCls = isErr
    ? 'text-red-400'
    : p.direction === 'tx'
    ? 'text-blue-400'
    : 'text-green-400';
  const allFields = flattenDecoded(p.decoded);
  const baseRows = p.direction === 'tx'
    ? allFields.filter(([k]) => k !== 'command')
    : allFields;
  const rows = extraFields && extraFields.length > 0 ? extraFields : baseRows;

  return (
    <div className="bg-gray-900/60 overflow-hidden">
      <div className={`expand-content ${open ? 'px-6 pb-3 pt-1' : 'closed'}`} style={{ maxHeight: open ? '300px' : undefined }}>
        <div className={`text-[10px] mb-1.5 uppercase tracking-wider ${isErr ? 'text-red-500' : 'text-gray-500'}`}>
          {p.direction === 'tx'
            ? <><PaperPlaneTilt size={11} className="inline mr-1" />TX · PID 0x{p.pid}</>
            : isErr
            ? <><WarningCircle size={11} className="inline mr-1" />ERR · PID 0x{p.pid}</>
            : <><DownloadSimple size={11} className="inline mr-1" />RX · PID 0x{p.pid}</>
          }
        </div>
        <div className="space-y-0.5 text-xs">
          {rows.length > 0 ? (
            rows.map(([k, v]) => (
              <div key={k}>
                <span className="w-36 inline-block text-gray-500">{toTitleCase(k)}</span>
                <span className={valueCls}>{formatValue(v)}</span>
              </div>
            ))
          ) : (
            <span className="text-gray-700 italic">no field data</span>
          )}
        </div>
      </div>
    </div>
  );
}

function dirBadgeCls(p: PacketEntry) {
  const isErr = p.pid === 'FE';
  return p.direction === 'tx'
    ? 'bg-[#1e3a8a] text-[#93c5fd] border border-[#3b82f6]'
    : isErr
    ? 'bg-red-900/30 text-red-400 border border-red-500/50'
    : 'bg-[#064e3b] text-[#6ee7b7] border border-[#10b981]';
}

// ── PID filter popover ────────────────────────────────────────────

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
    function onDown(e: globalThis.MouseEvent) {
      const t = e.target as Node;
      if (popRef.current && !popRef.current.contains(t) && !anchor.contains(t)) onClose();
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [anchor, onClose]);

  const visible = pids.filter((p) => !search || p.toUpperCase().includes(search.toUpperCase()));

  return createPortal(
    <div
      ref={popRef}
      className="fixed bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-[9998]"
      style={{ top: rect.bottom + 4, left: x, width: 192 }}
    >
      <div className="p-2 border-b border-gray-800">
        <input
          autoFocus
          placeholder="Search PID…"
          maxLength={2}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs font-mono text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500"
        />
      </div>
      <div className="p-1 max-h-44 overflow-y-auto">
        {visible.map((pid) => {
          const active = selected.has(pid);
          return (
            <div
              key={pid}
              className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-gray-800 transition-colors"
              onClick={() => onToggle(pid)}
            >
              <span className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 text-[8px] ${active ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-600 text-transparent'}`}>
                ✓
              </span>
              <span className={`font-mono text-xs ${active ? 'text-blue-300' : 'text-gray-400'}`}>
                0x{pid}
              </span>
            </div>
          );
        })}
      </div>
      <div className="p-1.5 border-t border-gray-800 flex gap-1">
        <button onClick={onAll} className="flex-1 py-0.5 rounded text-[10px] text-gray-400 hover:text-gray-200 hover:bg-gray-700 border border-gray-700 transition-colors">
          All
        </button>
        <button onClick={onAll} className="flex-1 py-0.5 rounded text-[10px] text-gray-400 hover:text-gray-200 hover:bg-gray-700 border border-gray-700 transition-colors">
          Clear
        </button>
      </div>
    </div>,
    document.body
  );
}

// ── Main component ────────────────────────────────────────────────

const COL_SPAN = 5;
const ALT_BG = ['', 'bg-gray-800/15'] as const;

export function PacketTrace() {
  const packets = useAppStore((s) => s.packets);
  const txCount = useAppStore((s) => s.txCount);
  const rxCount = useAppStore((s) => s.rxCount);
  const autoScroll = useAppStore((s) => s.autoScroll);
  const setAutoScroll = useAppStore((s) => s.setAutoScroll);
  const clearPackets = useAppStore((s) => s.clearPackets);
  const displayTimeoutMs = useAppStore((s) => s.displayTimeoutMs);
  const animationWatermark = useAppStore((s) => s.animationWatermark);
  const userCmds = useAppStore((s) => s.userCmds);

  const [dirFilter, setDirFilter] = useState<DirFilter>('all');
  const [selectedPids, setSelectedPids] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set());
  const [isClearing, setIsClearing] = useState(false);
  const [, setVersion] = useState(0);
  const [colWidths, setColWidths] = useState([160, 60, 52, 120]);
  const [traceVisible, setTraceVisible] = useState(true);
  const [pidAnchor, setPidAnchor] = useState<HTMLElement | null>(null);
  const [eraserHovered, setEraserHovered] = useState(false);
  const [eraserWiggling, setEraserWiggling] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // IDs whose entry animation has already completed — used to suppress re-animation on re-render
  const cleanedUpIds = useRef<Set<number>>(new Set());
  // Stagger delay (ms) per group key, assigned once synchronously during render
  const groupStaggerDelays = useRef<Map<number, number>>(new Map());
  // Monotonic counter for sequential stagger; reset after a quiet period
  const groupStaggerCounter = useRef(0);
  const staggerResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [packets, autoScroll]);

  // Reset stagger counter on each new command so responses start fresh at 0ms delay
  useEffect(() => {
    groupStaggerCounter.current = 0;
  }, [animationWatermark]);

  // Cleanup-only effect: removes packet-new class after animation finishes
  useEffect(() => {
    if (animationWatermark === null) return;
    const liveIds = packets
      .filter((p) => p.id > animationWatermark && !cleanedUpIds.current.has(p.id))
      .map((p) => p.id);
    if (liveIds.length === 0) return;

    // Compute max stagger delay so cleanup fires after the last group finishes
    let maxDelay = 0;
    for (const g of groups) {
      const gId = g.kind === 'pair' ? g.tx.id : g.packet.id;
      if (gId > animationWatermark && !cleanedUpIds.current.has(gId)) {
        maxDelay = Math.max(maxDelay, groupStaggerDelays.current.get(g.key) ?? 0);
      }
    }

    // Reset stagger counter after a quiet period so unrelated commands start fresh
    if (staggerResetRef.current) clearTimeout(staggerResetRef.current);
    staggerResetRef.current = setTimeout(() => { groupStaggerCounter.current = 0; }, 1500);

    const t = setTimeout(() => {
      liveIds.forEach((id) => cleanedUpIds.current.add(id));
      setVersion((v) => v + 1);
    }, maxDelay + 400);
    return () => clearTimeout(t);
  }, [packets, animationWatermark]); // eslint-disable-line react-hooks/exhaustive-deps

  const allPids = useMemo(() => [...new Set(packets.map((p) => p.pid))].sort(), [packets]);

  const filtered = useMemo(
    () =>
      packets.filter((p) => {
        const dirOk = dirFilter === 'all' || p.direction === dirFilter;
        const pidOk = selectedPids.size === 0 || selectedPids.has(p.pid);
        return dirOk && pidOk;
      }),
    [packets, dirFilter, selectedPids]
  );

  const groups = useMemo(() => buildGroups(filtered), [filtered]);

  // Collapse/Expand All toggle state
  const allPairKeys = useMemo(
    () => groups.filter((g): g is PairGroup => g.kind === 'pair').map((g) => g.key),
    [groups]
  );
  const allCollapsed = allPairKeys.length > 0 && allPairKeys.every((k) => collapsedGroups.has(k));

  useEffect(() => {
    const now = Date.now();
    const pendingTimes = groups
      .filter((g): g is PairGroup => g.kind === 'pair' && g.rx === null)
      .map((g) => g.tx.timestamp_ms)
      .filter((t) => now - t < displayTimeoutMs);
    if (pendingTimes.length === 0) return;
    const delay = displayTimeoutMs - (now - Math.min(...pendingTimes)) + 50;
    const id = setTimeout(() => setVersion((v) => v + 1), delay);
    return () => clearTimeout(id);
  }, [groups, displayTimeoutMs]);

  function toggleRow(p: PacketEntry) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(p.id)) next.delete(p.id);
      else next.add(p.id);
      return next;
    });
  }

  function toggleGroup(key: number, e: React.MouseEvent) {
    e.stopPropagation();
    setCollapsedGroups((prev) => {
      const s = new Set(prev);
      if (s.has(key)) s.delete(key); else s.add(key);
      return s;
    });
  }

  function collapseAll() {
    setCollapsedGroups(new Set(allPairKeys));
  }

  function expandAll() {
    setCollapsedGroups(new Set());
  }

  function handleClear() {
    if (packets.length === 0) return;
    setIsClearing(true);
    setTimeout(() => {
      clearPackets();
      setIsClearing(false);
      setCollapsedGroups(new Set());
      setExpandedIds(new Set());
      cleanedUpIds.current.clear();
      groupStaggerDelays.current.clear();
      groupStaggerCounter.current = 0;
      if (staggerResetRef.current) { clearTimeout(staggerResetRef.current); staggerResetRef.current = null; }
    }, 220);
  }

  function togglePid(pid: string) {
    setSelectedPids((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  }

  function startResize(colIdx: number, e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = colWidths[colIdx];
    function onMove(ev: globalThis.MouseEvent) {
      const delta = ev.clientX - startX;
      setColWidths(prev => {
        const next = [...prev];
        next[colIdx] = Math.max(40, startWidth + delta);
        return next;
      });
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 h-9 border-b border-gray-800 bg-gray-900 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1">
            {(['all', 'tx', 'rx'] as DirFilter[]).map((d) => (
              <button
                key={d}
                onClick={() => setDirFilter(d)}
                className={`h-6 px-2 rounded text-[10px] flex items-center transition-colors ${
                  dirFilter === d ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                }`}
              >
                {d === 'all' ? 'All' : d.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            onClick={(e: MouseEvent<HTMLButtonElement>) =>
              setPidAnchor((prev) => (prev ? null : e.currentTarget))
            }
            className={`relative w-6 h-6 rounded flex items-center justify-center transition-colors hover:bg-gray-800 ${
              selectedPids.size > 0 ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
            }`}
            title="Filter by PID"
          >
            <Funnel size={14} weight={selectedPids.size > 0 ? 'fill' : 'regular'} />
            {selectedPids.size > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-blue-500 rounded-full text-[8px] font-bold text-white leading-none flex items-center justify-center">
                {selectedPids.size}
              </span>
            )}
          </button>
          <button
            onClick={allCollapsed ? expandAll : collapseAll}
            title={allCollapsed ? 'Expand All' : 'Collapse All'}
            className="w-6 h-6 rounded flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-gray-800 border border-gray-700 transition-colors shrink-0"
          >
            <span key={allCollapsed ? 'out' : 'in'} className="icon-pop">
              {allCollapsed ? <CornersOut size={13} /> : <CornersIn size={13} />}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <AnimatedCount value={txCount} label="TX" colorCls="text-blue-400" />
            <span className="text-gray-700 text-[10px]">|</span>
            <AnimatedCount value={rxCount} label="RX" colorCls="text-green-400" />
          </div>
          <Toggle active={autoScroll} onClick={() => setAutoScroll(!autoScroll)} label="Auto-scroll" />
          <button
            onClick={() => {
              setEraserWiggling(true);
              setTimeout(() => setEraserWiggling(false), 400);
              handleClear();
            }}
            onMouseEnter={() => setEraserHovered(true)}
            onMouseLeave={() => setEraserHovered(false)}
            title="Clear"
            className="w-6 h-6 rounded flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-gray-800 border border-gray-700 transition-colors"
          >
            <span className={eraserWiggling ? 'icon-wiggle' : ''}>
              <Eraser size={13} weight={eraserHovered || eraserWiggling ? 'fill' : 'regular'} />
            </span>
          </button>
          <button
            onClick={() => setTraceVisible(!traceVisible)}
            className="w-6 h-6 rounded flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
          >
            {traceVisible ? <CaretDown size={13} /> : <CaretUp size={13} />}
          </button>
        </div>
      </div>

      {/* Table */}
      {traceVisible && (
        <div className="flex-1 overflow-y-auto trace-mono text-xs" style={{ transform: 'translateZ(0)' }}>
          <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: colWidths[0] }} />
              <col style={{ width: colWidths[1] }} />
              <col style={{ width: colWidths[2] }} />
              <col style={{ width: colWidths[3] }} />
              <col />
            </colgroup>
            <thead className="sticky top-0 bg-gray-900 z-10">
              <tr className="text-left text-[10px] text-gray-500 uppercase tracking-wider select-none">
                <th className="px-3 py-2 relative overflow-hidden">Command
                  <div className="absolute inset-y-0 right-0 w-1 cursor-col-resize hover:bg-blue-500/40 active:bg-blue-500/60" onMouseDown={(e) => startResize(0, e)} />
                </th>
                <th className="px-3 py-2 relative overflow-hidden">DIR
                  <div className="absolute inset-y-0 right-0 w-1 cursor-col-resize hover:bg-blue-500/40 active:bg-blue-500/60" onMouseDown={(e) => startResize(1, e)} />
                </th>
                <th className="px-3 py-2 relative overflow-hidden">CTR
                  <div className="absolute inset-y-0 right-0 w-1 cursor-col-resize hover:bg-blue-500/40 active:bg-blue-500/60" onMouseDown={(e) => startResize(2, e)} />
                </th>
                <th className="px-3 py-2 relative overflow-hidden">Time
                  <div className="absolute inset-y-0 right-0 w-1 cursor-col-resize hover:bg-blue-500/40 active:bg-blue-500/60" onMouseDown={(e) => startResize(3, e)} />
                </th>
                <th className="px-3 py-2">Hex</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g, gi) => {
                const altBg = ALT_BG[gi % 2];

                if (g.kind === 'pair') {
                  const isGroupCollapsed = collapsedGroups.has(g.key);
                  const { tx, rx } = g;
                  const hasPair = rx !== null;
                  const cmdLabel = getCommandLabel(tx);
                  const isBackendTimeout = hasPair && rx !== null && rx.pid === 'FE' &&
                    (rx.decoded as Record<string, unknown>)?.error === 'timeout';
                  const isTimedOut = isBackendTimeout ||
                    (!hasPair && Date.now() - tx.timestamp_ms > displayTimeoutMs);
                  const newTx = animationWatermark !== null && tx.id > animationWatermark && !cleanedUpIds.current.has(tx.id);
                  const newRx = rx !== null && animationWatermark !== null && rx.id > animationWatermark && !cleanedUpIds.current.has(rx.id);
                  if (newTx && !groupStaggerDelays.current.has(g.key)) {
                    groupStaggerDelays.current.set(g.key, Math.min(groupStaggerCounter.current, 3) * 120);
                    groupStaggerCounter.current++;
                  }
                  const groupDelay = groupStaggerDelays.current.get(g.key) ?? 0;

                  return (
                    <Fragment key={g.key}>
                      {/* ── Group title row ──────────────────────── */}
                      <tr
                        className={`border-t border-gray-800/60 cursor-pointer select-none ${altBg} ${newTx ? 'packet-new' : ''} ${isClearing ? 'row-out' : ''}`}
                        style={newTx ? { animationDelay: `${groupDelay}ms` } : undefined}
                        onClick={(e) => toggleGroup(g.key, e)}
                      >
                        <td className="px-2 py-1">
                          <div className="flex items-center gap-1.5">
                            <button
                              className="text-gray-500 hover:text-gray-300 w-3 h-3 shrink-0 flex items-center justify-center transition-colors"
                              onClick={(e) => toggleGroup(g.key, e)}
                              title={isGroupCollapsed ? 'Expand' : 'Collapse'}
                            >
                              <CaretRight
                                size={10}
                                className={`transition-transform duration-200 ${isGroupCollapsed ? '' : 'rotate-90'}`}
                              />
                            </button>
                            <span className="text-gray-300 font-medium text-[11px]">{cmdLabel}</span>
                            {!isGroupCollapsed && <div className="flex-1 h-px bg-gray-800/60 ml-1" />}
                          </div>
                        </td>
                        <td className="px-3 py-1">
                          {isGroupCollapsed && (
                            <div className="flex items-center gap-1">
                              <span className={`px-1 py-0.5 rounded text-[9px] font-semibold ${dirBadgeCls(tx)}`}>TX</span>
                              {rx && <span className={`px-1 py-0.5 rounded text-[9px] font-semibold ${dirBadgeCls(rx)}`}>RX</span>}
                              {isTimedOut && <span className="px-1 py-0.5 rounded text-[9px] font-semibold bg-amber-900/30 text-amber-400 border border-amber-500/50">TO</span>}
                            </div>
                          )}
                        </td>
                        <td /><td /><td />
                      </tr>

                      {/* ── Sub-rows — single TR/TD with grid wrapper for smooth height animation ── */}
                      <tr className={`${altBg} ${newTx ? 'packet-new' : ''}`} style={newTx ? { animationDelay: `${groupDelay}ms` } : undefined}>
                        <td colSpan={COL_SPAN} className="p-0 border-0">
                          <div style={{
                            display: 'grid',
                            gridTemplateRows: isGroupCollapsed ? '0fr' : '1fr',
                            opacity: (isGroupCollapsed || isClearing) ? 0 : 1,
                            transition: 'grid-template-rows 180ms ease, opacity 120ms ease',
                          }}>
                            <div style={{ minHeight: 0, overflow: 'hidden' }}>
                              {/* Request row */}
                              <div
                                className={`flex items-center border-b border-gray-800/30 hover:bg-gray-700/20 cursor-pointer transition-colors ${expandedIds.has(tx.id) ? 'bg-gray-800/30' : ''} ${newTx ? 'packet-new' : ''}`}
                                style={newTx ? { animationDelay: `${groupDelay}ms` } : undefined}
                                onClick={() => toggleRow(tx)}
                              >
                                <div className="px-2 py-1.5 pl-7 shrink-0 overflow-hidden" style={{ width: colWidths[0] }}>
                                  <span className="text-blue-400 text-[10px] flex items-center gap-1"><PaperPlaneTilt size={11} />Request</span>
                                </div>
                                <div className="px-3 py-1.5 shrink-0" style={{ width: colWidths[1] }}>
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${dirBadgeCls(tx)}`}>TX</span>
                                </div>
                                <div className="px-3 py-1.5 text-gray-500 shrink-0" style={{ width: colWidths[2] }}>{tx.counter}</div>
                                <div className="px-3 py-1.5 text-gray-500 shrink-0" style={{ width: colWidths[3] }}>{formatTime(tx.timestamp_ms)}</div>
                                <div className="px-3 py-1.5 flex-1 min-w-0"><HexCell hex={tx.hex} dir="tx" /></div>
                              </div>
                              <ExpandDetailFlat p={tx} open={expandedIds.has(tx.id)} />

                              {/* Timeout indicator */}
                              {isTimedOut && (
                                <div className="flex items-center border-b border-amber-900/30 bg-amber-950/20">
                                  <div className="px-2 py-1.5 pl-7 shrink-0" style={{ width: colWidths[0] }}>
                                    <span className="text-amber-500 text-[10px] flex items-center gap-1"><Timer size={11} />Timeout</span>
                                  </div>
                                  <div className="px-3 py-1.5 shrink-0" style={{ width: colWidths[1] }}>
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-900/30 text-amber-400 border border-amber-500/50">TO</span>
                                  </div>
                                  <div className="px-3 py-1.5 text-gray-700 shrink-0" style={{ width: colWidths[2] }}>—</div>
                                  <div className="px-3 py-1.5 text-amber-700 text-[10px] shrink-0" style={{ width: colWidths[3] }}>after {isBackendTimeout && rx ? rx.timestamp_ms - tx.timestamp_ms : displayTimeoutMs}ms</div>
                                  <div className="px-3 py-1.5 flex-1 text-gray-700">—</div>
                                </div>
                              )}

                              {/* Response row */}
                              {hasPair && rx && !isBackendTimeout && (
                                <>
                                  <div
                                    className={`flex items-center border-b border-gray-800/30 hover:bg-gray-700/20 cursor-pointer transition-colors ${expandedIds.has(rx.id) ? 'bg-gray-800/30' : ''} ${newRx ? 'packet-new' : ''}`}
                                    style={newRx ? { animationDelay: `${groupDelay + 100}ms` } : undefined}
                                    onClick={() => toggleRow(rx)}
                                  >
                                    <div className="px-2 py-1.5 pl-7 shrink-0 overflow-hidden" style={{ width: colWidths[0] }}>
                                      <span className={`text-[10px] flex items-center gap-1 ${rx.pid === 'FE' ? 'text-red-400' : 'text-green-400'}`}>
                                        <DownloadSimple size={11} />Response
                                      </span>
                                    </div>
                                    <div className="px-3 py-1.5 shrink-0" style={{ width: colWidths[1] }}>
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${dirBadgeCls(rx)}`}>RX</span>
                                    </div>
                                    <div className="px-3 py-1.5 text-gray-500 shrink-0" style={{ width: colWidths[2] }}>{rx.counter}</div>
                                    <div className="px-3 py-1.5 text-gray-500 shrink-0" style={{ width: colWidths[3] }}>{formatTime(rx.timestamp_ms)}</div>
                                    <div className="px-3 py-1.5 flex-1 min-w-0"><HexCell hex={rx.hex} dir="rx" /></div>
                                  </div>
                                  <ExpandDetailFlat
                                    p={rx}
                                    open={expandedIds.has(rx.id)}
                                    extraFields={tx.pid === 'F1' ? (decodeUserCmdRx(tx, rx, userCmds) ?? undefined) : undefined}
                                  />
                                </>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  );
                }

                // ── Solo packet ──────────────────────────────────
                const p = g.packet;
                const isNewSolo = animationWatermark !== null && p.id > animationWatermark && !cleanedUpIds.current.has(p.id);
                if (isNewSolo && !groupStaggerDelays.current.has(g.key)) {
                  groupStaggerDelays.current.set(g.key, Math.min(groupStaggerCounter.current, 3) * 120);
                  groupStaggerCounter.current++;
                }
                const soloDelay = groupStaggerDelays.current.get(g.key) ?? 0;
                return (
                  <Fragment key={g.key}>
                    <tr
                      className={`border-b border-gray-800/40 hover:bg-gray-700/20 cursor-pointer transition-colors ${altBg} ${expandedIds.has(p.id) ? 'bg-gray-800/30' : ''} ${isNewSolo ? 'packet-new' : ''} ${isClearing ? 'row-out' : ''}`}
                      style={isNewSolo ? { animationDelay: `${soloDelay}ms` } : undefined}
                      onClick={() => toggleRow(p)}
                    >
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="w-3 shrink-0" />
                          <span className="text-gray-500 truncate">{getCommandLabel(p)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${dirBadgeCls(p)}`}>
                          {p.direction.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-gray-500">{p.counter}</td>
                      <td className="px-3 py-1.5 text-gray-500">{formatTime(p.timestamp_ms)}</td>
                      <td className="px-3 py-1.5"><HexCell hex={p.hex} dir={p.direction} /></td>
                    </tr>
                    <ExpandDetail p={p} colSpan={COL_SPAN} open={expandedIds.has(p.id)} />
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          <div ref={bottomRef} />
        </div>
      )}

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
