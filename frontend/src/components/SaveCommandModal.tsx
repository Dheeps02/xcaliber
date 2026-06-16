import { useMemo, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { FloppyDisk } from '@phosphor-icons/react';
import { useAppStore } from '../stores/app-store';
import type { SavedCmd } from '../lib/types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

const EXIT_MS = 130;

interface Props {
  defaultName: string;
  cmdKey: string;
  bytes: string[];
  onClose: () => void;
}

function suggestionRowStyle(active: boolean): CSSProperties {
  return {
    padding: '4px 8px',
    fontSize: 11,
    textAlign: 'left',
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
    background: active ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'transparent',
  };
}

export function SaveCommandModal({ defaultName, cmdKey, bytes, onClose }: Props) {
  const savedCmds   = useAppStore((s) => s.savedCmds);
  const addSavedCmd = useAppStore((s) => s.addSavedCmd);
  const showToast   = useAppStore((s) => s.showToast);

  const [name, setName]           = useState(defaultName);
  const [group, setGroup]         = useState('');
  const [subgroup, setSubgroup]   = useState('');
  const [isExiting, setIsExiting] = useState(false);
  const [groupOpen, setGroupOpen]       = useState(false);
  const [subgroupOpen, setSubgroupOpen] = useState(false);

  const groups = useMemo(() => {
    const all = Array.from(new Set(savedCmds.map((c) => c.group))).sort();
    const q = group.trim().toLowerCase();
    return q ? all.filter((g) => g.toLowerCase().includes(q)) : all;
  }, [savedCmds, group]);

  const subgroups = useMemo(() => {
    const all = Array.from(new Set(
      savedCmds.filter((c) => c.group === group.trim() && c.subgroup).map((c) => c.subgroup as string)
    )).sort();
    const q = subgroup.trim().toLowerCase();
    return q ? all.filter((sg) => sg.toLowerCase().includes(q)) : all;
  }, [savedCmds, group, subgroup]);

  function close() {
    setIsExiting(true);
    setTimeout(onClose, EXIT_MS);
  }

  function handleSave() {
    const trimmedName  = name.trim();
    const trimmedGroup = group.trim();
    const trimmedSub   = subgroup.trim();
    if (!trimmedName || !trimmedGroup) return;

    const cmd: SavedCmd = {
      id: crypto.randomUUID(),
      name: trimmedName,
      group: trimmedGroup,
      ...(trimmedSub ? { subgroup: trimmedSub } : {}),
      cmdKey,
      bytes,
    };
    addSavedCmd(cmd);
    showToast(`Saved "${trimmedName}" to ${trimmedGroup}${trimmedSub ? ` / ${trimmedSub}` : ''}`, 'success');
    close();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') close();
  }

  return createPortal(
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 ${isExiting ? 'modal-backdrop-exit' : 'modal-backdrop-enter'}`}
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        className={`xcb-glass w-80 p-4 flex flex-col gap-3 rounded-lg ${isExiting ? 'modal-panel-exit' : 'modal-panel-enter'}`}
        style={{ border: '1px solid var(--border-strong)', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}
      >
        <div className="flex items-center gap-2">
          <FloppyDisk size={14} style={{ color: 'var(--text-muted)' }} />
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
            Save Command
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Name</label>
          <Input value={name} onChange={setName} autoFocus onKeyDown={handleKeyDown} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Group</label>
          <Input
            value={group}
            onChange={(v) => { setGroup(v); setGroupOpen(true); }}
            onFocus={() => setGroupOpen(true)}
            onBlur={() => setGroupOpen(false)}
            placeholder="Choose or create a group…"
            onKeyDown={handleKeyDown}
          />
          {groupOpen && groups.length > 0 && (
            <div className="flex flex-col rounded overflow-y-auto" style={{ border: '1px solid var(--border-strong)', background: 'var(--surface-overlay)', maxHeight: 96 }}>
              {groups.map((g) => (
                <button
                  key={g}
                  type="button"
                  style={suggestionRowStyle(g === group.trim())}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setGroup(g); setGroupOpen(false); }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
                  onMouseLeave={(e) => Object.assign(e.currentTarget.style, suggestionRowStyle(g === group.trim()))}
                >
                  {g}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Subgroup (optional)</label>
          <Input
            value={subgroup}
            onChange={(v) => { setSubgroup(v); setSubgroupOpen(true); }}
            onFocus={() => setSubgroupOpen(true)}
            onBlur={() => setSubgroupOpen(false)}
            placeholder="Choose or create a subgroup…"
            onKeyDown={handleKeyDown}
          />
          {subgroupOpen && subgroups.length > 0 && (
            <div className="flex flex-col rounded overflow-y-auto" style={{ border: '1px solid var(--border-strong)', background: 'var(--surface-overlay)', maxHeight: 96 }}>
              {subgroups.map((sg) => (
                <button
                  key={sg}
                  type="button"
                  style={suggestionRowStyle(sg === subgroup.trim())}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setSubgroup(sg); setSubgroupOpen(false); }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
                  onMouseLeave={(e) => Object.assign(e.currentTarget.style, suggestionRowStyle(sg === subgroup.trim()))}
                >
                  {sg}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button variant="primary" disabled={!name.trim() || !group.trim()} onClick={handleSave}>
            <FloppyDisk size={13} />Save
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
