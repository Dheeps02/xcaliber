import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/app-store';
import type { Toast } from '../stores/app-store';

function ToastItem({ id, message, type, detail }: Toast) {
  const dismissToast = useAppStore((s) => s.dismissToast);
  const [dying, setDying] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const hasMore = !!detail || message.length > 55;

  useEffect(() => {
    if (expanded) return;
    const out = setTimeout(() => setDying(true), 3200);
    const kill = setTimeout(() => dismissToast(id), 3600);
    return () => { clearTimeout(out); clearTimeout(kill); };
  }, [id, dismissToast, expanded]);

  function dismiss() {
    setDying(true);
    setTimeout(() => dismissToast(id), 400);
  }

  const colorCls =
    type === 'success' ? 'bg-green-900/95 border-green-500/40 text-green-200' :
    type === 'error'   ? 'bg-red-900/95 border-red-500/40 text-red-200' :
                         'bg-gray-800/98 border-gray-600/50 text-gray-200';

  return (
    <div
      className={`rounded-lg border shadow-2xl text-xs font-medium w-72 pointer-events-auto select-none ${colorCls} ${dying ? 'toast-out' : 'toast-in'}`}
      onClick={dismiss}
    >
      <div className="px-3 py-2.5 flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {!expanded ? (
            <div className="relative flex items-center gap-1.5">
              <p
                className="flex-1 min-w-0 overflow-hidden whitespace-nowrap text-xs leading-snug"
                style={{
                  maskImage: hasMore
                    ? `linear-gradient(to right, black 65%, transparent 92%)`
                    : 'none',
                  WebkitMaskImage: hasMore
                    ? `linear-gradient(to right, black 65%, transparent 92%)`
                    : 'none',
                }}
              >
                {message}
              </p>
              {hasMore && (
                <button
                  className="shrink-0 text-[10px] opacity-60 hover:opacity-100 transition-opacity underline"
                  style={{ color: 'inherit' }}
                  onClick={e => { e.stopPropagation(); setExpanded(true); }}
                >
                  More
                </button>
              )}
            </div>
          ) : (
            <div>
              <p className="text-xs leading-relaxed break-words">{message}</p>
              {detail && (
                <p className="mt-2 text-[10px] opacity-60 break-words font-normal leading-relaxed border-t border-white/10 pt-2">
                  {detail}
                </p>
              )}
            </div>
          )}
        </div>
        {expanded && (
          <button
            className="shrink-0 opacity-50 hover:opacity-90 transition-opacity text-base leading-none mt-px"
            onClick={e => { e.stopPropagation(); dismiss(); }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useAppStore((s) => s.toasts);
  return (
    <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-[10001] pointer-events-none">
      {toasts.map((t) => <ToastItem key={t.id} {...t} />)}
    </div>
  );
}
