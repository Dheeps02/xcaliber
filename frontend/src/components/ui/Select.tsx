import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CaretDown, Check } from '@phosphor-icons/react';
import './Select.css';

interface SelectOption<T extends string | number> {
  value: T;
  label: string;
  prefix?: React.ReactNode;
}

interface SelectOwnProps<T extends string | number> {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  valueColor?: string;
  dirty?: boolean;
}

type SelectProps<T extends string | number> = SelectOwnProps<T> &
  Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'>;

export function Select<T extends string | number>({
  value,
  onChange,
  options,
  valueColor,
  dirty = false,
  className = '',
  style,
  onKeyDown: externalKeyDown,
  ...rest
}: SelectProps<T>) {
  const [open, setOpen]         = useState(false);
  const [panelRect, setPanelRect] = useState<DOMRect | null>(null);
  const triggerRef              = useRef<HTMLDivElement>(null);
  const panelRef                = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.value === value);

  function openPanel() {
    const el = triggerRef.current;
    if (!el) return;
    setPanelRect(el.getBoundingClientRect());
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !panelRef.current?.contains(t)) {
        setOpen(false);
      }
    }
    function onScroll(e: Event) {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape' && open) { setOpen(false); return; }
    if (!open && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
      e.preventDefault(); openPanel(); return;
    }
    if (open) {
      const idx = options.findIndex(o => o.value === value);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        onChange(options[Math.min(idx + 1, options.length - 1)].value);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        onChange(options[Math.max(idx - 1, 0)].value);
        return;
      }
      if (e.key === 'Enter') { setOpen(false); return; }
    }
    externalKeyDown?.(e);
  }

  let panelStyle: React.CSSProperties = {};
  if (panelRect) {
    const estimatedH = Math.min(options.length * 26 + 10, 200);
    const flipUp = panelRect.bottom + estimatedH > window.innerHeight - 8 && panelRect.top > estimatedH + 8;
    panelStyle = {
      position: 'fixed',
      left: panelRect.left,
      minWidth: panelRect.width,
      zIndex: 9999,
      ...(flipUp
        ? { bottom: window.innerHeight - panelRect.top + 2 }
        : { top: panelRect.bottom + 2 }
      ),
    };
  }

  const triggerCls = ['xcb-select-trigger', open ? 'open' : '', dirty ? 'dirty' : '', className]
    .filter(Boolean).join(' ');

  return (
    <div
      {...rest}
      ref={triggerRef}
      className={triggerCls}
      style={style}
      tabIndex={0}
      role="combobox"
      aria-expanded={open}
      aria-haspopup="listbox"
      onClick={() => open ? setOpen(false) : openPanel()}
      onKeyDown={handleKeyDown}
    >
      {selected?.prefix}
      <span className="xcb-select-value" style={valueColor ? { color: valueColor } : undefined}>
        {selected?.label ?? '—'}
      </span>
      <CaretDown size={9} className={`xcb-select-caret${open ? ' open' : ''}`} />

      {open && createPortal(
        <div ref={panelRef} className="xcb-select-panel" style={panelStyle} role="listbox">
          {options.map(opt => (
            <div
              key={String(opt.value)}
              className={`xcb-select-item${opt.value === value ? ' selected' : ''}`}
              role="option"
              aria-selected={opt.value === value}
              onMouseDown={e => { e.preventDefault(); onChange(opt.value); setOpen(false); }}
            >
              {opt.prefix}
              <span style={{ flex: 1 }}>{opt.label}</span>
              {opt.value === value && <Check size={9} style={{ flexShrink: 0, color: 'var(--accent)' }} />}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
