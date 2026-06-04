import { useId } from 'react';

// ── TraceIcon (2-box conveyor) ────────────────────────────────────────────────
// A 3-element stack (exit / stay / enter) where the group translates up by one
// step per tick. The top box collapses scaleY→0 as it exits; the bottom box
// expands scaleY 0→1 as it enters. animKey re-mounts on every packet/tab-switch;
// repeatCount drives CSS --tick-count so n packets = n rapid ticks in ~1.5 s.

export function TraceIcon({ size, animKey, repeatCount = 1 }: {
  size: number;
  animKey: number;
  repeatCount?: number;
}) {
  const dur = Math.round(1500 / Math.max(1, repeatCount));
  return (
    <svg viewBox="0 0 256 256" width={size} height={size} fill="currentColor" overflow="hidden" aria-hidden>
      <g
        key={animKey}
        className="trace-tab-conveyor"
        style={{ '--tick-dur': `${dur}ms`, '--tick-count': repeatCount } as React.CSSProperties}
      >
        {/* Exiting box — collapses toward its center */}
        <rect x="28" y="16"  width="200" height="104" rx="16" className="trace-tab-exit"  />
        {/* Staying box — just translates */}
        <rect x="28" y="140" width="200" height="104" rx="16" />
        {/* Entering box — expands from its center; starts off-screen below */}
        <rect x="28" y="264" width="200" height="104" rx="16" className="trace-tab-enter" />
      </g>
    </svg>
  );
}

// ── DaqIcon (sine wave oscilloscope) ─────────────────────────────────────────
// Center X-axis + Y-axis frame the oscilloscope. 1.5-period sine wave draws in
// via stroke-dashoffset on animKey re-mount. live=true: infinite redraw loop.

export function DaqIcon({ size, animKey, live }: { size: number; animKey: number; live?: boolean }) {
  return (
    <svg viewBox="0 0 256 256" width={size} height={size} aria-hidden>
      {/* Center (X) axis */}
      <path d="M 20 128 L 244 128" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" opacity="0.3" />
      {/* Y-axis */}
      <path d="M 24 44 L 24 212" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" opacity="0.3" />
      {/* 1.5-period sine wave — bezier approximation, starts at axis origin */}
      <path
        key={animKey}
        d="M 24 128 C 37 128, 47 58, 60 58 C 73 58, 83 128, 96 128 C 109 128, 119 198, 132 198 C 145 198, 155 128, 168 128 C 181 128, 191 58, 204 58 C 217 58, 227 128, 240 128"
        fill="none"
        stroke="currentColor"
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`daq-tab-line${live ? ' daq-tab-line-live' : ''}`}
      />
    </svg>
  );
}

// ── SequenceIcon (FilmStrip) ──────────────────────────────────────────────────
// Taller strip (h=130) with 2 visible frames (w=80) and 3 perforations per rail.
// 3rd frame parks at x=256 so the loop is seamless: translateX(-112) shows
// exactly the same 2 frames as translateX(0), making infinite scroll invisible.

export function SequenceIcon({ size, animKey, live }: { size: number; animKey: number; live?: boolean }) {
  const uid  = useId();
  const clip = `seq-${uid.replace(/:/g, '')}`;

  return (
    <svg viewBox="0 0 256 256" width={size} height={size} fill="currentColor" aria-hidden>
      <defs>
        <clipPath id={clip}>
          <rect x="16" y="63" width="224" height="130" rx="8" />
        </clipPath>
      </defs>

      {/* Strip background */}
      <rect x="16" y="63" width="224" height="130" rx="8" opacity="0.22" />

      {/* Perforations — top rail (static, outside scroll group) */}
      {[19, 123, 228].map((x) => (
        <rect key={`pt-${x}`} x={x} y="67" width="10" height="10" rx="2" opacity="0.55" />
      ))}
      {/* Perforations — bottom rail */}
      {[19, 123, 228].map((x) => (
        <rect key={`pb-${x}`} x={x} y="180" width="10" height="10" rx="2" opacity="0.55" />
      ))}

      {/* Scrolling frames — 3rd frame at x=256 keeps the loop seamless */}
      <g clipPath={`url(#${clip})`}>
        <g key={animKey} className={live ? 'seq-tab-scroll' : 'seq-tab-advance'}>
          {[32, 144, 256].map((x) => (
            <rect key={x} x={x} y="80" width="80" height="96" rx="4" />
          ))}
        </g>
      </g>
    </svg>
  );
}
