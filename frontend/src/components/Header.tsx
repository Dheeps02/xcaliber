import { useRef, useState } from 'react';
import { useAppStore } from '../stores/app-store';
import { api } from '../lib/api';
import { Settings } from './Settings';
import { ToastContainer } from './Toast';
import type { DaqEntryType } from '../lib/types';

export function Header() {
  const connected       = useAppStore((s) => s.connected);
  const setConnected    = useAppStore((s) => s.setConnected);
  const showToast       = useAppStore((s) => s.showToast);
  const a2lVariables    = useAppStore((s) => s.a2lVariables);
  const setA2lVariables = useAppStore((s) => s.setA2lVariables);
  const [showSettings, setShowSettings] = useState(false);
  const a2lInputRef = useRef<HTMLInputElement>(null);

  async function handleToggle() {
    if (connected) {
      setConnected(false);
      await api.disconnect().catch(() => {});
      showToast('Disconnected', 'info');
    } else {
      try {
        const r = await api.connect();
        setConnected(true, r.slave);
        showToast('Connected to slave', 'success');
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Connection failed';
        showToast(msg, 'error');
      }
    }
  }

  async function handleLoadA2l(file: File) {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as unknown;
      const arr = Array.isArray(data) ? data
        : (data as Record<string, unknown>).variables ?? [];
      if (!Array.isArray(arr)) throw new Error();
      setA2lVariables(arr as { name: string; addr: number; type?: DaqEntryType }[]);
      showToast(`Loaded ${(arr as unknown[]).length} A2L variable(s)`, 'success');
    } catch {
      showToast('Invalid A2L JSON. Expected [{name, addr, type?}]', 'error');
    }
  }

  return (
    <>
      <input
        ref={a2lInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) { handleLoadA2l(file); e.target.value = ''; }
        }}
      />
      <header className="flex items-center justify-end px-4 h-11 border-b border-gray-800 bg-gray-900 shrink-0">
        <div className="flex items-center gap-2">
          {/* A2L loader — far left */}
          <button
            onClick={() => a2lInputRef.current?.click()}
            title={a2lVariables.length > 0
              ? `A2L loaded: ${a2lVariables.length} variables`
              : 'Load A2L JSON for variable autocomplete'}
            className={`px-2 py-1 rounded-md text-xs font-medium border transition-colors active:scale-95 ${
              a2lVariables.length > 0
                ? 'text-green-400 border-green-500/30 bg-green-500/10 hover:bg-green-500/20'
                : 'text-gray-400 border-gray-700 bg-gray-800 hover:bg-gray-700'
            }`}
          >
            A2L{a2lVariables.length > 0 ? ` (${a2lVariables.length})` : ''}
          </button>

          <div className="w-px h-4 bg-gray-800" />

          {/* Connect / Disconnect */}
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${connected ? 'blinker-on' : 'blinker-off'}`} />
            <button
              onClick={handleToggle}
              style={{ minWidth: '90px' }}
              className={`py-1 rounded-md text-xs font-medium border transition-colors active:scale-95 text-center ${
                connected
                  ? 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'
                  : 'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20'
              }`}
            >
              {connected ? 'Disconnect' : 'Connect'}
            </button>
          </div>

          {/* Get Status */}
          <button
            onClick={() => api.getStatus().catch(() => {})}
            disabled={!connected}
            className="px-2 py-1 rounded-md text-xs font-medium bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-800 text-gray-400 border border-gray-700 transition-colors active:scale-95 disabled:active:scale-100"
          >
            Get Status
          </button>

          <div className="w-px h-4 bg-gray-800" />

          {/* Sync — far right before settings */}
          <button
            onClick={() => api.sync().catch((e: Error) => showToast(e.message, 'error'))}
            disabled={!connected}
            className="px-2 py-1 rounded-md text-xs font-medium bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-800 text-gray-400 border border-gray-700 transition-colors active:scale-95 disabled:active:scale-100"
          >
            Sync
          </button>

          {/* Settings — always last */}
          <button
            onClick={() => setShowSettings(true)}
            title="Settings"
            className="w-7 h-7 rounded flex items-center justify-center text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition-colors active:scale-95"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </header>
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      <ToastContainer />
    </>
  );
}
