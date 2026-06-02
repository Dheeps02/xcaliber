import { useState, useRef } from 'react';
import { useAppStore } from '../stores/app-store';
import type { UserCmdDef, UserCmdRequestByte, UserCmdResponseVariant, UserCmdResponseByte, MatchCondition, UserCmdFileFormat } from '../lib/types';

// ── Helpers ───────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

function newCmd(): UserCmdDef {
  return {
    id: uid(),
    name: 'NewCmd',
    requestBytes: [],
    responseVariants: [{ id: uid(), name: 'Default', conditions: [], bytes: [] }],
  };
}

const OPS: MatchCondition['op'][] = ['==', '!=', '<', '>', '<=', '>='];

const inputCls =
  'w-full px-2 py-0.5 rounded bg-gray-900 border border-gray-700 text-xs font-mono text-gray-200 focus:outline-none focus:border-blue-500 placeholder:text-gray-700';

// ── Animated collapse wrapper ─────────────────────────────────────

function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div
      style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows 200ms ease' }}
    >
      <div style={{ overflow: 'hidden' }}>{children}</div>
    </div>
  );
}

// ── ConditionBadge ────────────────────────────────────────────────

function ConditionRow({
  cond,
  onChange,
  onRemove,
}: {
  cond: MatchCondition;
  onChange: (c: MatchCondition) => void;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-[10px] font-mono text-gray-500">req[</span>
      <input
        type="number"
        min={0}
        value={cond.reqByteOffset}
        onChange={(e) => onChange({ ...cond, reqByteOffset: Number(e.target.value) })}
        className="w-8 px-1 py-0.5 rounded bg-gray-900 border border-gray-700 text-[10px] font-mono text-amber-300 focus:outline-none focus:border-blue-500 text-center"
      />
      <span className="text-[10px] font-mono text-gray-500">]</span>
      <select
        value={cond.op}
        onChange={(e) => onChange({ ...cond, op: e.target.value as MatchCondition['op'] })}
        className="px-1 py-0.5 rounded bg-gray-900 border border-gray-700 text-[10px] font-mono text-amber-300 focus:outline-none focus:border-blue-500"
      >
        {OPS.map((op) => <option key={op} value={op}>{op}</option>)}
      </select>
      <span className="text-[10px] font-mono text-gray-400">0x</span>
      <input
        type="text"
        maxLength={2}
        value={cond.value.toString(16).toUpperCase().padStart(2, '0')}
        onChange={(e) => {
          const n = parseInt(e.target.value, 16);
          if (!isNaN(n)) onChange({ ...cond, value: n });
        }}
        className="w-8 px-1 py-0.5 rounded bg-gray-900 border border-gray-700 text-[10px] font-mono text-amber-300 focus:outline-none focus:border-blue-500 text-center uppercase"
      />
      <button onClick={onRemove} className="text-gray-600 hover:text-red-400 transition-colors text-[11px] ml-0.5">✕</button>
    </span>
  );
}

// ── VariantCard ───────────────────────────────────────────────────

function VariantCard({
  variant,
  onUpdate,
  onDuplicate,
  onRemove,
}: {
  variant: UserCmdResponseVariant;
  onUpdate: (v: UserCmdResponseVariant) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(true);
  const isDefault = variant.conditions.length === 0;

  function updateCond(i: number, c: MatchCondition) {
    const conditions = variant.conditions.map((x, j) => j === i ? c : x);
    onUpdate({ ...variant, conditions });
  }

  function removeCond(i: number) {
    onUpdate({ ...variant, conditions: variant.conditions.filter((_, j) => j !== i) });
  }

  function addCond() {
    onUpdate({ ...variant, conditions: [...variant.conditions, { reqByteOffset: 1, op: '==', value: 0 }] });
  }

  function updateByte(i: number, b: UserCmdResponseByte) {
    const bytes = variant.bytes.map((x, j) => j === i ? b : x);
    onUpdate({ ...variant, bytes });
  }

  function removeByte(i: number) {
    onUpdate({ ...variant, bytes: variant.bytes.filter((_, j) => j !== i) });
  }

  function addByte() {
    const nextOffset = variant.bytes.length > 0 ? variant.bytes[variant.bytes.length - 1].offset + 1 : 0;
    onUpdate({ ...variant, bytes: [...variant.bytes, { offset: nextOffset, label: '' }] });
  }

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/80">
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-gray-500 hover:text-gray-300 transition-colors shrink-0 w-3 text-[10px]"
        >
          {open ? '▾' : '▸'}
        </button>
        <span className="text-[10px] font-medium text-gray-500 shrink-0">
          {isDefault ? 'Default (fallback)' : 'if'}
        </span>
        <div className="flex flex-wrap gap-1.5 flex-1 min-w-0 items-center">
          {variant.conditions.map((c, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              {i > 0 && <span className="text-[9px] text-gray-600 font-medium">AND</span>}
              <ConditionRow cond={c} onChange={(nc) => updateCond(i, nc)} onRemove={() => removeCond(i)} />
            </span>
          ))}
          <button
            onClick={addCond}
            className="text-[10px] text-gray-600 hover:text-blue-400 transition-colors"
          >
            {isDefault && variant.conditions.length === 0 ? '+ Add condition' : '+ And'}
          </button>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!open && (
            <span className="text-[10px] text-gray-600 font-mono">{variant.bytes.length}B</span>
          )}
          <button onClick={onDuplicate} title="Duplicate" className="text-[11px] text-gray-600 hover:text-blue-400 transition-colors px-1">⧉</button>
          <button onClick={onRemove} title="Remove" className="text-[11px] text-gray-600 hover:text-red-400 transition-colors px-1">✕</button>
        </div>
      </div>

      {/* Response bytes — animated collapse */}
      <Collapse open={open}>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-800/40 text-[10px] text-gray-600 uppercase tracking-wider text-left">
              <th className="px-3 py-1.5 w-16">Offset</th>
              <th className="px-3 py-1.5">Label</th>
              <th className="px-3 py-1.5 w-8" />
            </tr>
          </thead>
          <tbody>
            {variant.bytes.map((b, i) => (
              <tr key={i} className="border-t border-gray-800">
                <td className="px-3 py-1.5">
                  <input
                    type="number"
                    min={0}
                    value={b.offset}
                    onChange={(e) => updateByte(i, { ...b, offset: Number(e.target.value) })}
                    className="w-14 px-2 py-0.5 rounded bg-gray-900 border border-gray-700 text-xs font-mono text-gray-400 focus:outline-none focus:border-blue-500"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="text"
                    value={b.label}
                    onChange={(e) => updateByte(i, { ...b, label: e.target.value })}
                    placeholder="label"
                    className={inputCls}
                  />
                </td>
                <td className="px-3 py-1.5 text-center">
                  <button onClick={() => removeByte(i)} className="text-gray-600 hover:text-red-400 transition-colors text-[11px]">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-3 py-2 border-t border-gray-800">
          <button onClick={addByte} className="text-[11px] text-gray-600 hover:text-blue-400 transition-colors flex items-center gap-1">
            <span className="text-sm leading-none">+</span> Add byte
          </button>
        </div>
      </Collapse>
    </div>
  );
}

// ── RequestBytesTable ─────────────────────────────────────────────

function RequestBytesTable({
  bytes,
  onUpdate,
}: {
  bytes: UserCmdRequestByte[];
  onUpdate: (bytes: UserCmdRequestByte[]) => void;
}) {
  function updateByte(i: number, b: UserCmdRequestByte) {
    onUpdate(bytes.map((x, j) => j === i ? b : x));
  }

  function removeByte(i: number) {
    onUpdate(bytes.filter((_, j) => j !== i));
  }

  function addByte() {
    onUpdate([...bytes, { label: '', tip: '', default: '', options: [] }]);
  }

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-800/60 text-[10px] text-gray-600 uppercase tracking-wider text-left">
            <th className="px-3 py-1.5 w-8">#</th>
            <th className="px-3 py-1.5 w-24">Label</th>
            <th className="px-3 py-1.5 w-20">Default</th>
            <th className="px-3 py-1.5">Description (hover tip)</th>
            <th className="px-3 py-1.5 w-8" />
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-gray-800 opacity-40 select-none">
            <td className="px-3 py-1.5 font-mono text-gray-500 text-[10px]">0</td>
            <td className="px-3 py-1.5 font-mono text-gray-400 text-[10px]">pid</td>
            <td className="px-3 py-1.5 font-mono text-gray-400 text-[10px]">F1</td>
            <td className="px-3 py-1.5 text-gray-600 text-[10px]">USER_CMD (0xF1) — fixed</td>
            <td />
          </tr>
          {bytes.map((b, i) => (
            <tr key={i} className="border-t border-gray-800">
              <td className="px-3 py-1.5 font-mono text-gray-500 text-[10px]">{i + 1}</td>
              <td className="px-3 py-1.5">
                <input
                  type="text"
                  value={b.label}
                  onChange={(e) => updateByte(i, { ...b, label: e.target.value })}
                  placeholder="label"
                  className={inputCls}
                />
              </td>
              <td className="px-3 py-1.5">
                <input
                  type="text"
                  value={b.default}
                  onChange={(e) => updateByte(i, { ...b, default: e.target.value })}
                  placeholder="hex"
                  className={inputCls}
                />
              </td>
              <td className="px-3 py-1.5">
                <input
                  type="text"
                  value={b.tip}
                  onChange={(e) => updateByte(i, { ...b, tip: e.target.value })}
                  placeholder="Shown on hover in command bar"
                  className={inputCls}
                />
              </td>
              <td className="px-3 py-1.5 text-center">
                <button onClick={() => removeByte(i)} className="text-gray-600 hover:text-red-400 transition-colors text-[11px]">✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-3 py-2 border-t border-gray-800">
        <button onClick={addByte} className="text-[11px] text-gray-600 hover:text-blue-400 transition-colors flex items-center gap-1">
          <span className="text-sm leading-none">+</span> Add byte
        </button>
      </div>
    </div>
  );
}

// ── CommandEditor ─────────────────────────────────────────────────

function CommandEditor({
  cmd,
  onSave,
}: {
  cmd: UserCmdDef;
  onSave: (cmd: UserCmdDef) => void;
}) {
  const [draft, setDraft] = useState<UserCmdDef>(cmd);
  const [reqOpen, setReqOpen] = useState(true);

  function updateVariant(i: number, v: UserCmdResponseVariant) {
    setDraft((d) => ({ ...d, responseVariants: d.responseVariants.map((x, j) => j === i ? v : x) }));
  }

  function duplicateVariant(i: number) {
    const clone: UserCmdResponseVariant = {
      ...draft.responseVariants[i],
      id: uid(),
      name: draft.responseVariants[i].name + ' (copy)',
      conditions: [...draft.responseVariants[i].conditions],
      bytes: [...draft.responseVariants[i].bytes],
    };
    setDraft((d) => ({
      ...d,
      responseVariants: [...d.responseVariants.slice(0, i + 1), clone, ...d.responseVariants.slice(i + 1)],
    }));
  }

  function removeVariant(i: number) {
    setDraft((d) => ({ ...d, responseVariants: d.responseVariants.filter((_, j) => j !== i) }));
  }

  function addVariant() {
    setDraft((d) => ({
      ...d,
      responseVariants: [...d.responseVariants, { id: uid(), name: 'Variant', conditions: [], bytes: [] }],
    }));
  }

  return (
    <div className="space-y-5 p-5">
      {/* Name */}
      <div>
        <label className="text-[10px] text-gray-500 font-medium block mb-1">Command Name</label>
        <input
          type="text"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          className="w-full px-2.5 py-1.5 rounded-md bg-gray-900 border border-gray-700 text-xs font-mono text-gray-200 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Request bytes — animated collapse */}
      <div>
        <button
          onClick={() => setReqOpen((o) => !o)}
          className="flex items-center gap-1.5 mb-2 group"
        >
          <span className="text-gray-500 group-hover:text-gray-300 transition-colors text-[10px] w-3">
            {reqOpen ? '▾' : '▸'}
          </span>
          <span className="text-[10px] text-gray-500 font-medium">Request Bytes</span>
          {!reqOpen && (
            <span className="text-[10px] text-gray-600 font-mono ml-1">{draft.requestBytes.length + 1}B</span>
          )}
        </button>
        <Collapse open={reqOpen}>
          <RequestBytesTable
            bytes={draft.requestBytes}
            onUpdate={(bytes) => setDraft((d) => ({ ...d, requestBytes: bytes }))}
          />
        </Collapse>
      </div>

      {/* Response variants */}
      <div>
        <p className="text-[10px] text-gray-500 font-medium mb-2">
          Response Variants
          <span className="text-gray-700 ml-1.5 font-normal">— first matching condition wins</span>
        </p>
        <div className="space-y-2">
          {draft.responseVariants.map((v, i) => (
            <VariantCard
              key={v.id}
              variant={v}
              onUpdate={(nv) => updateVariant(i, nv)}
              onDuplicate={() => duplicateVariant(i)}
              onRemove={() => removeVariant(i)}
            />
          ))}
        </div>
        <button
          onClick={addVariant}
          className="mt-2 text-[11px] text-gray-600 hover:text-blue-400 transition-colors flex items-center gap-1"
        >
          <span className="text-sm leading-none">+</span> Add variant
        </button>
      </div>

      {/* Save */}
      <div className="pt-1 border-t border-gray-800">
        <button
          onClick={() => onSave(draft)}
          className="px-4 py-1.5 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors active:scale-95"
        >
          Save
        </button>
      </div>
    </div>
  );
}

// ── UserCmdTab ────────────────────────────────────────────────────

export function UserCmdTab() {
  const userCmds = useAppStore((s) => s.userCmds);
  const setUserCmds = useAppStore((s) => s.setUserCmds);
  const [selectedId, setSelectedId] = useState<string | null>(userCmds[0]?.id ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeCmd = userCmds.find((c) => c.id === selectedId) ?? null;

  function addCmd() {
    const cmd = newCmd();
    setUserCmds([...userCmds, cmd]);
    setSelectedId(cmd.id);
  }

  function deleteCmd(id: string) {
    const next = userCmds.filter((c) => c.id !== id);
    setUserCmds(next);
    if (selectedId === id) setSelectedId(next[0]?.id ?? null);
  }

  function saveCmd(cmd: UserCmdDef) {
    setUserCmds(userCmds.map((c) => c.id === cmd.id ? cmd : c));
  }

  function exportCmds() {
    const payload: UserCmdFileFormat = { version: 1, commands: userCmds };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'commands.ucmd';
    a.click();
    URL.revokeObjectURL(url);
  }

  function importCmds(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as UserCmdFileFormat;
        if (parsed.version === 1 && Array.isArray(parsed.commands)) {
          setUserCmds(parsed.commands);
          setSelectedId(parsed.commands[0]?.id ?? null);
        }
      } catch {
        // malformed file — silently ignore
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <div className="flex h-full">
      {/* Left: command list */}
      <div className="w-44 border-r border-gray-800 flex flex-col shrink-0">
        <div className="px-3 py-2.5 border-b border-gray-800">
          <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">USER_CMDs (0xF1)</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {userCmds.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center rounded-md text-xs transition-colors ${
                selectedId === c.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              <button
                onClick={() => setSelectedId(c.id)}
                className="flex-1 text-left px-2.5 py-1.5 min-w-0"
              >
                <span className="block truncate">{c.name}</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); deleteCmd(c.id); }}
                title="Delete"
                className={`pr-2 opacity-0 group-hover:opacity-100 transition-opacity text-[11px] ${
                  selectedId === c.id ? 'text-blue-200 hover:text-white' : 'text-gray-600 hover:text-red-400'
                }`}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            onClick={addCmd}
            className="w-full text-left px-2.5 py-1.5 rounded-md text-xs text-gray-600 hover:text-blue-400 transition-colors flex items-center gap-1"
          >
            <span className="text-sm leading-none">+</span> Add
          </button>
        </div>
        <div className="p-2 border-t border-gray-800 flex gap-1.5">
          <input ref={fileInputRef} type="file" accept=".ucmd" className="hidden" onChange={importCmds} />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 px-2 py-1 rounded text-[10px] text-gray-500 hover:text-gray-300 bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            Import
          </button>
          <button
            onClick={exportCmds}
            className="flex-1 px-2 py-1 rounded text-[10px] text-gray-500 hover:text-gray-300 bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            Export
          </button>
        </div>
      </div>

      {/* Right: editor */}
      <div className="flex-1 overflow-y-auto">
        {activeCmd ? (
          <CommandEditor key={activeCmd.id} cmd={activeCmd} onSave={saveCmd} />
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-gray-600">
            No commands yet — click <span className="mx-1 text-blue-400">+ Add</span> to create one
          </div>
        )}
      </div>
    </div>
  );
}
