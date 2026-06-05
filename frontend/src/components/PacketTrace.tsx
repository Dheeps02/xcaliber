import {
  useState, useRef, useEffect, useMemo, Fragment,
} from 'react';
import { Eraser } from '@phosphor-icons/react';
import { useAppStore } from '../stores/app-store';
import { formatLabel, formatTime } from '../lib/utils';
import type { PacketEntry } from '../lib/types';
import { flattenDecoded, formatValue } from './PacketDetail';
import { Button } from './ui/Button';
import { SegmentControl } from './ui/SegmentControl';
import { Toggle } from './ui/Toggle';
import { DataTable } from './ui/DataTable';
import type { ColDef } from './ui/DataTable';

// ── types ─────────────────────────────────────────────────────────────────────

type DirFilter = 'all' | 'tx' | 'rx';

// ── helpers ───────────────────────────────────────────────────────────────────

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

// ── ExpandPanel ───────────────────────────────────────────────────────────────

function ExpandPanel({ p, open }: { p: PacketEntry; open: boolean }) {
  const isErr  = p.pid === 'FE';
  const effectiveDir = isErr ? 'err' : p.direction;
  const color  = dirColor(effectiveDir);
  const label  = p.direction === 'tx' ? 'TX' : isErr ? 'ERR' : 'RX';
  const allFields = flattenDecoded(p.decoded);
  const rows   = p.direction === 'tx'
    ? allFields.filter(([k]) => k !== 'command')
    : allFields;

  const [openKey, setOpenKey] = useState(0);
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) setOpenKey((k) => k + 1);
    prevOpenRef.current = open;
  }, [open]);

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
            {rows.length > 0 ? rows.map(([k, v], idx) => (
              <Fragment key={`${k}-${openKey}`}>
                <span className="field-fade" style={{ color: 'var(--text-muted)', animationDelay: `${idx * 45}ms` }}>{k}</span>
                <span className="field-fade" style={{ color, animationDelay: `${idx * 45 + 22}ms` }}>{formatValue(v)}</span>
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

// ── HexCells ──────────────────────────────────────────────────────────────────

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

// ── Column definitions ────────────────────────────────────────────────────────

function makeColumns(): ColDef<PacketEntry>[] {
  return [
    {
      key: 'command',
      header: 'Command',
      width: 200,
      minWidth: 120,
      sortable: true,
      sortValue: (p) => getCommandName(p),
      filterable: true,
      filterMatch: (p, v) => {
        const lower = v.toLowerCase();
        return (
          getCommandName(p).toLowerCase().includes(lower) ||
          p.pid.toLowerCase().includes(lower)
        );
      },
      renderCell: (p) => (
        <div
          className="flex items-center gap-2 py-2 min-w-0 overflow-hidden"
          style={{ paddingLeft: 20 }}
        >
          <span className="font-medium text-[12px] truncate" style={{ color: 'var(--text-primary)' }}>
            {getCommandName(p)}
          </span>
          <span className="text-[10px] font-mono shrink-0" style={{ color: 'var(--text-muted)' }}>
            #{p.counter}
          </span>
        </div>
      ),
    },
    {
      key: 'time',
      header: 'Time',
      width: 110,
      minWidth: 70,
      sortable: true,
      sortValue: (p) => p.timestamp_ms,
      renderCell: (p) => (
        <div className="flex items-center py-2 font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {formatTime(p.timestamp_ms)}
        </div>
      ),
    },
    {
      key: 'hex',
      header: 'Hex',
      flex: true,
      filterable: true,
      filterMatch: (p, v) => p.hex.toUpperCase().includes(v.toUpperCase()),
      renderCell: (p) => {
        const isErr = p.pid === 'FE';
        const effectiveDir = isErr ? 'err' : p.direction;
        return (
          <div className="flex items-center gap-1 py-2 font-mono text-[11px] flex-wrap min-w-0">
            <HexCells hex={p.hex} dir={effectiveDir} />
          </div>
        );
      },
    },
  ];
}

const COLUMNS = makeColumns();

// ── PacketTrace ───────────────────────────────────────────────────────────────

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

  const [dirFilter, setDirFilter]   = useState<DirFilter>('all');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [isClearing, setIsClearing]   = useState(false);
  const [eraserHovered, setEraserHovered]   = useState(false);
  const [eraserWiggling, setEraserWiggling] = useState(false);
  const [, setVersion] = useState(0);

  const cleanedUpIds    = useRef<Set<number>>(new Set());
  const staggerDelays   = useRef<Map<number, number>>(new Map());
  const staggerCounter  = useRef(0);
  const lastWatermarkRef = useRef<number | null>(null);

  // Reset stagger counter on new watermark
  if (animationWatermark !== lastWatermarkRef.current) {
    staggerCounter.current = 0;
    lastWatermarkRef.current = animationWatermark;
  }

  // Animation cleanup
  useEffect(() => {
    if (animationWatermark === null) return;
    const liveIds = packets
      .filter((p) => p.id > animationWatermark && !cleanedUpIds.current.has(p.id))
      .map((p) => p.id);
    if (liveIds.length === 0) return;
    const maxDelay = liveIds.reduce((m, id) => Math.max(m, staggerDelays.current.get(id) ?? 0), 0);
    const t = setTimeout(() => {
      liveIds.forEach((id) => cleanedUpIds.current.add(id));
      setVersion((v) => v + 1);
    }, maxDelay + 400);
    return () => clearTimeout(t);
  }, [packets, animationWatermark]);

  const dirFilteredPackets = useMemo(
    () => packets.filter((p) => dirFilter === 'all' || p.direction === dirFilter),
    [packets, dirFilter]
  );

  function toggleRow(p: PacketEntry) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(p.id)) next.delete(p.id); else next.add(p.id);
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

  // ── Row prop callbacks ───────────────────────────────────────────────────

  function effectiveDir(p: PacketEntry) {
    return p.pid === 'FE' ? 'err' : p.direction;
  }

  function rowStyle(p: PacketEntry): React.CSSProperties {
    const isNew = animationWatermark !== null && p.id > animationWatermark && !cleanedUpIds.current.has(p.id);
    if (isNew && !staggerDelays.current.has(p.id)) {
      staggerDelays.current.set(p.id, Math.min(staggerCounter.current * 60, 180));
      staggerCounter.current++;
    }
    const isExpanded = expandedIds.has(p.id);
    return {
      background: isExpanded ? 'var(--surface-overlay)' : dirBgColor(effectiveDir(p)),
      borderBottom: '1px solid var(--border)',
      paddingRight: 16,
      ...(isNew ? { animationDelay: `${staggerDelays.current.get(p.id) ?? 0}ms` } : {}),
    };
  }

  function rowHoverStyle(p: PacketEntry): React.CSSProperties {
    if (expandedIds.has(p.id)) return {};
    return { background: dirBgHover(effectiveDir(p)) };
  }

  function rowClassName(p: PacketEntry): string {
    const isNew = animationWatermark !== null && p.id > animationWatermark && !cleanedUpIds.current.has(p.id);
    return isNew ? 'packet-new' : '';
  }

  function wrapperClassName(p: PacketEntry): string {
    return isClearing ? 'row-out' : '';
  }

  function rowDecoration(p: PacketEntry): React.ReactNode {
    const dir = effectiveDir(p);
    const color = dirColor(dir);
    return (
      <div
        style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: 3,
          borderRadius: '0 2px 2px 0',
          background: color,
          boxShadow: `3px 0 10px color-mix(in srgb, ${color} 45%, transparent)`,
        }}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div
        className="xcb-glass flex items-center justify-between px-3.5 shrink-0"
        style={{ height: 36, borderBottom: '1px solid var(--border)' }}
      >
        <SegmentControl items={DIR_ITEMS} value={dirFilter} onChange={setDirFilter} size="sm" />

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Toggle checked={autoScroll} onChange={() => setAutoScroll(!autoScroll)} />
            <span
              className="text-[11px] select-none"
              style={{ color: autoScroll ? 'var(--text-primary)' : 'var(--text-muted)' }}
            >Auto-scroll</span>
          </div>

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

      {/* ── Table ───────────────────────────────────────────────────── */}
      <DataTable
        columns={COLUMNS}
        rows={dirFilteredPackets}
        rowKey={(p) => p.id}
        autoScroll={autoScroll}
        onRowClick={toggleRow}
        renderExpand={(p, open) => <ExpandPanel p={p} open={open} />}
        isExpanded={(p) => expandedIds.has(p.id)}
        rowStyle={rowStyle}
        rowHoverStyle={rowHoverStyle}
        rowClassName={rowClassName}
        wrapperClassName={wrapperClassName}
        rowDecoration={rowDecoration}
      />
    </div>
  );
}
