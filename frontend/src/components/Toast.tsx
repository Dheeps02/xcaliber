import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CheckCircle, XCircle, WarningCircle, Info } from '@phosphor-icons/react';
import { useAppStore } from '../stores/app-store';
import type { Toast } from '../stores/app-store';

function iconFor(type: Toast['type'], color: string) {
  const props = { size: 16, weight: 'fill', style: { color, flexShrink: 0, filter: `drop-shadow(0 0 4px ${color})` } } as const;
  if (type === 'success') return <CheckCircle   {...props} />;
  if (type === 'error')   return <XCircle       {...props} />;
  if (type === 'warning') return <WarningCircle {...props} />;
  return                         <Info          {...props} />;
}

function colorFor(type: Toast['type']): string {
  if (type === 'success') return 'var(--status-ok)';
  if (type === 'error')   return 'var(--status-err)';
  if (type === 'warning') return 'var(--status-warn)';
  return 'var(--text-muted)';
}

function ToastItem({ id, message, type, detail, faded }: Toast & { faded: boolean }) {
  const dismissToast = useAppStore((s) => s.dismissToast);
  const [dying, setDying]       = useState(false);
  const [expanded, setExpanded] = useState(false);

  const color   = colorFor(type);
  const hasMore = !!detail || message.length > 55;

  useEffect(() => {
    if (expanded) return;
    const out  = setTimeout(() => setDying(true),   3200);
    const kill = setTimeout(() => dismissToast(id), 3600);
    return () => { clearTimeout(out); clearTimeout(kill); };
  }, [id, dismissToast, expanded]);

  function dismiss() {
    setDying(true);
    setTimeout(() => dismissToast(id), 400);
  }

  return (
    <div
      data-toast-id={id}
      style={{
        opacity: faded ? 0 : 1,
        transition: 'opacity 240ms ease',
        pointerEvents: faded ? 'none' : 'auto',
      }}
    >
      <div
        data-type={type}
        className={`xcb-toast select-none ${dying ? 'toast-out' : 'toast-in'}`}
        style={{ width: 720 }}
        onClick={dismiss}
      >
        <div className="xcb-toast-glow" />
        <div className="relative flex items-center gap-2.5 px-4 py-2.5">
          {iconFor(type, color)}
          <div className="flex-1 min-w-0">
            {!expanded ? (
              <div className="flex items-center gap-2">
                <p
                  className="flex-1 min-w-0 text-xs font-medium leading-snug overflow-hidden whitespace-nowrap"
                  style={{
                    color: 'var(--toast-text)',
                    maskImage: hasMore ? 'linear-gradient(to right, black 70%, transparent 95%)' : 'none',
                    WebkitMaskImage: hasMore ? 'linear-gradient(to right, black 70%, transparent 95%)' : 'none',
                  }}
                >
                  {message}
                </p>
                {hasMore && (
                  <button
                    className="shrink-0 text-[10px] underline opacity-50 hover:opacity-90 transition-opacity"
                    style={{ color }}
                    onClick={e => { e.stopPropagation(); setExpanded(true); }}
                  >
                    More
                  </button>
                )}
              </div>
            ) : (
              <div>
                <p className="text-xs font-medium leading-relaxed break-words" style={{ color: 'var(--toast-text)' }}>
                  {message}
                </p>
                {detail && (
                  <p
                    className="mt-2 text-[10px] font-normal leading-relaxed break-words border-t pt-2 opacity-60"
                    style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}
                  >
                    {detail}
                  </p>
                )}
              </div>
            )}
          </div>
          {expanded && (
            <button
              className="shrink-0 text-base leading-none opacity-40 hover:opacity-80 transition-opacity"
              style={{ color: 'var(--text-muted)' }}
              onClick={e => { e.stopPropagation(); dismiss(); }}
            >
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ToastContainer() {
  const toasts    = useAppStore((s) => s.toasts);
  const listRef   = useRef<HTMLDivElement>(null);
  const posRef    = useRef<Map<number, number>>(new Map());

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const items = list.querySelectorAll<HTMLElement>('[data-toast-id]');

    items.forEach(item => {
      const id   = Number(item.getAttribute('data-toast-id'));
      const newY = item.getBoundingClientRect().top;
      const oldY = posRef.current.get(id);

      if (oldY !== undefined && Math.abs(oldY - newY) > 0.5 && !item.querySelector('.toast-out')) {
        const delta = oldY - newY;
        item.animate(
          [{ transform: `translateY(${delta}px)` }, { transform: 'translateY(0)' }],
          { duration: 240, easing: 'cubic-bezier(0.34, 1.20, 0.64, 1)' },
        );
      }

      posRef.current.set(id, newY);
    });

    const live = new Set(Array.from(items).map(el => Number(el.getAttribute('data-toast-id'))));
    posRef.current.forEach((_, id) => { if (!live.has(id)) posRef.current.delete(id); });
  });

  return (
    <div
      ref={listRef}
      className="fixed z-[10001] pointer-events-none flex flex-col items-center gap-2"
      style={{ bottom: '10vh', left: '50%', transform: 'translateX(-50%)' }}
    >
      {toasts.map((t, i) => (
        <ToastItem key={t.id} {...t} faded={i < toasts.length - 3} />
      ))}
    </div>
  );
}
