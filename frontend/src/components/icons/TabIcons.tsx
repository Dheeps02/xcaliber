import { useId } from 'react';

// ── TraceIcon (Phosphor Rows + scroll) ───────────────────────────────────────
// Two stacked copies of the Rows path inside overflow:hidden SVG.
// Animation slides the group up by 256px so copy2 (offset 256) scrolls into view.
// n packets → n iterations at 1500ms total, creating the whrrrr effect.

const ROWS_PATH = "M208,136H48a16,16,0,0,0-16,16v40a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V152A16,16,0,0,0,208,136Zm0,56H48V152H208v40Zm0-144H48A16,16,0,0,0,32,64v40a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V64A16,16,0,0,0,208,48Zm0,56H48V64H208v40Z";

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
        className="trace-rows-scroll"
        style={{ '--tick-dur': `${dur}ms`, '--tick-count': repeatCount } as React.CSSProperties}
      >
        <path d={ROWS_PATH} />
        <g transform="translate(0,176)">
          <path d={ROWS_PATH} />
        </g>
      </g>
    </svg>
  );
}

// ── DaqIcon (oscilloscope sine wave) ─────────────────────────────────────────
// Single cubic bezier per half-period (kappa ≈ 0.3642) gives a smooth sine.
// Static: 2-period wave from x=16, clipped to viewport.
// Live: 4-period wave path that scrolls translateX(-128px) seamlessly.

const DAQ_WAVE_STATIC = "M16,128 C39,73 57,73 80,128 C103,183 121,183 144,128 C167,73 185,73 208,128 C231,183 249,183 272,128";
const DAQ_WAVE_SCROLL = "M-128,128 C-105,73 -87,73 -64,128 C-41,183 -23,183 0,128 C23,73 41,73 64,128 C87,183 105,183 128,128 C151,73 169,73 192,128 C215,183 233,183 256,128 C279,73 297,73 320,128 C343,183 361,183 384,128";

export function DaqIcon({ size, animKey, live }: { size: number; animKey: number; live?: boolean }) {
  const uid  = useId();
  const clip = `daq-${uid.replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 256 256" width={size} height={size} aria-hidden>
      <defs>
        <clipPath id={clip}>
          <rect x="16" y="44" width="224" height="168" />
        </clipPath>
      </defs>
      {/* X-axis */}
      <path d="M16,128 L240,128" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" opacity="0.3" />
      {/* Y-axis */}
      <path d="M24,44 L24,212" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" opacity="0.3" />
      <g clipPath={`url(#${clip})`}>
        {live ? (
          <path
            d={DAQ_WAVE_SCROLL}
            fill="none"
            stroke="currentColor"
            strokeWidth="16"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="daq-wave-scroll"
          />
        ) : (
          <path
            key={animKey}
            d={DAQ_WAVE_STATIC}
            fill="none"
            stroke="currentColor"
            strokeWidth="16"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </g>
    </svg>
  );
}

// ── SequenceIcon (Phosphor Queue + spinner) ───────────────────────────────────
// 3 queue lines always shown. Right side: play triangle at rest, spinning arc
// when live. Spinner centered at (208,160) — the play triangle centroid.

const QUEUE_LINES = "M32,64a8,8,0,0,1,8-8H216a8,8,0,0,1,0,16H40A8,8,0,0,1,32,64Zm104,56H40a8,8,0,0,0,0,16h96a8,8,0,0,0,0-16Zm0,64H40a8,8,0,0,0,0,16h96a8,8,0,0,0,0-16";
const QUEUE_PLAY  = "M248,160a8,8,0,0,1-3.76,6.78l-64,40A8,8,0,0,1,168,200V120a8,8,0,0,1,12.24-6.78l64,40A8,8,0,0,1,248,160ZM224.91,160L184,134.43v51.14Z";

export function SequenceIcon({ size, live }: { size: number; animKey: number; live?: boolean }) {
  return (
    <svg viewBox="0 0 256 256" width={size} height={size} fill="currentColor" aria-hidden>
      <path d={QUEUE_LINES} />
      {live ? (
        <circle
          cx="208" cy="160" r="30"
          fill="none"
          stroke="currentColor"
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray="63 126"
          className="seq-icon-spinner"
        />
      ) : (
        <path d={QUEUE_PLAY} />
      )}
    </svg>
  );
}
