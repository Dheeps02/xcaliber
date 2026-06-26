import { useState } from 'react'
import { PaperPlaneTilt, CheckCircle, XCircle } from '@phosphor-icons/react'

type RowType = 'tx' | 'rx' | 'err'
type Filter  = 'all' | 'tx' | 'rx'

const MONO = "'JetBrains Mono', monospace"
const SANS = "'Inter', system-ui, sans-serif"

function dirColor(type: RowType): string {
  if (type === 'tx')  return 'var(--tx)'
  if (type === 'rx')  return 'var(--rx)'
  return 'var(--status-err)'
}

function dirBg(type: RowType): string {
  if (type === 'tx')  return 'color-mix(in srgb, var(--tx) 5%, transparent)'
  if (type === 'rx')  return 'color-mix(in srgb, var(--rx) 4%, transparent)'
  return 'color-mix(in srgb, var(--status-err) 5%, transparent)'
}

function Icon({ type, color }: { type: RowType; color: string }) {
  const s = { color, flexShrink: 0 } as React.CSSProperties
  if (type === 'tx')  return <PaperPlaneTilt size={12} style={s} />
  if (type === 'rx')  return <CheckCircle    size={12} style={s} />
  return                     <XCircle        size={12} style={s} />
}

const ROWS: Array<{ type: RowType; name: string; counter: number; time: string; hex: string }> = [
  { type: 'tx',  name: 'Connect',           counter: 1, time: '0 ms',  hex: 'FC 00' },
  { type: 'rx',  name: 'Positive Response', counter: 2, time: '1 ms',  hex: 'FF 01 C0 00 00 1F 1F 00' },
  { type: 'tx',  name: 'Short Upload',      counter: 3, time: '2 ms',  hex: 'F4 00 04 00 00 00 00 00' },
  { type: 'rx',  name: 'Positive Response', counter: 4, time: '3 ms',  hex: 'FF 04 00 00 00 00 00 00' },
  { type: 'err', name: 'Negative Response', counter: 5, time: '4 ms',  hex: 'FE 20' },
]

const SEGMENTS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'tx',  label: 'TX' },
  { id: 'rx',  label: 'RX' },
]

function segColor(id: Filter): string {
  if (id === 'tx') return 'var(--tx)'
  if (id === 'rx') return 'var(--rx)'
  return 'var(--accent)'
}

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

export function DirectionFilterDemo() {
  const [filter, setFilter] = useState<Filter>('all')

  const visible = ROWS.filter(r => {
    if (filter === 'all') return true
    if (filter === 'tx')  return r.type === 'tx'
    return r.type === 'rx' || r.type === 'err'
  })

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: 4 }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '8px 10px',
        background: 'var(--surface-raised)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          display: 'flex', background: 'var(--surface-base)',
          borderRadius: 6, padding: 2, gap: 1,
        }}>
          {SEGMENTS.map(seg => {
            const active = filter === seg.id
            const c = segColor(seg.id)
            return (
              <button
                key={seg.id}
                onClick={() => setFilter(seg.id)}
                style={{
                  fontFamily: MONO, fontSize: 11, fontWeight: 500,
                  padding: '3px 12px', borderRadius: 4, border: 'none',
                  cursor: 'pointer',
                  background: active ? `color-mix(in srgb, ${c} 18%, var(--surface-overlay))` : 'transparent',
                  color: active ? c : 'var(--text-muted)',
                  transition: 'background 120ms, color 120ms',
                }}
              >
                {seg.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Rows */}
      <div style={{ padding: '6px 6px 3px' }}>
        {visible.map(row => <PacketRow key={row.counter} {...row} />)}
      </div>
    </div>
  )
}
