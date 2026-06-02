import { useState, useRef, useEffect } from 'react';

export function AnimatedCount({
  value,
  label,
  colorCls,
}: {
  value: number;
  label?: string;
  colorCls: string;
}) {
  const [displayed, setDisplayed] = useState(value);
  const [animKey, setAnimKey] = useState(0);
  const [animCls, setAnimCls] = useState('');
  const displayedRef = useRef(displayed);
  displayedRef.current = displayed;
  const t1 = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t2 = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value === displayedRef.current) return;
    if (t1.current) clearTimeout(t1.current);
    if (t2.current) clearTimeout(t2.current);

    if (value === 0) {
      setAnimCls('count-exit');
      t1.current = setTimeout(() => {
        setDisplayed(0);
        setAnimCls('count-enter-from-top');
        t2.current = setTimeout(() => setAnimCls(''), 250);
      }, 160);
    } else {
      setDisplayed(value);
      setAnimKey((k) => k + 1);
      setAnimCls('count-tick');
      t1.current = setTimeout(() => setAnimCls(''), 240);
    }
  }, [value]);

  useEffect(() => () => {
    if (t1.current) clearTimeout(t1.current);
    if (t2.current) clearTimeout(t2.current);
  }, []);

  return (
    <span className={`${colorCls} inline-flex items-center gap-0.5 font-mono text-[10px] overflow-hidden`}>
      {label && <span className="opacity-60">{label}:</span>}
      <span key={animKey} className={animCls} style={{ display: 'inline-block' }}>{displayed}</span>
    </span>
  );
}
