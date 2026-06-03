import { useState } from 'react';
import { useAppStore } from '../stores/app-store';
import { ArrowsClockwise } from '@phosphor-icons/react';

const EXIT_MS = 130;

export function AlertModal() {
  const alertMsg    = useAppStore((s) => s.alertMsg);
  const alertAction = useAppStore((s) => s.alertAction);
  const clearAlert  = useAppStore((s) => s.clearAlert);
  const [isExiting, setIsExiting] = useState(false);
  const [pending, setPending]     = useState(false);

  if (!alertMsg) return null;

  function handleClose() {
    setIsExiting(true);
    setTimeout(() => { clearAlert(); setIsExiting(false); }, EXIT_MS);
  }

  async function handleAction() {
    if (!alertAction) return;
    setPending(true);
    try {
      await alertAction.fn();
    } catch {
      setPending(false);
    }
  }

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 ${isExiting ? 'modal-backdrop-exit' : 'modal-backdrop-enter'}`}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !alertAction) handleClose(); }}
    >
      <div className={`bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-80 p-5 flex flex-col gap-4 ${isExiting ? 'modal-panel-exit' : 'modal-panel-enter'}`}>
        <p className="text-sm text-gray-200 leading-relaxed">{alertMsg}</p>
        <div className="flex gap-2 justify-end">
          {alertAction ? (
            <>
              <button
                onClick={handleClose}
                disabled={pending}
                className="px-3 py-1.5 rounded text-xs text-gray-400 hover:text-gray-200 border border-gray-700 hover:bg-gray-800 disabled:opacity-40 transition-colors"
              >
                Dismiss
              </button>
              <button
                onClick={handleAction}
                disabled={pending}
                className="px-4 py-1.5 rounded text-xs font-medium bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white transition-colors active:scale-95 flex items-center gap-1.5"
              >
                <ArrowsClockwise size={12} className={pending ? 'animate-spin' : ''} />
                {alertAction.label}
              </button>
            </>
          ) : (
            <button
              onClick={handleClose}
              className="px-4 py-1.5 rounded text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors active:scale-95"
            >
              OK
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
