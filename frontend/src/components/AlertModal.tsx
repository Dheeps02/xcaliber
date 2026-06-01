import { useAppStore } from '../stores/app-store';

export function AlertModal() {
  const alertMsg  = useAppStore((s) => s.alertMsg);
  const clearAlert = useAppStore((s) => s.clearAlert);

  if (!alertMsg) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
      onMouseDown={(e) => { if (e.target === e.currentTarget) clearAlert(); }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-80 p-5 flex flex-col gap-4">
        <p className="text-sm text-gray-200 leading-relaxed">{alertMsg}</p>
        <button
          onClick={clearAlert}
          className="self-end px-4 py-1.5 rounded text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors active:scale-95"
        >
          OK
        </button>
      </div>
    </div>
  );
}
