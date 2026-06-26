import { useState } from 'react'
import { Broom } from '@phosphor-icons/react'

const SWEEP_CSS = `
  @keyframes icon-broom-sweep {
    0%   { transform: rotate(0deg)   translateX(0); }
    10%  { transform: rotate(-12deg) translateX(0); }
    32%  { transform: rotate(15deg)  translateX(-4px); }
    46%  { transform: rotate(3deg)   translateX(-1px); }
    64%  { transform: rotate(20deg)  translateX(-6px); }
    76%  { transform: rotate(14deg)  translateX(-4px); }
    88%  { transform: rotate(5deg)   translateX(-1px); }
    100% { transform: rotate(0deg)   translateX(0); }
  }
  .xcbd-broom-sweep { animation: icon-broom-sweep 560ms linear both; }
`

export function BroomButtonDemo() {
  const [hovered,  setHovered]  = useState(false)
  const [sweeping, setSweeping] = useState(false)

  function handleClick() {
    if (sweeping) return
    setSweeping(true)
    setTimeout(() => setSweeping(false), 560)
  }

  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, padding: 0, borderRadius: 5, flexShrink: 0,
    background: 'transparent', backgroundImage: 'none',
    border: '1px solid transparent',
    boxShadow: 'none',
    cursor: 'pointer',
    color: hovered ? 'var(--text-secondary)' : 'var(--text-muted)',
    transition: 'box-shadow 80ms ease-out, color 80ms ease-out, border-color 80ms ease-out, background 80ms ease-out',
    ...(hovered && {
      background: 'var(--shine-2)',
      backgroundImage: 'linear-gradient(180deg, var(--shine-3) 0%, transparent 100%)',
      borderColor: 'var(--border)',
      boxShadow: 'inset 0 1px 0 var(--shine-3), 0 1px 3px var(--shadow-6)',
    }),
  }

  return (
    <>
      <style>{SWEEP_CSS}</style>
      <button
        style={base}
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title="Clear"
      >
        <span className={sweeping ? 'xcbd-broom-sweep' : ''}>
          <Broom size={16} weight={hovered || sweeping ? 'fill' : 'regular'} />
        </span>
      </button>
    </>
  )
}
