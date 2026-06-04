import { useRef, useLayoutEffect } from 'react';

interface ConnectToggleProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  className?: string;
}

const SPRING = 'transform 220ms cubic-bezier(0.34, 1.25, 0.64, 1), background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease';

export function ConnectToggle({ checked, onChange, disabled = false, className = '' }: ConnectToggleProps) {
  const thumbRef = useRef<HTMLSpanElement>(null);
  const trackRef = useRef<HTMLSpanElement>(null);
  const ready = useRef(false);

  useLayoutEffect(() => {
    const thumb = thumbRef.current;
    const track = trackRef.current;
    if (!thumb || !track) return;

    const tx = checked ? 18 : 0;

    if (!ready.current) {
      thumb.style.transform = `translateX(${tx}px)`;
      void thumb.offsetWidth;
      thumb.style.transition = SPRING;
      track.style.transition = 'background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease';
      ready.current = true;
    } else {
      thumb.style.transform = `translateX(${tx}px)`;
    }

    track.style.backgroundColor = checked
      ? 'color-mix(in srgb, var(--status-ok) 18%, var(--surface-overlay))'
      : 'rgba(0,0,0,0.35)';
    track.style.borderColor = checked
      ? 'color-mix(in srgb, var(--status-ok) 30%, rgba(0,0,0,0.5))'
      : 'rgba(0,0,0,0.55)';
    track.style.boxShadow = checked
      ? 'inset 0 2px 4px rgba(0,0,0,0.4), inset 0 1px 2px rgba(0,0,0,0.3), 0 0 0 1px color-mix(in srgb, var(--status-ok) 15%, transparent)'
      : 'inset 0 2px 4px rgba(0,0,0,0.45), inset 0 1px 2px rgba(0,0,0,0.3)';

    thumb.style.borderColor = checked
      ? 'color-mix(in srgb, var(--status-ok) 35%, rgba(0,0,0,0.4))'
      : 'rgba(0,0,0,0.45)';
    thumb.style.boxShadow = checked
      ? 'inset 0 1px 0 rgba(255,255,255,0.15), 0 2px 4px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.3), 0 0 6px color-mix(in srgb, var(--status-ok) 30%, transparent)'
      : 'inset 0 1px 0 rgba(255,255,255,0.12), 0 2px 4px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.3)';
  }, [checked]);

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
        ref={trackRef}
        aria-hidden
        style={{
          position: 'relative',
          display: 'inline-block',
          width: 34,
          height: 18,
          borderRadius: 9,
          border: '1px solid rgba(0,0,0,0.55)',
          background: 'rgba(0,0,0,0.35)',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.45), inset 0 1px 2px rgba(0,0,0,0.3)',
          flexShrink: 0,
        }}
      >
        {/* Thumb */}
        <span
          ref={thumbRef}
          aria-hidden
          style={{
            position: 'absolute',
            top: 2,
            left: 2,
            width: 12,
            height: 12,
            borderRadius: '50%',
            border: '1px solid rgba(0,0,0,0.45)',
            background: 'var(--surface-overlay)',
            backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 50%, rgba(0,0,0,0.06) 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 2px 4px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.3)',
          }}
        />
      </span>

      {/* Label */}
      <span
        style={{
          fontSize: 11,
          color: checked ? 'var(--status-ok)' : 'var(--text-secondary)',
          transition: 'color 180ms ease',
          userSelect: 'none',
        }}
      >
        {checked ? 'Connected' : 'Connect'}
      </span>
    </button>
  );
}
