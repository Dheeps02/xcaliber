import { useState } from 'react';

interface SliderProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  disabled?: boolean;
  className?: string;
}

const THUMB_W = 16;
const THUMB_H = 16;

const SHADOW_RAISED  = '0 2px 0 var(--shadow-9), inset 0 1px 0 var(--shine-5), 0 1px 2px var(--shadow-5)';
const SHADOW_PRESSED = 'inset 0 2px 3px var(--shadow-9), inset 0 1px 0 var(--shadow-4)';

export function Slider({ min, max, step = 1, value, onChange, onCommit, disabled = false, className = '' }: SliderProps) {
  const [pressing, setPressing] = useState(false);
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));

  // thumb center = fill width = calc(pct * (100% - thumbW) + thumbW/2)
  const pos = `calc(${pct} * (100% - ${THUMB_W}px) + ${THUMB_W / 2}px)`;

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        height: THUMB_H + 4,
        display: 'flex',
        alignItems: 'center',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {/* Visual track — pointer-events: none so input underneath captures all events */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: 6,
        borderRadius: 3,
        background: 'var(--input-bg)',
        border: '1px solid var(--input-border)',
        boxShadow: 'inset 0 2px 4px var(--shadow-7), inset 0 1px 2px var(--shadow-5)',
        overflow: 'visible',
        pointerEvents: 'none',
      }}>
        {/* Fill */}
        <div style={{
          position: 'absolute',
          left: 0, top: 0, bottom: 0,
          width: pos,
          borderRadius: 3,
          background: 'color-mix(in srgb, var(--accent) 32%, var(--input-bg))',
          boxShadow: 'inset 0 1px 3px var(--shadow-4), 0 0 8px 2px color-mix(in srgb, var(--accent) 30%, transparent)',
        }} />

        {/* Thumb */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: pos,
          transform: 'translate(-50%, -50%)',
          width: THUMB_W,
          height: THUMB_H,
          borderRadius: 4,
          border: '1px solid var(--input-border)',
          background: 'var(--surface-overlay)',
          backgroundImage: pressing
            ? 'none'
            : 'linear-gradient(180deg, var(--shine-4) 0%, var(--shine-1) 50%, var(--shadow-2) 100%)',
          boxShadow: pressing ? SHADOW_PRESSED : SHADOW_RAISED,
          transition: 'box-shadow 80ms ease',
        }} />
      </div>

      {/* Native input — invisible, handles all interaction + a11y */}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerDown={() => setPressing(true)}
        onPointerUp={(e) => {
          setPressing(false);
          onCommit?.(Number((e.target as HTMLInputElement).value));
        }}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: disabled ? 'not-allowed' : 'pointer',
          margin: 0,
        }}
      />
    </div>
  );
}
