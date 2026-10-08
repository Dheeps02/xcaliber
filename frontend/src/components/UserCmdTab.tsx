import { useState, useRef, useCallback, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
  type Modifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  DotsSixVertical,
  CaretDown,
  CaretRight,
  ArrowLeft,
  Plus,
  X,
  CopySimple,
  PencilSimple,
  Trash,
} from '@phosphor-icons/react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { DialInput } from './ui/DialInput';
import { Select } from './ui/Select';
import { useAppStore } from '../stores/app-store';
import { api } from '../lib/api';
import type {
  UserCmdDef,
  UserCmdRequestByte,
  UserCmdResponseVariant,
  UserCmdResponseByte,
  MatchCondition,
  CmdGroup,
  CmdSubgroup,
} from '../lib/types';

type SaveBarState = { save: () => Promise<void>; dirty: boolean; saving: boolean } | null;
type TabAction   = { label: string; icon: React.ReactNode; onClick: () => void };

// ── Helpers ────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

function newCmd(): UserCmdDef {
  return {
    id: uid(),
    name: 'NewCmd',
    requestBytes: [{ label: 'Command ID', tip: '', default: '', options: [] }],
    responseVariants: [{ id: uid(), name: 'Default', conditions: [], bytes: [] }],
  };
}

const OPS: MatchCondition['op'][] = ['==', '!=', '<', '>', '<=', '>='];

function computeStats(cmd: UserCmdDef) {
  const size = 1 + cmd.requestBytes.length;
  const variants = cmd.responseVariants.length;
  const ctrlOffsets = new Set<number>();
  for (const v of cmd.responseVariants) {
    for (const c of v.conditions) ctrlOffsets.add(c.reqByteOffset);
  }
  return { size, variants, ctrlBytes: ctrlOffsets.size };
}

// ── Animated collapse ──────────────────────────────────────────────

function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows 200ms ease' }}>
      <div style={{ overflow: 'hidden' }}>{children}</div>
    </div>
  );
}

// ── Stat badge ─────────────────────────────────────────────────────

function StatBadge({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 10, fontFamily: 'monospace',
      color: 'var(--text-muted)',
      background: 'color-mix(in srgb, var(--surface-overlay) 70%, transparent)',
      border: '1px solid var(--border)',
      borderRadius: 3, padding: '0 5px', lineHeight: '16px',
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

// ── Inline-editable name ───────────────────────────────────────────

function EditableName({
  value,
  onChange,
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  style?: React.CSSProperties;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <Input
        value={draft}
        onChange={setDraft}
        size="sm"
        style={{ width: 140, ...style }}
        onBlur={() => { onChange(draft); setEditing(false); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { onChange(draft); setEditing(false); }
          if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        }}
        autoFocus
      />
    );
  }

  return (
    <span
      onClick={() => { setDraft(value); setEditing(true); }}
      title="Click to rename"
      style={{ cursor: 'text', ...style }}
    >
      {value}
    </span>
  );
}

// ── Editor shared helpers ──────────────────────────────────────────

const JBM = "'JetBrains Mono', 'Fira Code', monospace";
const ROW_DIV = '1px solid color-mix(in srgb, var(--border) 50%, transparent)';
const SQ: React.CSSProperties = { width: 24, height: 24, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' };

function warnGlow(dirty: boolean): React.CSSProperties {
  return {
    borderRadius: 6,
    boxShadow: dirty
      ? '0 0 0 2px var(--status-warn), 0 0 10px 2px color-mix(in srgb, var(--status-warn) 30%, transparent)'
      : 'none',
    transition: 'box-shadow 350ms ease',
  };
}

function altBg(i: number): string {
  return i % 2 === 1 ? 'color-mix(in srgb, var(--surface-overlay) 18%, transparent)' : 'transparent';
}

function SectionHeader({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        width: 2, alignSelf: 'stretch', borderRadius: 1, flexShrink: 0,
        background: 'linear-gradient(180deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 40%, transparent) 100%)',
        boxShadow: '0 0 8px 1px color-mix(in srgb, var(--accent) 40%, transparent)',
      }} />
      <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
        {children}
      </span>
      {right != null && <><div style={{ flex: 1 }} />{right}</>}
    </div>
  );
}

// ── ConditionRow ───────────────────────────────────────────────────

function ConditionRow({
  cond,
  onChange,
  onRemove,
  requestBytes,
}: {
  cond: MatchCondition;
  onChange: (c: MatchCondition) => void;
  onRemove: () => void;
  requestBytes: UserCmdRequestByte[];
}) {
  const byteOptions = requestBytes.map((b, i) => ({
    value: String(i + 1),
    label: `${b.label || `Byte ${i + 1}`} (0x${(i + 1).toString(16).toUpperCase().padStart(2, '0')})`,
  }));

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Select<string>
        value={String(cond.reqByteOffset)}
        onChange={(v) => onChange({ ...cond, reqByteOffset: parseInt(v, 10) })}
        options={byteOptions.length ? byteOptions : [{ value: '1', label: 'Command ID (0x01)' }]}
        style={{ fontFamily: JBM, fontSize: 12, minWidth: 160 }}
      />
      <Select<string>
        value={cond.op}
        onChange={(v) => onChange({ ...cond, op: v as MatchCondition['op'] })}
        options={OPS.map(op => ({ value: op, label: op }))}
        style={{ fontFamily: JBM, fontSize: 12 }}
      />
      <span style={{ fontSize: 12, fontFamily: JBM, color: 'var(--text-muted)' }}>0x</span>
      <Input
        type="text"
        maxLength={2}
        value={cond.value.toString(16).toUpperCase().padStart(2, '0')}
        onChange={(v) => { const n = parseInt(v, 16); if (!isNaN(n)) onChange({ ...cond, value: n }); }}
        mono
        style={{ width: 52, fontFamily: JBM, textTransform: 'uppercase' }}
      />
      <Button variant="ghost" intent="danger" onClick={onRemove} style={SQ}>
        <X size={14} />
      </Button>
    </div>
  );
}

// ── VariantSection ─────────────────────────────────────────────────

function VariantSection({
  variant,
  index,
  onUpdate,
  onDuplicate,
  onRemove,
  requestBytes,
  dirty,
}: {
  variant: UserCmdResponseVariant;
  index: number;
  onUpdate: (v: UserCmdResponseVariant) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  requestBytes: UserCmdRequestByte[];
  dirty: boolean;
}) {
  const [open, setOpen] = useState(true);
  const isDefault = variant.conditions.length === 0;

  function updateCond(i: number, c: MatchCondition) {
    onUpdate({ ...variant, conditions: variant.conditions.map((x, j) => j === i ? c : x) });
  }
  function removeCond(i: number) {
    onUpdate({ ...variant, conditions: variant.conditions.filter((_, j) => j !== i) });
  }
  function addCond() {
    onUpdate({ ...variant, conditions: [...variant.conditions, { reqByteOffset: 1, op: '==', value: 0 }] });
  }
  function updateByte(i: number, b: UserCmdResponseByte) {
    onUpdate({ ...variant, bytes: variant.bytes.map((x, j) => j === i ? b : x) });
  }
  function removeByte(i: number) {
    onUpdate({ ...variant, bytes: variant.bytes.filter((_, j) => j !== i) });
  }
  function addByte() {
    const prev = variant.bytes.length > 0 ? variant.bytes[variant.bytes.length - 1] : null;
    const nextOffset = prev ? prev.offset + (prev.length ?? 1) : 0;
    onUpdate({ ...variant, bytes: [...variant.bytes, { offset: nextOffset, length: 1, label: '' }] });
  }

  const TH: React.CSSProperties = {
    padding: '5px 10px', textAlign: 'left', fontWeight: 600,
    fontSize: 9, fontFamily: JBM, textTransform: 'uppercase',
    letterSpacing: '0.07em', color: 'var(--text-muted)',
  };

  return (
    <div>
      <SectionHeader
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button variant="ghost" onClick={onDuplicate} title="Duplicate" style={SQ}>
              <CopySimple size={14} />
            </Button>
            <Button variant="ghost" intent="danger" onClick={onRemove} title="Remove" style={SQ}>
              <X size={14} />
            </Button>
            <Button variant="ghost" onClick={() => setOpen(o => !o)} style={SQ}>
              {open ? <CaretDown size={14} /> : <CaretRight size={14} />}
            </Button>
          </div>
        }
      >
        Response {index + 1}
        {isDefault && (
          <span style={{ fontSize: 11, fontWeight: 400, letterSpacing: 0, textTransform: 'none', color: 'var(--text-muted)', marginLeft: 6 }}>
            — default
          </span>
        )}
      </SectionHeader>

      <Collapse open={open}>
        <div style={{ marginTop: 12 }}>
          {/* Conditions */}
          {variant.conditions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              {variant.conditions.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {i > 0 && (
                    <span style={{ fontSize: 10, fontFamily: JBM, fontWeight: 700, color: 'var(--text-muted)', width: 32, textAlign: 'right' }}>
                      AND
                    </span>
                  )}
                  {i === 0 && <span style={{ fontSize: 10, fontFamily: JBM, color: 'var(--text-muted)', width: 32, textAlign: 'right' }}>IF</span>}
                  <ConditionRow cond={c} onChange={nc => updateCond(i, nc)} onRemove={() => removeCond(i)} requestBytes={requestBytes} />
                </div>
              ))}
            </div>
          )}
          <div style={{ marginBottom: 14 }}>
            <Button variant="ghost" onClick={addCond}>
              <Plus size={12} />
              {isDefault && variant.conditions.length === 0 ? 'Make conditional' : 'Add condition'}
            </Button>
          </div>

          {/* Response bytes */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', ...warnGlow(dirty) }}>
            <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'color-mix(in srgb, var(--surface-overlay) 30%, transparent)' }}>
                  <th style={{ ...TH, width: 90 }}>OFFSET</th>
                  <th style={{ ...TH, width: 70 }}>LENGTH</th>
                  <th style={TH}>LABEL</th>
                  <th style={{ width: 36 }} />
                </tr>
              </thead>
              <tbody>
                {variant.bytes.map((b, i) => (
                  <tr key={i} style={{ borderTop: ROW_DIV, background: altBg(i) }}>
                    <td style={{ padding: '5px 10px' }}>
                      <DialInput
                        value={b.offset}
                        onChange={(v) => updateByte(i, { ...b, offset: v })}
                        min={0}
                        max={255}
                        digits={3}
                      />
                    </td>
                    <td style={{ padding: '5px 10px' }}>
                      <DialInput
                        value={b.length ?? 1}
                        onChange={(v) => updateByte(i, { ...b, length: v })}
                        min={1}
                        max={8}
                        digits={1}
                      />
                    </td>
                    <td style={{ padding: '5px 10px' }}>
                      <Input value={b.label} onChange={(v) => updateByte(i, { ...b, label: v })} size="sm" placeholder="label" />
                    </td>
                    <td style={{ padding: '5px 6px', textAlign: 'center' }}>
                      <Button variant="ghost" intent="danger" onClick={() => removeByte(i)} style={SQ}>
                        <X size={14} />
                      </Button>
                    </td>
                  </tr>
                ))}
                {variant.bytes.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No bytes mapped
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Button variant="ghost" onClick={addByte} style={{ marginTop: 6 }}>
            <Plus size={12} /> Add byte
          </Button>
        </div>
      </Collapse>
    </div>
  );
}

// ── RequestBytesTable ──────────────────────────────────────────────

function RequestBytesTable({
  bytes,
  onUpdate,
}: {
  bytes: UserCmdRequestByte[];
  onUpdate: (bytes: UserCmdRequestByte[]) => void;
}) {
  const EMPTY_BYTE: UserCmdRequestByte = { label: '', tip: '', default: '', options: [] };
  const cmdId = bytes[0] ?? EMPTY_BYTE;
  const params = bytes.slice(1);

  function updateCmdId(b: UserCmdRequestByte) {
    onUpdate(bytes.length > 0 ? bytes.map((x, j) => j === 0 ? b : x) : [b]);
  }
  function updateParam(i: number, b: UserCmdRequestByte) {
    onUpdate(bytes.map((x, j) => j === i + 1 ? b : x));
  }
  function removeParam(i: number) {
    onUpdate(bytes.filter((_, j) => j !== i + 1));
  }
  function addParam() {
    const base = bytes.length > 0 ? bytes : [{ ...EMPTY_BYTE, label: 'Command ID' }];
    onUpdate([...base, { ...EMPTY_BYTE }]);
  }

  const TH: React.CSSProperties = {
    padding: '5px 10px', textAlign: 'left', fontWeight: 600,
    fontSize: 9, fontFamily: JBM, textTransform: 'uppercase',
    letterSpacing: '0.07em', color: 'var(--text-muted)',
  };

  return (
    <>
      <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
        <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'color-mix(in srgb, var(--surface-overlay) 30%, transparent)' }}>
              <th style={{ ...TH, width: 52 }}>ADDR</th>
              <th style={{ ...TH, width: 110 }}>LABEL</th>
              <th style={{ ...TH, width: 80 }}>DEFAULT</th>
              <th style={TH}>TIP</th>
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {/* PID — fully fixed */}
            <tr style={{ borderTop: ROW_DIV, opacity: 0.45 }}>
              <td style={{ padding: '5px 10px', fontFamily: JBM, color: 'var(--accent)', fontSize: 10 }}>0x00</td>
              <td style={{ padding: '5px 10px', fontFamily: JBM, color: 'var(--text-secondary)', fontSize: 10 }}>pid</td>
              <td style={{ padding: '5px 10px', fontFamily: JBM, color: 'var(--text-secondary)', fontSize: 10 }}>0xF1</td>
              <td style={{ padding: '5px 10px', color: 'var(--text-muted)', fontSize: 10, fontStyle: 'italic' }}>USER_CMD — fixed</td>
              <td />
            </tr>
            {/* Command ID — fixed label, editable value */}
            <tr style={{ borderTop: ROW_DIV, background: altBg(0) }}>
              <td style={{ padding: '5px 10px', fontFamily: JBM, color: 'var(--accent)', fontSize: 10 }}>0x01</td>
              <td style={{ padding: '5px 10px', fontFamily: JBM, color: 'var(--text-secondary)', fontSize: 11 }}>Command ID</td>
              <td style={{ padding: '5px 10px' }}>
                <Input value={cmdId.default} onChange={(v) => updateCmdId({ ...cmdId, default: v })} size="sm" mono placeholder="0x00" />
              </td>
              <td style={{ padding: '5px 10px' }}>
                <Input value={cmdId.tip} onChange={(v) => updateCmdId({ ...cmdId, tip: v })} size="sm" placeholder="shown on hover" />
              </td>
              <td />
            </tr>
            {/* User parameter bytes */}
            {params.map((b, i) => (
              <tr key={i} style={{ borderTop: ROW_DIV, background: altBg(i + 1) }}>
                <td style={{ padding: '5px 10px', fontFamily: JBM, color: 'var(--accent)', fontSize: 10 }}>
                  0x{(i + 2).toString(16).toUpperCase().padStart(2, '0')}
                </td>
                <td style={{ padding: '5px 10px' }}>
                  <Input value={b.label} onChange={(v) => updateParam(i, { ...b, label: v })} size="sm" placeholder="label" />
                </td>
                <td style={{ padding: '5px 10px' }}>
                  <Input value={b.default} onChange={(v) => updateParam(i, { ...b, default: v })} size="sm" mono placeholder="0x00" />
                </td>
                <td style={{ padding: '5px 10px' }}>
                  <Input value={b.tip} onChange={(v) => updateParam(i, { ...b, tip: v })} size="sm" placeholder="shown on hover" />
                </td>
                <td style={{ padding: '5px 6px', textAlign: 'center' }}>
                  <Button variant="ghost" intent="danger" onClick={() => removeParam(i)} style={SQ}>
                    <X size={14} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button variant="ghost" onClick={addParam} style={{ marginTop: 6 }}>
        <Plus size={12} /> Add byte
      </Button>
    </>
  );
}

// ── CommandEditor ──────────────────────────────────────────────────

function CommandEditor({
  cmd,
  onSave,
}: {
  cmd: UserCmdDef;
  onSave: (cmd: UserCmdDef) => void;
}) {
  const [requestBytes, setRequestBytes] = useState(cmd.requestBytes);
  const [responseVariants, setResponseVariants] = useState(cmd.responseVariants);

  const isDirtyRequest = JSON.stringify(requestBytes) !== JSON.stringify(cmd.requestBytes);
  const isDirtyVariants =
    responseVariants.length !== cmd.responseVariants.length ||
    responseVariants.some((v, i) => JSON.stringify(v) !== JSON.stringify(cmd.responseVariants[i]));
  const isDirty = isDirtyRequest || isDirtyVariants;

  function isVariantDirty(v: UserCmdResponseVariant): boolean {
    const orig = cmd.responseVariants.find(rv => rv.id === v.id);
    return !orig || JSON.stringify(v) !== JSON.stringify(orig);
  }

  function updateVariant(i: number, v: UserCmdResponseVariant) {
    setResponseVariants(rv => rv.map((x, j) => j === i ? v : x));
  }

  function duplicateVariant(i: number) {
    const src = responseVariants[i];
    const clone: UserCmdResponseVariant = {
      ...src, id: uid(), name: src.name + ' (copy)',
      conditions: [...src.conditions], bytes: [...src.bytes],
    };
    setResponseVariants(rv => [...rv.slice(0, i + 1), clone, ...rv.slice(i + 1)]);
  }

  function removeVariant(i: number) {
    setResponseVariants(rv => rv.filter((_, j) => j !== i));
  }

  function addVariant() {
    setResponseVariants(rv => [...rv, { id: uid(), name: 'Variant', conditions: [], bytes: [] }]);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, padding: 20 }}>

      {/* ── Request frame ── */}
      <div className="settings-field" style={{ '--field-i': 0 } as React.CSSProperties}>
        <SectionHeader
          right={
            <span style={{ fontSize: 11, fontFamily: JBM, color: 'var(--text-muted)' }}>
              {requestBytes.length + 1}B
            </span>
          }
        >
          Request Frame
        </SectionHeader>
        <div style={{ marginTop: 14, ...warnGlow(isDirtyRequest) }}>
          <RequestBytesTable bytes={requestBytes} onUpdate={setRequestBytes} />
        </div>
      </div>

      {/* ── Response variants ── */}
      {responseVariants.map((v, i) => (
        <VariantSection
          key={v.id}
          variant={v}
          index={i}
          onUpdate={(nv) => updateVariant(i, nv)}
          onDuplicate={() => duplicateVariant(i)}
          onRemove={() => removeVariant(i)}
          requestBytes={requestBytes}
          dirty={isVariantDirty(v)}
        />
      ))}

      {responseVariants.length === 0 && (
        <p className="settings-field" style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', margin: 0, '--field-i': 1 } as React.CSSProperties}>
          No response variants defined yet.
        </p>
      )}

      <Button variant="ghost" onClick={addVariant} className="settings-field" style={{ '--field-i': responseVariants.length + 1 } as React.CSSProperties}>
        <Plus size={12} /> Add response variant
      </Button>

      {/* ── Save ── */}
      <div className="settings-field" style={{ paddingTop: 8, borderTop: '1px solid var(--border)', '--field-i': responseVariants.length + 2 } as React.CSSProperties}>
        <Button variant="primary" disabled={!isDirty} onClick={() => onSave({ ...cmd, requestBytes, responseVariants })}>
          Save
        </Button>
      </div>
    </div>
  );
}

// ── EditorView ─────────────────────────────────────────────────────

function EditorView({ cmdId, onBack }: { cmdId: string; onBack: () => void }) {
  const userCmds = useAppStore(s => s.userCmds);
  const setUserCmds = useAppStore(s => s.setUserCmds);
  const cmd = userCmds.find(c => c.id === cmdId);

  const [draftName, setDraftName] = useState(cmd?.name ?? '');

  if (!cmd) { onBack(); return null; }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="settings-field" style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px', flexShrink: 0,
        borderBottom: '1px solid var(--border)',
        '--field-i': 0,
      } as React.CSSProperties}>
        <Button variant="ghost" onClick={onBack} style={{ gap: 5, fontSize: 11, flexShrink: 0 }}>
          <ArrowLeft size={12} /> Commands
        </Button>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>/</span>
        <Input
          value={draftName}
          onChange={setDraftName}
          mono
          style={{ fontSize: 12, height: 28, maxWidth: 280 }}
        />
      </div>
      <div className="settings-field" style={{ flex: 1, overflowY: 'auto', '--field-i': 1 } as React.CSSProperties}>
        <CommandEditor
          key={cmd.id}
          cmd={{ ...cmd, name: draftName }}
          onSave={(updated) => {
            setDraftName(updated.name);
            setUserCmds(userCmds.map(c => c.id === updated.id ? updated : c));
          }}
        />
      </div>
    </div>
  );
}

// ── SortableCmdRow ─────────────────────────────────────────────────

function SortableCmdRow({ cmd, indent, onEdit, onDelete }: { cmd: UserCmdDef; indent: number; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `cmd:${cmd.id}`,
  });
  const showAlert = useAppStore(s => s.showAlert);
  const { size, variants, ctrlBytes } = computeStats(cmd);

  function handleDelete() {
    showAlert(`Delete "${cmd.name}"?`, {
      label: 'Delete',
      fn: async () => onDelete(),
    });
  }

  return (
    <div
      ref={setNodeRef}
      className="group settings-field"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0 : 1,
        display: 'flex', alignItems: 'center', gap: 6,
        height: 32, paddingLeft: indent, paddingRight: 8,
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface-base)',
        '--field-i': 0,
      } as React.CSSProperties}
    >
      <span
        {...attributes}
        {...listeners}
        style={{ cursor: 'grab', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', flexShrink: 0, touchAction: 'none' }}
      >
        <DotsSixVertical size={14} />
      </span>
      <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {cmd.name}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <StatBadge>{size}B</StatBadge>
        <StatBadge>{variants} {variants === 1 ? 'struct' : 'structs'}</StatBadge>
        {ctrlBytes > 0 && <StatBadge>{ctrlBytes} ctrl</StatBadge>}
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <Button variant="ghost" onClick={onEdit} style={{ padding: 0, width: 24, height: 24 }} title="Edit">
          <PencilSimple size={14} />
        </Button>
        <Button variant="ghost" intent="danger" onClick={handleDelete} style={{ padding: 0, width: 24, height: 24 }} title="Delete">
          <Trash size={14} />
        </Button>
      </div>
    </div>
  );
}

// ── Empty drop zone ────────────────────────────────────────────────

function EmptyDropHint({ indent }: { indent: number }) {
  return (
    <div style={{
      paddingLeft: indent, paddingRight: 8, height: 28,
      display: 'flex', alignItems: 'center',
      borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>Empty — drag here</span>
    </div>
  );
}

// ── SortableSubgroupRow ────────────────────────────────────────────

function SortableSubgroupRow({
  sub,
  isOpen,
  onToggle,
  onDelete,
  onUpdateName,
  children,
}: {
  sub: CmdSubgroup;
  isOpen: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onUpdateName: (name: string) => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `sub:${sub.id}`,
  });
  const showAlert = useAppStore(s => s.showAlert);

  function handleDelete() {
    showAlert(`Delete subgroup "${sub.name}"?`, { label: 'Delete', fn: async () => onDelete() });
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0 : 1 }}
    >
      <div className="settings-field" style={{
        display: 'flex', alignItems: 'center', gap: 5,
        height: 30, paddingLeft: 8, paddingRight: 8,
        background: 'color-mix(in srgb, var(--surface-raised) 30%, transparent)',
        borderBottom: '1px solid var(--border)',
        '--field-i': 0,
      } as React.CSSProperties}>
        <span
          {...attributes}
          {...listeners}
          style={{ cursor: 'grab', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', flexShrink: 0, touchAction: 'none' }}
        >
          <DotsSixVertical size={12} />
        </span>
        <Button variant="ghost" onClick={onToggle} style={{ padding: 0, width: 18, height: 18, flexShrink: 0 }}>
          {isOpen ? <CaretDown size={10} /> : <CaretRight size={10} />}
        </Button>
        <EditableName
          value={sub.name}
          onChange={onUpdateName}
          style={{ flex: 1, fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}
        />
        <Button variant="ghost" intent="danger" onClick={handleDelete} style={{ padding: 0, width: 18, height: 18, flexShrink: 0 }}>
          <Trash size={11} />
        </Button>
      </div>
      <Collapse open={isOpen}>
        {children}
      </Collapse>
    </div>
  );
}

// ── SortableGroupRow ───────────────────────────────────────────────

function SortableGroupRow({
  group,
  isOpen,
  onToggle,
  onAddSubgroup,
  onDelete,
  onUpdateName,
  children,
}: {
  group: CmdGroup;
  isOpen: boolean;
  onToggle: () => void;
  onAddSubgroup: () => void;
  onDelete: () => void;
  onUpdateName: (name: string) => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `grp:${group.id}`,
  });
  const showAlert = useAppStore(s => s.showAlert);

  function handleDelete() {
    showAlert(`Delete group "${group.name}" and all its commands?`, { label: 'Delete', fn: async () => onDelete() });
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0 : 1 }}
    >
      <div className="settings-field" style={{
        display: 'flex', alignItems: 'center', gap: 6,
        height: 34, paddingLeft: 2, paddingRight: 8,
        background: 'color-mix(in srgb, var(--surface-raised) 50%, transparent)',
        borderBottom: '1px solid var(--border)',
        '--field-i': 0,
      } as React.CSSProperties}>
        <span
          {...attributes}
          {...listeners}
          style={{ cursor: 'grab', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '0 4px', flexShrink: 0, touchAction: 'none' }}
        >
          <DotsSixVertical size={14} />
        </span>
        <Button variant="ghost" onClick={onToggle} style={{ padding: 0, width: 20, height: 20, flexShrink: 0 }}>
          {isOpen ? <CaretDown size={12} /> : <CaretRight size={12} />}
        </Button>
        <EditableName
          value={group.name}
          onChange={onUpdateName}
          style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <Button variant="ghost" onClick={onAddSubgroup} style={{ fontSize: 10, height: 20, padding: '1px 6px' }}>
            <Plus size={9} /> Subgroup
          </Button>
          <Button variant="ghost" intent="danger" onClick={handleDelete} style={{ padding: 0, width: 20, height: 20 }}>
            <Trash size={12} />
          </Button>
        </div>
      </div>
      <Collapse open={isOpen}>
        {children}
      </Collapse>
    </div>
  );
}

// ── DragOverlay helpers ────────────────────────────────────────────

function OverlayGhost({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ boxShadow: '0 6px 20px rgba(0,0,0,0.35)', borderRadius: 4, opacity: 0.92 }}>
      {children}
    </div>
  );
}

// ── TreeView ───────────────────────────────────────────────────────

function TreeView({ onEdit, onSetActions }: { onEdit: (cmdId: string) => void; onSetActions: (a: TabAction[]) => void }) {
  const userCmds     = useAppStore(s => s.userCmds);
  const setUserCmds  = useAppStore(s => s.setUserCmds);
  const cmdGroups    = useAppStore(s => s.cmdGroups);
  const setCmdGroups = useAppStore(s => s.setCmdGroups);
  const cmdSubgroups    = useAppStore(s => s.cmdSubgroups);
  const setCmdSubgroups = useAppStore(s => s.setCmdSubgroups);

  const [openGroups, setOpenGroups]       = useState<Set<string>>(() => new Set([]));
  const [openSubgroups, setOpenSubgroups] = useState<Set<string>>(() => new Set([]));
  const [activeId, setActiveId] = useState<string | null>(null);

  const probeRef = useRef<HTMLDivElement>(null);
  const correctionModifier = useCallback<Modifier>(({ transform }) => {
    const r = probeRef.current?.getBoundingClientRect();
    if (!r) return transform;
    return { ...transform, x: transform.x - r.left, y: transform.y - r.top };
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
  }

  function renderOverlay(id: string): React.ReactNode {
    if (id.startsWith('grp:')) {
      const group = cmdGroups.find(g => `grp:${g.id}` === id);
      if (!group) return null;
      return (
        <OverlayGhost>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, paddingLeft: 10, paddingRight: 8, background: 'color-mix(in srgb, var(--surface-raised) 50%, transparent)' }}>
            <DotsSixVertical size={14} color="var(--text-muted)" />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{group.name}</span>
          </div>
        </OverlayGhost>
      );
    }
    if (id.startsWith('sub:')) {
      const sub = cmdSubgroups.find(s => `sub:${s.id}` === id);
      if (!sub) return null;
      return (
        <OverlayGhost>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, height: 30, paddingLeft: 12, paddingRight: 8, background: 'color-mix(in srgb, var(--surface-raised) 30%, transparent)' }}>
            <DotsSixVertical size={12} color="var(--text-muted)" />
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>{sub.name}</span>
          </div>
        </OverlayGhost>
      );
    }
    if (id.startsWith('cmd:')) {
      const cmd = userCmds.find(c => `cmd:${c.id}` === id);
      if (!cmd) return null;
      const { size, variants, ctrlBytes } = computeStats(cmd);
      return (
        <OverlayGhost>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, paddingLeft: 14, paddingRight: 8, background: 'var(--surface-base)' }}>
            <DotsSixVertical size={14} color="var(--text-muted)" />
            <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cmd.name}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <StatBadge>{size}B</StatBadge>
              <StatBadge>{variants} {variants === 1 ? 'struct' : 'structs'}</StatBadge>
              {ctrlBytes > 0 && <StatBadge>{ctrlBytes} ctrl</StatBadge>}
            </div>
          </div>
        </OverlayGhost>
      );
    }
    return null;
  }

  // ── Group / subgroup management ──────────────────────────────────

  function addGroup() {
    const g: CmdGroup = { id: uid(), name: 'New Group' };
    setCmdGroups([...cmdGroups, g]);
    setOpenGroups(prev => new Set([...prev, g.id]));
  }

  function deleteGroup(id: string) {
    setCmdGroups(cmdGroups.filter(g => g.id !== id));
    setCmdSubgroups(cmdSubgroups.filter(s => s.parentGroupId !== id));
    setUserCmds(userCmds.map(c =>
      c.groupId === id ? { ...c, groupId: undefined, subgroupId: undefined } : c
    ));
  }

  function updateGroupName(id: string, name: string) {
    setCmdGroups(cmdGroups.map(g => g.id === id ? { ...g, name } : g));
  }

  function addSubgroup(parentGroupId: string) {
    const s: CmdSubgroup = { id: uid(), name: 'New Subgroup', parentGroupId };
    setCmdSubgroups([...cmdSubgroups, s]);
    setOpenSubgroups(prev => new Set([...prev, s.id]));
    setOpenGroups(prev => new Set([...prev, parentGroupId]));
  }

  function deleteSubgroup(id: string) {
    const sub = cmdSubgroups.find(s => s.id === id);
    setCmdSubgroups(cmdSubgroups.filter(s => s.id !== id));
    setUserCmds(userCmds.map(c =>
      c.subgroupId === id ? { ...c, subgroupId: undefined, groupId: sub?.parentGroupId } : c
    ));
  }

  function updateSubgroupName(id: string, name: string) {
    setCmdSubgroups(cmdSubgroups.map(s => s.id === id ? { ...s, name } : s));
  }

  function addCmd() {
    const cmd = newCmd();
    if (cmdGroups.length === 0) {
      setUserCmds([...userCmds, cmd]);
      return;
    }
    const lastGroup = cmdGroups[cmdGroups.length - 1];
    const lastGroupSubs = cmdSubgroups.filter(s => s.parentGroupId === lastGroup.id);
    if (lastGroupSubs.length > 0) {
      const lastSub = lastGroupSubs[lastGroupSubs.length - 1];
      setUserCmds([...userCmds, { ...cmd, groupId: lastGroup.id, subgroupId: lastSub.id }]);
      setOpenSubgroups(prev => new Set([...prev, lastSub.id]));
    } else {
      setUserCmds([...userCmds, { ...cmd, groupId: lastGroup.id }]);
    }
    setOpenGroups(prev => new Set([...prev, lastGroup.id]));
  }

  // ── Action registration ───────────────────────────────────────────

  const addGroupRef = useRef<() => void>(null!);
  addGroupRef.current = addGroup;
  const stableAddGroup = useCallback(() => addGroupRef.current(), []);

  const addCmdRef = useRef<() => void>(null!);
  addCmdRef.current = addCmd;
  const stableAddCmd = useCallback(() => addCmdRef.current(), []);

  useEffect(() => {
    onSetActions([
      { label: 'New Group',   icon: <Plus size={11} />, onClick: stableAddGroup },
      { label: 'New Command', icon: <Plus size={11} />, onClick: stableAddCmd },
    ]);
    return () => onSetActions([]);
  }, [onSetActions, stableAddGroup, stableAddCmd]);

  // ── Drag & drop ──────────────────────────────────────────────────

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;

    const aId = String(active.id);
    const oId = String(over.id);

    // Reorder groups
    if (aId.startsWith('grp:') && oId.startsWith('grp:')) {
      const from = cmdGroups.findIndex(g => `grp:${g.id}` === aId);
      const to   = cmdGroups.findIndex(g => `grp:${g.id}` === oId);
      if (from !== -1 && to !== -1) setCmdGroups(arrayMove(cmdGroups, from, to));
      return;
    }

    // Reorder subgroups (same parent only)
    if (aId.startsWith('sub:') && oId.startsWith('sub:')) {
      const aSub = cmdSubgroups.find(s => `sub:${s.id}` === aId);
      const oSub = cmdSubgroups.find(s => `sub:${s.id}` === oId);
      if (aSub && oSub && aSub.parentGroupId === oSub.parentGroupId) {
        const siblings = cmdSubgroups.filter(s => s.parentGroupId === aSub.parentGroupId);
        const rest     = cmdSubgroups.filter(s => s.parentGroupId !== aSub.parentGroupId);
        const from = siblings.indexOf(aSub);
        const to   = siblings.indexOf(oSub);
        setCmdSubgroups([...rest, ...arrayMove(siblings, from, to)]);
      }
      return;
    }

    // Move / reorder commands
    if (aId.startsWith('cmd:')) {
      const cmdId = aId.slice(4);

      let newGroupId: string | undefined;
      let newSubgroupId: string | undefined;
      let overCmdId: string | undefined;

      if (oId.startsWith('cmd:')) {
        overCmdId = oId.slice(4);
        const overCmd = userCmds.find(c => c.id === overCmdId);
        if (!overCmd) return;
        newGroupId    = overCmd.groupId;
        newSubgroupId = overCmd.subgroupId;
      } else if (oId.startsWith('grp:')) {
        newGroupId    = oId.slice(4);
        newSubgroupId = undefined;
      } else if (oId.startsWith('sub:')) {
        const sub = cmdSubgroups.find(s => `sub:${s.id}` === oId);
        if (!sub) return;
        newGroupId    = sub.parentGroupId;
        newSubgroupId = sub.id;
      } else {
        return;
      }

      let updated = userCmds.map(c =>
        c.id === cmdId ? { ...c, groupId: newGroupId, subgroupId: newSubgroupId } : c
      );

      if (overCmdId) {
        const from = updated.findIndex(c => c.id === cmdId);
        const to   = updated.findIndex(c => c.id === overCmdId);
        if (from !== -1 && to !== -1) updated = arrayMove(updated, from, to);
      }

      setUserCmds(updated);
    }
  }

  const uncategorized = userCmds.filter(c => !c.groupId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Probe: measures any transform offset introduced by ancestor CSS containing blocks */}
      <div ref={probeRef} style={{ position: 'fixed', left: 0, top: 0, width: 0, height: 0, pointerEvents: 'none' }} />
      {/* Page title */}
      <div className="settings-field" style={{ padding: '12px 16px', flexShrink: 0, borderBottom: '1px solid var(--border)', '--field-i': 0 } as React.CSSProperties}>
        <SectionHeader>User Commands</SectionHeader>
      </div>
      {/* Tree */}
      <div className="settings-field" style={{ flex: 1, overflowY: 'auto', '--field-i': 1 } as React.CSSProperties}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={(e) => { setActiveId(null); handleDragEnd(e); }}
          onDragCancel={() => setActiveId(null)}
        >
          {/* Uncategorized */}
          {uncategorized.length > 0 && (
            <div>
              <div style={{
                padding: '4px 8px 4px 14px',
                fontSize: 10, fontWeight: 500, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.05em',
                borderBottom: '1px solid var(--border)',
              }}>
                Uncategorized
              </div>
              <SortableContext items={uncategorized.map(c => `cmd:${c.id}`)} strategy={verticalListSortingStrategy}>
                {uncategorized.map(cmd => (
                  <SortableCmdRow key={cmd.id} cmd={cmd} indent={14} onEdit={() => onEdit(cmd.id)} onDelete={() => setUserCmds(userCmds.filter(c => c.id !== cmd.id))} />
                ))}
              </SortableContext>
            </div>
          )}

          {/* Groups */}
          <SortableContext items={cmdGroups.map(g => `grp:${g.id}`)} strategy={verticalListSortingStrategy}>
            {cmdGroups.map(group => {
              const directCmds = userCmds.filter(c => c.groupId === group.id && !c.subgroupId);
              const subs       = cmdSubgroups.filter(s => s.parentGroupId === group.id);
              const isOpen     = openGroups.has(group.id);

              return (
                <SortableGroupRow
                  key={group.id}
                  group={group}
                  isOpen={isOpen}
                  onToggle={() => setOpenGroups(prev => {
                    const next = new Set(prev);
                    next.has(group.id) ? next.delete(group.id) : next.add(group.id);
                    return next;
                  })}
                  onAddSubgroup={() => addSubgroup(group.id)}
                  onDelete={() => deleteGroup(group.id)}
                  onUpdateName={(name) => updateGroupName(group.id, name)}
                >
                  {/* Direct commands in this group */}
                  <SortableContext items={directCmds.map(c => `cmd:${c.id}`)} strategy={verticalListSortingStrategy}>
                    {directCmds.map((cmd, cmdIdx) => (
                      <div
                        key={cmd.id}
                        style={{
                          opacity: isOpen ? 1 : 0,
                          transform: isOpen ? 'none' : 'translateY(-3px)',
                          transition: 'opacity 150ms ease, transform 150ms ease',
                          transitionDelay: isOpen ? `${cmdIdx * 20}ms` : '0ms',
                        }}
                      >
                        <SortableCmdRow cmd={cmd} indent={28} onEdit={() => onEdit(cmd.id)} onDelete={() => setUserCmds(userCmds.filter(c => c.id !== cmd.id))} />
                      </div>
                    ))}
                    {directCmds.length === 0 && subs.length === 0 && (
                      <EmptyDropHint indent={28} />
                    )}
                  </SortableContext>

                  {/* Subgroups */}
                  <SortableContext items={subs.map(s => `sub:${s.id}`)} strategy={verticalListSortingStrategy}>
                    {subs.map((sub, subIdx) => {
                      const subCmds  = userCmds.filter(c => c.subgroupId === sub.id);
                      const isSubOpen = openSubgroups.has(sub.id);

                      return (
                        <div
                          key={sub.id}
                          style={{
                            opacity: isOpen ? 1 : 0,
                            transform: isOpen ? 'none' : 'translateY(-3px)',
                            transition: 'opacity 150ms ease, transform 150ms ease',
                            transitionDelay: isOpen ? `${(directCmds.length + subIdx) * 20}ms` : '0ms',
                          }}
                        >
                          <SortableSubgroupRow
                            sub={sub}
                            isOpen={isSubOpen}
                            onToggle={() => setOpenSubgroups(prev => {
                              const next = new Set(prev);
                              next.has(sub.id) ? next.delete(sub.id) : next.add(sub.id);
                              return next;
                            })}
                            onDelete={() => deleteSubgroup(sub.id)}
                            onUpdateName={(name) => updateSubgroupName(sub.id, name)}
                          >
                            <SortableContext items={subCmds.map(c => `cmd:${c.id}`)} strategy={verticalListSortingStrategy}>
                              {subCmds.map((cmd, cmdIdx) => (
                                <div
                                  key={cmd.id}
                                  style={{
                                    opacity: isSubOpen ? 1 : 0,
                                    transform: isSubOpen ? 'none' : 'translateY(-3px)',
                                    transition: 'opacity 130ms ease, transform 130ms ease',
                                    transitionDelay: isSubOpen ? `${cmdIdx * 16}ms` : '0ms',
                                  }}
                                >
                                  <SortableCmdRow cmd={cmd} indent={40} onEdit={() => onEdit(cmd.id)} onDelete={() => setUserCmds(userCmds.filter(c => c.id !== cmd.id))} />
                                </div>
                              ))}
                              {subCmds.length === 0 && (
                                <EmptyDropHint indent={40} />
                              )}
                            </SortableContext>
                          </SortableSubgroupRow>
                        </div>
                      );
                    })}
                  </SortableContext>
                </SortableGroupRow>
              );
            })}
          </SortableContext>

          {/* Empty state */}
          {userCmds.length === 0 && cmdGroups.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, fontSize: 12, color: 'var(--text-muted)' }}>
              No commands yet — click <span style={{ color: 'var(--accent)', margin: '0 4px' }}>New Command</span> to get started
            </div>
          )}

          <DragOverlay modifiers={[correctionModifier]}>
            {activeId ? renderOverlay(activeId) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}

// ── UserCmdTab ─────────────────────────────────────────────────────

export function UserCmdTab({ onSetSaveBar, onSetActions }: { onSetSaveBar: (s: SaveBarState) => void; onSetActions: (a: TabAction[]) => void }) {
  const [view, setView] = useState<'tree' | { cmdId: string }>('tree');

  const userCmds     = useAppStore(s => s.userCmds);
  const cmdGroups    = useAppStore(s => s.cmdGroups);
  const cmdSubgroups = useAppStore(s => s.cmdSubgroups);
  const config       = useAppStore(s => s.config);
  const showToast    = useAppStore(s => s.showToast);

  const [saving, setSaving] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    JSON.stringify({ userCmds, cmdGroups, cmdSubgroups })
  );
  const dirty = JSON.stringify({ userCmds, cmdGroups, cmdSubgroups }) !== savedSnapshot;

  async function save() {
    if (!config) return;
    setSaving(true);
    try {
      await api.updateConfig({
        server_ip:    config.connection.server_ip,
        server_port:  config.connection.server_port,
        protocol:     config.connection.protocol,
        timeout_ms:   config.connection.timeout_ms,
        bind_ip:      config.connection.bind_ip    || undefined,
        source_port:  config.connection.source_port || undefined,
        src_mac:      config.connection.src_mac    || undefined,
        dst_mac:      config.connection.dst_mac    || undefined,
        vlan_id:      config.connection.vlan_id    || undefined,
        endian:       config.endian,
        events:       config.events,
        user_cmds:    userCmds,
        cmd_groups:   cmdGroups,
        cmd_subgroups: cmdSubgroups,
      });
      setSavedSnapshot(JSON.stringify({ userCmds, cmdGroups, cmdSubgroups }));
      showToast('Commands saved', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  }

  const saveRef = useRef<() => Promise<void>>(null!);
  saveRef.current = save;
  const stableSave = useCallback(() => saveRef.current(), []);

  useEffect(() => {
    onSetSaveBar({ save: stableSave, dirty, saving });
    return () => onSetSaveBar(null);
  }, [onSetSaveBar, stableSave, dirty, saving]);

  if (view !== 'tree') {
    return <EditorView key={view.cmdId} cmdId={view.cmdId} onBack={() => setView('tree')} />;
  }

  return <TreeView onEdit={(cmdId) => setView({ cmdId })} onSetActions={onSetActions} />;
}
