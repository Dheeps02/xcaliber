import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FolderOpen } from '@phosphor-icons/react';
import { isElectron } from '../lib/electron';

const inElectron = isElectron();

const EXIT_MS = 130;

interface Props {
  defaultFilename: string;
  content: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ExportDialog({ defaultFilename, content, onClose, onSuccess }: Props) {
  const dotIdx = defaultFilename.lastIndexOf('.');
  const defaultStem = dotIdx > 0 ? defaultFilename.slice(0, dotIdx) : defaultFilename;
  const ext = dotIdx > 0 ? defaultFilename.slice(dotIdx) : '';

  const [stem, setStem] = useState(defaultStem);
  const [folder, setFolder] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (!inElectron) return;
    window.electron!.getDocumentsDir().then(setFolder).catch(() => setFolder(''));
  }, []);

  function close() {
    setIsExiting(true);
    setTimeout(() => { onClose(); }, EXIT_MS);
  }

  async function browseFolder() {
    const selected = await window.electron!.openDirectory();
    if (selected) setFolder(selected);
  }

  async function handleSave() {
    const name = stem.trim() + ext;
    if (!stem.trim()) { setError('Filename is required.'); return; }

    setSaving(true);
    setError('');

    try {
      if (inElectron) {
        const sep = folder.endsWith('/') || folder.endsWith('\\') ? '' : '/';
        const path = folder ? `${folder}${sep}${name}` : name;
        await window.electron!.saveFile(path, content);
      } else {
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = name; a.click();
        URL.revokeObjectURL(url);
      }
      onSuccess?.();
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 ${isExiting ? 'modal-backdrop-exit' : 'modal-backdrop-enter'}`}
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className={`bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-96 p-5 flex flex-col gap-4 ${isExiting ? 'modal-panel-exit' : 'modal-panel-enter'}`}>
        <p className="text-sm font-medium text-gray-200">Export File</p>

        {/* Filename */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Filename</label>
          <div className="flex items-stretch rounded-md border border-gray-700 bg-gray-800 focus-within:border-blue-500 transition-colors overflow-hidden">
            <input
              autoFocus
              value={stem}
              onChange={(e) => { setStem(e.target.value); setError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') close(); }}
              className="flex-1 px-2.5 py-1.5 bg-transparent text-xs font-mono text-gray-200 focus:outline-none min-w-0"
            />
            {ext && (
              <span className="px-2 py-1.5 text-xs font-mono text-gray-500 bg-gray-750 border-l border-gray-700 select-none shrink-0">
                {ext}
              </span>
            )}
          </div>
        </div>

        {/* Folder — Electron only */}
        {inElectron && (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Folder</label>
            <div className="flex gap-2">
              <input
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                placeholder="Choose a folder…"
                className="flex-1 px-2.5 py-1.5 rounded-md bg-gray-800 border border-gray-700 text-xs font-mono text-gray-200 focus:outline-none focus:border-blue-500 transition-colors min-w-0"
              />
              <button
                onClick={browseFolder}
                className="px-2.5 py-1.5 rounded-md bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors flex items-center gap-1.5 text-xs shrink-0"
              >
                <FolderOpen size={14} /> Browse
              </button>
            </div>
          </div>
        )}

        {error && <p className="text-[10px] text-red-400">{error}</p>}

        <div className="flex gap-2 justify-end">
          <button
            onClick={close}
            className="px-4 py-1.5 rounded text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 rounded text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors active:scale-95"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
