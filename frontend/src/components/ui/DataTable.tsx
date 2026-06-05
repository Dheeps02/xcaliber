import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUp, ArrowDown, Funnel, X } from '@phosphor-icons/react';

// ── FadeIn ────────────────────────────────────────────────────────────────────

function FadeIn({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = '0';
    const id = requestAnimationFrame(() => { if (el) el.style.opacity = ''; });
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <span ref={ref} style={{ transition: 'opacity 150ms ease', display: 'flex', alignItems: 'center', flexShrink: 0, ...style }}>
      {children}
    </span>
  );
}

// ── Column definition ─────────────────────────────────────────────────────────

export interface ColDef<T> {
  key: string;
  header: string;
  width?: number;
  minWidth?: number;
  flex?: boolean;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  filterable?: boolean;
  filterMatch?: (row: T, value: string) => boolean;
  renderCell: (row: T) => React.ReactNode;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface DataTableProps<T> {
  columns: ColDef<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  autoScroll?: boolean;
  onRowClick?: (row: T) => void;
  renderExpand?: (row: T, open: boolean) => React.ReactNode;
  isExpanded?: (row: T) => boolean;
  rowStyle?: (row: T) => React.CSSProperties;
  rowHoverStyle?: (row: T) => React.CSSProperties;
  rowClassName?: (row: T) => string;
  wrapperClassName?: (row: T) => string;
  rowDecoration?: (row: T) => React.ReactNode;
}

// ── DataTable ─────────────────────────────────────────────────────────────────

export function DataTable<T>({
  columns, rows, rowKey, autoScroll,
  onRowClick, renderExpand, isExpanded,
  rowStyle, rowHoverStyle, rowClassName, wrapperClassName, rowDecoration,
}: DataTableProps<T>) {
  const [colWidths]   = useState<number[]>(() => columns.map(c => c.width ?? 120));
  const [sort, setSort]       = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [filterOpen, setFilterOpen] = useState<string | null>(null);
  const [filterRect, setFilterRect] = useState<DOMRect | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | number | null>(null);
  const [hoveredCol, setHoveredCol] = useState<string | null>(null);
  const [reorderKey, setReorderKey] = useState(0);

  const widthsRef = useRef(colWidths);
  widthsRef.current = colWidths;
  const [, forceWidth] = useState(0);

  const bottomRef        = useRef<HTMLDivElement>(null);
  const rowsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [rows, autoScroll]);

  // Reset reorderKey after animation window closes so incoming packets don't inherit the delay
  useEffect(() => {
    if (reorderKey === 0) return;
    const t = setTimeout(() => setReorderKey(0), 500);
    return () => clearTimeout(t);
  }, [reorderKey]);

  // Imperative row reorder animation: force-reflow restart is the only reliable cross-browser approach
  useEffect(() => {
    if (reorderKey === 0 || !rowsContainerRef.current) return;
    const rows = Array.from(
      rowsContainerRef.current.querySelectorAll<HTMLElement>('[data-xcbrow]')
    ).filter(el => !el.classList.contains('packet-new'));
    rows.forEach(el => {
      el.classList.remove('sort-icon-fade');
      void el.offsetHeight; // force reflow — commits the removed state
      el.classList.add('sort-icon-fade');
    });
    const t = setTimeout(() => rows.forEach(el => el.classList.remove('sort-icon-fade')), 200);
    return () => clearTimeout(t);
  }, [reorderKey]);

  // ── Grid template ────────────────────────────────────────────────────────
  const gridCols = columns.map((col, i) =>
    col.flex ? '1fr' : `${widthsRef.current[i]}px`
  ).join(' ');

  // ── Sort + filter ────────────────────────────────────────────────────────
  const displayRows = useMemo(() => {
    let result = rows;

    for (const col of columns) {
      const fv = filters[col.key]?.trim();
      if (!fv) continue;
      if (col.filterMatch) {
        result = result.filter(r => col.filterMatch!(r, fv));
      } else if (col.sortValue) {
        const lower = fv.toLowerCase();
        result = result.filter(r => String(col.sortValue!(r)).toLowerCase().includes(lower));
      }
    }

    if (sort) {
      const col = columns.find(c => c.key === sort.key);
      if (col?.sortValue) {
        result = [...result].sort((a, b) => {
          const av = col.sortValue!(a);
          const bv = col.sortValue!(b);
          const cmp = av < bv ? -1 : av > bv ? 1 : 0;
          return sort.dir === 'asc' ? cmp : -cmp;
        });
      }
    }

    return result;
  }, [rows, filters, sort, columns]);

  // ── Column resize ────────────────────────────────────────────────────────
  function handleResizeStart(e: React.MouseEvent, colIdx: number) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = widthsRef.current[colIdx];
    const minW   = columns[colIdx].minWidth ?? 60;

    function onMove(me: MouseEvent) {
      widthsRef.current[colIdx] = Math.max(minW, startW + me.clientX - startX);
      forceWidth(n => n + 1);
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // ── Sort toggle ──────────────────────────────────────────────────────────
  function toggleSort(key: string) {
    setSort(prev => {
      if (prev?.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc')  return { key, dir: 'desc' };
      return null;
    });
    setReorderKey(k => k + 1);
  }

  // ── Filter open/close ────────────────────────────────────────────────────
  function openFilter(key: string, btn: HTMLElement) {
    if (filterOpen === key) {
      setFilterOpen(null);
      setReorderKey(k => k + 1);
      return;
    }
    setFilterRect(btn.getBoundingClientRect());
    setFilterOpen(key);
  }

  function closeFilter() {
    setFilterOpen(null);
    setReorderKey(k => k + 1);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid', gridTemplateColumns: gridCols,
          position: 'sticky', top: 0, zIndex: 10,
          background: 'var(--surface-base)',
          borderBottom: '1px solid var(--border)',
          userSelect: 'none',
        }}
      >
        {columns.map((col, i) => {
          const isSorted     = sort?.key === col.key;
          const hasFilter    = !!filters[col.key]?.trim();
          const isHov        = hoveredCol === col.key;
          const isFilterOpen = filterOpen === col.key;

          return (
            <div
              key={col.key}
              style={{
                position: 'relative', display: 'flex', alignItems: 'center', gap: 3,
                padding: '5px 8px 5px 12px',
                cursor: col.sortable ? 'pointer' : 'default',
              }}
              onMouseEnter={() => setHoveredCol(col.key)}
              onMouseLeave={() => setHoveredCol(null)}
              onClick={col.sortable ? () => toggleSort(col.key) : undefined}
            >
              {/* Label */}
              <span
                style={{
                  fontSize: 10, fontWeight: 600, letterSpacing: '0.09em',
                  textTransform: 'uppercase',
                  color: isSorted || hasFilter ? 'var(--text-secondary)' : 'var(--text-muted)',
                  transition: 'color 120ms',
                }}
              >
                {col.header}
              </span>

              {/* Filter button — right next to label */}
              {col.filterable && (isHov || hasFilter || isFilterOpen) && (
                <FadeIn>
                  <button
                    onClick={(e) => { e.stopPropagation(); openFilter(col.key, e.currentTarget); }}
                    style={{
                      background: 'none', border: 'none', padding: '1px 2px', cursor: 'pointer',
                      color: hasFilter || isFilterOpen ? 'var(--accent)' : 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', borderRadius: 3, flexShrink: 0,
                    }}
                  >
                    <Funnel size={13} weight={hasFilter ? 'fill' : 'regular'} />
                  </button>
                </FadeIn>
              )}

              {/* Sort icon — after filter, before spacer */}
              {col.sortable && (isHov || isSorted) && (
                <FadeIn style={{ position: 'relative', width: 15, height: 15 }}>
                  <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', opacity: isSorted && sort!.dir === 'desc' ? 1 : 0, transition: 'opacity 110ms ease' }}>
                    <ArrowDown size={15} />
                  </span>
                  <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: isSorted ? 'var(--accent)' : 'var(--text-muted)', opacity: isSorted && sort!.dir === 'desc' ? 0 : 1, transition: 'opacity 110ms ease, color 110ms ease' }}>
                    <ArrowUp size={15} />
                  </span>
                </FadeIn>
              )}

              <div style={{ flex: 1 }} />

              {/* Resize handle */}
              {!col.flex && (
                <div
                  style={{
                    position: 'absolute', right: 0, top: 0, bottom: 0,
                    width: 6, cursor: 'col-resize', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                  onMouseDown={(e) => handleResizeStart(e, i)}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{
                    width: 1, height: '55%',
                    background: 'var(--border)',
                    opacity: isHov ? 1 : 0,
                    transition: 'opacity 120ms',
                  }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Rows ────────────────────────────────────────────────────── */}
      <div ref={rowsContainerRef} style={{ flex: 1, overflowY: 'auto' }}>
        {displayRows.map((row) => {
          const key     = rowKey(row);
          const isHov   = hoveredRow === key;
          const expanded = isExpanded?.(row) ?? false;
          const base    = rowStyle?.(row);
          const hover   = isHov && rowHoverStyle ? rowHoverStyle(row) : undefined;
          const wrapCls = wrapperClassName?.(row) ?? '';
          const rowCls  = rowClassName?.(row) ?? '';

          return (
            <div key={key} className={wrapCls}>
              <div
                data-xcbrow=""
                className={rowCls}
                style={{
                  display: 'grid', gridTemplateColumns: gridCols,
                  position: 'relative',
                  cursor: onRowClick ? 'pointer' : 'default',
                  transition: 'background 70ms',
                  ...base, ...hover,
                }}
                onClick={() => onRowClick?.(row)}
                onMouseEnter={() => setHoveredRow(key)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                {rowDecoration?.(row)}
                {columns.map(col => (
                  <div key={col.key} style={{ minWidth: 0 }}>
                    {col.renderCell(row)}
                  </div>
                ))}
              </div>
              {renderExpand?.(row, expanded)}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* ── Filter popover ───────────────────────────────────────────── */}
      {filterOpen && filterRect && createPortal(
        <FilterPopover
          rect={filterRect}
          value={filters[filterOpen] ?? ''}
          onChange={v => setFilters(prev => ({ ...prev, [filterOpen]: v }))}
          onClose={closeFilter}
        />,
        document.body
      )}
    </div>
  );
}

// ── FilterPopover ─────────────────────────────────────────────────────────────

interface FilterPopoverProps {
  rect: DOMRect;
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
}

function FilterPopover({ rect, value, onChange, onClose }: FilterPopoverProps) {
  const popRef   = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  let x = rect.left;
  if (x + 168 > window.innerWidth - 8) x = Math.max(8, window.innerWidth - 168 - 8);

  useEffect(() => {
    inputRef.current?.focus();
    const onDown = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={popRef}
      className="xcb-glass fixed rounded-lg z-[9999]"
      style={{
        top: rect.bottom + 4, left: x, width: 168,
        border: '1px solid var(--border-strong)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        padding: 8,
      }}
    >
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Filter…"
          className="xcb-input w-full px-2 py-1 text-xs font-mono focus:outline-none"
          style={{ paddingRight: value ? 22 : undefined }}
        />
        {value && (
          <button
            onClick={() => { onChange(''); inputRef.current?.focus(); }}
            style={{
              position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              color: 'var(--text-muted)', display: 'flex',
            }}
          >
            <X size={10} />
          </button>
        )}
      </div>
    </div>
  );
}
