import {
  Fragment, useRef, useState, useEffect,
  type ChangeEvent, type MouseEvent, type ReactNode,
} from 'react';
import { TOOLBAR_ICON_SIZE, INFO_ICON_SIZE } from '../lib/constants';
import { createPortal } from 'react-dom';
import {
  PaperPlaneTilt, Plus, CaretLeft, CaretRight,
  CornersIn, CornersOut, CaretDown, Info, X, Command, MagnifyingGlass,
  Monitor, UserCircle, BookmarksSimple, ClockCounterClockwise,
  Bookmark, Trash,
} from '@phosphor-icons/react';
import { useAppStore } from '../stores/app-store';
import { useTooltip } from '../context/TooltipContext';
import { CMD_DEFS, CMD_GROUPS } from '../lib/cmd-defs';
import { api } from '../lib/api';
import type { CmdDef, FieldOption, SeqStep, SavedCmd } from '../lib/types';
import { toTitleCase, formatLabel } from '../lib/utils';
import { Button } from './ui/Button';
import { SegmentControl } from './ui/SegmentControl';
import { SaveCommandModal } from './SaveCommandModal';

// ── module-level mouse tracker ───────────────────────────────────────────────
// getBoundingClientRect checks in timers need the current cursor position, but
// React synthetic events can't be read asynchronously. A single passive listener
// keeps coords fresh without per-component overhead.
const _mouse = { x: 0, y: 0 };
if (typeof document !== 'undefined') {
  document.addEventListener('pointermove', (e) => { _mouse.x = e.clientX; _mouse.y = e.clientY; }, { passive: true, capture: true });
}

// ── constants ────────────────────────────────────────────────────────────────

const BASE_CELLS    = 8;
const GAP_DELAY_MS  = 480;
const GHOST_IN_MS   = 200;
const GHOST_OUT_MS  = 150;

const EXIT_MS = 160;
const STAGGER_MS = 28;
const PICKER_TABS = ['history', 'system', 'user', 'saved'] as const;
const GROUP_STAGGER = 35;
const GROUP_FADE = 180;
const SUB_STAGGER = 30;
const SUB_FADE = 160;

interface DropdownState {
  cellIdx: number;
  options: FieldOption[];
  x: number;
  y: number;
  width: number;
}

const emptyMsgStyle = { padding: '16px 10px', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' } as const;

const CMD_GRID_COLS = '20px 36px 1fr 36px';

function CmdPickerHeaderRow() {
  return (
    <div
      style={{
        display: 'grid', gridTemplateColumns: CMD_GRID_COLS, gap: 8, alignItems: 'center',
        padding: '4px 10px', position: 'sticky', top: 0, zIndex: 1,
        borderBottom: '1px solid var(--border)',
        fontSize: 10, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-muted)',
      }}
    >
      <span />
      <span className="flex items-center gap-2"><span className="xcb-vdiv-fade" />PID</span>
      <span className="flex items-center gap-2"><span className="xcb-vdiv-fade" />Name</span>
      <span className="flex items-center justify-end gap-2"><span className="xcb-vdiv-fade" />Size</span>
    </div>
  );
}

function CmdPickerGroupHeader({ children, collapsed, onToggle }: { children: ReactNode; collapsed?: boolean; onToggle?: () => void }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '10px 10px 2px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)',
        cursor: onToggle ? 'pointer' : 'default', userSelect: 'none',
      }}
      onClick={onToggle}
    >
      {onToggle && <CaretDown size={10} style={{ transform: collapsed ? 'rotate(-90deg)' : undefined, transition: 'transform 120ms', flexShrink: 0 }} />}
      {children}
    </div>
  );
}

function CmdPickerSectionHeader({ children, collapsed, onToggle }: { children: ReactNode; collapsed?: boolean; onToggle?: () => void }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '6px 10px 2px 16px', fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)',
        cursor: onToggle ? 'pointer' : 'default', userSelect: 'none',
      }}
      onClick={onToggle}
    >
      {onToggle && <CaretDown size={9} style={{ transform: collapsed ? 'rotate(-90deg)' : undefined, transition: 'transform 120ms', flexShrink: 0 }} />}
      {children}
    </div>
  );
}

function CmdPickerRow({ icon, pidLabel, label, size, onClick }: { icon: ReactNode; pidLabel: string; label: string; size: number; onClick: () => void }) {
  return (
    <button
      style={{
        display: 'grid', gridTemplateColumns: CMD_GRID_COLS, gap: 8, alignItems: 'center',
        width: '100%', padding: '3px 10px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
      onClick={onClick}
    >
      <span style={{ display: 'flex', color: 'var(--text-muted)' }}>{icon}</span>
      <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--text-muted)', textAlign: 'right' }}>{pidLabel}</span>
      <span style={{ fontSize: 11, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--text-muted)', textAlign: 'right' }}>{size}</span>
    </button>
  );
}

function sourceIcon(source: 'system' | 'user' | 'saved') {
  switch (source) {
    case 'system': return <Monitor size={14} />;
    case 'user':   return <UserCircle size={14} />;
    case 'saved':  return <BookmarksSimple size={14} />;
  }
}

// ── GapZone ──────────────────────────────────────────────────────────────────

function GapZone({ absIdx, onInsert, onOpen, onClose, cellWidth }: {
  absIdx: number;
  onInsert: (idx: number) => void;
  onOpen: (absIdx: number) => void;
  onClose: () => void;
  cellWidth: number;
}) {
  const [open, setOpen] = useState(false);
  const openTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearOpenTimer()  { if (openTimerRef.current)  { clearTimeout(openTimerRef.current);  openTimerRef.current  = null; } }
  function clearCloseTimer() { if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; } }

  function doClose() { setOpen(false); onClose(); }

  function scheduleClose() {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(doClose, 1000);
  }

  useEffect(() => () => { clearOpenTimer(); clearCloseTimer(); }, []);

  return (
    <div
      style={{
        flexShrink: 0,
        width: open ? (BASE_CELLS * cellWidth + 102) / (BASE_CELLS + 1) : 6,
        alignSelf: 'stretch',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: `width ${open ? GHOST_IN_MS : GHOST_OUT_MS}ms ease`,
        cursor: open ? 'pointer' : 'default',
      }}
      onMouseEnter={() => {
        clearCloseTimer();
        if (open) return;
        clearOpenTimer();
        openTimerRef.current = setTimeout(() => {
          setOpen(true);
          onOpen(absIdx);
        }, GAP_DELAY_MS);
      }}
      onMouseLeave={() => {
        clearOpenTimer();
        if (open) scheduleClose();
      }}
      onClick={() => {
        if (!open) return;
        clearOpenTimer();
        clearCloseTimer();
        doClose();
        onInsert(absIdx);
      }}
    >
      {/* Mirror the label row (h-4 = 16px + mb-1 = 4px) so the ghost aligns with the inputs */}
      <div style={{ height: 20, flexShrink: 0 }} />
      <div
        style={{
          flex: 1,
          margin: '0 6px',
          borderRadius: 4,
          background: 'var(--input-bg)',
          border: '1px solid var(--input-border)',
          borderTopColor: 'var(--input-border-top)',
          boxShadow: 'inset 0 2px 4px var(--shadow-8), inset 0 1px 2px var(--shadow-6), 0 1px 0 var(--shine-2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--accent)',
          opacity: open ? 1 : 0,
          transition: `opacity ${open ? GHOST_IN_MS : GHOST_OUT_MS}ms ease`,
        }}
      >
        <Plus size={10} />
      </div>
    </div>
  );
}

// ── CommandBar ───────────────────────────────────────────────────────────────

export function CommandBar() {
  const activeCmd           = useAppStore((s) => s.activeCmd);
  const byteValues          = useAppStore((s) => s.byteValues);
  const setByteValue        = useAppStore((s) => s.setByteValue);
  const setActiveCmd        = useAppStore((s) => s.setActiveCmd);
  const customCmdDefs       = useAppStore((s) => s.customCmdDefs);
  const userCmdDefs         = useAppStore((s) => s.userCmdDefs);
  const commandHistory      = useAppStore((s) => s.commandHistory);
  const addCommandHistory   = useAppStore((s) => s.addCommandHistory);
  const collapsed           = useAppStore((s) => s.byteBarCollapsed);
  const setCollapsed        = useAppStore((s) => s.setByteBarCollapsed);
  const showToast           = useAppStore((s) => s.showToast);
  const activeMainTab       = useAppStore((s) => s.activeMainTab);
  const activeSequenceId    = useAppStore((s) => s.activeSequenceId);
  const seqSelectedStepId   = useAppStore((s) => s.seqSelectedStepId);
  const setSeqSelectedStepId = useAppStore((s) => s.setSeqSelectedStepId);
  const seqRunResult        = useAppStore((s) => s.seqRunResult);
  const sequences           = useAppStore((s) => s.sequences);
  const updateSequence      = useAppStore((s) => s.updateSequence);
  const savedCmds           = useAppStore((s) => s.savedCmds);

  const { showTip, hideTip } = useTooltip();

  const def = activeCmd
    ? (CMD_DEFS[activeCmd] ?? customCmdDefs[activeCmd] ?? userCmdDefs[activeCmd])
    : null;

  const [allBytes, setAllBytes]   = useState<string[]>(() => [...byteValues]);
  const [section, setSection]     = useState(0);
  const [labelKey, setLabelKey]   = useState(0);
  const [shownValues, setShownValues] = useState<string[]>(() => [...byteValues]);
  const [spanPhase, setSpanPhase] = useState<'idle' | 'exit' | 'enter'>('idle');
  const [phaseKey, setPhaseKey]   = useState(0);
  const [typeKeys, setTypeKeys]   = useState<number[]>(Array(BASE_CELLS).fill(0));
  const [sendFlying, setSendFlying] = useState(false);
  const [dropdown, setDropdown]   = useState<DropdownState | null>(null);
  const [expandKey, setExpandKey]     = useState(0);
  const [toggleKey, setToggleKey]     = useState(0);
  const [openGapAbsIdx, setOpenGapAbsIdx] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen]   = useState(false);
  const [pickerTab, setPickerTab]     = useState<'history' | 'system' | 'user' | 'saved'>('history');
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerPos, setPickerPos]     = useState<{ top: number; left: number; width: number } | null>(null);
  const [pickerRender, setPickerRender]   = useState(false);
  const [pickerClosing, setPickerClosing] = useState(false);
  const [pickerSliding, setPickerSliding] = useState(false);
  const [collapsedGroups, setCollapsedGroups]       = useState<Set<string>>(new Set());
  const [collapsedSubgroups, setCollapsedSubgroups] = useState<Set<string>>(new Set());
  const [saveSnapshot, setSaveSnapshot] = useState<{ cmdKey: string; bytes: string[]; defaultName: string } | null>(null);

  const inputRefs    = useRef<(HTMLInputElement | null)[]>([]);
  const cellDivRefs  = useRef<(HTMLDivElement | null)[]>([]);
  const pickerRef    = useRef<HTMLDivElement>(null);
  const pickerPanelRef = useRef<HTMLDivElement>(null);
  const prevCollapsedRef = useRef(collapsed);
  const shownValuesRef = useRef(shownValues);
  shownValuesRef.current = shownValues;
  const sectionRef     = useRef(section);
  sectionRef.current   = section;
  const allBytesRef    = useRef(allBytes);
  allBytesRef.current  = allBytes;
  const holdTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickerSlideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickerCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevLabelTextsRef = useRef<string[]>(Array(BASE_CELLS).fill(''));

  useEffect(() => {
    if (prevCollapsedRef.current && !collapsed) setExpandKey((k) => k + 1);
    prevCollapsedRef.current = collapsed;
  }, [collapsed]);

  useEffect(() => {
    if (!dropdown) return;
    const onDown = (e: globalThis.MouseEvent) => {
      if (!(e.target as Element).closest('#cmd-dropdown')) setDropdown(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [dropdown]);

  // Keep the picker panel mounted briefly after close so it can play an
  // exit animation (mirrors the detail-expand entrance) instead of vanishing.
  useEffect(() => {
    if (pickerOpen) {
      if (pickerCloseTimerRef.current) clearTimeout(pickerCloseTimerRef.current);
      setPickerClosing(false);
      setPickerRender(true);
    } else if (pickerRender) {
      setPickerClosing(true);
      pickerCloseTimerRef.current = setTimeout(() => {
        setPickerRender(false);
        setPickerClosing(false);
      }, 160);
    }
    return () => {
      if (pickerCloseTimerRef.current) clearTimeout(pickerCloseTimerRef.current);
    };
  }, [pickerOpen]);

  // Picker panel is portaled to <body> (see below) so its backdrop-filter
  // isn't nested inside the bar's own .xcb-glass blur — nested
  // backdrop-filters sample the ancestor's flat fill instead of the page,
  // which renders as a flat tint with no visible blur.
  useEffect(() => {
    if (!pickerOpen) return;
    const update = () => {
      const rect = pickerRef.current?.getBoundingClientRect();
      if (rect) setPickerPos({ top: rect.bottom, left: rect.left, width: rect.width });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [pickerOpen]);

  // Hide pane scrollbars while the tab-slide transition is in flight —
  // otherwise the scrollbar track slides across the screen with the pane.
  useEffect(() => {
    setPickerSliding(true);
    if (pickerSlideTimerRef.current) clearTimeout(pickerSlideTimerRef.current);
    pickerSlideTimerRef.current = setTimeout(() => setPickerSliding(false), 1000);
    return () => {
      if (pickerSlideTimerRef.current) clearTimeout(pickerSlideTimerRef.current);
    };
  }, [pickerTab]);

  useEffect(() => {
    prevLabelTextsRef.current = Array.from({ length: BASE_CELLS }, (_, i) => {
      const fd = section === 0 ? def?.fields[i] : undefined;
      return fd ? toTitleCase(fd.label) : '';
    });
  });

  useEffect(() => {
    const isDifferent = byteValues.some((v, i) => v !== (allBytes[i] ?? ''));
    if (!isDifferent && section === 0) return;
    const newShown = [...byteValues];
    animate(newShown, shownValuesRef.current);
    setAllBytes([...byteValues]);
    setSection(0);
    setLabelKey((k) => k + 1);
    setTypeKeys(Array(BASE_CELLS).fill(0));
  }, [byteValues]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (holdTimerRef.current) clearTimeout(holdTimerRef.current); }, []);

  function startHold(action: () => void, delay = 1000) {
    holdTimerRef.current = setTimeout(() => {
      action();
      startHold(action, Math.max(50, delay * 0.7));
    }, delay);
  }

  function stopHold() {
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
  }

  function getCellValue(i: number): string { return allBytes[section * BASE_CELLS + i] ?? ''; }

  function setCellValue(i: number, v: string) {
    setAllBytes((prev) => {
      const next = [...prev];
      const idx = section * BASE_CELLS + i;
      while (next.length <= idx) next.push('');
      next[idx] = v;
      return next;
    });
  }

  function insertByteAt(absIdx: number) {
    const next = [...allBytesRef.current];
    next.splice(absIdx, 0, '');
    setAllBytes(next);
    const pageStart = sectionRef.current * BASE_CELLS;
    setShownValues(Array.from({ length: BASE_CELLS }, (_, i) => next[pageStart + i] ?? ''));
    setTypeKeys(prev => prev.map(k => k + 1));
  }

  function deleteByteAt(absIdx: number) {
    const next = [...allBytesRef.current];
    next.splice(absIdx, 1);
    setAllBytes(next);
    const pageStart = sectionRef.current * BASE_CELLS;
    const newPageVals = Array.from({ length: BASE_CELLS }, (_, i) => next[pageStart + i] ?? '');
    animate(newPageVals, shownValuesRef.current);
  }

  function animate(newShown: string[], oldShown: string[]) {
    const hasOld = oldShown.some((v) => v !== '');
    if (!hasOld) {
      setShownValues(newShown);
      setSpanPhase('enter');
      setPhaseKey((k) => k + 1);
      setTimeout(() => setSpanPhase('idle'), 350);
      return;
    }
    setSpanPhase('exit');
    setPhaseKey((k) => k + 1);
    const exitTotal = EXIT_MS + STAGGER_MS * (BASE_CELLS - 1);
    setTimeout(() => {
      setShownValues(newShown);
      setSpanPhase('enter');
      setPhaseKey((k) => k + 1);
      setTimeout(() => setSpanPhase('idle'), 350);
    }, exitTotal);
  }

  function goBack() {
    const sec = sectionRef.current;
    if (sec === 0) return;
    const newSec = sec - 1;
    const newShown = Array.from({ length: BASE_CELLS }, (_, i) => allBytesRef.current[newSec * BASE_CELLS + i] ?? '');
    animate(newShown, shownValuesRef.current);
    setSection(newSec);
    setLabelKey((k) => k + 1);
    setTypeKeys(Array(BASE_CELLS).fill(0));
  }

  function goForward() {
    const sec = sectionRef.current;
    const newSec = sec + 1;
    const newShown = Array.from({ length: BASE_CELLS }, (_, i) => allBytesRef.current[newSec * BASE_CELLS + i] ?? '');
    animate(newShown, shownValuesRef.current);
    setSection(newSec);
    setLabelKey((k) => k + 1);
    setTypeKeys(Array(BASE_CELLS).fill(0));
  }

  function openDropdown(cellIdx: number, options: FieldOption[], e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    const input = inputRefs.current[cellIdx];
    if (!input) return;
    const rect = input.getBoundingClientRect();
    const width = Math.max(rect.width, 130);
    let x = rect.left;
    if (x + width > window.innerWidth - 8) x = Math.max(8, window.innerWidth - width - 8);
    setDropdown({ cellIdx, options, x, y: rect.bottom + 3, width });
  }

  async function handleSend() {
    if (def?.directAction === 'connect') { await api.connect().catch(() => {}); return; }
    if (def?.directAction === 'disconnect') { await api.disconnect().catch(() => {}); return; }
    let lastNonEmpty = -1;
    for (let i = allBytes.length - 1; i >= 0; i--) {
      if (allBytes[i]?.trim()) { lastNonEmpty = i; break; }
    }
    if (lastNonEmpty < 0) return;
    const bytes: number[] = [];
    for (let i = 0; i <= lastNonEmpty; i++) {
      const v = allBytes[i]?.trim();
      const n = v ? parseInt(v, 16) : 0;
      bytes.push(isNaN(n) ? 0 : n & 0xff);
    }
    if (def?.isUserCmd && def.userCmdName) {
      await api.userCmd(def.userCmdName, bytes[1] ?? 0, bytes.slice(2))
        .catch((e: Error) => showToast(e.message, 'error'));
    } else {
      await api.raw(bytes).catch((e: Error) => showToast(e.message, 'error'));
    }
  }

  function handleAddToSequence() {
    const seq = sequences.find((s) => s.id === activeSequenceId);
    if (!seq) return;
    const stepBytes = Array.from({ length: BASE_CELLS }, (_, i) => allBytes[i]?.trim() ?? '');
    const cmdKey = activeCmd ?? (CMD_DEFS[stepBytes[0]?.toLowerCase()] ? stepBytes[0].toLowerCase() : 'raw');
    const newStep: SeqStep = {
      id: crypto.randomUUID(), cmdKey, bytes: stepBytes, resp: 'either',
    };
    updateSequence({ ...seq, steps: [...seq.steps, newStep] });
  }

  function handleRemoveSelectedStep() {
    const seq = sequences.find((s) => s.id === activeSequenceId);
    if (!seq || !seqSelectedStepId) return;
    updateSequence({ ...seq, steps: seq.steps.filter((s) => s.id !== seqSelectedStepId) });
    setSeqSelectedStepId(null);
  }

  function openSaveModal() {
    let lastNonEmpty = -1;
    for (let i = allBytes.length - 1; i >= 0; i--) {
      if (allBytes[i]?.trim()) { lastNonEmpty = i; break; }
    }
    if (lastNonEmpty < 0) return;
    const bytes = allBytes.slice(0, lastNonEmpty + 1).map((b) => (b ?? '').trim().toUpperCase());
    const cmdKey = activeCmd ?? (CMD_DEFS[bytes[0]?.toLowerCase()] ? bytes[0].toLowerCase() : 'raw');
    const defaultName = activeCmd
      ? (def?.userCmdName ?? formatLabel(activeCmd))
      : bytes.filter(Boolean).join(' ');
    setSaveSnapshot({ cmdKey, bytes, defaultName });
  }

  function selectSaved(cmd: SavedCmd) {
    setActiveCmd(cmd.cmdKey);
    cmd.bytes.forEach((b, i) => setByteValue(i, b));
    setPickerOpen(false);
    setPickerQuery('');
    if (collapsed) setCollapsed(false);
  }

  const q = pickerQuery.toLowerCase().trim();
  const filteredGroups = CMD_GROUPS
    .map(group => ({
      ...group,
      subgroups: group.subgroups
        .map(sub => ({
          ...sub,
          commands: sub.commands.filter(cmd =>
            !q || cmd.id.includes(q) || cmd.label.toLowerCase().includes(q) || cmd.pid.toLowerCase().includes(q)
          ),
        }))
        .filter(sub => sub.commands.length > 0),
    }))
    .filter(group => group.subgroups.length > 0);
  const userEntries = [...Object.entries(userCmdDefs), ...Object.entries(customCmdDefs)].filter(([key, def]) =>
    !q || key.includes(q) || (def.userCmdName ?? '').toLowerCase().includes(q)
  );
  const historyEntries = commandHistory
    .map((id) => {
      if (CMD_DEFS[id])      return { id, def: CMD_DEFS[id],      source: 'system' as const };
      if (customCmdDefs[id]) return { id, def: customCmdDefs[id], source: 'saved'  as const };
      if (userCmdDefs[id])   return { id, def: userCmdDefs[id],   source: 'user'   as const };
      return null;
    })
    .filter((e): e is { id: string; def: CmdDef; source: 'system' | 'user' | 'saved' } => e !== null);

  const savedFiltered = savedCmds.filter((c) =>
    !q || c.name.toLowerCase().includes(q) || c.cmdKey.toLowerCase().includes(q) ||
    c.group.toLowerCase().includes(q) || (c.subgroup ?? '').toLowerCase().includes(q)
  );

  const savedByGroup = new Map<string, Map<string, SavedCmd[]>>();
  for (const cmd of savedFiltered) {
    let subMap = savedByGroup.get(cmd.group);
    if (!subMap) { subMap = new Map(); savedByGroup.set(cmd.group, subMap); }
    const subKey = cmd.subgroup ?? '';
    let list = subMap.get(subKey);
    if (!list) { list = []; subMap.set(subKey, list); }
    list.push(cmd);
  }

  function renderSavedGroups() {
    return Array.from(savedByGroup.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([group, subMap]) => (
        <div key={group}>
          <CmdPickerGroupHeader>{group}</CmdPickerGroupHeader>
          {Array.from(subMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([subgroup, cmds]) => (
              <div key={subgroup || '__root__'}>
                {subgroup && <CmdPickerSectionHeader>{subgroup}</CmdPickerSectionHeader>}
                {cmds.map((cmd) => (
                  <CmdPickerRow key={cmd.id} icon={<BookmarksSimple size={14} />} pidLabel={cmd.bytes[0] || '--'} label={cmd.name} size={cmd.bytes.length} onClick={() => selectSaved(cmd)} />
                ))}
              </div>
            ))}
        </div>
      ));
  }

  function selectCmd(id: string) {
    setActiveCmd(id);
    addCommandHistory(id);
    setPickerOpen(false);
    setPickerQuery('');
    if (collapsed) setCollapsed(false);
  }

  function toggleGroup(name: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  function toggleSubgroup(key: string) {
    setCollapsedSubgroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const isSeqRunning = seqRunResult?.status === 'running';
  const startByte = section * BASE_CELLS;
  const endByte   = startByte + BASE_CELLS - 1;
  const cmdLabel  = !activeCmd
    ? 'Command Bar'
    : (def?.userCmdName?.toUpperCase() ?? activeCmd.replace(/-/g, ' ').toUpperCase());

  return (
    <div
      className="xcb-glass shrink-0"
      style={{ borderBottom: '1px solid var(--border)', position: 'relative', zIndex: pickerOpen ? 10 : undefined }}
    >
      {/* ── Title row ───────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-3.5 cursor-pointer relative"
        style={{ height: 34, borderBottom: collapsed ? 'none' : '1px solid var(--border)' }}
        onClick={() => { setCollapsed(!collapsed); setToggleKey((k) => k + 1); }}
      >
        {/* Centered search bar */}
        <div
          ref={pickerRef}
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 560,
            top: 4,
            zIndex: 20,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="xcb-input relative flex items-center"
            style={{
              height: 26,
              borderRadius: 4,
              background: 'var(--shadow-6)',
              border: '1px solid var(--shadow-9)',
              boxShadow: 'inset 0 2px 5px var(--shadow-10), inset 0 1px 2px var(--shadow-7), 0 1px 0 var(--shine-3)',
            }}
          >
            <MagnifyingGlass
              size={12}
              className="absolute left-2 pointer-events-none"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              placeholder="Search for a command…"
              className="w-full text-[11px] bg-transparent focus:outline-none"
              style={{
                height: 26,
                paddingLeft: 26,
                paddingRight: 8,
                color: 'var(--text-primary)',
                caretColor: 'var(--accent)',
                border: 'none',
                outline: 'none',
              }}
              value={pickerQuery}
              onChange={e => setPickerQuery(e.target.value)}
              onFocus={() => { setPickerOpen(true); setPickerTab('history'); }}
            />
          </div>
        </div>

        {/* Picker panel — portaled to <body> so its backdrop-filter blurs
            real page content instead of nesting inside the bar's own .xcb-glass */}
        {pickerRender && pickerPos && createPortal(
          <>
            {/* Click-outside backdrop — closes the picker and swallows the
                click so it can't also trigger whatever's underneath. */}
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9998,
                pointerEvents: pickerClosing ? 'none' : undefined,
              }}
              onClick={(e) => { e.stopPropagation(); setPickerOpen(false); }}
            />
            <div
              ref={pickerPanelRef}
              className="xcb-glass-panel"
              style={{
                position: 'fixed',
                top: pickerPos.top + 6,
                left: pickerPos.left,
                width: pickerPos.width,
                zIndex: 9999,
                overflow: 'hidden',
                borderRadius: 8,
                border: '1px solid var(--border-strong)',
                boxShadow: 'inset 0 1px 0 var(--shine-3), 0 16px 48px rgba(0,0,0,0.5)',
                animation: pickerClosing
                  ? 'detail-collapse 160ms var(--ease-out) forwards'
                  : 'detail-expand 160ms var(--ease-out)',
                pointerEvents: pickerClosing ? 'none' : undefined,
              }}
              onClick={(e) => e.stopPropagation()}
            >
            <div style={{ height: 520, display: 'flex', flexDirection: 'column' }}>
                {/* Tabs */}
                <div style={{ padding: '8px 8px 5px', flexShrink: 0 }}>
                  <SegmentControl<'history' | 'system' | 'user' | 'saved'>
                    items={[
                      { value: 'history', label: 'History', icon: <ClockCounterClockwise size={18} /> },
                      { value: 'system', label: 'System', icon: <Monitor size={18} /> },
                      { value: 'user',   label: 'User',   icon: <UserCircle size={18} /> },
                      { value: 'saved',  label: 'Saved',  icon: <BookmarksSimple size={18} /> },
                    ]}
                    value={pickerTab}
                    onChange={setPickerTab}
                    size="sm"
                    variant="icon-text"
                    className="fill"
                  />
                </div>
                {/* Command list */}
                <div style={{ flex: 1, overflow: 'hidden', position: 'relative', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  {q ? (
                    <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingBottom: 6 }}>
                      {/* Global search — merges results across System/User/Saved, ignoring the active tab */}
                      {(filteredGroups.length === 0 && userEntries.length === 0 && savedFiltered.length === 0)
                        ? <div style={emptyMsgStyle}>No commands match</div>
                        : <>
                            <CmdPickerHeaderRow />
                            {filteredGroups.map(group => (
                              <div key={group.name}>
                                <CmdPickerGroupHeader>{group.name}</CmdPickerGroupHeader>
                                {group.subgroups.map(sub => (
                                  <div key={sub.name}>
                                    <CmdPickerSectionHeader>{sub.name}</CmdPickerSectionHeader>
                                    {sub.commands.map(cmd => (
                                      <CmdPickerRow key={cmd.id} icon={<Monitor size={14} />} pidLabel={cmd.pid.slice(2)} label={formatLabel(cmd.id)} size={CMD_DEFS[cmd.id]?.fields.length ?? 0} onClick={() => selectCmd(cmd.id)} />
                                    ))}
                                  </div>
                                ))}
                              </div>
                            ))}
                            {userEntries.length > 0 && (
                              <div>
                                <CmdPickerGroupHeader>User</CmdPickerGroupHeader>
                                {userEntries.map(([key, def]) => (
                                  <CmdPickerRow key={key} icon={<UserCircle size={14} />} pidLabel={def.pid ?? '--'} label={def.userCmdName ?? formatLabel(key)} size={def.fields.length} onClick={() => selectCmd(key)} />
                                ))}
                              </div>
                            )}
                            {savedFiltered.length > 0 && renderSavedGroups()}
                          </>
                      }
                    </div>
                  ) : (
                    <>
                      <CmdPickerHeaderRow />
                      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', minHeight: 0 }}>
                        <div style={{
                          display: 'flex',
                          height: '100%',
                          width: '400%',
                          transform: `translateX(-${PICKER_TABS.indexOf(pickerTab) * 25}%)`,
                          transition: 'transform 500ms var(--ease-in-out)',
                          willChange: 'transform',
                        }}>
                      {/* History */}
                      <div style={{ width: '25%', height: '100%', overflowY: pickerSliding ? 'hidden' : 'auto', flexShrink: 0, paddingBottom: 6 }}>
                        {historyEntries.length === 0
                          ? <div style={emptyMsgStyle}>No recent commands</div>
                          : historyEntries.map(({ id, def, source }) => (
                              <CmdPickerRow key={id} icon={sourceIcon(source)} pidLabel={def.pid ?? '--'} label={def.userCmdName ?? formatLabel(id)} size={def.fields.length} onClick={() => selectCmd(id)} />
                            ))
                        }
                      </div>
                      {/* System */}
                      <div style={{ width: '25%', height: '100%', overflowY: pickerSliding ? 'hidden' : 'auto', flexShrink: 0, paddingBottom: 6 }}>
                        {filteredGroups.length === 0
                          ? <div style={emptyMsgStyle}>No commands match</div>
                          : filteredGroups.map(group => {
                                const groupCollapsed = collapsedGroups.has(group.name);
                                return (
                                  <div key={group.name}>
                                    <CmdPickerGroupHeader collapsed={groupCollapsed} onToggle={() => toggleGroup(group.name)}>{group.name}</CmdPickerGroupHeader>
                                    <div style={{
                                      display: 'grid',
                                      gridTemplateRows: groupCollapsed ? '0fr' : '1fr',
                                      overflow: 'hidden',
                                      transition: 'grid-template-rows 240ms ease',
                                      transitionDelay: groupCollapsed ? `${Math.max(0, group.subgroups.length - 1) * GROUP_STAGGER + GROUP_FADE}ms` : '0ms',
                                    }}>
                                      <div style={{ minHeight: 0 }}>
                                        {group.subgroups.map((sub, idx) => {
                                          const subKey = `${group.name}::${sub.name}`;
                                          const subCollapsed = collapsedSubgroups.has(subKey);
                                          return (
                                            <div
                                              key={sub.name}
                                              style={{
                                                opacity: groupCollapsed ? 0 : 1,
                                                transform: groupCollapsed ? 'translateY(-4px)' : 'translateY(0)',
                                                transition: `opacity ${GROUP_FADE}ms ease, transform ${GROUP_FADE}ms ease`,
                                                transitionDelay: `${idx * GROUP_STAGGER}ms`,
                                              }}
                                            >
                                              <CmdPickerSectionHeader collapsed={subCollapsed} onToggle={() => toggleSubgroup(subKey)}>{sub.name}</CmdPickerSectionHeader>
                                              <div style={{
                                                display: 'grid',
                                                gridTemplateRows: subCollapsed ? '0fr' : '1fr',
                                                overflow: 'hidden',
                                                transition: 'grid-template-rows 200ms ease',
                                                transitionDelay: subCollapsed ? `${Math.max(0, sub.commands.length - 1) * SUB_STAGGER + SUB_FADE}ms` : '0ms',
                                              }}>
                                                <div style={{ minHeight: 0 }}>
                                                  {sub.commands.map((cmd, cIdx) => (
                                                    <div
                                                      key={cmd.id}
                                                      style={{
                                                        opacity: subCollapsed ? 0 : 1,
                                                        transform: subCollapsed ? 'translateY(-4px)' : 'translateY(0)',
                                                        transition: `opacity ${SUB_FADE}ms ease, transform ${SUB_FADE}ms ease`,
                                                        transitionDelay: `${cIdx * SUB_STAGGER}ms`,
                                                      }}
                                                    >
                                                      <CmdPickerRow icon={<Monitor size={14} />} pidLabel={cmd.pid.slice(2)} label={formatLabel(cmd.id)} size={CMD_DEFS[cmd.id]?.fields.length ?? 0} onClick={() => selectCmd(cmd.id)} />
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                        }
                      </div>
                      {/* User */}
                      <div style={{ width: '25%', height: '100%', overflowY: pickerSliding ? 'hidden' : 'auto', flexShrink: 0, paddingBottom: 6 }}>
                        {userEntries.length === 0
                          ? <div style={emptyMsgStyle}>No user commands loaded</div>
                          : userEntries.map(([key, def]) => (
                              <CmdPickerRow key={key} icon={<UserCircle size={14} />} pidLabel={def.pid ?? '--'} label={def.userCmdName ?? formatLabel(key)} size={def.fields.length} onClick={() => selectCmd(key)} />
                            ))
                        }
                      </div>
                      {/* Saved */}
                      <div style={{ width: '25%', height: '100%', overflowY: pickerSliding ? 'hidden' : 'auto', flexShrink: 0, paddingBottom: 6 }}>
                        {savedFiltered.length === 0
                          ? <div style={emptyMsgStyle}>{q ? 'No commands match' : 'No saved commands — use the save button next to Send'}</div>
                          : renderSavedGroups()
                        }
                      </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </>,
          document.body
        )}

        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <span
            className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.07em] uppercase"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Command size={TOOLBAR_ICON_SIZE} style={{ color: 'var(--text-muted)' }} />
            {cmdLabel}
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={section === 0}
              className="w-[18px] h-5 flex items-center justify-center rounded transition-colors"
              style={{
                color: section === 0 ? 'var(--text-muted)' : 'var(--text-secondary)',
                opacity: section === 0 ? 0.3 : 1,
                background: 'none',
                cursor: section === 0 ? 'not-allowed' : 'pointer',
              }}
              onMouseDown={(e) => { e.stopPropagation(); if (section === 0) return; goBack(); startHold(goBack); }}
              onMouseUp={stopHold}
              onMouseLeave={stopHold}
            >
              <CaretLeft size={10} />
            </button>
            <span
              key={`sec-${labelKey}`}
              className="text-[10px] font-mono label-fade inline-flex items-baseline justify-center gap-0.5"
              style={{ color: 'var(--text-muted)', width: '13ch' }}
            >
              <span>Bytes</span>
              <span style={{ display: 'inline-block', width: '3ch', textAlign: 'right' }}>{startByte}</span>
              <span>–</span>
              <span style={{ display: 'inline-block', width: '3ch', textAlign: 'left' }}>{endByte}</span>
            </span>
            <button
              className="w-[18px] h-5 flex items-center justify-center rounded transition-colors"
              style={{
                color: 'var(--text-secondary)',
                background: 'none',
                cursor: 'pointer',
              }}
              onMouseDown={(e) => { e.stopPropagation(); goForward(); startHold(goForward); }}
              onMouseUp={stopHold}
              onMouseLeave={stopHold}
            >
              <CaretRight size={10} />
            </button>
          </div>
        </div>

        <div className="flex-1" />

        {collapsed
          ? <CornersOut key={toggleKey} size={TOOLBAR_ICON_SIZE} className={toggleKey > 0 ? 'icon-pop' : ''} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          : <CornersIn  key={toggleKey} size={TOOLBAR_ICON_SIZE} className={toggleKey > 0 ? 'icon-pop' : ''} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        }
      </div>

      {/* ── Collapsible body ────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateRows: collapsed ? '0fr' : '1fr',
          transition: 'grid-template-rows 180ms ease',
        }}
      >
        <div style={{ overflow: 'hidden' }}>

          {/* Cells */}
          <div className="flex items-end px-3.5 pt-2 pb-2">
            {Array.from({ length: BASE_CELLS }, (_, i) => {
              const absIdx    = startByte + i;
              const fieldDef  = section === 0 ? def?.fields[i] : undefined;
              const isLocked  = !!def && section === 0 && (i === 0 || (i === 1 && !!def.isUserCmd));
              const cellValue = getCellValue(i);
              const cellShown = shownValues[i] ?? '';
              const prevLbl   = prevLabelTextsRef.current[i] ?? '';
              const currLbl   = fieldDef ? toTitleCase(fieldDef.label) : '';
              const lblCls    = prevLbl === '' && currLbl !== '' ? 'label-enter' : 'label-fade';
              const spanCls   =
                spanPhase === 'exit'  ? 'count-exit' :
                spanPhase === 'enter' ? 'count-tick'  :
                typeKeys[i] > 0       ? 'type-fade'   : '';
              const spanStyle =
                spanPhase !== 'idle' ? { animationDelay: `${i * STAGGER_MS}ms` } : undefined;

              return (
                <Fragment key={`${i}-${expandKey}`}>
                  {i > 0 && (
                    <GapZone
                      absIdx={section * BASE_CELLS + i}
                      onInsert={insertByteAt}
                      onOpen={setOpenGapAbsIdx}
                      onClose={() => setOpenGapAbsIdx(null)}
                      cellWidth={cellDivRefs.current[i - 1]?.offsetWidth ?? 56}
                    />
                  )}
                  <div
                    ref={(el) => { cellDivRefs.current[i] = el; }}
                    className="flex-1 flex flex-col min-w-0"
                    style={{
                      ...(expandKey > 0 ? { animation: `bar-enter 200ms ease-out ${i * 28}ms both` } : {}),
                      ...(i === BASE_CELLS - 1 ? {
                      flexGrow: openGapAbsIdx !== null ? 0 : 1,
                      overflow: 'hidden',
                      opacity: openGapAbsIdx !== null ? 0 : 1,
                      transition: 'flex-grow 200ms ease, opacity 200ms ease',
                    } : {}),
                    }}
                  >
                  <div className="flex items-baseline justify-between mb-1 h-4 overflow-hidden pr-0.5">
                    <span
                      key={`lbl-${labelKey}-${i}`}
                      className={`text-[9px] font-semibold uppercase tracking-widest leading-none truncate min-w-0 overflow-hidden ${lblCls}`}
                      style={{ color: fieldDef ? 'var(--text-muted)' : 'transparent' }}
                    >{fieldDef ? toTitleCase(fieldDef.label) : '.'}</span>
                    {fieldDef && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        {fieldDef.options && (
                          <button
                            className="flex items-center px-0.5 leading-none transition-colors"
                            style={{ color: 'var(--text-muted)' }}
                            onClick={(e) => openDropdown(i, fieldDef.options!, e)}
                            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--accent)')}
                            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
                          ><CaretDown size={10} /></button>
                        )}
                        <button
                          className="flex items-center px-0.5 leading-none transition-colors"
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={(e) => showTip(e.currentTarget, fieldDef.tip)}
                          onMouseLeave={hideTip}
                        ><Info size={INFO_ICON_SIZE} /></button>
                      </div>
                    )}
                  </div>

                  <div className={`relative group rounded xcb-input${isLocked ? ' opacity-60' : ''}`}>
                    <span
                      key={`idx-${labelKey}-${i}`}
                      className="absolute top-0.5 left-1 text-[8px] font-mono pointer-events-none label-fade"
                      style={{ color: 'var(--text-muted)', lineHeight: 1 }}
                    >{absIdx}</span>
                    <input
                      ref={(el) => { inputRefs.current[i] = el; }}
                      maxLength={2}
                      value={cellValue}
                      disabled={isLocked}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        if (isLocked) return;
                        const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').toUpperCase().slice(0, 2);
                        setCellValue(i, v);
                        setShownValues((prev) => { const n = [...prev]; n[i] = v; return n; });
                        setTypeKeys((prev) => { const n = [...prev]; n[i]++; return n; });
                      }}
                      className="w-full px-1 py-1.5 rounded text-xs font-mono text-center focus:outline-none bg-transparent border-0"
                      style={{ color: 'transparent', caretColor: isLocked ? 'transparent' : 'var(--text-secondary)' }}
                    />
                    <span
                      key={`${spanPhase}-${phaseKey}-${typeKeys[i]}-${i}`}
                      className={`absolute inset-0 flex items-center justify-center text-xs font-mono pointer-events-none ${spanCls}`}
                      style={{
                        color: isLocked ? 'var(--text-muted)' : cellShown ? 'var(--text-primary)' : 'var(--text-muted)',
                        ...spanStyle,
                      }}
                    >{cellShown || '00'}</span>
                    <button
                      className={`absolute top-0.5 right-0.5 w-[13px] h-[13px] flex items-center justify-center rounded z-10 opacity-0 group-hover:opacity-100 transition-opacity ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                      style={{ background: 'var(--surface-overlay)', color: 'var(--text-muted)' }}
                      onMouseEnter={isLocked ? undefined : (e) => ((e.currentTarget as HTMLElement).style.color = 'var(--status-err)')}
                      onMouseLeave={isLocked ? undefined : (e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
                      onClick={isLocked ? undefined : () => deleteByteAt(section * BASE_CELLS + i)}
                    ><X size={9} /></button>
                  </div>
                  </div>
                </Fragment>
              );
            })}

            {activeMainTab === 'sequence' ? (
              <>
                <Button
                  key={`add-${expandKey}`}
                  variant="primary"
                  className="!text-[11px] !py-1.5 leading-4 !px-0 !w-[66px] shrink-0 self-end"
                  style={expandKey > 0 ? { animation: `bar-enter 200ms ease-out ${BASE_CELLS * 28}ms both` } : undefined}
                  disabled={!activeSequenceId || isSeqRunning}
                  onClick={handleAddToSequence}
                >
                  <Plus size={14} />
                  Add
                </Button>
                <Button
                  key={`del-${expandKey}`}
                  variant="primary"
                  intent="danger"
                  className="!text-[11px] !py-1.5 leading-4 !px-0 !w-[66px] shrink-0 self-end"
                  style={expandKey > 0 ? { animation: `bar-enter 200ms ease-out ${(BASE_CELLS + 1) * 28}ms both` } : undefined}
                  disabled={!activeSequenceId || !seqSelectedStepId || isSeqRunning}
                  title="Remove selected frame from sequence"
                  onClick={handleRemoveSelectedStep}
                >
                  <Trash size={14} />
                  Del
                </Button>
              </>
            ) : (
              <>
                <Button
                  key={`send-${expandKey}`}
                  variant="primary"
                  className="!text-[11px] !py-1.5 leading-4 !px-0 !w-[66px] shrink-0 self-end"
                  style={expandKey > 0 ? { animation: `bar-enter 200ms ease-out ${BASE_CELLS * 28}ms both` } : undefined}
                  onClick={() => {
                    setSendFlying(true);
                    setTimeout(() => setSendFlying(false), 550);
                    handleSend();
                  }}
                >
                  <span className={sendFlying ? 'icon-send-cycle' : ''}>
                    <PaperPlaneTilt size={14} />
                  </span>
                  Send
                </Button>
                <Button
                  key={`save-${expandKey}`}
                  variant="primary"
                  intent="info"
                  className="!text-[11px] !py-1.5 leading-4 !px-0 !w-[66px] shrink-0 self-end"
                  style={expandKey > 0 ? { animation: `bar-enter 200ms ease-out ${(BASE_CELLS + 1) * 28}ms both` } : undefined}
                  disabled={!activeCmd && !allBytes.some((b) => b?.trim())}
                  title="Save command to list"
                  onClick={openSaveModal}
                >
                  <Bookmark size={14} />
                  Save
                </Button>
              </>
            )}
          </div>

        </div>
      </div>

      {/* Byte dropdown portal */}
      {dropdown && createPortal(
        <div
          id="cmd-dropdown"
          className="fixed rounded-md shadow-2xl z-[9999] py-0.5"
          style={{
            top: dropdown.y, left: dropdown.x, minWidth: dropdown.width,
            background: 'var(--surface-overlay)',
            border: '1px solid var(--border-strong)',
          }}
        >
          {dropdown.options.map((opt) => (
            <div
              key={opt.val}
              className="px-2.5 py-1 text-xs font-mono cursor-pointer flex items-center gap-2 transition-colors"
              style={{ color: 'var(--text-primary)' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
              onClick={() => {
                const i = dropdown.cellIdx;
                setCellValue(i, opt.val);
                setShownValues((prev) => { const n = [...prev]; n[i] = opt.val; return n; });
                setDropdown(null);
              }}
            >
              <span style={{ color: 'var(--accent)' }}>{opt.val}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{opt.label}</span>
            </div>
          ))}
        </div>,
        document.body
      )}

      {saveSnapshot && (
        <SaveCommandModal
          defaultName={saveSnapshot.defaultName}
          cmdKey={saveSnapshot.cmdKey}
          bytes={saveSnapshot.bytes}
          onClose={() => setSaveSnapshot(null)}
        />
      )}
    </div>
  );
}
