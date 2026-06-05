import { useState, useRef, useEffect } from 'react';

interface DialInputProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
}

const REEL_W       = 14;
const TICK_SPACING = 5;
const PX_PER_STEP  = TICK_SPACING;

export function DialInput({ value, onChange, min, max, step = 1, style, inputStyle }: DialInputProps) {
  const [phase, setPhase]           = useState(0);
  const [active, setActive]         = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const inputRef    = useRef<HTMLInputElement>(null);
  const reelRef     = useRef<HTMLDivElement>(null);
  const activeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spinRef     = useRef<(delta: number) => void>(() => {});

  useEffect(() => () => { if (activeTimer.current) clearTimeout(activeTimer.current); }, []);

  function clamp(n: number) {
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    return n;
  }

  function flash() {
    setActive(true);
    if (activeTimer.current) clearTimeout(activeTimer.current);
    activeTimer.current = setTimeout(() => setActive(false), 350);
  }

  spinRef.current = (delta: number) => {
    const next = clamp(value + delta * step);
    if (next !== value) {
      onChange(next);
      setPhase(p => p + delta);
    }
    flash();
  };

  useEffect(() => {
    const handler = (e: WheelEvent) => { e.preventDefault(); spinRef.current(e.deltaY > 0 ? -1 : 1); };
    const input   = inputRef.current;
    const reel    = reelRef.current;
    input?.addEventListener('wheel', handler, { passive: false });
    reel?.addEventListener('wheel', handler, { passive: false });
    return () => {
      input?.removeEventListener('wheel', handler);
      reel?.removeEventListener('wheel', handler);
    };
  }, []);

  function handleReelMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    setIsDragging(true);
    const startY     = e.clientY;
    const startVal   = value;
    const startPhase = phase;
    let prevSteps    = 0;

    function onMove(me: MouseEvent) {
      const steps  = Math.round((startY - me.clientY) / 4);
      if (steps === prevSteps) return;
      prevSteps = steps;
      const next   = clamp(startVal + steps * step);
      const actual = Math.round((next - startVal) / step);
      onChange(next);
      setPhase(startPhase + actual);
      flash();
    }
    function onUp() {
      setIsDragging(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // Negative phase = value increased = ticks move up = bgPos decreases
  // Math.round keeps ticks on whole pixels — prevents subpixel thickness variation
  const bgPos = -Math.round(phase * PX_PER_STEP);

  return (
    <div
      style={{
        display: 'inline-flex', alignItems: 'stretch',
        background: 'rgba(0,0,0,0.25)',
        border: '1px solid rgba(0,0,0,0.5)',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)',
        borderRadius: 4,
        overflow: 'hidden',
        ...style,
      }}
    >
      <input
        ref={inputRef}
        type="number"
        value={value}
        onChange={e => { const n = Number(e.target.value); if (!isNaN(n) && e.target.value !== '') onChange(clamp(n)); }}
        min={min} max={max} step={step}
        className="no-spinner"
        style={{
          flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none',
          padding: '4px 2px 4px 8px', fontFamily: 'monospace', fontSize: 12,
          color: 'var(--text-primary)',
          ...inputStyle,
        }}
      />

      <div
        ref={reelRef}
        onMouseDown={handleReelMouseDown}
        style={{
          width: REEL_W, flexShrink: 0,
          cursor: 'ns-resize',
          userSelect: 'none',
          position: 'relative',
          overflow: 'hidden',
          clipPath: 'ellipse(50% 52% at 50% 50%)',
        }}
      >
        {/* Tick layer — mask fades toward edges for depth */}
        <div
          style={{
            position: 'absolute', inset: 0,
            backgroundImage: `repeating-linear-gradient(to bottom, transparent 0px, transparent ${TICK_SPACING - 2}px, rgba(255,255,255,0.2) ${TICK_SPACING - 2}px, rgba(255,255,255,0.2) ${TICK_SPACING - 1}px, transparent ${TICK_SPACING - 1}px, transparent ${TICK_SPACING}px)`,
            backgroundPositionY: `${bgPos}px`,
            transition: isDragging ? 'none' : 'background-position-y 60ms linear',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.25) 18%, rgba(0,0,0,0.8) 32%, black 42%, black 58%, rgba(0,0,0,0.8) 68%, rgba(0,0,0,0.25) 82%, transparent 100%)',
            maskImage: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.25) 18%, rgba(0,0,0,0.8) 32%, black 42%, black 58%, rgba(0,0,0,0.8) 68%, rgba(0,0,0,0.25) 82%, transparent 100%)',
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  );
}
