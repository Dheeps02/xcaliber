import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/app-store';
import type { Toast } from '../stores/app-store';

function ToastItem({ id, message, type }: Toast) {
  const dismissToast = useAppStore((s) => s.dismissToast);
  const [dying, setDying] = useState(false);

  useEffect(() => {
    const out = setTimeout(() => setDying(true), 2600);
    const kill = setTimeout(() => dismissToast(id), 3000);
    return () => { clearTimeout(out); clearTimeout(kill); };
  }, [id, dismissToast]);

  const colorCls =
    type === 'success' ? 'bg-green-900/90 border-green-500/40 text-green-300' :
    type === 'error'   ? 'bg-red-900/90 border-red-500/40 text-red-300' :
                         'bg-gray-800/95 border-gray-600/50 text-gray-200';

  return (
    <div
      className={`px-4 py-2.5 rounded-lg border backdrop-blur-sm shadow-xl text-xs font-medium min-w-52 ${colorCls} ${dying ? 'toast-out' : 'toast-in'}`}
    >
      {message}
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
