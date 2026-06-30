import { useRef, useEffect, useState, forwardRef } from 'react';

interface IpInputProps {
  value: string;
  onChange: (value: string) => void;
  style?: React.CSSProperties;
}

function splitIp(ip: string): [string, string, string, string] {
  if (!ip) return ['', '', '', ''];
  const p = ip.split('.');
  return [p[0] ?? '', p[1] ?? '', p[2] ?? '', p[3] ?? ''];
}

function joinIp(parts: [string, string, string, string]): string {
  return parts.every(p => p === '') ? '' : parts.join('.');
}

export const IpInput = forwardRef<HTMLDivElement, IpInputProps>(function IpInput({ value, onChange, style }, fwdRef) {
  const [parts, setParts] = useState<[string, string, string, string]>(() => splitIp(value));
  const refsEl = useRef<(HTMLInputElement | null)[]>([null, null, null, null]);

  useEffect(() => {
    setParts(prev => {
      return joinIp(prev) !== value ? splitIp(value) : prev;
    });
  }, [value]);

  function update(i: number, raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 3);
    const n      = Number(digits);
    const val    = digits === '' ? '' : n > 255 ? '255' : digits;
    const next   = [...parts] as [string, string, string, string];
    next[i] = val;
    setParts(next);
    onChange(joinIp(next));
    if (val.length === 3 && i < 3) {
      const el = refsEl.current[i + 1];
      el?.focus();
      el?.select();
    }
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    if (e.key === '.') {
      e.preventDefault();
      if (i < 3) { refsEl.current[i + 1]?.focus(); refsEl.current[i + 1]?.select(); }
    } else if (e.key === 'Backspace' && parts[i] === '' && i > 0) {
      e.preventDefault();
      const prev = refsEl.current[i - 1];
      prev?.focus();
      prev?.setSelectionRange(prev.value.length, prev.value.length);
    } else if (e.key === 'ArrowRight' && el.selectionStart === el.value.length && i < 3) {
      e.preventDefault();
      refsEl.current[i + 1]?.focus();
    } else if (e.key === 'ArrowLeft' && el.selectionStart === 0 && i > 0) {
      e.preventDefault();
      const prev = refsEl.current[i - 1];
      prev?.focus();
      prev?.setSelectionRange(prev.value.length, prev.value.length);
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const text = e.clipboardData.getData('text').trim();
    const m    = text.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!m) return;
    const next = [m[1], m[2], m[3], m[4]].map(s => (Number(s) > 255 ? '255' : s)) as [string, string, string, string];
    setParts(next);
    onChange(next.join('.'));
    refsEl.current[3]?.focus();
  }

  return (
    <div
      ref={fwdRef}
      onPaste={handlePaste}
      style={{
        display: 'inline-flex', alignItems: 'center',
        height: 24, padding: '0 5px',
        background: 'var(--input-bg)',
        border: '1px solid var(--input-border)',
        borderTopColor: 'var(--input-border-top)',
        borderRadius: 4,
        boxShadow: 'inset 0 2px 4px var(--shadow-7), inset 0 1px 2px var(--shadow-5)',
        transition: 'border-color 120ms ease',
        ...style,
      }}
    >
      {([0, 1, 2, 3] as const).map(i => (
        <span key={i} style={{ display: 'contents' }}>
          <input
            ref={el => { refsEl.current[i] = el; }}
            type="text"
            inputMode="numeric"
            value={parts[i]}
            placeholder="0"
            maxLength={3}
            onChange={e => update(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            onFocus={e => e.target.select()}
            style={{
              width: 24, minWidth: 0,
              background: 'none', border: 'none', outline: 'none',
              padding: 0,
              textAlign: 'center',
              fontFamily: 'monospace', fontSize: 12,
              color: 'var(--text-primary)',
            }}
          />
          {i < 3 && (
            <span style={{ color: 'var(--text-muted)', fontSize: 11, userSelect: 'none', lineHeight: 1, padding: '0 1px' }}>
              .
            </span>
          )}
        </span>
      ))}
    </div>
  );
});
