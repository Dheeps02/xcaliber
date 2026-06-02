import {
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  memo,
  Fragment,
  useId,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Trash, Wrench, Play, Stop, Pulse, ArrowSquareOut, FolderOpen,
  Database, Plus, PencilSimple, X, DotsSixVertical, ChartLine,
  Rows, FloppyDisk, MagnifyingGlass, Waveform,
} from '@phosphor-icons/react';
import { useAppStore } from '../stores/app-store';
import { api } from '../lib/api';
import type { DaqList, DaqOdt, DaqEntry, DaqEntryType, A2lVariable } from '../lib/types';

// ── constants ────────────────────────────────────────────────────
const TYPE_SIZES: Record<DaqEntryType, number> = {
  u8: 1, i8: 1, u16: 2, i16: 2, u32: 4, i32: 4, f32: 4, f64: 8,
};
const DEFAULT_COL_WIDTHS = { signal: 160, value: 96, type: 52, address: 100, listOdt: 64 };
const ODT_COLORS = ['#10b981','#3b82f6','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#ec4899','#84cc16'];

// ── Sparkline ────────────────────────────────────────────────────
const Sparkline = memo(function Sparkline({ history, color = '#10b981', zoom = 40, onZoomChange }: {
  history: number[];
  color?: string;
  zoom?: number;
  onZoomChange?: (dir: number) => void;
}) {
  const W = 200, H = 22;
  const svgRef = useRef<SVGSVGElement>(null);
  const rawId = useId();
  const gradId = `sg${rawId.replace(/[^a-z0-9]/gi, '')}`;

  useEffect(() => {
    const el = svgRef.current;
    if (!el || !onZoomChange) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      onZoomChange!(e.deltaY > 0 ? 1 : -1);
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onZoomChange]);

  const slice = history.slice(-zoom);
  if (slice.length < 2) {
    return (
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" className="block opacity-30">
        <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="#374151" strokeWidth={1} />
      </svg>
    );
  }

  const mn = Math.min(...slice);
  const mx = Math.max(...slice);
  const range = mx - mn || 1;
  const points = slice.map((v, i) => ({
    x: (i / (slice.length - 1)) * (W - 4) + 2,
    y: (H - 4) - ((v - mn) / range) * (H - 8) + 2,
  }));

  const pts = points.map(p => `${p.x},${p.y}`).join(' ');

  // Closed path for the gradient fill: follow the line then drop to the bottom
  const first = points[0], last = points[points.length - 1];
  const fillPath = `M ${first.x},${first.y} `
    + points.slice(1).map(p => `L ${p.x},${p.y}`).join(' ')
    + ` L ${last.x},${H} L ${first.x},${H} Z`;

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" className="block">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2={H} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* Background */}
      <rect width={W} height={H} fill={color} fillOpacity={0.06} />


      {/* Gradient fill */}
      <path d={fillPath} fill={`url(#${gradId})`} />

      {/* Line */}
      <polyline points={pts} fill="none" style={{ stroke: color, transition: 'stroke 300ms ease' }} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
});

// ── Animated count for DAQ summary ───────────────────────────────
function DaqAnimNum({ value }: { value: number }) {
  const [displayed, setDisplayed] = useState(value);
  const [rev, setRev] = useState(0);
  const prevRef = useRef(value);

  useEffect(() => {
    if (prevRef.current === value) return;
    prevRef.current = value;
    setDisplayed(value);
    setRev((r) => r + 1);
  }, [value]);

  return (
    <span key={rev} className={rev > 0 ? 'count-tick' : ''} style={{ display: 'inline-block' }}>
      {displayed}
    </span>
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

function resolveEntryAddr(input: string, a2lVars: A2lVariable[]): number | null {
  const t = input.trim();
  if (/^(?:0x)?[0-9a-fA-F]+$/i.test(t)) {
    const n = parseInt(t.replace(/^0x/i, ''), 16);
    return isNaN(n) ? null : n;
  }
  const v = a2lVars.find((v) => v.name === t);
  return v ? v.addr : null;
}

function EntryPopover({ listId, odtId, entryIdx, initial, anchor, onSave, onClose }: EntryPopoverProps) {
  const a2lVars  = useAppStore((s) => s.a2lVariables);
  const showToast = useAppStore((s) => s.showToast);
  const [name, setName] = useState(initial?.name ?? '');
  const [addr, setAddr] = useState(initial ? `0x${initial.addr.toString(16).padStart(8, '0').toUpperCase()}` : '');
  const [ext, setExt] = useState(String(initial?.addr_ext ?? 0));
  const [typeName, setTypeName] = useState<DaqEntryType>(initial?.type_name ?? 'u32');
  const [errors, setErrors] = useState<{ name?: boolean; addr?: boolean }>({});
  const [nameSuggs, setNameSuggs] = useState<A2lVariable[]>([]);
  const [nameSuggOpen, setNameSuggOpen] = useState(false);
  const [addrSuggs, setAddrSuggs] = useState<A2lVariable[]>([]);
  const [addrSuggOpen, setAddrSuggOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Label field: filter A2L suggestions by name
  useEffect(() => {
    if (!name.trim() || a2lVars.length === 0) { setNameSuggs([]); return; }
    const q = name.toLowerCase();
    setNameSuggs(a2lVars.filter(v => v.name.toLowerCase().includes(q)).slice(0, 8));
  }, [name, a2lVars]);

  // Address field: filter A2L suggestions when not a hex string
  useEffect(() => {
    const t = addr.trim();
    if (!t || /^0x/i.test(t) || a2lVars.length === 0) { setAddrSuggs([]); return; }
    const q = t.toLowerCase();
    setAddrSuggs(a2lVars.filter(v => v.name.toLowerCase().includes(q)).slice(0, 8));
    setAddrSuggOpen(true);
  }, [addr, a2lVars]);

  function selectNameSuggestion(v: A2lVariable) {
    setName(v.name);
    setAddr(`0x${v.addr.toString(16).padStart(8, '0').toUpperCase()}`);
    if (v.type) setTypeName(v.type);
    setNameSuggs([]);
    setNameSuggOpen(false);
    setErrors({});
  }

  function selectAddrSuggestion(v: A2lVariable) {
    setAddr(`0x${v.addr.toString(16).padStart(8, '0').toUpperCase()}`);
    if (v.type) setTypeName(v.type);
    setAddrSuggs([]);
    setAddrSuggOpen(false);
    setErrors(p => ({ ...p, addr: false }));
  }

  // Close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onClose]);

  function handleSave() {
    const addrTrim = addr.trim();
    const isHex = /^(?:0x)?[0-9a-fA-F]+$/i.test(addrTrim);
    const resolvedAddr = resolveEntryAddr(addr, a2lVars);
    const errs: { name?: boolean; addr?: boolean } = {};
    if (!name.trim()) errs.name = true;
    if (resolvedAddr === null) {
      errs.addr = true;
      if (!isHex) {
        showToast(
          a2lVars.length === 0
            ? 'No A2L file loaded — load one to resolve variable names'
            : 'Unknown variable name',
          'error'
        );
      }
    }
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    onSave(
      { name: name.trim(), addr: resolvedAddr!, addr_ext: Number(ext) || 0, size: TYPE_SIZES[typeName], type_name: typeName },
      listId, odtId, entryIdx
    );
  }

  // Smart positioning: prefer below anchor, flip above if not enough room
  const POPUP_H = (nameSuggs.length > 0 && nameSuggOpen) || (addrSuggs.length > 0 && addrSuggOpen) ? 340 : 268;
  const POPUP_W = 244;
  const MARGIN = 8;
  const below = anchor.y + MARGIN;
  let top: number;
  if (below + POPUP_H < window.innerHeight - MARGIN) {
    top = below;
  } else {
    const above = anchor.y - POPUP_H - MARGIN;
    top = above >= MARGIN ? above : Math.max(MARGIN, window.innerHeight - POPUP_H - MARGIN);
  }
  let left = anchor.x;
  if (left + POPUP_W > window.innerWidth - MARGIN) left = anchor.x - POPUP_W;
  left = Math.max(MARGIN, left);

  const style: React.CSSProperties = { position: 'fixed', top, left, width: POPUP_W, zIndex: 9998 };

  const inputCls = (err?: boolean) =>
    `w-full px-2 py-1 bg-gray-800 rounded text-xs text-gray-200 focus:outline-none border ${
      err ? 'border-red-500 focus:border-red-400' : 'border-gray-700 focus:border-blue-500'
    }`;

  return createPortal(
    <div ref={popRef} style={style} className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2 flex items-center gap-1.5"><Rows size={13} />ODT Entry</p>
      <div className="space-y-2">
        <div className="relative">
          <label className="text-[10px] text-gray-500 block mb-0.5">Label</label>
          <input
            ref={nameInputRef}
            value={name}
            onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: false })); setNameSuggOpen(true); }}
            onFocus={() => setNameSuggOpen(true)}
            onBlur={() => setTimeout(() => setNameSuggOpen(false), 120)}
            placeholder="EngineRPM"
            className={inputCls(errors.name)}
          />
          {errors.name && <p className="text-[9px] text-red-400 mt-0.5">Label is required</p>}
          {nameSuggOpen && nameSuggs.length > 0 && (
            <div className="absolute z-10 left-0 right-0 top-full mt-0.5 bg-gray-800 border border-gray-700 rounded shadow-xl max-h-36 overflow-y-auto">
              {nameSuggs.map(v => (
                <div
                  key={v.name}
                  className="flex items-center justify-between px-2 py-1 hover:bg-gray-700 cursor-pointer transition-colors"
                  onMouseDown={e => { e.preventDefault(); selectNameSuggestion(v); }}
                >
                  <span className="text-xs text-gray-200 truncate">{v.name}</span>
                  <span className="text-[10px] text-gray-500 font-mono ml-2 shrink-0">
                    0x{v.addr.toString(16).toUpperCase().padStart(8, '0')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <label className="text-[10px] text-gray-500 block mb-0.5">Address</label>
            <input value={addr}
              onChange={e => { setAddr(e.target.value); setErrors(p => ({ ...p, addr: false })); setAddrSuggOpen(true); }}
              onBlur={() => setTimeout(() => setAddrSuggOpen(false), 120)}
              placeholder="0x... or VarName"
              className={`font-mono ${inputCls(errors.addr)}`} />
            {errors.addr && <p className="text-[9px] text-red-400 mt-0.5">Invalid address or unknown variable</p>}
            {addrSuggOpen && addrSuggs.length > 0 && (
              <div className="absolute z-10 left-0 right-0 top-full mt-0.5 bg-gray-800 border border-gray-700 rounded shadow-xl max-h-36 overflow-y-auto">
                {addrSuggs.map(v => (
                  <div
                    key={v.name}
                    className="flex items-center justify-between px-2 py-1 hover:bg-gray-700 cursor-pointer transition-colors"
                    onMouseDown={e => { e.preventDefault(); selectAddrSuggestion(v); }}
                  >
                    <span className="text-xs text-gray-200 truncate">{v.name}</span>
                    <span className="text-[10px] text-gray-500 font-mono ml-2 shrink-0">
                      0x{v.addr.toString(16).toUpperCase().padStart(8, '0')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ width: 48 }}>
            <label className="text-[10px] text-gray-500 block mb-0.5">Ext</label>
            <input value={ext} onChange={e => setExt(e.target.value)} placeholder="0"
              className={`font-mono ${inputCls()}`} />
          </div>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block mb-0.5">Type</label>
          <select value={typeName} onChange={e => setTypeName(e.target.value as DaqEntryType)}
            className={inputCls()}>
            {(['u8','u16','u32','i8','i16','i32','f32','f64'] as DaqEntryType[]).map(t => (
              <option key={t} value={t}>{t} ({TYPE_SIZES[t]}B)</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-1.5 mt-3">
        <button onClick={handleSave}
          className="flex-1 py-1 rounded text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center justify-center gap-1.5">
          <FloppyDisk size={14} />Save
        </button>
        <button onClick={onClose}
          className="px-3 py-1 rounded text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 border border-gray-700 transition-colors">
          Cancel
        </button>
      </div>
    </div>,
    document.body
  );
}

// ── DAQ List Tree ────────────────────────────────────────────────
interface TreeProps {
  lists: DaqList[];
  odtColors: Record<string, string>;
  onOdtColorChange: (listId: number, odtId: number, color: string) => void;
  onAddList: () => void;
  onDeleteList: (listId: number) => void;
  onDeleteOdt: (listId: number, odtId: number) => void;
  onSetEvent: (listId: number, ch: number) => void;
  onAddOdt: (listId: number) => void;
  onSaveEntry: (entry: DaqEntry, listId: number, odtId: number, entryIdx: number | null) => void;
  onDeleteEntry: (listId: number, odtId: number, entryIdx: number) => void;
  onRenameList: (listId: number, name: string | undefined) => void;
  onRenameOdt: (listId: number, odtId: number, name: string | undefined) => void;
  onMoveEntry: (listId: number, odtId: number, fromIdx: number, toIdx: number) => void;
}

function DaqTree({ lists, odtColors, onOdtColorChange, onAddList, onDeleteList, onDeleteOdt, onSetEvent, onAddOdt, onSaveEntry, onDeleteEntry, onRenameList, onRenameOdt, onMoveEntry }: TreeProps) {
  const storeEvents = useAppStore(s => s.events);
  const events = storeEvents.length > 0 ? storeEvents : [
    { id: 1, name: '1 ms' }, { id: 2, name: '10 ms' }, { id: 3, name: '100 ms' },
    { id: 4, name: '1 s' }, { id: 5, name: '10 s' },
  ];
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [exitingLists,   setExitingLists]   = useState<Set<number>>(new Set());
  const [exitingOdts,    setExitingOdts]    = useState<Set<string>>(new Set());
  const [exitingEntries, setExitingEntries] = useState<Set<string>>(new Set());
  const [popover, setPopover] = useState<{ listId: number; odtId: number; entryIdx: number | null; initial?: DaqEntry; anchor: { x: number; y: number } } | null>(null);
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [colorPicker, setColorPicker] = useState<{ listId: number; odtId: number; x: number; y: number } | null>(null);
  const [dragEntry, setDragEntry] = useState<{ listId: number; odtId: number; fromIdx: number } | null>(null);
  const dragEntryRef = useRef<{ listId: number; odtId: number; fromIdx: number } | null>(null);
  const [dropOver, setDropOver] = useState<{ listId: number; odtId: number; toIdx: number; above: boolean } | null>(null);
  const dropOverRef = useRef<{ listId: number; odtId: number; toIdx: number; above: boolean } | null>(null);
  const [recentlyMoved, setRecentlyMoved] = useState<string | null>(null);
  const listsRef      = useRef(lists);
  const entryElsRef   = useRef<Map<string, HTMLElement>>(new Map());
  const prevEntryYRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (renamingKey && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingKey]);

  useEffect(() => {
    if (!colorPicker) return;
    function onDown(e: MouseEvent) {
      if (!(e.target as Element).closest('#daq-tree-color-picker')) setColorPicker(null);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [colorPicker]);

  // Keep listsRef in sync so the pointer-up handler can read entry names
  useEffect(() => { listsRef.current = lists; }, [lists]);

  // Pointer-event based drag (replaces HTML5 drag-and-drop which is unreliable in webkit2gtk)
  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      if (!dragEntryRef.current) return;
      const ds = dragEntryRef.current;
      const els = document.elementsFromPoint(e.clientX, e.clientY);
      const entryEl = els.find(
        (el) => (el as HTMLElement).dataset?.entryIdx !== undefined
      ) as HTMLElement | undefined;
      if (!entryEl) return;
      const lId  = parseInt(entryEl.dataset.entryList ?? '');
      const oId  = parseInt(entryEl.dataset.entryOdt  ?? '');
      const eIdx = parseInt(entryEl.dataset.entryIdx  ?? '');
      if (isNaN(lId) || isNaN(oId) || isNaN(eIdx) || lId !== ds.listId || oId !== ds.odtId) return;
      const rect  = entryEl.getBoundingClientRect();
      const above = e.clientY < rect.top + rect.height / 2;
      const val   = { listId: lId, odtId: oId, toIdx: eIdx, above };
      dropOverRef.current = val;
      setDropOver(val);
    }

    function onPointerUp() {
      if (!dragEntryRef.current) return;
      const de  = dragEntryRef.current;
      const dov = dropOverRef.current;
      dragEntryRef.current = null;
      dropOverRef.current  = null;
      document.body.style.cursor    = '';
      document.body.style.userSelect = '';
      setDragEntry(null);
      setDropOver(null);
      if (!dov || dov.listId !== de.listId || dov.odtId !== de.odtId) return;
      const { fromIdx } = de;
      const raw   = dov.above ? dov.toIdx : dov.toIdx + 1;
      const toIdx = raw > fromIdx ? raw - 1 : raw;
      if (toIdx === fromIdx) return;
      const lst  = listsRef.current.find(l => l.id === de.listId);
      const odt  = lst?.odts.find(o => o.id === de.odtId);
      const name = odt?.entries[fromIdx]?.name ?? '';
      setRecentlyMoved(`${de.listId}:${de.odtId}:${name}`);
      setTimeout(() => setRecentlyMoved(null), 450);
      onMoveEntry(de.listId, de.odtId, fromIdx, toIdx);
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup',   onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup',   onPointerUp);
    };
  }, [onMoveEntry]);

  // FLIP for entry reorder: snapshot-before is stored in prevEntryYRef from the previous render.
  // After React commits the new list order, useLayoutEffect reads old vs new Y and plays the
  // inverse-translate trick. transitionend cleans up inline styles so they don't ghost later.
  useLayoutEffect(() => {
    const prev = prevEntryYRef.current;
    const next = new Map<string, number>();
    for (const [key, el] of entryElsRef.current) {
      const currentY = el.getBoundingClientRect().top;
      next.set(key, currentY);
      const oldY = prev.get(key);
      if (oldY === undefined) continue;           // newly added entry — no animation
      const dy = oldY - currentY;
      if (Math.abs(dy) < 1) continue;
      el.style.transition = 'none';
      el.style.transform  = `translateY(${dy}px)`;
      void el.offsetHeight;                       // synchronous reflow: lock in "from" state
      el.style.transition = 'transform 220ms cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      el.style.transform  = '';
      el.addEventListener('transitionend', function onEnd(ev: Event) {
        if ((ev as TransitionEvent).propertyName !== 'transform') return;
        el.style.transition = '';
        el.removeEventListener('transitionend', onEnd);
      });
    }
    prevEntryYRef.current = next;
  }, [lists]);

  function toggleCollapse(key: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function startRename(key: string, currentName: string) {
    setRenamingKey(key);
    setRenameValue(currentName);
  }

  function commitRename() {
    if (!renamingKey) return;
    const trimmed = renameValue.trim();
    if (renamingKey.startsWith('list-')) {
      onRenameList(parseInt(renamingKey.slice(5)), trimmed || undefined);
    } else {
      const rest = renamingKey.slice(4);
      const dash = rest.indexOf('-');
      onRenameOdt(parseInt(rest.slice(0, dash)), parseInt(rest.slice(dash + 1)), trimmed || undefined);
    }
    setRenamingKey(null);
  }

  function cancelRename() { setRenamingKey(null); }

  const ANIM_MS = 160;

  function handleDeleteList(listId: number) {
    setExitingLists(s => new Set(s).add(listId));
    setTimeout(() => {
      onDeleteList(listId);
      setExitingLists(s => { const n = new Set(s); n.delete(listId); return n; });
    }, ANIM_MS);
  }

  function handleDeleteOdt(listId: number, odtId: number) {
    const key = `${listId}:${odtId}`;
    setExitingOdts(s => new Set(s).add(key));
    setTimeout(() => {
      onDeleteOdt(listId, odtId);
      setExitingOdts(s => { const n = new Set(s); n.delete(key); return n; });
    }, ANIM_MS);
  }

  function handleDeleteEntry(listId: number, odtId: number, ei: number) {
    const key = `${listId}:${odtId}:${ei}`;
    setExitingEntries(s => new Set(s).add(key));
    setTimeout(() => {
      onDeleteEntry(listId, odtId, ei);
      setExitingEntries(s => { const n = new Set(s); n.delete(key); return n; });
    }, ANIM_MS);
  }

  function saveEntry(entry: DaqEntry, listId: number, odtId: number, entryIdx: number | null) {
    onSaveEntry(entry, listId, odtId, entryIdx);
    setPopover(null);
  }

  const totalEntries = lists.reduce((s, l) => s + l.odts.reduce((ss, o) => ss + o.entries.length, 0), 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 h-8 border-b border-gray-800 shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 flex items-center gap-1.5"><Database size={18} />DAQ Lists</span>
        <button onClick={onAddList} className="flex items-center gap-1 text-[10px] font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 px-2 py-0.5 rounded transition-colors">
          <Plus size={12} /> Add List
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {lists.length === 0 && (
          <p className="text-center text-gray-700 text-xs py-6">No DAQ lists. Click + Add List.</p>
        )}
        {lists.map((list) => {
          const lKey = `list-${list.id}`;
          const lCollapsed = collapsed.has(lKey);
          return (
            <div key={list.id} className={`daq-list-card mb-1.5${exitingLists.has(list.id) ? ' daq-exiting' : ''}`}>
              {/* List header */}
              <div className="daq-list-header group" onClick={(e) => { if (!(e.target as Element).closest('[data-no-collapse]')) toggleCollapse(lKey); }}>
                <span className="text-gray-500 text-[10px] w-3 shrink-0">{lCollapsed ? '▸' : '▾'}</span>
                {renamingKey === lKey ? (
                  <input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={e => { if (e.key === 'Enter') commitRename(); else if (e.key === 'Escape') cancelRename(); }}
                    onClick={e => e.stopPropagation()}
                    className="px-1 bg-gray-800 border border-blue-500 rounded text-[11px] text-gray-200 focus:outline-none min-w-[4ch] max-w-[20ch]"
                    style={{ width: `${Math.max(4, renameValue.length + 2)}ch` }}
                  />
                ) : (
                  <div className="flex items-center gap-1 flex-1 min-w-0" data-no-collapse="">
                    <span
                      className="text-gray-300 text-[11px] font-semibold truncate cursor-text"
                      onDoubleClick={e => { e.stopPropagation(); startRename(lKey, list.name ?? `List ${list.id}`); }}
                    >
                      {list.name ?? `List ${list.id}`}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); startRename(lKey, list.name ?? `List ${list.id}`); }}
                      className="text-gray-700 hover:text-blue-400 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                      title="Rename list"
                    ><PencilSimple size={12} /></button>
                  </div>
                )}
                <select
                  value={list.event_channel}
                  onClick={e => e.stopPropagation()}
                  onChange={e => { e.stopPropagation(); onSetEvent(list.id, Number(e.target.value)); }}
                  className="px-1 py-0 bg-gray-900 border border-gray-700 rounded text-[10px] font-mono text-gray-400 focus:outline-none focus:border-blue-500 shrink-0"
                >
                  {events.map(ev => {
                    const hex = `0x${ev.id.toString(16).padStart(2, '0').toUpperCase()}`;
                    return <option key={ev.id} value={ev.id}>{hex} — {ev.name}</option>;
                  })}
                </select>
                <button
                  onClick={e => { e.stopPropagation(); handleDeleteList(list.id); }}
                  className="ml-1 text-gray-600 hover:text-red-400 transition-colors shrink-0"
                ><X size={12} /></button>
              </div>

              {/* Animated list body */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateRows: lCollapsed ? '0fr' : '1fr',
                  opacity: lCollapsed ? 0 : 1,
                  transition: 'grid-template-rows 200ms ease, opacity 150ms ease',
                }}
              >
                <div style={{ minHeight: 0, overflow: 'hidden' }}>
                  <div className="daq-list-body">
                    {list.odts.map(odt => {
                      const oKey = `${list.id}-${odt.id}`;
                      const oRenameKey = `odt-${list.id}-${odt.id}`;
                      const oCollapsed = collapsed.has(oKey);
                      return (
                        <div key={odt.id} className={`daq-odt-card${exitingOdts.has(`${list.id}:${odt.id}`) ? ' daq-exiting' : ''}`}>
                          <div className="daq-odt-header group" onClick={(e) => { if (!(e.target as Element).closest('[data-no-collapse]')) toggleCollapse(oKey); }}>
                            <span className="w-3 shrink-0">{oCollapsed ? '▸' : '▾'}</span>
                            <button
                              data-no-collapse=""
                              className="w-2 h-2 rounded-full shrink-0 cursor-pointer hover:scale-125 transition-transform"
                              style={{ background: odtColors[`${list.id}:${odt.id}`] ?? ODT_COLORS[0] }}
                              title="Click to change ODT color"
                              onClick={e => { e.stopPropagation(); setColorPicker(prev => prev?.listId === list.id && prev.odtId === odt.id ? null : { listId: list.id, odtId: odt.id, x: e.clientX + 6, y: e.clientY + 6 }); }}
                            />
                            {renamingKey === oRenameKey ? (
                              <input
                                ref={renameInputRef}
                                value={renameValue}
                                onChange={e => setRenameValue(e.target.value)}
                                onBlur={commitRename}
                                onKeyDown={e => { if (e.key === 'Enter') commitRename(); else if (e.key === 'Escape') cancelRename(); }}
                                onClick={e => e.stopPropagation()}
                                className="px-1 bg-gray-800 border border-blue-500 rounded text-[10px] text-gray-200 focus:outline-none min-w-[4ch] max-w-[18ch]"
                                style={{ width: `${Math.max(4, renameValue.length + 2)}ch` }}
                              />
                            ) : (
                              <div className="flex items-center gap-1 flex-1 min-w-0" data-no-collapse="">
                                <span
                                  className="truncate cursor-text"
                                  onDoubleClick={e => { e.stopPropagation(); startRename(oRenameKey, odt.name ?? `ODT ${odt.id}`); }}
                                >
                                  {odt.name ?? `ODT ${odt.id}`}
                                </span>
                                <button
                                  onClick={e => { e.stopPropagation(); startRename(oRenameKey, odt.name ?? `ODT ${odt.id}`); }}
                                  className="text-gray-700 hover:text-blue-400 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                                  title="Rename ODT"
                                ><PencilSimple size={12} /></button>
                              </div>
                            )}
                            <span className="text-gray-600 shrink-0">{odt.entries.length} entries</span>
                            <button
                              onClick={e => { e.stopPropagation(); handleDeleteOdt(list.id, odt.id); }}
                              className="ml-1 text-gray-600 hover:text-red-400 transition-colors shrink-0"
                              title="Delete ODT"
                            ><X size={12} /></button>
                          </div>

                          {/* Animated ODT body */}
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateRows: oCollapsed ? '0fr' : '1fr',
                              opacity: oCollapsed ? 0 : 1,
                              transition: 'grid-template-rows 180ms ease, opacity 130ms ease',
                            }}
                          >
                            <div style={{ minHeight: 0, overflow: 'hidden' }}>
                              <div className="daq-odt-body" style={{ position: 'relative' }}>
                                {/* Sliding drop indicator — glides between positions as you drag */}
                                {(() => {
                                  if (!dragEntry || dragEntry.listId !== list.id || dragEntry.odtId !== odt.id) return null;
                                  if (!dropOver  || dropOver.listId  !== list.id || dropOver.odtId  !== odt.id) return null;
                                  const { fromIdx } = dragEntry;
                                  const raw = dropOver.above ? dropOver.toIdx : dropOver.toIdx + 1;
                                  const effectiveToIdx = raw > fromIdx ? raw - 1 : raw;
                                  if (effectiveToIdx === fromIdx) return null;
                                  const lineIdx = fromIdx < effectiveToIdx ? effectiveToIdx + 1 : effectiveToIdx;
                                  const firstKey = `${list.id}:${odt.id}:${odt.entries[0]?.name ?? ''}`;
                                  const entryH   = entryElsRef.current.get(firstKey)?.offsetHeight ?? 24;
                                  return (
                                    <div style={{
                                      position: 'absolute', left: 0, right: 0,
                                      top: lineIdx * entryH,
                                      height: 2,
                                      background: '#60a5fa',
                                      borderRadius: 1,
                                      transition: 'top 130ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                                      pointerEvents: 'none',
                                      zIndex: 10,
                                    }}>
                                      <div style={{
                                        position: 'absolute', left: 2, top: '50%',
                                        transform: 'translateY(-50%)',
                                        width: 7, height: 7, borderRadius: '50%',
                                        background: '#60a5fa',
                                      }} />
                                    </div>
                                  );
                                })()}
                                {odt.entries.map((entry, ei) => {
                                  const isDragging = dragEntry?.listId === list.id && dragEntry?.odtId === odt.id && dragEntry?.fromIdx === ei;
                                  const movedKey = `${list.id}:${odt.id}:${entry.name}`;
                                  return (
                                  <div
                                    key={entry.name}
                                    ref={(el) => {
                                      const k = `${list.id}:${odt.id}:${entry.name}`;
                                      if (el) entryElsRef.current.set(k, el);
                                      else    entryElsRef.current.delete(k);
                                    }}
                                    data-entry-list={list.id}
                                    data-entry-odt={odt.id}
                                    data-entry-idx={ei}
                                    className={`daq-entry-row group${exitingEntries.has(`${list.id}:${odt.id}:${ei}`) ? ' daq-exiting' : ''}${isDragging ? ' opacity-40' : ''}${recentlyMoved === movedKey ? ' daq-moved' : ''}`}
                                    onClick={(e) => {
                                      if (dragEntryRef.current) return;
                                      setPopover({ listId: list.id, odtId: odt.id, entryIdx: ei, initial: entry, anchor: { x: e.clientX, y: e.clientY } });
                                    }}
                                  >
                                    <span
                                      className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 shrink-0 cursor-grab active:cursor-grabbing select-none leading-none"
                                      onPointerDown={(e) => {
                                        if (e.button !== 0) return;
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const val = { listId: list.id, odtId: odt.id, fromIdx: ei };
                                        dragEntryRef.current = val;
                                        setDragEntry(val);
                                        document.body.style.cursor    = 'grabbing';
                                        document.body.style.userSelect = 'none';
                                      }}
                                    ><DotsSixVertical size={13} /></span>
                                    <span className="shrink-0 leading-none" style={{ color: odtColors[`${list.id}:${odt.id}`] ?? ODT_COLORS[0] }}><Waveform size={12} /></span>
                                    <span className="text-gray-300 text-[11px] flex-1 truncate">{entry.name}</span>
                                    <span className="font-mono text-gray-500 text-[10px] shrink-0">{entry.type_name}</span>
                                    <button
                                      className="ml-0.5 text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                                      onClick={e => { e.stopPropagation(); handleDeleteEntry(list.id, odt.id, ei); }}
                                    ><X size={12} /></button>
                                  </div>
                                  );
                                })}
                                <div className="px-2 py-1">
                                  <button
                                    onClick={e => setPopover({ listId: list.id, odtId: odt.id, entryIdx: null, anchor: { x: e.clientX, y: e.clientY } })}
                                    className="flex items-center gap-1 text-[10px] text-gray-600 hover:text-blue-400 transition-colors"
                                  >
                                    <Plus size={12} /> Add Entry
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <button onClick={() => onAddOdt(list.id)}
                      className="flex items-center gap-1 text-[10px] text-gray-600 hover:text-blue-400 transition-colors px-1 py-0.5 mt-0.5">
                      <Plus size={12} /> Add ODT
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="px-3 py-1.5 border-t border-gray-800 shrink-0">
        <span className="text-[10px] text-gray-500 font-mono">
          <DaqAnimNum value={lists.length} /> lists · <DaqAnimNum value={totalEntries} /> signals
        </span>
      </div>

      {/* Entry popover (rendered via portal in EntryPopover itself) */}
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

      {/* Color picker portal */}
      {colorPicker && createPortal(
        <div
          id="daq-tree-color-picker"
          className="fixed bg-gray-900 border border-gray-700 rounded-lg p-2.5 shadow-2xl z-[9999]"
          style={{ top: colorPicker.y, left: colorPicker.x }}
        >
          <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-2">ODT Color</p>
          <div className="flex gap-1.5">
            {ODT_COLORS.map(c => {
              const key = `${colorPicker.listId}:${colorPicker.odtId}`;
              return (
                <button
                  key={c}
                  className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${odtColors[key] === c ? 'ring-2 ring-white ring-offset-1 ring-offset-gray-900 scale-110' : ''}`}
                  style={{ background: c }}
                  onClick={() => { onOdtColorChange(colorPicker.listId, colorPicker.odtId, c); setColorPicker(null); }}
                />
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Live Values Table ─────────────────────────────────────────────
interface LiveTableProps {
  lists: DaqList[];
  odtColors: Record<string, string>;
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

const EXPAND_STAGGER  = 55;   // ms between each row fading in
const EXPAND_FADE_DUR = 200;  // row fade-in duration
const PLOT_REVEAL_DUR = 420;  // plot clip-reveal duration
const PLOT_OFFSET     = 120;  // extra ms before plot starts (after row begins)
const ROW_ENTER_DUR   = 280;  // daq-row-enter animation duration

function DaqLiveTable({ lists, odtColors }: LiveTableProps) {
  const liveValues = useAppStore(s => s.daqLiveValues);
  const [colWidths, setColWidths] = useState(DEFAULT_COL_WIDTHS);
  const [animatedKeys, setAnimatedKeys] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(40);
  const [collapsedLists, setCollapsedLists] = useState<Set<number>>(new Set());
  const [expandingLists, setExpandingLists] = useState<Set<number>>(new Set());
  const prevKeysRef  = useRef<Set<string>>(new Set());
  const rowElsRef    = useRef<Map<string, HTMLElement>>(new Map());
  const prevRowYRef  = useRef<Map<string, number>>(new Map());

  // Stable zoom handler passed to each Sparkline
  const handleZoom = useCallback((dir: number) => {
    setZoom(p => Math.max(5, Math.min(200, p + dir * 10)));
  }, []);

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

  // Group rows by list for rendering
  const rowsByList = useMemo(() =>
    lists
      .map(list => ({ list, rows: rows.filter(r => r.listId === list.id) }))
      .filter(g => g.rows.length > 0),
    [lists, rows] // eslint-disable-line react-hooks/exhaustive-deps
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

  // FLIP for live-table rows — same prevYRef pattern as DaqTree
  useLayoutEffect(() => {
    const prev = prevRowYRef.current;
    const next = new Map<string, number>();
    for (const [key, el] of rowElsRef.current) {
      const currentY = el.getBoundingClientRect().top;
      next.set(key, currentY);
      const oldY = prev.get(key);
      if (oldY === undefined) continue;
      const dy = oldY - currentY;
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
    prevRowYRef.current = next;
  }, [lists]);

  function startResize(col: keyof typeof DEFAULT_COL_WIDTHS, e: ReactMouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = colWidths[col];
    function onMove(ev: MouseEvent) {
      setColWidths(prev => ({ ...prev, [col]: Math.max(50, startWidth + ev.clientX - startX) }));
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function formatValue(v: number | null, type: DaqEntryType): string {
    if (v === null) return '—';
    if (type === 'f32' || type === 'f64') return v.toFixed(4);
    return String(v);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 h-8 border-b border-gray-800 shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 flex items-center gap-1.5"><ChartLine size={18} />Live Values</span>
        <span className="text-[10px] text-gray-600 font-mono flex items-center gap-1"><MagnifyingGlass size={12} />{zoom} pts</span>
      </div>
      <div className="flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-700 text-xs">
            <Database size={32} className="mb-2 opacity-40" />
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
              <col />
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
                    <div
                      className="absolute inset-y-0 right-0 w-1 cursor-col-resize hover:bg-blue-500/40 active:bg-blue-500/60"
                      onMouseDown={(e) => startResize(col, e)}
                    />
                  </th>
                ))}
                <th className="px-3 py-1.5">Plot</th>
              </tr>
            </thead>
            <tbody>
              {rowsByList.map(({ list, rows: listRows }, gi) => {
                const isCollapsed = collapsedLists.has(list.id);
                return (
                  <Fragment key={list.id}>
                    {/* List group header — click to collapse */}
                    <tr>
                      <td
                        colSpan={6}
                        className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-800 cursor-pointer select-none hover:bg-gray-800/40 transition-colors bg-gray-900/70 ${gi > 0 ? 'border-t border-t-gray-700' : ''}`}
                        onClick={() => {
                          const wasCollapsed = collapsedLists.has(list.id);
                          setCollapsedLists(prev => {
                            const next = new Set(prev);
                            if (next.has(list.id)) next.delete(list.id); else next.add(list.id);
                            return next;
                          });
                          if (wasCollapsed) {
                            setExpandingLists(e => new Set([...e, list.id]));
                            setTimeout(() => {
                              setExpandingLists(e => { const n = new Set(e); n.delete(list.id); return n; });
                            }, 50 + listRows.length * EXPAND_STAGGER + EXPAND_FADE_DUR + PLOT_REVEAL_DUR + 100);
                          }
                        }}
                      >
                        <span className="mr-1 inline-block">{isCollapsed ? '▸' : '▾'}</span>
                        {list.name ?? `List ${list.id}`}
                      </td>
                    </tr>
                    {/* Animated rows wrapper */}
                    <tr>
                      <td colSpan={6} style={{ padding: 0, border: 0 }}>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateRows: isCollapsed ? '0fr' : '1fr',
                            transition: 'grid-template-rows 200ms ease',
                          }}
                        >
                          <div style={{ minHeight: 0, overflow: 'hidden' }}>
                            {listRows.map((row, ri) => {
                              const isAnimating  = animatedKeys.has(row.key);
                              const isExpanding  = expandingLists.has(list.id);
                              const rowColor     = odtColors[`${row.listId}:${row.odtId}`] ?? ODT_COLORS[0];
                              const rowBaseDelay = isExpanding ? 50 + ri * EXPAND_STAGGER : ri * 40;
                              const rowStyle: React.CSSProperties | undefined =
                                isAnimating ? { animationDelay: `${ri * 40}ms` } :
                                isExpanding ? { animation: `daq-row-fade-in ${EXPAND_FADE_DUR}ms ease-out both`, animationDelay: `${rowBaseDelay}ms` } :
                                undefined;
                              const plotStyle: React.CSSProperties | undefined =
                                (isAnimating || isExpanding) ? {
                                  animation: `daq-plot-reveal ${PLOT_REVEAL_DUR}ms ease-out both`,
                                  animationDelay: `${rowBaseDelay + (isAnimating ? ROW_ENTER_DUR - 30 : PLOT_OFFSET)}ms`,
                                } : undefined;
                              return (
                                <div
                                  key={row.key}
                                  ref={(el) => { if (el) rowElsRef.current.set(row.key, el); else rowElsRef.current.delete(row.key); }}
                                  className={`flex border-b border-gray-800/40 hover:bg-gray-800/30 transition-colors text-xs font-mono ${isAnimating ? 'daq-row-enter' : ''}`}
                                  style={rowStyle}
                                >
                                  <div className="px-3 py-1.5 text-gray-300 truncate overflow-hidden" style={{ width: colWidths.signal, flexShrink: 0 }}>{row.entry.name}</div>
                                  <div className={`px-3 py-1.5 tabular-nums ${row.value !== null ? 'text-green-400' : 'text-gray-600'}`} style={{ width: colWidths.value, flexShrink: 0 }}>{formatValue(row.value, row.entry.type_name)}</div>
                                  <div className="px-3 py-1.5 text-gray-500" style={{ width: colWidths.type, flexShrink: 0 }}>{row.entry.type_name}</div>
                                  <div className="px-3 py-1.5 text-gray-500" style={{ width: colWidths.address, flexShrink: 0 }}>0x{row.entry.addr.toString(16).padStart(8, '0').toUpperCase()}</div>
                                  <div className="px-3 py-1.5 text-gray-600" style={{ width: colWidths.listOdt, flexShrink: 0 }}>{row.listId}/{row.odtId}</div>
                                  <div className="px-2 py-1 flex-1 min-w-0" style={plotStyle}>
                                    <Sparkline history={row.history} color={rowColor} zoom={zoom} onZoomChange={handleZoom} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}
// ── Directional animated DTO rate counter ────────────────────────
function DtoRateCount({ value }: { value: number }) {
  const [displayed, setDisplayed] = useState(value);
  const [animKey,   setAnimKey]   = useState(0);
  const [animCls,   setAnimCls]   = useState('');
  const prevRef = useRef(value);
  const timer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value === prevRef.current) return;
    const up = value > prevRef.current;
    prevRef.current = value;
    setDisplayed(value);
    setAnimKey(k => k + 1);
    setAnimCls(up ? 'count-tick' : 'count-enter-from-top');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAnimCls(''), 260);
  }, [value]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <span key={animKey} className={animCls} style={{ display: 'inline-block', overflow: 'hidden' }}>
      {displayed}
    </span>
  );
}

interface ToolbarProps {
  lists: DaqList[];
  configuring: boolean;
  onConfigure: () => void;
  onStart: () => void;
  onStop: () => void;
  onFree: () => void;
  onSave: () => void;
  onLoad: (file: File) => void;
}

function DaqToolbar({ lists, configuring, onConfigure, onStart, onStop, onFree, onSave, onLoad }: ToolbarProps) {
  const daqStatus = useAppStore(s => s.daqStatus);
  const connected = useAppStore(s => s.connected);
  const daqDtoRate = useAppStore(s => s.daqDtoRate);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [wrenchKey,         setWrenchKey]         = useState(0);
  const [playPopKey,        setPlayPopKey]         = useState(0);
  const [stopPopKey,        setStopPopKey]         = useState(0);
  const [freeConfirmOpen,   setFreeConfirmOpen]    = useState(false);
  const [freeConfirmExiting,setFreeConfirmExiting] = useState(false);

  const CONFIRM_EXIT_MS = 130;
  function closeConfirm() {
    setFreeConfirmExiting(true);
    setTimeout(() => { setFreeConfirmOpen(false); setFreeConfirmExiting(false); }, CONFIRM_EXIT_MS);
  }
  const prevStatusRef = useRef(daqStatus);

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = daqStatus;
    if (prev === 'idle'       && daqStatus === 'configured') setWrenchKey(k => k + 1);
    if (prev === 'configured' && daqStatus === 'running')    setPlayPopKey(k => k + 1);
    if (prev === 'running'    && daqStatus === 'configured') setStopPopKey(k => k + 1);
  }, [daqStatus]);

  const canConfigure = !configuring && daqStatus === 'idle' && connected && lists.some(l => l.odts.some(o => o.entries.length > 0));
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
    <div className="flex items-center gap-2 px-4 h-9 border-b border-gray-800 bg-gray-900/60 shrink-0">
      <input
        ref={fileInputRef}
        type="file"
        accept=".daq,.json"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) { onLoad(file); e.target.value = ''; }
        }}
      />
      {/* Status */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className={`w-2 h-2 rounded-full shrink-0 ${ledClass}`} />
        <span className={`text-[10px] w-16 ${stateLabelCls}`}>{stateLabel}</span>
      </div>
      <div className="w-px h-4 bg-gray-800" />

      {/* Free All */}
      <button
        onClick={() => setFreeConfirmOpen(true)}
        disabled={!canFree}
        className={`h-6 px-2.5 rounded text-[10px] font-medium flex items-center gap-1.5 border transition-colors ${
          canFree
            ? 'text-gray-400 border-gray-700 bg-gray-800 hover:bg-gray-700 cursor-pointer'
            : 'text-gray-600 border-gray-800 bg-gray-900 cursor-not-allowed opacity-40'
        }`}
      >
        <Trash size={18} />Free All
      </button>
      <div className="w-px h-4 bg-gray-800" />

      {/* Configure */}
      <button
        onClick={onConfigure}
        disabled={!canConfigure}
        className={`h-6 px-2.5 rounded text-[10px] font-medium flex items-center gap-1.5 border transition-colors text-blue-400 border-blue-500/30 bg-blue-500/10 ${
          canConfigure ? 'hover:bg-blue-500/20 cursor-pointer' : 'opacity-40 cursor-not-allowed'
        }`}
      >
        {configuring ? (
          <>
            <svg className="animate-spin" width="10" height="10" viewBox="0 0 10 10" fill="none">
              <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.3" />
              <path d="M5 1a4 4 0 0 1 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Configuring DAQ
          </>
        ) : <><Wrench key={wrenchKey} size={18} className={wrenchKey > 0 ? 'icon-wrench-crank' : ''} />Configure</>}
      </button>

      {/* Play */}
      <button
        onClick={onStart}
        disabled={!canStart}
        title="Start DAQ"
        className={`w-6 h-6 rounded flex items-center justify-center border transition-colors text-green-400 border-green-500/30 bg-green-500/10 ${
          canStart ? 'hover:bg-green-500/20 cursor-pointer' : 'opacity-40 cursor-not-allowed'
        }`}
      ><Play key={playPopKey} size={14} className={playPopKey > 0 ? 'icon-pop' : ''} /></button>

      {/* Stop */}
      <button
        onClick={onStop}
        disabled={!canStop}
        title="Stop DAQ"
        className={`w-6 h-6 rounded flex items-center justify-center border transition-colors text-red-400 border-red-500/30 bg-red-500/10 ${
          canStop ? 'hover:bg-red-500/20 cursor-pointer' : 'opacity-40 cursor-not-allowed'
        }`}
      ><Stop key={stopPopKey} size={14} className={stopPopKey > 0 ? 'icon-pop' : ''} /></button>

      <div className="flex-1" />

      {/* DTO rate */}
      <span className="text-[10px] text-gray-600 font-mono flex items-center gap-1">
        <Pulse size={13} />{daqDtoRate} DTOs / s
      </span>

      <div className="w-px h-4 bg-gray-800" />

      {/* Export / Import */}
      <button
        onClick={onSave}
        title="Export DAQ lists to .daq file"
        className="h-6 px-2.5 rounded text-[10px] font-medium flex items-center gap-1.5 border transition-colors text-gray-400 border-gray-700 bg-gray-800 hover:bg-gray-700 cursor-pointer"
      >
        <ArrowSquareOut size={14} />Export
      </button>
      <button
        onClick={() => fileInputRef.current?.click()}
        title="Import DAQ lists from .daq file"
        className="h-6 px-2.5 rounded text-[10px] font-medium flex items-center gap-1.5 border transition-colors text-gray-400 border-gray-700 bg-gray-800 hover:bg-gray-700 cursor-pointer"
      >
        <FolderOpen size={14} />Import
      </button>

      {/* Free All confirm dialog */}
      {freeConfirmOpen && createPortal(
        <div
          className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 ${freeConfirmExiting ? 'modal-backdrop-exit' : 'modal-backdrop-enter'}`}
          onMouseDown={e => { if (e.target === e.currentTarget) closeConfirm(); }}
        >
          <div className={`bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-72 p-5 flex flex-col gap-4 ${freeConfirmExiting ? 'modal-panel-exit' : 'modal-panel-enter'}`}>
            <p className="text-sm text-gray-200 leading-relaxed">
              Free all DAQ resources on the slave? This will stop acquisition and release all configured lists.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={closeConfirm}
                className="px-3 py-1.5 rounded text-xs text-gray-400 hover:text-gray-200 border border-gray-700 hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { closeConfirm(); onFree(); }}
                className="px-4 py-1.5 rounded text-xs font-medium bg-red-600 hover:bg-red-500 text-white transition-colors active:scale-95 flex items-center gap-1.5"
              >
                <Trash size={18} />Free All
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
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
  const [configuring, setConfiguring] = useState(false);
  const [odtColors, setOdtColors] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    let idx = 0;
    daqLists.forEach(list => {
      list.odts.forEach(odt => { init[`${list.id}:${odt.id}`] = ODT_COLORS[idx++ % ODT_COLORS.length]; });
    });
    return init;
  });

  // Add default color for newly added ODTs
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

  const splitterDrag = useCallback((dx: number) => {
    setTreePaneWidth(prev => Math.max(160, Math.min(520, prev + dx)));
  }, []);

  // ── Tree mutation handlers (local store only — synced to backend at Configure) ──

  function handleAddList() {
    const id = daqLists.length > 0 ? Math.max(...daqLists.map(l => l.id)) + 1 : 0;
    setDaqLists([...daqLists, { id, event_channel: 1, odts: [{ id: 0, entries: [] }] }]);
  }

  function handleDeleteList(listId: number) {
    setDaqLists(daqLists.filter(l => l.id !== listId));
  }

  function handleSetEvent(listId: number, ch: number) {
    setDaqLists(daqLists.map(l => l.id === listId ? { ...l, event_channel: ch } : l));
  }

  function handleAddOdt(listId: number) {
    setDaqLists(daqLists.map(l => {
      if (l.id !== listId) return l;
      const nextId = l.odts.length > 0 ? Math.max(...l.odts.map(o => o.id)) + 1 : 0;
      return { ...l, odts: [...l.odts, { id: nextId, entries: [] }] };
    }));
  }

  function handleSaveEntry(entry: DaqEntry, listId: number, odtId: number, entryIdx: number | null) {
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

  function handleDeleteEntry(listId: number, odtId: number, entryIdx: number) {
    setDaqLists(daqLists.map(l => {
      if (l.id !== listId) return l;
      return { ...l, odts: l.odts.map(o => o.id !== odtId ? o : { ...o, entries: o.entries.filter((_, i) => i !== entryIdx) }) };
    }));
  }

  function handleDeleteOdt(listId: number, odtId: number) {
    setDaqLists(daqLists.map(l =>
      l.id !== listId ? l : { ...l, odts: l.odts.filter(o => o.id !== odtId) }
    ));
  }

  function handleRenameList(listId: number, name: string | undefined) {
    setDaqLists(daqLists.map(l => l.id === listId ? { ...l, name } : l));
  }

  function handleRenameOdt(listId: number, odtId: number, name: string | undefined) {
    setDaqLists(daqLists.map(l =>
      l.id !== listId ? l : {
        ...l,
        odts: l.odts.map(o => o.id !== odtId ? o : { ...o, name }),
      }
    ));
  }

  function handleMoveEntry(listId: number, odtId: number, fromIdx: number, toIdx: number) {
    setDaqLists(daqLists.map(l => {
      if (l.id !== listId) return l;
      return {
        ...l,
        odts: l.odts.map(o => {
          if (o.id !== odtId) return o;
          const entries = [...o.entries];
          const [removed] = entries.splice(fromIdx, 1);
          entries.splice(toIdx, 0, removed);
          return { ...o, entries };
        }),
      };
    }));
  }

  function handleSaveDaq() {
    const colors: Record<string, string> = {};
    daqLists.forEach((list, li) => {
      list.odts.forEach((odt, oi) => {
        const c = odtColors[`${list.id}:${odt.id}`];
        if (c) colors[`${li}:${oi}`] = c;
      });
    });
    const data = JSON.stringify({ version: 1, lists: daqLists, colors }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'daq_config.daq';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleLoadDaq(file: File) {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as { version: number; lists: DaqList[]; colors?: Record<string, string> };
      if (data.version !== 1 || !Array.isArray(data.lists)) {
        showToast('Invalid .daq file format', 'error');
        return;
      }
      const reIndexed: DaqList[] = data.lists.map((l: DaqList, li: number) => ({
        ...l,
        id: li,
        odts: (l.odts ?? []).map((o: DaqOdt, oi: number) => ({ ...o, id: oi })),
      }));
      setDaqLists(reIndexed);
      if (data.colors) {
        setOdtColors(data.colors);
      }
      showToast(`Loaded ${reIndexed.length} DAQ list(s)`, 'success');
    } catch {
      showToast('Failed to parse .daq file', 'error');
    }
  }

  // ── DAQ lifecycle handlers ──────────────────────────────────────

  async function handleConfigure() {
    setConfiguring(true);
    await new Promise<void>(r => setTimeout(r, 0));
    try {
      await api.daqReplaceLists(daqLists);
      await api.daqConfigure();
      setDaqStatus('configured');
    } catch (e) { showToast((e as Error).message, 'error'); }
    finally { setConfiguring(false); }
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
        configuring={configuring}
        onConfigure={handleConfigure}
        onStart={handleStart}
        onStop={handleStop}
        onFree={handleFree}
        onSave={handleSaveDaq}
        onLoad={handleLoadDaq}
      />
      <div className="flex flex-1 overflow-hidden">
        <div style={{ width: treePaneWidth, minWidth: 160 }} className="flex flex-col overflow-hidden border-r border-gray-800 bg-gray-950">
          <DaqTree
            lists={daqLists}
            odtColors={odtColors}
            onOdtColorChange={(listId, odtId, color) => setOdtColors(prev => ({ ...prev, [`${listId}:${odtId}`]: color }))}
            onAddList={handleAddList}
            onDeleteList={handleDeleteList}
            onDeleteOdt={handleDeleteOdt}
            onSetEvent={handleSetEvent}
            onAddOdt={handleAddOdt}
            onSaveEntry={handleSaveEntry}
            onDeleteEntry={handleDeleteEntry}
            onRenameList={handleRenameList}
            onRenameOdt={handleRenameOdt}
            onMoveEntry={handleMoveEntry}
          />
        </div>
        <PaneSplitter onDrag={splitterDrag} />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <DaqLiveTable lists={daqLists} odtColors={odtColors} />
        </div>
      </div>
    </div>
  );
}
