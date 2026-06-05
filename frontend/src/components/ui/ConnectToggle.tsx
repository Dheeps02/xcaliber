import { useState, useEffect, useRef } from 'react';
import { Link, LinkBreak } from '@phosphor-icons/react';

interface ConnectToggleProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  className?: string;
}

const TRACK_W      = 36;
const TRACK_H      = 20;
const THUMB_W      = 16;
const THUMB_H      = 16;
const THUMB_TRAVEL = TRACK_W - THUMB_W - 4;

const SHADOW_RAISED  = '0 2px 0 rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18), 0 1px 2px rgba(0,0,0,0.25)';
const SHADOW_PRESSED = 'inset 0 2px 3px rgba(0,0,0,0.5), inset 0 1px 0 rgba(0,0,0,0.2)';

const THUMB_TRANSITION = 'transform 130ms ease-in, box-shadow 230ms cubic-bezier(0.34, 1.56, 0.64, 1), border-color 180ms ease';
const TRACK_TRANSITION = 'background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease';

export function ConnectToggle({ checked, onChange, disabled = false, className = '' }: ConnectToggleProps) {
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

  const statusVar   = checked ? 'var(--status-ok)' : 'var(--status-err)';
  const trackBg     = `color-mix(in srgb, ${statusVar} 18%, var(--surface-overlay))`;
  const trackBorder = `color-mix(in srgb, ${statusVar} 30%, rgba(0,0,0,0.5))`;
  const trackShadow = `inset 0 2px 4px rgba(0,0,0,0.4), inset 0 1px 2px rgba(0,0,0,0.3), 0 0 0 1px color-mix(in srgb, ${statusVar} 15%, transparent)`;
  const thumbBorder = pressing
    ? 'rgba(0,0,0,0.45)'
    : `color-mix(in srgb, ${statusVar} 35%, rgba(0,0,0,0.4))`;
  const iconColor   = `color-mix(in srgb, ${statusVar} 75%, rgba(255,255,255,0.5))`;

  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={handleClick}
      title={checked ? 'Disconnect' : 'Connect'}
      className={className}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: 'none', border: 'none', padding: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {/* Track */}
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
        {/* Thumb */}
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
              : 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 50%, rgba(0,0,0,0.06) 100%)',
            boxShadow: pressing ? SHADOW_PRESSED : SHADOW_RAISED,
            transform: `translateX(${checked ? THUMB_TRAVEL : 0}px)`,
            transition: ready ? THUMB_TRANSITION : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {/* Both icons stacked; crossfade over the full thumb-slide duration */}
          <span style={{ position: 'relative', width: 8, height: 8, pointerEvents: 'none', flexShrink: 0 }}>
            <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: iconColor, opacity: checked ? 1 : 0, transition: ready ? `opacity 130ms ease-in, color 180ms ease` : 'none' }}>
              <Link size={8} weight="bold" />
            </span>
            <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: iconColor, opacity: checked ? 0 : 1, transition: ready ? `opacity 130ms ease-in, color 180ms ease` : 'none' }}>
              <LinkBreak size={8} weight="bold" />
            </span>
          </span>
        </span>
      </span>

      {/* Label — ghost text reserves width of the longer string */}
      <span style={{ position: 'relative', display: 'inline-block', fontSize: 11, userSelect: 'none' }}>
        <span style={{ visibility: 'hidden' }}>Disconnected</span>
        <span style={{ position: 'absolute', left: 0, whiteSpace: 'nowrap', color: 'var(--status-ok)', opacity: checked ? 1 : 0, transition: ready ? 'opacity 180ms ease' : 'none' }}>Connected</span>
        <span style={{ position: 'absolute', left: 0, whiteSpace: 'nowrap', color: 'var(--status-err)', opacity: checked ? 0 : 1, transition: ready ? 'opacity 180ms ease' : 'none' }}>Disconnected</span>
      </span>
    </button>
  );
}
