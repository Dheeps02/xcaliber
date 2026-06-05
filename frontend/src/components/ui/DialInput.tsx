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

export function DialInput({ value, onChange, min, max, step = 1, style, inputStyle }: DialInputProps) {
  const [rotation, setRotation]     = useState(0);
  const [active, setActive]         = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const inputRef    = useRef<HTMLInputElement>(null);
  const activeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spinRef     = useRef<(delta: number) => void>(() => {});

  function clamp(n: number) {
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    return n;
  }

  // Always-fresh spin fn; native event handler calls this via ref to avoid stale closure
  spinRef.current = (delta: number) => {
    const next = clamp(value + delta * step);
    if (next === value) return;
    onChange(next);
    setRotation(r => r + delta * 30);
    setActive(true);
    if (activeTimer.current) clearTimeout(activeTimer.current);
    activeTimer.current = setTimeout(() => setActive(false), 350);
  };

  // Non-passive wheel on the input so we can preventDefault (blocks page scroll)
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const h = (e: WheelEvent) => { e.preventDefault(); spinRef.current(e.deltaY > 0 ? -1 : 1); };
    el.addEventListener('wheel', h, { passive: false });
    return () => el.removeEventListener('wheel', h);
  }, []);

  useEffect(() => () => { if (activeTimer.current) clearTimeout(activeTimer.current); }, []);

  // Drag the dial up/down to change value
  function handleDialMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    const startY   = e.clientY;
    const startVal = value;
    const startRot = rotation;
    let   lastSteps = 0;
    setIsDragging(true);

    function onMove(me: MouseEvent) {
      const steps = Math.round((startY - me.clientY) / 4);
      if (steps === lastSteps) return;
      lastSteps = steps;
      onChange(clamp(startVal + steps * step));
      setRotation(startRot + steps * 30);
      setActive(true);
    }
    function onUp() {
      setIsDragging(false);
      setActive(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function handleDialWheel(e: React.WheelEvent) {
    e.stopPropagation();
    spinRef.current(e.deltaY > 0 ? -1 : 1);
  }

  const ringStroke = active
    ? 'color-mix(in srgb, var(--accent) 55%, rgba(255,255,255,0.15))'
    : 'rgba(255,255,255,0.13)';
  const handStroke = active ? 'var(--accent)' : 'rgba(255,255,255,0.45)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, ...style }}>
      <input
        ref={inputRef}
        type="number"
        value={value}
        onChange={(e) => { const n = Number(e.target.value); if (!isNaN(n)) onChange(clamp(n)); }}
        min={min} max={max} step={step}
        className="xcb-input no-spinner px-2 py-1 font-mono text-xs text-center focus:outline-none"
        style={{ flex: 1, minWidth: 0, ...inputStyle }}
        onFocusCapture={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)')}
        onBlurCapture={(e) => ((e.currentTarget as HTMLElement).style.borderColor = '')}
      />

      {/* Dial — drag up/down or scroll to change value */}
      <svg
        width={20} height={20}
        viewBox="0 0 20 20"
        style={{ flexShrink: 0, cursor: 'ns-resize', display: 'block', userSelect: 'none' }}
        onMouseDown={handleDialMouseDown}
        onWheel={handleDialWheel}
      >
        {/* Ring track */}
        <circle
          cx={10} cy={10} r={8}
          fill="rgba(0,0,0,0.3)"
          stroke={ringStroke}
          strokeWidth={1}
          style={{ transition: 'stroke 180ms ease' }}
        />
        {/* Rotating hand — transformOrigin at SVG center (10,10) */}
        <g
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: '10px 10px',
            transition: isDragging ? 'none' : 'transform 120ms ease-out',
          }}
        >
          <line
            x1={10} y1={7.5} x2={10} y2={3.5}
            stroke={handStroke}
            strokeWidth={1.5}
            strokeLinecap="round"
            style={{ transition: 'stroke 180ms ease' }}
          />
        </g>
        {/* Center pip */}
        <circle cx={10} cy={10} r={1.5} fill="rgba(255,255,255,0.18)" />
      </svg>
    </div>
  );
}
