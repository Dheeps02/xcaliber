import { useState, useEffect, useRef } from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}

const TRACK_W      = 36;
const TRACK_H      = 20;
const THUMB_W      = 16;
const THUMB_H      = 16;
const THUMB_TRAVEL = TRACK_W - THUMB_W - 4;

const SHADOW_RAISED  = '0 2px 0 var(--shadow-9), inset 0 1px 0 var(--shine-5), 0 1px 2px var(--shadow-5)';
const SHADOW_PRESSED = 'inset 0 2px 3px var(--shadow-9), inset 0 1px 0 var(--shadow-4)';

const THUMB_TRANSITION = 'transform 130ms ease-in, box-shadow 230ms cubic-bezier(0.34, 1.56, 0.64, 1), border-color 180ms ease';
const TRACK_TRANSITION = 'background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease';

export function Toggle({ checked, onChange, disabled = false }: ToggleProps) {
  const [ready, setReady]       = useState(false);
  const [pressing, setPressing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setReady(true); }, []);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  function handleClick() {
    if (pressing || disabled) return;
    setPressing(true);
    timerRef.current = setTimeout(() => { onChange(); setPressing(false); }, 110);
  }

  const trackBg     = checked
    ? 'color-mix(in srgb, var(--accent) 18%, var(--surface-overlay))'
    : 'var(--input-bg)';
  const trackBorder = checked
    ? 'color-mix(in srgb, var(--accent) 30%, var(--input-border))'
    : 'var(--input-border)';
  const trackShadow = checked
    ? 'inset 0 2px 4px var(--shadow-7), inset 0 1px 2px var(--shadow-6), 0 0 0 1px color-mix(in srgb, var(--accent) 15%, transparent)'
    : 'inset 0 2px 4px var(--shadow-8), inset 0 1px 2px var(--shadow-6)';
  const thumbBorder = checked && !pressing
    ? 'color-mix(in srgb, var(--accent) 35%, var(--input-border))'
    : 'var(--input-border)';

  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={handleClick}
      style={{
        display: 'inline-flex', alignItems: 'center',
        background: 'none', border: 'none', padding: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        flexShrink: 0,
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'relative', display: 'inline-block',
          width: TRACK_W, height: TRACK_H,
          borderRadius: 5,
          border: `1px solid ${trackBorder}`,
          backgroundColor: trackBg,
          boxShadow: trackShadow,
          flexShrink: 0,
          transition: ready ? TRACK_TRANSITION : 'none',
        }}
      >
        <span
          aria-hidden
          style={{
            position: 'absolute', top: 1, left: 2,
            width: THUMB_W, height: THUMB_H,
            borderRadius: 3,
            border: `1px solid ${thumbBorder}`,
            background: 'var(--surface-overlay)',
            backgroundImage: pressing
              ? 'none'
              : 'linear-gradient(180deg, var(--shine-4) 0%, var(--shine-1) 50%, var(--shadow-2) 100%)',
            boxShadow: pressing ? SHADOW_PRESSED : SHADOW_RAISED,
            transform: `translateX(${checked ? THUMB_TRAVEL : 0}px)`,
            transition: ready ? THUMB_TRANSITION : 'none',
          }}
        />
      </span>
    </button>
  );
}
