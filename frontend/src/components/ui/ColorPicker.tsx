import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { HexColorPicker, HexColorInput } from 'react-colorful';

interface ColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
}

function currentAccent() {
  return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#10b981';
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [open, setOpen]         = useState(false);
  const [rect, setRect]         = useState<DOMRect | null>(null);
  const triggerRef              = useRef<HTMLButtonElement>(null);
  const panelRef                = useRef<HTMLDivElement>(null);

  const displayColor = value || currentAccent();

  function openPanel() {
    const el = triggerRef.current;
    if (!el) return;
    setRect(el.getBoundingClientRect());
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const panelStyle: React.CSSProperties = rect
    ? { position: 'fixed', right: window.innerWidth - rect.right, top: rect.bottom + 6, zIndex: 10000 }
    : {};

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => open ? setOpen(false) : openPanel()}
        style={{
          width: 30, height: 30,
          borderRadius: 6,
          background: displayColor,
          border: '1px solid var(--input-border)',
          borderTopColor: 'var(--input-border-top)',
          boxShadow: 'inset 0 2px 4px var(--shadow-7), inset 0 1px 1px var(--shadow-5), 0 1px 0 var(--shine-2)',
          cursor: 'pointer',
          flexShrink: 0,
          outline: open ? '2px solid color-mix(in srgb, var(--accent) 50%, transparent)' : 'none',
          outlineOffset: 2,
        }}
      />

      {open && createPortal(
        <div
          ref={panelRef}
          style={{
            ...panelStyle,
            width: 220,
            background: 'color-mix(in srgb, var(--surface-raised) 60%, transparent)',
            backdropFilter: 'blur(24px) saturate(1.5)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
            border: '1px solid var(--border-strong)',
            borderRadius: 10,
            boxShadow: '0 8px 32px var(--shadow-7), inset 0 1px 0 var(--shine-2)',
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {/* Wheel */}
          <HexColorPicker
            color={displayColor}
            onChange={onChange}
            style={{ width: '100%', height: 180 }}
          />

          {/* Hex input + reset */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', flexShrink: 0 }}>#</span>
            <HexColorInput
              color={displayColor}
              onChange={onChange}
              prefixed={false}
              style={{
                flex: 1,
                height: 26,
                background: 'var(--input-bg)',
                border: '1px solid var(--input-border)',
                borderTopColor: 'var(--input-border-top)',
                borderRadius: 4,
                padding: '0 7px',
                fontSize: 11,
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                color: 'var(--text-primary)',
                outline: 'none',
                boxShadow: 'inset 0 2px 4px var(--shadow-6)',
                letterSpacing: '0.05em',
                userSelect: 'text',
                cursor: 'text',
              }}
            />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
