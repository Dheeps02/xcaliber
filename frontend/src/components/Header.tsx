import { useAppStore } from '../stores/app-store';
import { api } from '../lib/api';

export function Header() {
  const connected = useAppStore((s) => s.connected);
  const setConnected = useAppStore((s) => s.setConnected);

  async function handleToggle() {
    if (connected) {
      setConnected(false);
      await api.disconnect().catch(() => {});
    } else {
      try {
        const r = await api.connect();
        setConnected(true, r.slave);
      } catch (e) {
        console.error('Connect failed:', e);
      }
    }
  }

  return (
    <header className="flex items-center justify-between px-4 h-11 border-b border-gray-800 bg-gray-900 shrink-0">
      <div className="flex items-center gap-3">
        <span className="font-semibold text-sm tracking-tight">XCP Client</span>
        <span className="text-gray-600 text-xs">v0.1.0</span>
      </div>
      <div className="flex items-center gap-3">
        {connected && (
          <button
            onClick={() => api.getStatus().catch(() => {})}
            className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-800 hover:bg-gray-700 text-gray-400 border border-gray-700 transition-colors"
          >
            GET_STATUS
          </button>
        )}
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              connected ? 'blinker-on' : 'bg-gray-600'
            }`}
          />
          <button
            onClick={handleToggle}
            className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
              connected
                ? 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'
                : 'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20'
            }`}
          >
            {connected ? 'Disconnect' : 'Connect'}
          </button>
        </div>
      </div>
    </header>
  );
}
