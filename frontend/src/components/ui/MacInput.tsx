import { useRef, useEffect, useState, forwardRef } from 'react';

interface MacInputProps {
  value: string;
  onChange: (value: string) => void;
  style?: React.CSSProperties;
}

type MacParts = [string, string, string, string, string, string];

function splitMac(mac: string): MacParts {
  if (!mac) return ['', '', '', '', '', ''];
  const p = mac.toUpperCase().split(/[:\-]/);
  return [p[0] ?? '', p[1] ?? '', p[2] ?? '', p[3] ?? '', p[4] ?? '', p[5] ?? ''];
}

function joinMac(parts: MacParts): string {
  return parts.every(p => p === '') ? '' : parts.join(':');
}

export const MacInput = forwardRef<HTMLDivElement, MacInputProps>(function MacInput({ value, onChange, style }, fwdRef) {
  const [parts, setParts] = useState<MacParts>(() => splitMac(value));
  const refsEl = useRef<(HTMLInputElement | null)[]>([null, null, null, null, null, null]);

  useEffect(() => {
    const normalized = value.toUpperCase();
    setParts(prev => (joinMac(prev) !== normalized ? splitMac(value) : prev));
  }, [value]);

  function update(i: number, raw: string) {
    const hex  = raw.replace(/[^0-9a-fA-F]/g, '').toUpperCase().slice(0, 2);
    const next = [...parts] as MacParts;
    next[i] = hex;
    setParts(next);
    onChange(joinMac(next));
    if (hex.length === 2 && i < 5) {
      const el = refsEl.current[i + 1];
      el?.focus();
      el?.select();
    }
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    if (e.key === ':' || e.key === '-') {
      e.preventDefault();
      if (i < 5) { refsEl.current[i + 1]?.focus(); refsEl.current[i + 1]?.select(); }
    } else if (e.key === 'Backspace' && parts[i] === '' && i > 0) {
      e.preventDefault();
      const prev = refsEl.current[i - 1];
      prev?.focus();
      prev?.setSelectionRange(prev.value.length, prev.value.length);
    } else if (e.key === 'ArrowRight' && el.selectionStart === el.value.length && i < 5) {
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
    const sep  = text.match(/^([0-9a-fA-F]{1,2})[:\-]([0-9a-fA-F]{1,2})[:\-]([0-9a-fA-F]{1,2})[:\-]([0-9a-fA-F]{1,2})[:\-]([0-9a-fA-F]{1,2})[:\-]([0-9a-fA-F]{1,2})$/);
    const raw  = text.match(/^([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/);
    const m    = sep ?? raw;
    if (!m) return;
    const next = [m[1], m[2], m[3], m[4], m[5], m[6]].map(s => s.toUpperCase()) as MacParts;
    setParts(next);
    onChange(next.join(':'));
    refsEl.current[5]?.focus();
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
      {([0, 1, 2, 3, 4, 5] as const).map(i => (
        <span key={i} style={{ display: 'contents' }}>
          <input
            ref={el => { refsEl.current[i] = el; }}
            type="text"
            inputMode="text"
            value={parts[i]}
            placeholder="00"
            maxLength={2}
            onChange={e => update(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            onFocus={e => e.target.select()}
            style={{
              width: 18, minWidth: 0,
              background: 'none', border: 'none', outline: 'none',
              padding: 0,
              textAlign: 'center',
              fontFamily: 'monospace', fontSize: 12,
              color: 'var(--text-primary)',
            }}
          />
          {i < 5 && (
            <span style={{ color: 'var(--text-muted)', fontSize: 11, userSelect: 'none', lineHeight: 1, padding: '0 1px' }}>
              :
            </span>
          )}
        </span>
      ))}
    </div>
  );
});
