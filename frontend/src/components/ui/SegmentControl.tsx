import { useRef, useLayoutEffect, type ReactNode } from 'react';

type SegVariant   = 'text' | 'icon' | 'icon-text';
type SegDirection = 'horizontal' | 'vertical';

interface SegItem<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface SegmentControlProps<T extends string> {
  items: SegItem<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  variant?: SegVariant;
  direction?: SegDirection;
  className?: string;
}

const SPRING_H = 'transform 320ms cubic-bezier(0.34, 1.25, 0.64, 1), width 240ms cubic-bezier(0.34, 1.25, 0.64, 1)';
const SPRING_V = 'transform 320ms cubic-bezier(0.34, 1.25, 0.64, 1), height 240ms cubic-bezier(0.34, 1.25, 0.64, 1)';

export function SegmentControl<T extends string>({
  items,
  value,
  onChange,
  size = 'md',
  variant = 'text',
  direction = 'horizontal',
  className = '',
}: SegmentControlProps<T>) {
  const btnRefs  = useRef<(HTMLButtonElement | null)[]>([]);
  const thumbRef = useRef<HTMLDivElement>(null);
  const ready    = useRef(false);

  useLayoutEffect(() => {
    const idx = items.findIndex((i) => i.value === value);
    const btn = btnRefs.current[idx];
    const el  = thumbRef.current;
    if (!btn || !el) return;

    if (direction === 'vertical') {
      const y = btn.offsetTop;
      const h = btn.offsetHeight;
      if (!ready.current) {
        el.style.transform  = `translateY(${y}px)`;
        el.style.height     = `${h}px`;
        el.style.opacity    = '1';
        void el.offsetHeight;
        el.style.transition = SPRING_V;
        ready.current = true;
      } else {
        el.style.transform = `translateY(${y}px)`;
        el.style.height    = `${h}px`;
      }
    } else {
      const x = btn.offsetLeft;
      const w = btn.offsetWidth;
      if (!ready.current) {
        // Snap thumb to its initial position before the browser has painted.
        // `void el.offsetWidth` flushes pending style recalcs so the browser
        // treats the current position as the settled "from" state. Only after
        // that flush do we enable the spring, preventing it from firing.
        el.style.transform  = `translateX(${x}px)`;
        el.style.width      = `${w}px`;
        el.style.opacity    = '1';
        void el.offsetWidth;
        el.style.transition = SPRING_H;
        ready.current = true;
      } else {
        el.style.transform = `translateX(${x}px)`;
        el.style.width     = `${w}px`;
      }
    }
  }, [value, items, direction]);

  const radius = size === 'sm' ? '5px' : '6px';
  const pad    = size === 'sm' ? 2 : 3;

  const thumbStyle: React.CSSProperties = direction === 'vertical'
    ? {
        position: 'absolute',
        top: 0, left: pad, right: pad,
        height: 0, opacity: 0,
        borderRadius: radius,
        background: 'var(--surface-overlay)',
        backgroundImage: 'linear-gradient(180deg, var(--shine-3) 0%, var(--shine-1) 50%, var(--shadow-2) 100%)',
        border: '1px solid var(--input-border)',
        boxShadow: 'inset 0 1px 0 var(--shine-3), 0 2px 5px var(--shadow-8), 0 1px 2px var(--shadow-7)',
        pointerEvents: 'none',
      }
    : {
        position: 'absolute',
        top: pad, bottom: pad, left: 0,
        width: 0, opacity: 0,
        borderRadius: radius,
        background: 'var(--surface-overlay)',
        backgroundImage: 'linear-gradient(180deg, var(--shine-3) 0%, var(--shine-1) 50%, var(--shadow-2) 100%)',
        border: '1px solid var(--input-border)',
        boxShadow: 'inset 0 1px 0 var(--shine-3), 0 2px 5px var(--shadow-8), 0 1px 2px var(--shadow-7)',
        pointerEvents: 'none',
      };

  return (
    <div
      className={`xcb-segment${size === 'sm' ? ' sm' : ''}${variant === 'icon' ? ' icon-only' : ''}${direction === 'vertical' ? ' vertical' : ''} ${className}`}
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      <div ref={thumbRef} aria-hidden style={thumbStyle} />

      {items.map((item, i) => (
        <button
          key={item.value}
          ref={(el) => { btnRefs.current[i] = el; }}
          className={`xcb-seg-btn${value === item.value ? ' active' : ''}`}
          style={{ position: 'relative', zIndex: 1 }}
          title={variant === 'icon' ? item.label : undefined}
          onClick={() => onChange(item.value)}
        >
          {variant !== 'text' && item.icon}
          {variant !== 'icon' && item.label}
        </button>
      ))}
    </div>
  );
}
