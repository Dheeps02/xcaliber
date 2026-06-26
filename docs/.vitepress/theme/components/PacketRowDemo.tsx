import { PaperPlaneTilt, CheckCircle, XCircle, Timer } from '@phosphor-icons/react'

type RowType = 'tx' | 'rx' | 'err' | 'timeout'

function dirColor(type: RowType): string {
  if (type === 'tx')      return 'var(--tx)'
  if (type === 'rx')      return 'var(--rx)'
  if (type === 'timeout') return 'var(--status-warn)'
  return 'var(--status-err)'
}

function dirBg(type: RowType): string {
  if (type === 'tx')      return 'color-mix(in srgb, var(--tx) 5%, transparent)'
  if (type === 'rx')      return 'color-mix(in srgb, var(--rx) 4%, transparent)'
  if (type === 'timeout') return 'color-mix(in srgb, var(--status-warn) 5%, transparent)'
  return 'color-mix(in srgb, var(--status-err) 5%, transparent)'
}

const MONO = "'JetBrains Mono', monospace"
const SANS = "'Inter', system-ui, sans-serif"

const config: Record<RowType, { name: string; counter: number; time: string; hex: string | null }> = {
  tx:      { name: 'Connect',           counter: 1, time: '0 ms',    hex: 'FC 00' },
  rx:      { name: 'Positive Response', counter: 2, time: '1 ms',    hex: 'FF 01 C0 00 00 1F 1F 00' },
  err:     { name: 'Negative Response', counter: 3, time: '2 ms',    hex: 'FE 20' },
  timeout: { name: 'Timeout',           counter: 4, time: '1002 ms', hex: null },
}

function Icon({ type, color }: { type: RowType; color: string }) {
  const s = { color, flexShrink: 0 } as React.CSSProperties
  if (type === 'tx')      return <PaperPlaneTilt size={12} style={s} />
  if (type === 'rx')      return <CheckCircle    size={12} style={s} />
  if (type === 'err')     return <XCircle        size={12} style={s} />
  return                         <Timer          size={12} style={s} />
}

export function PacketRowDemo({ type }: { type: RowType }) {
  const row   = config[type]
  const color = dirColor(type)
  const bg    = dirBg(type)

  return (
    <div style={{ borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 4 }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '200px 110px 1fr',
        position: 'relative',
        background: bg,
        paddingRight: 16,
      }}>
        {/* left accent bar — matches rowDecoration in PacketTrace.tsx */}
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
          borderRadius: '0 2px 2px 0',
          background: color,
          boxShadow: `3px 0 10px color-mix(in srgb, ${color} 45%, transparent)`,
        }} />

        {/* Command column */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 12, paddingTop: 8, paddingBottom: 8, minWidth: 0 }}>
          <Icon type={type} color={color} />
          <span style={{ fontFamily: SANS, fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.name}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
            #{row.counter}
          </span>
        </div>

        {/* Time column */}
        <div style={{ display: 'flex', alignItems: 'center', paddingTop: 8, paddingBottom: 8, fontFamily: MONO, fontSize: 11, color: 'var(--text-muted)' }}>
          {row.time}
        </div>

        {/* Hex column */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingTop: 8, paddingBottom: 8, fontFamily: MONO, fontSize: 11, flexWrap: 'wrap', minWidth: 0 }}>
          {row.hex
            ? row.hex.split(' ').map((b, i) => <span key={i} style={{ color }}>{b}</span>)
            : <span style={{ color: 'var(--text-muted)' }}>—</span>
          }
        </div>
      </div>
    </div>
  )
}
