import { useState, useEffect } from 'react';

interface ConnectToggleProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  className?: string;
}

const THUMB_TRANSITION = 'transform 220ms cubic-bezier(0.34, 1.25, 0.64, 1), border-color 180ms ease, box-shadow 180ms ease';
const TRACK_TRANSITION = 'background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease';

export function ConnectToggle({ checked, onChange, disabled = false, className = '' }: ConnectToggleProps) {
  const [ready, setReady] = useState(false);

  // Enable transitions only after mount so the initial position snaps without animation.
  useEffect(() => { setReady(true); }, []);

  const trackBg     = checked
    ? 'color-mix(in srgb, var(--status-ok) 18%, var(--surface-overlay))'
    : 'rgba(0,0,0,0.35)';
  const trackBorder = checked
    ? 'color-mix(in srgb, var(--status-ok) 30%, rgba(0,0,0,0.5))'
    : 'rgba(0,0,0,0.55)';
  const trackShadow = checked
    ? 'inset 0 2px 4px rgba(0,0,0,0.4), inset 0 1px 2px rgba(0,0,0,0.3), 0 0 0 1px color-mix(in srgb, var(--status-ok) 15%, transparent)'
    : 'inset 0 2px 4px rgba(0,0,0,0.45), inset 0 1px 2px rgba(0,0,0,0.3)';
  const thumbBorder = checked
    ? 'color-mix(in srgb, var(--status-ok) 35%, rgba(0,0,0,0.4))'
    : 'rgba(0,0,0,0.45)';
  const thumbShadow = checked
    ? 'inset 0 1px 0 rgba(255,255,255,0.15), 0 2px 4px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.3), 0 0 6px color-mix(in srgb, var(--status-ok) 30%, transparent)'
    : 'inset 0 1px 0 rgba(255,255,255,0.12), 0 2px 4px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.3)';

  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      title={checked ? 'Disconnect' : 'Connect'}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {/* Track */}
      <span
        aria-hidden
        style={{
          position: 'relative',
          display: 'inline-block',
          width: 34,
          height: 18,
          borderRadius: 9,
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
            position: 'absolute',
            top: 2,
            left: 2,
            width: 12,
            height: 12,
            borderRadius: '50%',
            border: `1px solid ${thumbBorder}`,
            background: 'var(--surface-overlay)',
            backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 50%, rgba(0,0,0,0.06) 100%)',
            boxShadow: thumbShadow,
            transform: `translateX(${checked ? 18 : 0}px)`,
            transition: ready ? THUMB_TRANSITION : 'none',
          }}
        />
      </span>

      {/* Label */}
      <span
        style={{
          fontSize: 11,
          color: checked ? 'var(--status-ok)' : 'var(--text-secondary)',
          transition: ready ? 'color 180ms ease' : 'none',
          userSelect: 'none',
        }}
      >
        {checked ? 'Connected' : 'Connect'}
      </span>
    </button>
  );
}
