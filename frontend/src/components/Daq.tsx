import {
  useRef,
  useState,
  useEffect,
  useCallback,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { useAppStore } from '../stores/app-store';
import { api } from '../lib/api';
import type { DaqList, DaqOdt, DaqEntry, DaqEntryType } from '../lib/types';

// ── constants ────────────────────────────────────────────────────
const SPARK_N = 40;
const TYPE_SIZES: Record<DaqEntryType, number> = {
  u8: 1, i8: 1, u16: 2, i16: 2, u32: 4, i32: 4, f32: 4, f64: 8,
};
const EVENT_OPTS = [
  { value: 1,   label: '0x01 — 1 ms' },
  { value: 2,   label: '0x02 — 10 ms' },
  { value: 3,   label: '0x03 — 100 ms' },
  { value: 4,   label: '0x04 — 1 s' },
  { value: 5,   label: '0x05 — 10 s' },
];
const DEFAULT_COL_WIDTHS = { signal: 160, value: 96, type: 52, address: 100, listOdt: 64 };

// ── Sparkline ────────────────────────────────────────────────────
function Sparkline({ history }: { history: number[] }) {
  if (history.length < 2) {
    return <svg width={80} height={22} className="block opacity-30"><line x1={0} y1={11} x2={80} y2={11} stroke="#374151" strokeWidth={1} /></svg>;
  }
  const mn = Math.min(...history);
  const mx = Math.max(...history);
  const range = mx - mn || 1;
  const pts = history.map((v, i) => {
    const x = (i / (history.length - 1)) * 76 + 2;
    const y = 20 - ((v - mn) / range) * 18;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={80} height={22} className="block">
      <polyline points={pts} fill="none" stroke="#10b981" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Entry Edit Popover ───────────────────────────────────────────
interface EntryPopoverProps {
  listId: number;
  odtId: number;
  entryIdx: number | null; // null = new
  initial?: DaqEntry;
  anchor: { x: number; y: number };
  onSave: (entry: DaqEntry, listId: number, odtId: number, entryIdx: number | null) => void;
  onClose: () => void;
}

function EntryPopover({ listId, odtId, entryIdx, initial, anchor, onSave, onClose }: EntryPopoverProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [addr, setAddr] = useState(initial ? `0x${initial.addr.toString(16).padStart(8, '0').toUpperCase()}` : '');
  const [ext, setExt] = useState(String(initial?.addr_ext ?? 0));
  const [typeName, setTypeName] = useState<DaqEntryType>(initial?.type_name ?? 'u32');

  function handleSave() {
    const parsed = parseInt(addr.replace(/^0x/i, ''), 16);
    if (!name.trim() || isNaN(parsed)) return;
    onSave(
      { name: name.trim(), addr: parsed, addr_ext: Number(ext) || 0, size: TYPE_SIZES[typeName], type_name: typeName },
      listId, odtId, entryIdx
    );
  }

  const style: React.CSSProperties = {
    position: 'fixed',
    top: Math.min(anchor.y, window.innerHeight - 260),
    left: Math.min(anchor.x, window.innerWidth - 256),
    width: 240,
    zIndex: 9998,
  };

  return (
    <div style={style} className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">ODT Entry</p>
      <div className="space-y-2">
        <div>
          <label className="text-[10px] text-gray-500 block mb-0.5">Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="EngineRPM"
            className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500" />
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[10px] text-gray-500 block mb-0.5">Address</label>
            <input value={addr} onChange={e => setAddr(e.target.value)} placeholder="0x80004000"
              className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs font-mono text-gray-200 focus:outline-none focus:border-blue-500" />
          </div>
          <div style={{ width: 48 }}>
            <label className="text-[10px] text-gray-500 block mb-0.5">Ext</label>
            <input value={ext} onChange={e => setExt(e.target.value)} placeholder="0"
              className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs font-mono text-gray-200 focus:outline-none focus:border-blue-500" />
          </div>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block mb-0.5">Type</label>
          <select value={typeName} onChange={e => setTypeName(e.target.value as DaqEntryType)}
            className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500">
            {(['u8','u16','u32','i8','i16','i32','f32','f64'] as DaqEntryType[]).map(t => (
              <option key={t} value={t}>{t} ({TYPE_SIZES[t]}B)</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-1.5 mt-3">
        <button onClick={handleSave}
          className="flex-1 py-1 rounded text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors">
          Save
        </button>
        <button onClick={onClose}
          className="px-3 py-1 rounded text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 border border-gray-700 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── DAQ List Tree ────────────────────────────────────────────────
interface TreeProps {
  lists: DaqList[];
  onAddList: () => void;
  onDeleteList: (listId: number) => void;
  onSetEvent: (listId: number, ch: number) => void;
  onAddOdt: (listId: number) => void;
  onSaveEntry: (entry: DaqEntry, listId: number, odtId: number, entryIdx: number | null) => void;
  onDeleteEntry: (listId: number, odtId: number, entryIdx: number) => void;
}

function DaqTree({ lists, onAddList, onDeleteList, onSetEvent, onAddOdt, onSaveEntry, onDeleteEntry }: TreeProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [popover, setPopover] = useState<{ listId: number; odtId: number; entryIdx: number | null; initial?: DaqEntry; anchor: { x: number; y: number } } | null>(null);

  function toggleCollapse(key: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function saveEntry(entry: DaqEntry, listId: number, odtId: number, entryIdx: number | null) {
    onSaveEntry(entry, listId, odtId, entryIdx);
    setPopover(null);
  }

  const totalEntries = lists.reduce((s, l) => s + l.odts.reduce((ss, o) => ss + o.entries.length, 0), 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 h-8 border-b border-gray-800 shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-600">DAQ Lists</span>
        <button onClick={onAddList} className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-blue-400 transition-colors">
          <span style={{ fontSize: 14, lineHeight: '14px' }}>+</span> Add List
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {lists.length === 0 && (
          <p className="text-center text-gray-700 text-xs py-6">No DAQ lists. Click + Add List.</p>
        )}
        {lists.map(list => {
          const lKey = `list-${list.id}`;
          const lCollapsed = collapsed.has(lKey);
          return (
            <div key={list.id} className="daq-list-card mb-1.5">
              {/* List header */}
              <div className="daq-list-header" onClick={() => toggleCollapse(lKey)}>
                <span className="text-gray-500 text-[10px] w-3 shrink-0">{lCollapsed ? '▸' : '▾'}</span>
                <span className="text-gray-300 text-[11px] font-semibold flex-1">List {list.id}</span>
                <select
                  value={list.event_channel}
                  onClick={e => e.stopPropagation()}
                  onChange={e => { e.stopPropagation(); onSetEvent(list.id, Number(e.target.value)); }}
                  className="px-1 py-0 bg-gray-900 border border-gray-700 rounded text-[10px] font-mono text-gray-400 focus:outline-none focus:border-blue-500 shrink-0"
                >
                  {EVENT_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <button
                  onClick={e => { e.stopPropagation(); onDeleteList(list.id); }}
                  className="ml-1 text-gray-600 hover:text-red-400 text-[10px] transition-colors shrink-0"
                >✕</button>
              </div>

              {!lCollapsed && (
                <div className="daq-list-body">
                  {list.odts.map(odt => {
                    const oKey = `${list.id}-${odt.id}`;
                    const oCollapsed = collapsed.has(oKey);
                    return (
                      <div key={odt.id} className="daq-odt-card">
                        <div className="daq-odt-header" onClick={() => toggleCollapse(oKey)}>
                          <span className="w-3 shrink-0">{oCollapsed ? '▸' : '▾'}</span>
                          <span className="flex-1">ODT {odt.id}</span>
                          <span className="text-gray-600">{odt.entries.length} entries</span>
                        </div>
                        {!oCollapsed && (
                          <div className="daq-odt-body">
                            {odt.entries.map((entry, ei) => (
                              <div key={ei} className="daq-entry-row group" onClick={(e) => {
                                setPopover({ listId: list.id, odtId: odt.id, entryIdx: ei, initial: entry, anchor: { x: e.clientX, y: e.clientY } });
                              }}>
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500/50 shrink-0" />
                                <span className="text-gray-300 text-[11px] flex-1 truncate">{entry.name}</span>
                                <span className="font-mono text-gray-500 text-[10px] shrink-0">{entry.type_name}</span>
                                <button
                                  className="ml-0.5 text-gray-700 hover:text-red-400 text-[10px] opacity-0 group-hover:opacity-100 transition-all shrink-0"
                                  onClick={e => { e.stopPropagation(); onDeleteEntry(list.id, odt.id, ei); }}
                                >✕</button>
                              </div>
                            ))}
                            <div className="px-2 py-1">
                              <button
                                onClick={e => setPopover({ listId: list.id, odtId: odt.id, entryIdx: null, anchor: { x: e.clientX, y: e.clientY } })}
                                className="flex items-center gap-1 text-[10px] text-gray-600 hover:text-blue-400 transition-colors"
                              >
                                <span style={{ fontSize: 12, lineHeight: '12px' }}>+</span> Add Entry
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <button onClick={() => onAddOdt(list.id)}
                    className="text-[10px] text-gray-600 hover:text-blue-400 transition-colors px-1 py-0.5 mt-0.5">
                    + Add ODT
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="px-3 py-1.5 border-t border-gray-800 shrink-0">
        <span className="text-[10px] text-gray-700 font-mono">
          {lists.length} lists · {totalEntries} signals
        </span>
      </div>

      {/* Entry popover */}
      {popover && (
        <EntryPopover
          listId={popover.listId}
          odtId={popover.odtId}
          entryIdx={popover.entryIdx}
          initial={popover.initial}
          anchor={popover.anchor}
          onSave={saveEntry}
          onClose={() => setPopover(null)}
        />
      )}
    </div>
  );
}

// ── Live Values Table ─────────────────────────────────────────────
interface LiveTableProps {
  lists: DaqList[];
}

interface LiveRow {
  key: string;
  listId: number;
  odtId: number;
  entry: DaqEntry;
  value: number | null;
  history: number[];
  isNew: boolean;
}

// Resizer handle
function ColResizer({ onDrag }: { onDrag: (dx: number) => void }) {
  const dragging = useRef(false);
  const last = useRef(0);

  function onMouseDown(e: ReactMouseEvent) {
    dragging.current = true;
    last.current = e.clientX;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  useEffect(() => {
    function move(e: MouseEvent) {
      if (!dragging.current) return;
      onDrag(e.clientX - last.current);
      last.current = e.clientX;
    }
    function up() {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [onDrag]);

  return (
    <div
      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize group z-10"
      onMouseDown={onMouseDown}
    >
      <div className="absolute right-0 top-1 bottom-1 w-px bg-gray-800 group-hover:bg-blue-500 transition-colors" />
    </div>
  );
}

function DaqLiveTable({ lists }: LiveTableProps) {
  const liveValues = useAppStore(s => s.daqLiveValues);
  const [colWidths, setColWidths] = useState(DEFAULT_COL_WIDTHS);
  const [animatedKeys, setAnimatedKeys] = useState<Set<string>>(new Set());
  const prevKeysRef = useRef<Set<string>>(new Set());

  // Flatten all entries into rows
  const rows: LiveRow[] = lists.flatMap(list =>
    list.odts.flatMap(odt =>
      odt.entries.map(entry => {
        const key = `${list.id}:${odt.id}:${entry.name}`;
        const live = liveValues.get(key);
        return {
          key,
          listId: list.id,
          odtId: odt.id,
          entry,
          value: live?.value ?? null,
          history: live?.history ?? [],
          isNew: false,
        };
      })
    )
  );

  // Detect newly appearing rows and animate them
  useEffect(() => {
    const currentKeys = new Set(rows.map(r => r.key));
    const newKeys = new Set<string>();
    for (const k of currentKeys) {
      if (!prevKeysRef.current.has(k)) newKeys.add(k);
    }
    prevKeysRef.current = currentKeys;
    if (newKeys.size === 0) return;
    setAnimatedKeys(prev => new Set([...prev, ...newKeys]));
    const t = setTimeout(() => {
      setAnimatedKeys(prev => {
        const next = new Set(prev);
        newKeys.forEach(k => next.delete(k));
        return next;
      });
    }, 600);
    return () => clearTimeout(t);
  }, [rows.map(r => r.key).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  function resizeCol(col: keyof typeof DEFAULT_COL_WIDTHS, dx: number) {
    setColWidths(prev => ({ ...prev, [col]: Math.max(50, prev[col] + dx) }));
  }

  const resizeCb = useCallback(
    (col: keyof typeof DEFAULT_COL_WIDTHS) => (dx: number) => resizeCol(col, dx),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  function formatValue(v: number | null, type: DaqEntryType): string {
    if (v === null) return '—';
    if (type === 'f32' || type === 'f64') return v.toFixed(4);
    return String(v);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 h-8 border-b border-gray-800 shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-600">Live Values</span>
        <span className="text-[10px] text-gray-600">Click plot to expand</span>
      </div>
      <div className="flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-700 text-xs">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} className="w-8 h-8 mb-2 opacity-40">
              <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
            </svg>
            Add signals to a DAQ list, then Configure → Start
          </div>
        ) : (
          <table className="border-collapse text-xs font-mono" style={{ width: '100%', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: colWidths.signal }} />
              <col style={{ width: colWidths.value }} />
              <col style={{ width: colWidths.type }} />
              <col style={{ width: colWidths.address }} />
              <col style={{ width: colWidths.listOdt }} />
              <col style={{ width: 88 }} />
            </colgroup>
            <thead className="sticky top-0 bg-gray-900 z-10">
              <tr className="text-left text-[10px] text-gray-500 uppercase tracking-wider">
                {(
                  [
                    ['signal', 'Signal'],
                    ['value',  'Value'],
                    ['type',   'Type'],
                    ['address','Address'],
                    ['listOdt','L/O'],
                  ] as [keyof typeof DEFAULT_COL_WIDTHS, string][]
                ).map(([col, label]) => (
                  <th key={col} className="px-3 py-1.5 relative">
                    {label}
                    <ColResizer onDrag={resizeCb(col)} />
                  </th>
                ))}
                <th className="px-3 py-1.5">Plot</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => {
                const isAnimating = animatedKeys.has(row.key);
                return (
                  <tr
                    key={row.key}
                    className={`border-b border-gray-800/40 hover:bg-gray-800/30 transition-colors ${
                      isAnimating ? 'daq-row-enter' : ''
                    }`}
                    style={isAnimating ? { animationDelay: `${ri * 40}ms` } : undefined}
                  >
                    <td className="px-3 py-1.5 text-gray-300 truncate">{row.entry.name}</td>
                    <td className={`px-3 py-1.5 tabular-nums ${
                      row.value !== null ? 'text-green-400' : 'text-gray-600'
                    }`}>
                      {formatValue(row.value, row.entry.type_name)}
                    </td>
                    <td className="px-3 py-1.5 text-gray-500">{row.entry.type_name}</td>
                    <td className="px-3 py-1.5 text-gray-500">
                      0x{row.entry.addr.toString(16).padStart(8, '0').toUpperCase()}
                    </td>
                    <td className="px-3 py-1.5 text-gray-600">
                      {row.listId}/{row.odtId}
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="cursor-pointer" title="Click to expand (coming soon)">
                        <Sparkline history={row.history} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── DAQ Toolbar ──────────────────────────────────────────────────
interface ToolbarProps {
  lists: DaqList[];
  onConfigure: () => void;
  onStart: () => void;
  onStop: () => void;
  onFree: () => void;
}

function DaqToolbar({ lists, onConfigure, onStart, onStop, onFree }: ToolbarProps) {
  const daqStatus = useAppStore(s => s.daqStatus);
  const connected = useAppStore(s => s.connected);
  const daqDtoRate = useAppStore(s => s.daqDtoRate);

  const canConfigure = daqStatus === 'idle' && connected && lists.some(l => l.odts.some(o => o.entries.length > 0));
  const canStart     = daqStatus === 'configured';
  const canStop      = daqStatus === 'running';
  const canFree      = daqStatus !== 'idle';

  const ledClass =
    daqStatus === 'running'    ? 'blinker-on' :
    daqStatus === 'configured' ? 'blinker-yellow' :
    'blinker-grey';

  const stateLabel =
    daqStatus === 'running'    ? 'Running' :
    daqStatus === 'configured' ? 'Configured' :
    'Idle';

  const stateLabelCls =
    daqStatus === 'running'    ? 'text-green-400' :
    daqStatus === 'configured' ? 'text-yellow-400' :
    'text-gray-500';

  return (
    <div className="flex items-center gap-2 px-4 h-10 border-b border-gray-800 bg-gray-900/60 shrink-0">
      {/* Status */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className={`w-2 h-2 rounded-full shrink-0 ${ledClass}`} />
        <span className={`text-[10px] w-16 ${stateLabelCls}`}>{stateLabel}</span>
      </div>
      <div className="w-px h-4 bg-gray-800" />

      {/* Free All */}
      <button
        onClick={onFree}
        disabled={!canFree}
        className={`px-2.5 py-1 rounded text-[10px] font-medium border transition-colors ${
          canFree
            ? 'text-gray-400 border-gray-700 bg-gray-800 hover:bg-gray-700 cursor-pointer'
            : 'text-gray-600 border-gray-800 bg-gray-900 cursor-not-allowed opacity-40'
        }`}
      >
        Free All
      </button>
      <div className="w-px h-4 bg-gray-800" />

      {/* Configure */}
      <button
        onClick={onConfigure}
        disabled={!canConfigure}
        className={`px-2.5 py-1 rounded text-[10px] font-medium border transition-colors text-blue-400 border-blue-500/30 bg-blue-500/10 ${
          canConfigure ? 'hover:bg-blue-500/20 cursor-pointer' : 'opacity-40 cursor-not-allowed'
        }`}
      >
        Configure
      </button>

      {/* Play */}
      <button
        onClick={onStart}
        disabled={!canStart}
        title="Start DAQ"
        className={`w-7 h-7 rounded flex items-center justify-center text-xs border transition-colors text-green-400 border-green-500/30 bg-green-500/10 ${
          canStart ? 'hover:bg-green-500/20 cursor-pointer' : 'opacity-40 cursor-not-allowed'
        }`}
      >▶</button>

      {/* Stop */}
      <button
        onClick={onStop}
        disabled={!canStop}
        title="Stop DAQ"
        className={`w-7 h-7 rounded flex items-center justify-center text-xs border transition-colors text-red-400 border-red-500/30 bg-red-500/10 ${
          canStop ? 'hover:bg-red-500/20 cursor-pointer' : 'opacity-40 cursor-not-allowed'
        }`}
      >■</button>

      <div className="flex-1" />
      <span className="text-[10px] text-gray-600 font-mono">{daqDtoRate} DTOs / s</span>
    </div>
  );
}

// ── Resizable pane splitter ───────────────────────────────────────
function PaneSplitter({ onDrag }: { onDrag: (dx: number) => void }) {
  const dragging = useRef(false);
  const last = useRef(0);

  function onMouseDown(e: ReactMouseEvent) {
    dragging.current = true;
    last.current = e.clientX;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  useEffect(() => {
    function move(e: MouseEvent) {
      if (!dragging.current) return;
      onDrag(e.clientX - last.current);
      last.current = e.clientX;
    }
    function up() {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [onDrag]);

  return (
    <div
      className="w-1 cursor-col-resize shrink-0 hover:bg-blue-500 bg-gray-800 transition-colors"
      onMouseDown={onMouseDown}
    />
  );
}

// ── Root DAQ component ───────────────────────────────────────────
export function Daq() {
  const daqLists           = useAppStore(s => s.daqLists);
  const setDaqLists        = useAppStore(s => s.setDaqLists);
  const setDaqStatus       = useAppStore(s => s.setDaqStatus);
  const clearDaqLiveValues = useAppStore(s => s.clearDaqLiveValues);
  const showToast          = useAppStore(s => s.showToast);

  const [treePaneWidth, setTreePaneWidth] = useState(300);

  const splitterDrag = useCallback((dx: number) => {
    setTreePaneWidth(prev => Math.max(160, Math.min(520, prev + dx)));
  }, []);

  // ── Tree mutation handlers (call backend, then sync store) ──────

  async function handleAddList() {
    try {
      const result = await api.daqAddList(1);
      setDaqLists([...daqLists, result.list]);
    } catch (e) { showToast((e as Error).message, 'error'); }
  }

  async function handleDeleteList(listId: number) {
    try {
      await api.daqDeleteList(listId);
      setDaqLists(daqLists.filter(l => l.id !== listId));
    } catch (e) { showToast((e as Error).message, 'error'); }
  }

  async function handleSetEvent(listId: number, ch: number) {
    try {
      await api.daqSetEvent(listId, ch);
      setDaqLists(daqLists.map(l => l.id === listId ? { ...l, event_channel: ch } : l));
    } catch (e) { showToast((e as Error).message, 'error'); }
  }

  async function handleAddOdt(listId: number) {
    try {
      const result = await api.daqAddOdt(listId);
      setDaqLists(daqLists.map(l => {
        if (l.id !== listId) return l;
        return { ...l, odts: [...l.odts, { id: result.odt_id, entries: [] }] };
      }));
    } catch (e) { showToast((e as Error).message, 'error'); }
  }

  async function handleSaveEntry(entry: DaqEntry, listId: number, odtId: number, entryIdx: number | null) {
    try {
      if (entryIdx !== null) await api.daqDeleteEntry(listId, odtId, entryIdx);
      await api.daqAddEntry(listId, odtId, entry);
      const result = await api.daqGetLists();
      setDaqLists(result.lists);
    } catch (e) { showToast((e as Error).message, 'error'); }
  }

  async function handleDeleteEntry(listId: number, odtId: number, entryIdx: number) {
    try {
      await api.daqDeleteEntry(listId, odtId, entryIdx);
      const result = await api.daqGetLists();
      setDaqLists(result.lists);
    } catch (e) { showToast((e as Error).message, 'error'); }
  }

  // ── DAQ lifecycle handlers ──────────────────────────────────────

  async function handleConfigure() {
    try {
      await api.daqConfigure();
      setDaqStatus('configured');
    } catch (e) { showToast((e as Error).message, 'error'); }
  }

  async function handleStart() {
    try {
      await api.daqStart();
      setDaqStatus('running');
    } catch (e) { showToast((e as Error).message, 'error'); }
  }

  async function handleStop() {
    try {
      await api.daqStop();
      setDaqStatus('configured');
    } catch (e) { showToast((e as Error).message, 'error'); }
  }

  async function handleFree() {
    try {
      await api.daqFree();
      setDaqStatus('idle');
      clearDaqLiveValues();
    } catch (e) { showToast((e as Error).message, 'error'); }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <DaqToolbar
        lists={daqLists}
        onConfigure={handleConfigure}
        onStart={handleStart}
        onStop={handleStop}
        onFree={handleFree}
      />
      <div className="flex flex-1 overflow-hidden">
        <div style={{ background: '#030712', width: treePaneWidth, minWidth: 160 }} className="flex flex-col overflow-hidden border-r border-gray-800">
          <DaqTree
            lists={daqLists}
            onAddList={handleAddList}
            onDeleteList={handleDeleteList}
            onSetEvent={handleSetEvent}
            onAddOdt={handleAddOdt}
            onSaveEntry={handleSaveEntry}
            onDeleteEntry={handleDeleteEntry}
          />
        </div>
        <PaneSplitter onDrag={splitterDrag} />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <DaqLiveTable lists={daqLists} />
        </div>
      </div>
    </div>
  );
}
