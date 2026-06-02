import { useRef, useState } from 'react';
import { FileCode, Link, LinkBreak, Broadcast, ArrowsClockwise, GearSix, X, FolderOpen } from '@phosphor-icons/react';
import { revealItemInFileExplorer } from '@tauri-apps/plugin-opener';
import { useAppStore } from '../stores/app-store';
import { api } from '../lib/api';
import { Settings } from './Settings';
import { ToastContainer } from './Toast';
import type { DaqEntryType } from '../lib/types';

export function Header() {
  const connected          = useAppStore((s) => s.connected);
  const setConnected       = useAppStore((s) => s.setConnected);
  const showToast          = useAppStore((s) => s.showToast);
  const a2lVariables       = useAppStore((s) => s.a2lVariables);
  const setA2lVariables    = useAppStore((s) => s.setA2lVariables);
  const settingsOpen       = useAppStore((s) => s.settingsOpen);
  const settingsInitialTab = useAppStore((s) => s.settingsInitialTab);
  const openSettings       = useAppStore((s) => s.openSettings);
  const closeSettings      = useAppStore((s) => s.closeSettings);
  const a2lInputRef = useRef<HTMLInputElement>(null);
  const [a2lFileName, setA2lFileName] = useState<string | null>(null);
  const [a2lFilePath, setA2lFilePath] = useState<string | null>(null);

  async function handleToggle() {
    if (connected) {
      setConnected(false);
      await api.disconnect().catch(() => {});
    } else {
      try {
        const r = await api.connect();
        setConnected(true, r.slave);
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
      setA2lFileName(file.name);
      setA2lFilePath((file as File & { path?: string }).path ?? null);
      showToast(`Loaded ${(arr as unknown[]).length} A2L variable(s)`, 'success');
    } catch {
      showToast('Invalid A2L JSON. Expected [{name, addr, type?}]', 'error');
    }
  }

  function handleUnloadA2l() {
    setA2lVariables([]);
    setA2lFileName(null);
    setA2lFilePath(null);
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
      <header className="flex items-center justify-between px-4 h-11 border-b border-gray-800 bg-gray-900 shrink-0">
        {/* A2L loader — far left */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => a2lInputRef.current?.click()}
            title={a2lFileName ? `${a2lFileName} · ${a2lVariables.length} variables` : 'Load A2L JSON for variable autocomplete'}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border transition-colors active:scale-95 shrink-0 ${
              a2lFileName
                ? 'text-green-400 border-green-500/30 bg-green-500/10 hover:bg-green-500/20'
                : 'text-gray-400 border-gray-700 bg-gray-800 hover:bg-gray-700'
            }`}
          >
            <FileCode size={14} />
            {a2lFileName ? 'A2L Loaded' : 'Load A2L'}
          </button>
          {a2lFileName && (
            <div className="flex items-center gap-1 min-w-0">
              {a2lFilePath ? (
                <button
                  onClick={() => revealItemInFileExplorer(a2lFilePath).catch(() => {})}
                  title="Reveal in file explorer"
                  className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 truncate max-w-[160px] transition-colors"
                >
                  <FolderOpen size={11} />
                  {a2lFileName}
                </button>
              ) : (
                <span className="text-[10px] text-gray-500 truncate max-w-[160px]">{a2lFileName}</span>
              )}
              <button
                onClick={handleUnloadA2l}
                title="Unload A2L"
                className="text-gray-600 hover:text-red-400 transition-colors shrink-0"
              >
                <X size={11} />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">

          {/* Connect / Disconnect */}
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${connected ? 'blinker-on' : 'blinker-off'}`} />
            <button
              onClick={handleToggle}
              style={{ minWidth: '90px' }}
              className={`py-1 px-2 rounded-md text-xs font-medium border transition-colors active:scale-95 flex items-center gap-1.5 ${
                connected
                  ? 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'
                  : 'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20'
              }`}
            >
              {connected ? <LinkBreak size={14} /> : <Link size={14} />}
              {connected ? 'Disconnect' : 'Connect'}
            </button>
          </div>

          {/* Get Status */}
          <button
            onClick={() => api.getStatus().catch(() => {})}
            disabled={!connected}
            className="px-2 py-1 rounded-md text-xs font-medium bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-800 text-gray-400 border border-gray-700 transition-colors active:scale-95 disabled:active:scale-100 flex items-center gap-1.5"
          >
            <Broadcast size={14} />
            Get Status
          </button>

          <div className="w-px h-4 bg-gray-800" />

          {/* Sync — far right before settings */}
          <button
            onClick={() => api.sync().catch((e: Error) => showToast(e.message, 'error'))}
            disabled={!connected}
            className="px-2 py-1 rounded-md text-xs font-medium bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-800 text-gray-400 border border-gray-700 transition-colors active:scale-95 disabled:active:scale-100 flex items-center gap-1.5"
          >
            <ArrowsClockwise size={14} />
            Sync
          </button>

          {/* Settings — always last */}
          <button
            onClick={() => openSettings()}
            title="Settings"
            className="w-7 h-7 rounded flex items-center justify-center text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition-colors active:scale-95"
          >
            <GearSix size={16} />
          </button>
        </div>
      </header>
      {settingsOpen && <Settings onClose={closeSettings} initialTab={settingsInitialTab} />}
      <ToastContainer />
    </>
  );
}
