import {
  useState,
  useRef,
  useEffect,
  useMemo,
  Fragment,
  type MouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../stores/app-store';
import { toTitleCase, formatTime } from '../lib/utils';
import type { PacketEntry } from '../lib/types';

type DirFilter = 'all' | 'tx' | 'rx';

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
  return JSON.stringify(v);
}

function HexCell({ hex, dir }: { hex: string; dir: 'tx' | 'rx' }) {
  const cls = dir === 'tx' ? 'text-blue-400' : 'text-green-400';
  if (!hex) return <span className="text-gray-600 italic">—</span>;
  return (
    <>
      {hex.split(' ').map((b, i) => (
        <span key={i} className={cls}>
          {b}{' '}
        </span>
      ))}
    </>
  );
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
      if (popRef.current && !popRef.current.contains(t) && !anchor.contains(t))
        onClose();
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [anchor, onClose]);

  const visible = pids.filter(
    (p) => !search || p.toUpperCase().includes(search.toUpperCase())
  );

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
              <span
                className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 text-[8px] ${
                  active
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : 'border-gray-600 text-transparent'
                }`}
              >
                ✓
              </span>
              <span
                className={`font-mono text-xs ${
                  active ? 'text-blue-300' : 'text-gray-400'
                }`}
              >
                0x{pid}
              </span>
            </div>
          );
        })}
      </div>
      <div className="p-1.5 border-t border-gray-800 flex gap-1">
        <button
          onClick={onAll}
          className="flex-1 py-0.5 rounded text-[10px] text-gray-400 hover:text-gray-200 hover:bg-gray-700 border border-gray-700 transition-colors"
        >
          All
        </button>
        <button
          onClick={() => { onAll(); }}
          className="flex-1 py-0.5 rounded text-[10px] text-gray-400 hover:text-gray-200 hover:bg-gray-700 border border-gray-700 transition-colors"
        >
          Clear
        </button>
      </div>
    </div>,
    document.body
  );
}

// ── Main component ────────────────────────────────────────────────

export function PacketTrace() {
  const packets = useAppStore((s) => s.packets);
  const txCount = useAppStore((s) => s.txCount);
  const rxCount = useAppStore((s) => s.rxCount);
  const autoScroll = useAppStore((s) => s.autoScroll);
  const setAutoScroll = useAppStore((s) => s.setAutoScroll);
  const clearPackets = useAppStore((s) => s.clearPackets);

  const [dirFilter, setDirFilter] = useState<DirFilter>('all');
  const [selectedPids, setSelectedPids] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [traceVisible, setTraceVisible] = useState(true);
  const [pidAnchor, setPidAnchor] = useState<HTMLElement | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [packets, autoScroll]);

  const allPids = useMemo(
    () => [...new Set(packets.map((p) => p.pid))].sort(),
    [packets]
  );

  const filtered = useMemo(
    () =>
      packets.filter((p) => {
        const dirOk = dirFilter === 'all' || p.direction === dirFilter;
        const pidOk = selectedPids.size === 0 || selectedPids.has(p.pid);
        return dirOk && pidOk;
      }),
    [packets, dirFilter, selectedPids]
  );

  function toggleRow(p: PacketEntry) {
    setExpandedId((prev) => (prev === p.id ? null : p.id));
  }

  function togglePid(pid: string) {
    setSelectedPids((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  }

  const pidActive = selectedPids.size > 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 h-9 border-b border-gray-800 bg-gray-900 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-400">Packet Trace</span>
          <div className="flex items-center gap-1">
            {(['all', 'tx', 'rx'] as DirFilter[]).map((d) => (
              <button
                key={d}
                onClick={() => setDirFilter(d)}
                className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                  dirFilter === d
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                }`}
              >
                {d === 'all' ? 'All' : d.toUpperCase()}
              </button>
            ))}
          </div>
          {/* PID filter button */}
          <button
            onClick={(e: MouseEvent<HTMLButtonElement>) =>
              setPidAnchor((prev) => (prev ? null : e.currentTarget))
            }
            className={`relative w-6 h-6 rounded flex items-center justify-center transition-colors hover:bg-gray-800 ${
              pidActive ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
            }`}
            title="Filter by PID"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M1 2.5A.5.5 0 0 1 1.5 2h13a.5.5 0 0 1 .35.854L10 7.707V13.5a.5.5 0 0 1-.223.416l-3 2A.5.5 0 0 1 6 15.5V7.707L1.15 2.854A.5.5 0 0 1 1 2.5z" />
            </svg>
            {pidActive && (
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-full text-[7px] text-white flex items-center justify-center">
                {selectedPids.size}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className="text-blue-400">TX: {txCount}</span>
            <span className="text-gray-700">|</span>
            <span className="text-green-400">RX: {rxCount}</span>
          </div>
          <label className="flex items-center gap-1.5 text-[10px] text-gray-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="accent-blue-500"
            />
            Auto-scroll
          </label>
          <button
            onClick={clearPackets}
            className="px-2 py-0.5 rounded text-[10px] text-gray-500 hover:text-gray-300 hover:bg-gray-800 border border-gray-700 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={() => setTraceVisible(!traceVisible)}
            className="w-5 h-5 rounded flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-gray-800 text-xs transition-colors"
          >
            {traceVisible ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {/* Table */}
      {traceVisible && (
        <div className="flex-1 overflow-y-auto font-mono text-xs">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-gray-900 z-10">
              <tr className="text-left text-[10px] text-gray-500 uppercase tracking-wider">
                <th className="px-3 py-2 w-10">Dir</th>
                <th className="px-3 py-2 w-12">Ctr</th>
                <th className="px-3 py-2 w-32">Time</th>
                <th className="px-3 py-2">Hex</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const isExpanded = expandedId === p.id;
                const isErr = p.pid === 'FE';
                const badgeCls =
                  p.direction === 'tx'
                    ? 'bg-[#1e3a8a] text-[#93c5fd] border border-[#3b82f6]'
                    : isErr
                    ? 'bg-red-900/30 text-red-400 border border-red-500/50'
                    : 'bg-[#064e3b] text-[#6ee7b7] border border-[#10b981]';
                const valueCls = isErr
                  ? 'text-red-400'
                  : p.direction === 'tx'
                  ? 'text-blue-400'
                  : 'text-green-400';
                const decoded = flattenDecoded(p.decoded);

                return (
                  <Fragment key={p.id}>
                    <tr
                      className={`border-b border-gray-800/40 hover:bg-gray-800/30 cursor-pointer transition-colors ${
                        isExpanded ? 'bg-gray-800/20' : ''
                      }`}
                      onClick={() => toggleRow(p)}
                    >
                      <td className="px-3 py-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${badgeCls}`}
                        >
                          {p.direction.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-500">{p.counter}</td>
                      <td className="px-3 py-2 text-gray-500">
                        {formatTime(p.timestamp_ms)}
                      </td>
                      <td className="px-3 py-2">
                        <HexCell hex={p.hex} dir={p.direction} />
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-gray-900/60">
                        <td colSpan={4} className="px-6 pb-3 pt-1">
                          <div
                            className={`text-[10px] mb-1.5 uppercase tracking-wider ${
                              isErr ? 'text-red-500' : 'text-gray-500'
                            }`}
                          >
                            {p.direction === 'tx'
                              ? `→ TX · PID 0x${p.pid}`
                              : isErr
                              ? `✕ ERR · PID 0x${p.pid}`
                              : `← RX · PID 0x${p.pid}`}
                          </div>
                          <div className="space-y-0.5 text-xs">
                            {decoded.length > 0 ? (
                              decoded.map(([k, v]) => (
                                <div key={k}>
                                  <span className="w-36 inline-block text-gray-500">
                                    {toTitleCase(k)}
                                  </span>
                                  <span className={valueCls}>{formatValue(v)}</span>
                                </div>
                              ))
                            ) : (
                              <span className="text-gray-700 italic">
                                no decoded data
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
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
