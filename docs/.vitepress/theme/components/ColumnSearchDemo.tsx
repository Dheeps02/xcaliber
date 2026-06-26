import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUp, ArrowDown, Funnel, X, PaperPlaneTilt, CheckCircle, XCircle } from '@phosphor-icons/react'

type RowType = 'tx' | 'rx' | 'err'

const MONO = "'JetBrains Mono', monospace"
const SANS = "'Inter', system-ui, sans-serif"

function dirColor(type: RowType): string {
  if (type === 'tx') return 'var(--tx)'
  if (type === 'rx') return 'var(--rx)'
  return 'var(--status-err)'
}

function dirBg(type: RowType): string {
  if (type === 'tx') return 'color-mix(in srgb, var(--tx) 5%, transparent)'
  if (type === 'rx') return 'color-mix(in srgb, var(--rx) 4%, transparent)'
  return 'color-mix(in srgb, var(--status-err) 5%, transparent)'
}

function Icon({ type, color }: { type: RowType; color: string }) {
  const s = { color, flexShrink: 0 } as React.CSSProperties
  if (type === 'tx') return <PaperPlaneTilt size={12} style={s} />
  if (type === 'rx') return <CheckCircle    size={12} style={s} />
  return                    <XCircle        size={12} style={s} />
}

const ROWS: Array<{ type: RowType; name: string; pid: string; counter: number; time: string; hex: string }> = [
  { type: 'tx',  name: 'Connect',          pid: 'FC', counter: 1, time: '0 ms', hex: 'FC 00' },
  { type: 'rx',  name: 'Positive Response', pid: 'FF', counter: 2, time: '1 ms', hex: 'FF 01 C0 00 00 1F 1F 00' },
  { type: 'tx',  name: 'SET_DAQ_PTR',       pid: 'E5', counter: 3, time: '2 ms', hex: 'E5 00 00 00 00 00 00 00' },
  { type: 'rx',  name: 'Positive Response', pid: 'FF', counter: 4, time: '3 ms', hex: 'FF 00 00 00 00 00 00 00' },
  { type: 'tx',  name: 'WRITE_DAQ',         pid: 'E4', counter: 5, time: '4 ms', hex: 'E4 00 10 00 02 00 12 34' },
  { type: 'rx',  name: 'Positive Response', pid: 'FF', counter: 6, time: '5 ms', hex: 'FF 00 00 00 00 00 00 00' },
  { type: 'err', name: 'Negative Response', pid: 'FE', counter: 7, time: '6 ms', hex: 'FE 20' },
]

// ── FadeIn ────────────────────────────────────────────────────────────────────

function FadeIn({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.opacity = '0'
    const id = requestAnimationFrame(() => { if (el) el.style.opacity = '' })
    return () => cancelAnimationFrame(id)
  }, [])
  return (
    <span ref={ref} style={{ transition: 'opacity 150ms ease', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
      {children}
    </span>
  )
}

// ── SortIcon ──────────────────────────────────────────────────────────────────

function SortIcon({ isSorted, dir }: { isSorted: boolean; dir: 'asc' | 'desc' }) {
  const upRef   = useRef<HTMLSpanElement>(null)
  const downRef = useRef<HTMLSpanElement>(null)
  const initRef = useRef(false)

  useLayoutEffect(() => {
    const up   = upRef.current
    const down = downRef.current
    if (!up || !down) return
    const showDown = isSorted && dir === 'desc'
    if (!initRef.current) {
      initRef.current = true
      up.style.opacity   = showDown ? '0' : '1'
      down.style.opacity = showDown ? '1' : '0'
      up.style.color     = isSorted ? 'var(--accent)' : 'var(--text-muted)'
      return
    }
    up.style.transition = 'none'; down.style.transition = 'none'
    up.style.opacity = '0';       down.style.opacity = '0'
    up.style.color   = isSorted ? 'var(--accent)' : 'var(--text-muted)'
    let cancelled = false
    const rafId = requestAnimationFrame(() => {
      if (cancelled) return
      up.style.transition   = 'opacity 110ms ease'
      down.style.transition = 'opacity 110ms ease'
      up.style.opacity   = showDown ? '0' : '1'
      down.style.opacity = showDown ? '1' : '0'
    })
    return () => { cancelled = true; cancelAnimationFrame(rafId) }
  }, [isSorted, dir])

  return (
    <span style={{ position: 'relative', width: 15, height: 15, flexShrink: 0 }}>
      <span ref={downRef} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
        <ArrowDown size={15} />
      </span>
      <span ref={upRef} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ArrowUp size={15} />
      </span>
    </span>
  )
}

// ── FilterPopover ─────────────────────────────────────────────────────────────

function FilterPopover({ rect, value, onChange, onClose }: {
  rect: DOMRect; value: string; onChange: (v: string) => void; onClose: () => void
}) {
  const popRef   = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  let x = rect.left
  if (x + 168 > window.innerWidth - 8) x = Math.max(8, window.innerWidth - 168 - 8)

  useEffect(() => {
    inputRef.current?.focus()
    const onDown = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return createPortal(
    <div
      ref={popRef}
      style={{
        position: 'fixed',
        top: rect.bottom + 4, left: x, width: 168,
        background: 'var(--surface-raised)',
        border: '1px solid var(--border-strong)',
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
        padding: 8,
        zIndex: 9999,
      }}
    >
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Filter…"
          style={{
            width: '100%', fontFamily: MONO, fontSize: 12,
            background: 'var(--surface-base)',
            border: '1px solid var(--border)',
            borderRadius: 5, padding: '4px 8px',
            color: 'var(--text-primary)', outline: 'none',
            boxSizing: 'border-box',
            paddingRight: value ? 22 : 8,
          } as React.CSSProperties}
        />
        {value && (
          <button
            onClick={() => { onChange(''); inputRef.current?.focus() }}
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
    </div>,
    document.body
  )
}

// ── PacketRow ─────────────────────────────────────────────────────────────────

function PacketRow({ type, name, counter, time, hex }: typeof ROWS[number]) {
  const color = dirColor(type)
  const bg    = dirBg(type)
  return (
    <div style={{ borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 3 }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '200px 110px 1fr',
        position: 'relative', background: bg, paddingRight: 16,
      }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
          borderRadius: '0 2px 2px 0', background: color,
          boxShadow: `3px 0 10px color-mix(in srgb, ${color} 45%, transparent)`,
        }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 12, paddingTop: 8, paddingBottom: 8, minWidth: 0 }}>
          <Icon type={type} color={color} />
          <span style={{ fontFamily: SANS, fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
            #{counter}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', paddingTop: 8, paddingBottom: 8, fontFamily: MONO, fontSize: 11, color: 'var(--text-muted)' }}>
          {time}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingTop: 8, paddingBottom: 8, fontFamily: MONO, fontSize: 11, flexWrap: 'wrap', minWidth: 0 }}>
          {hex.split(' ').map((b, i) => <span key={i} style={{ color }}>{b}</span>)}
        </div>
      </div>
    </div>
  )
}

// ── ColumnSearchDemo ──────────────────────────────────────────────────────────

const COLS = [
  { key: 'command', header: 'Command', width: 200, sortable: true, filterable: true },
  { key: 'time',    header: 'Time',    width: 110, sortable: true, filterable: false },
  { key: 'hex',     header: 'Hex',     flex: true, sortable: false, filterable: true },
] as const

export function ColumnSearchDemo() {
  const [sort, setSort]           = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null)
  const [filters, setFilters]     = useState<Record<string, string>>({})
  const [filterOpen, setFilterOpen] = useState<string | null>(null)
  const [filterRect, setFilterRect] = useState<DOMRect | null>(null)
  const [hoveredCol, setHoveredCol] = useState<string | null>(null)

  let visible = ROWS.filter(r => {
    const cmd = filters['command']?.trim()
    const hex = filters['hex']?.trim()
    const cmdOk = !cmd || r.name.toLowerCase().includes(cmd.toLowerCase()) || r.pid.toLowerCase().includes(cmd.toLowerCase())
    const hexOk = !hex || r.hex.toUpperCase().includes(hex.toUpperCase())
    return cmdOk && hexOk
  })

  if (sort) {
    visible = [...visible].sort((a, b) => {
      const av = sort.key === 'command' ? a.name : sort.key === 'time' ? a.counter : a.hex
      const bv = sort.key === 'command' ? b.name : sort.key === 'time' ? b.counter : b.hex
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }

  function toggleSort(key: string) {
    setSort(prev => {
      if (prev?.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

  function openFilter(key: string, btn: HTMLElement) {
    if (filterOpen === key) { setFilterOpen(null); return }
    setFilterRect(btn.getBoundingClientRect())
    setFilterOpen(key)
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: 4 }}>

      {/* ── Header ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '200px 110px 1fr',
        background: 'var(--surface-base)',
        borderBottom: '1px solid var(--border)',
        userSelect: 'none',
      }}>
        {COLS.map(col => {
          const isSorted     = sort?.key === col.key
          const hasFilter    = !!filters[col.key]?.trim()
          const isHov        = hoveredCol === col.key
          const isFilterOpen = filterOpen === col.key

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
              <span style={{
                fontSize: 10, fontWeight: 600, letterSpacing: '0.09em',
                textTransform: 'uppercase',
                color: isSorted || hasFilter ? 'var(--text-secondary)' : 'var(--text-muted)',
                transition: 'color 120ms',
                fontFamily: SANS,
              }}>
                {col.header}
              </span>

              {col.filterable && (isHov || hasFilter || isFilterOpen) && (
                <FadeIn>
                  <button
                    onClick={e => { e.stopPropagation(); openFilter(col.key, e.currentTarget) }}
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

              {col.sortable && (isHov || isSorted) && (
                <FadeIn>
                  <SortIcon isSorted={isSorted} dir={sort?.dir ?? 'asc'} />
                </FadeIn>
              )}

              <div style={{ flex: 1 }} />

              {!col.flex && (
                <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 1, height: '55%', background: 'var(--border)', opacity: isHov ? 1 : 0, transition: 'opacity 120ms' }} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Rows ── */}
      <div style={{ padding: '6px 6px 3px' }}>
        {visible.length > 0
          ? visible.map(row => <PacketRow key={row.counter} {...row} />)
          : <div style={{ padding: '16px', textAlign: 'center', fontFamily: MONO, fontSize: 11, color: 'var(--text-muted)' }}>No packets match</div>
        }
      </div>

      {filterOpen && filterRect && (
        <FilterPopover
          rect={filterRect}
          value={filters[filterOpen] ?? ''}
          onChange={v => setFilters(prev => ({ ...prev, [filterOpen]: v }))}
          onClose={() => setFilterOpen(null)}
        />
      )}

    </div>
  )
}
