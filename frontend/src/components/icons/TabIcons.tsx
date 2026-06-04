import { useId } from 'react';

// ── TraceIcon (Rows) ──────────────────────────────────────────────────────────
// animKey increments on tab-switch and on new packet — re-mounts rows,
// restarting the stagger slide-in. Hover re-trigger is CSS-only.

export function TraceIcon({ size, animKey }: { size: number; animKey: number }) {
  return (
    <svg viewBox="0 0 256 256" width={size} height={size} fill="currentColor" aria-hidden>
      {[52, 116, 180].map((y, i) => (
        <rect
          key={`${i}-${animKey}`}
          x="28" y={y} width="200" height="38" rx="8"
          className="trace-tab-row"
          style={{ '--stagger': `${i * 50}ms` } as React.CSSProperties}
        />
      ))}
    </svg>
  );
}

// ── DaqIcon (ChartLine) ───────────────────────────────────────────────────────
// animKey re-mounts path + dot, restarting the dashoffset draw and dot scale-in.
// live=true adds continuous opacity pulse on the line and scale pulse on the dot.

export function DaqIcon({ size, animKey, live }: { size: number; animKey: number; live?: boolean }) {
  return (
    <svg viewBox="0 0 256 256" width={size} height={size} aria-hidden>
      <path
        key={animKey}
        d="M 24 196 L 64 152 L 100 168 L 148 108 L 188 128 L 228 76"
        fill="none"
        stroke="currentColor"
        strokeWidth="18"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`daq-tab-line${live ? ' daq-tab-line-live' : ''}`}
      />
      <circle
        key={`dot-${animKey}`}
        cx="228" cy="76" r="14"
        fill="currentColor"
        className={`daq-tab-dot${live ? ' daq-tab-dot-live' : ''}`}
      />
    </svg>
  );
}

// ── SequenceIcon (FilmStrip) ──────────────────────────────────────────────────
// animKey re-mounts the scrolling group, advancing frames by one step.
// live=true switches to a continuous linear scroll.
// Frame positions designed for seamless looping: at translateX(-68px) the three
// visible frames are in the same positions as at translateX(0).

export function SequenceIcon({ size, animKey, live }: { size: number; animKey: number; live?: boolean }) {
  const uid  = useId();
  const clip = `seq-${uid.replace(/:/g, '')}`;

  return (
    <svg viewBox="0 0 256 256" width={size} height={size} fill="currentColor" aria-hidden>
      <defs>
        <clipPath id={clip}>
          <rect x="16" y="76" width="224" height="104" rx="8" />
        </clipPath>
      </defs>

      {/* Strip background */}
      <rect x="16" y="76" width="224" height="104" rx="8" opacity="0.22" />

      {/* Scrolling frames — 4th frame ensures seamless loop */}
      <g clipPath={`url(#${clip})`}>
        <g key={animKey} className={live ? 'seq-tab-scroll' : 'seq-tab-advance'}>
          {[36, 104, 172, 240].map((x) => (
            <rect key={x} x={x} y="84" width="60" height="88" rx="4" />
          ))}
        </g>
      </g>
    </svg>
  );
}
