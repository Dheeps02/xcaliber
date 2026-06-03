import { useRef, useEffect, useState, type ReactNode } from 'react';

type SegVariant = 'text' | 'icon' | 'icon-text';

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
  className?: string;
}

export function SegmentControl<T extends string>({
  items,
  value,
  onChange,
  size = 'md',
  variant = 'text',
  className = '',
}: SegmentControlProps<T>) {
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const mounted = useRef(false);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    const idx = items.findIndex((i) => i.value === value);
    const btn = btnRefs.current[idx];
    if (!btn) return;
    setThumb({ left: btn.offsetLeft, width: btn.offsetWidth });
    mounted.current = true;
  }, [value, items]);

  const radius = size === 'sm' ? '5px' : '6px';

  return (
    <div className={`xcb-segment${size === 'sm' ? ' sm' : ''} ${className}`} style={{ position: 'relative' }}>

      {/* Sliding thumb */}
      {thumb && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: size === 'sm' ? 2 : 3,
            bottom: size === 'sm' ? 2 : 3,
            left: 0,
            width: thumb.width,
            borderRadius: radius,
            background: 'var(--surface-overlay)',
            backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.055) 0%, transparent 60%)',
            border: '1px solid var(--border-strong)',
            transform: `translateX(${thumb.left}px)`,
            transition: mounted.current
              ? 'transform 220ms cubic-bezier(0.34, 1.1, 0.64, 1), width 150ms cubic-bezier(0.34, 1.1, 0.64, 1)'
              : 'none',
            pointerEvents: 'none',
          }}
        />
      )}

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
