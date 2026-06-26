import { useState, useRef, useEffect, Fragment } from 'react'
import { PaperPlaneTilt, CheckCircle } from '@phosphor-icons/react'

type RowType = 'tx' | 'rx'

const MONO = "'JetBrains Mono', monospace"
const SANS = "'Inter', system-ui, sans-serif"

const DEMO = {
  tx: {
    pid: 'FC',
    label: 'TX',
    name: 'Connect',
    counter: 1,
    time: '0 ms',
    hex: 'FC 00',
    color: 'var(--tx)',
    bg:      'color-mix(in srgb, var(--tx) 5%, transparent)',
    bgHover: 'color-mix(in srgb, var(--tx) 10%, transparent)',
    fields: [
      ['mode', '0x00 (0)'],
    ] as [string, string][],
  },
  rx: {
    pid: 'FF',
    label: 'RX',
    name: 'Positive Response',
    counter: 2,
    time: '1 ms',
    hex: 'FF 01 C0 00 00 1F 1F 00',
    color: 'var(--rx)',
    bg:      'color-mix(in srgb, var(--rx) 4%, transparent)',
    bgHover: 'color-mix(in srgb, var(--rx) 8%, transparent)',
    fields: [
      ['resource',           '0x01 (1)'],
      ['comm_mode_basic',    '0xC0 (192)'],
      ['max_cto',            '0x1F (31)'],
      ['max_dto',            '0x1F (31)'],
      ['proto_layer_ver',    '0x01 (1)'],
      ['transport_layer_ver','0x01 (1)'],
    ] as [string, string][],
  },
}

const FIELD_FADE_CSS = `
  @keyframes xcb-field-fade {
    from { opacity: 0; transform: translateX(-4px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  .xcb-field-fade { animation: xcb-field-fade 150ms ease both; }
`

function Icon({ type, color }: { type: RowType; color: string }) {
  const s = { color, flexShrink: 0 } as React.CSSProperties
  return type === 'tx'
    ? <PaperPlaneTilt size={12} style={s} />
    : <CheckCircle    size={12} style={s} />
}

export function PacketExpandDemo({ type }: { type: RowType }) {
  const d = DEMO[type]
  const [open, setOpen]           = useState(false)
  const [everOpened, setEverOpened] = useState(false)
  const [openKey, setOpenKey]     = useState(0)
  const [hovered, setHovered]     = useState(false)
  const prevOpen = useRef(false)

  useEffect(() => {
    if (open && !prevOpen.current) setOpenKey(k => k + 1)
    prevOpen.current = open
  }, [open])

  const toggle = () => {
    if (!open) setEverOpened(true)
    setOpen(o => !o)
  }

  return (
    <>
      <style>{FIELD_FADE_CSS}</style>
      <div style={{ borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 4 }}>

        {/* ── Row ── */}
        <div
          role="button"
          onClick={toggle}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            display: 'grid',
            gridTemplateColumns: '200px 110px 1fr',
            position: 'relative',
            background: hovered ? d.bgHover : d.bg,
            paddingRight: 16,
            cursor: 'pointer',
            transition: 'background 70ms',
            userSelect: 'none',
          }}
        >
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
            borderRadius: '0 2px 2px 0',
            background: d.color,
            boxShadow: `3px 0 10px color-mix(in srgb, ${d.color} 45%, transparent)`,
          }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 12, paddingTop: 8, paddingBottom: 8, minWidth: 0 }}>
            <Icon type={type} color={d.color} />
            <span style={{ fontFamily: SANS, fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {d.name}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
              #{d.counter}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', paddingTop: 8, paddingBottom: 8, fontFamily: MONO, fontSize: 11, color: 'var(--text-muted)' }}>
            {d.time}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingTop: 8, paddingBottom: 8, fontFamily: MONO, fontSize: 11, flexWrap: 'wrap', minWidth: 0 }}>
            {d.hex.split(' ').map((b, i) => <span key={i} style={{ color: d.color }}>{b}</span>)}
          </div>
        </div>

        {/* ── Expand panel — grid-template-rows trick, same as app ── */}
        <div style={{
          display: 'grid',
          gridTemplateRows: open ? '1fr' : '0fr',
          transition: 'grid-template-rows 160ms ease',
          borderLeft: `3px solid ${d.color}`,
          background: 'var(--surface-overlay)',
          borderBottom: open ? '1px solid var(--border)' : 'none',
        }}>
          <div style={{ minHeight: 0, overflow: 'hidden' }}>
            {everOpened && (
              <div style={{ padding: '10px 16px' }}>
                <div style={{
                  fontFamily: MONO, fontSize: 10, fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  color: d.color, marginBottom: 8,
                }}>
                  {d.label} · PID 0x{d.pid}
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '150px 1fr',
                  rowGap: 4,
                  fontFamily: MONO,
                  fontSize: 11,
                }}>
                  {d.fields.map(([k, v], idx) => (
                    <Fragment key={`${k}-${openKey}`}>
                      <span className="xcb-field-fade" style={{ color: 'var(--text-muted)', animationDelay: `${idx * 45}ms` }}>
                        {k}
                      </span>
                      <span className="xcb-field-fade" style={{ color: d.color, animationDelay: `${idx * 45 + 22}ms` }}>
                        {v}
                      </span>
                    </Fragment>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </>
  )
}
