import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FolderOpen, Bookmark } from '@phosphor-icons/react';
import { isElectron } from '../lib/electron';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

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

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') close();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        className={`xcb-glass-panel rounded-lg w-96 p-5 flex flex-col gap-4 ${isExiting ? 'modal-panel-exit' : 'modal-panel-enter'}`}
        style={{ border: '1px solid var(--border-strong)', boxShadow: '0 16px 48px var(--shadow-8)' }}
      >
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Export File</p>

        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Filename</label>
          <div className="flex items-center gap-1.5">
            <Input mono autoFocus value={stem} onChange={(v) => { setStem(v); setError(''); }} onKeyDown={handleKeyDown} />
            {ext && (
              <span className="text-xs font-mono shrink-0" style={{ color: 'var(--text-muted)' }}>{ext}</span>
            )}
          </div>
        </div>

        {inElectron && (
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Folder</label>
            <div className="flex gap-2">
              <Input mono value={folder} onChange={setFolder} placeholder="Choose a folder…" onKeyDown={handleKeyDown} />
              <Button variant="default" onClick={browseFolder}>
                <FolderOpen size={13} />Browse
              </Button>
            </div>
          </div>
        )}

        {error && <p className="text-[10px]" style={{ color: 'var(--status-err)' }}>{error}</p>}

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button variant="primary" disabled={saving} onClick={handleSave}>
            <Bookmark size={13} />{saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
