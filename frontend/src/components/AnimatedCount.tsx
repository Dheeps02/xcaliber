import { useState, useEffect } from 'react';

export function AnimatedCount({
  value,
  label,
  color,
  className = '',
  pad,
}: {
  value: number;
  label?: string;
  color: string;
  className?: string;
  /** Zero-pad the number to this many digits */
  pad?: number;
}) {
  const fmt = (n: number) => pad ? String(n).padStart(pad, '0') : String(n);

  const [anim, setAnim] = useState({
    prev: fmt(value),
    cur:  fmt(value),
    epoch: 0,
    up: true,
  });

  useEffect(() => {
    const cur = fmt(value);
    setAnim(s => {
      if (s.cur === cur) return s;
      return { prev: s.cur, cur, epoch: s.epoch + 1, up: value >= Number(s.cur) };
    });
  }, [value]);

  const { prev, cur, epoch, up } = anim;
  const animCls = up ? 'count-tick' : 'count-enter-from-top';

  // Right-align comparison: compare each digit by its position from the right
  const len = cur.length;
  const digits = cur.split('').map((char, i) => {
    const posFromRight = len - 1 - i;
    const prevChar = posFromRight < prev.length
      ? prev[prev.length - 1 - posFromRight]
      : undefined; // digit didn't exist in previous value
    return { char, changed: prevChar !== char };
  });

  return (
    <span
      className={`inline-flex items-center font-mono text-[11px] overflow-hidden ${className}`}
      style={{ color }}
    >
      {label && <span style={{ opacity: 0.6, marginRight: 3 }}>{label}</span>}
      {digits.map((d, i) => (
        <span
          key={`${i}-${epoch}`}
          className={d.changed ? animCls : ''}
          style={{ display: 'inline-block' }}
        >
          {d.char}
        </span>
      ))}
    </span>
  );
}
