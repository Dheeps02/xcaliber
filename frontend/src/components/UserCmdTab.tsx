import { useState, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
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
  Upload,
  Download,
  Plus,
  X,
} from '@phosphor-icons/react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { DialInput } from './ui/DialInput';
import { Select } from './ui/Select';
import { useAppStore } from '../stores/app-store';
import type {
  UserCmdDef,
  UserCmdRequestByte,
  UserCmdResponseVariant,
  UserCmdResponseByte,
  MatchCondition,
  UserCmdFileFormat,
  CmdGroup,
  CmdSubgroup,
} from '../lib/types';

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
const SQ: React.CSSProperties = { width: 28, height: 28, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' };

function altBg(i: number): string {
  return i % 2 === 1 ? 'color-mix(in srgb, var(--surface-overlay) 18%, transparent)' : 'transparent';
}

function IconBtn({
  onClick,
  title,
  danger,
  children,
}: {
  onClick: () => void;
  title?: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '0 3px' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = danger ? 'var(--status-err)' : 'var(--accent)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
    >
      {children}
    </button>
  );
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
}: {
  cond: MatchCondition;
  onChange: (c: MatchCondition) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12, fontFamily: JBM, color: 'var(--text-muted)' }}>req[</span>
      <DialInput
        value={cond.reqByteOffset}
        onChange={(v) => onChange({ ...cond, reqByteOffset: v })}
        min={0}
        max={255}
        digits={3}
      />
      <span style={{ fontSize: 12, fontFamily: JBM, color: 'var(--text-muted)' }}>]</span>
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
        <X size={16} />
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
}: {
  variant: UserCmdResponseVariant;
  index: number;
  onUpdate: (v: UserCmdResponseVariant) => void;
  onDuplicate: () => void;
  onRemove: () => void;
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
    const nextOffset = variant.bytes.length > 0 ? variant.bytes[variant.bytes.length - 1].offset + 1 : 0;
    onUpdate({ ...variant, bytes: [...variant.bytes, { offset: nextOffset, label: '' }] });
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
              <span style={{ fontSize: 16, lineHeight: 1 }}>⧉</span>
            </Button>
            <Button variant="ghost" intent="danger" onClick={onRemove} title="Remove" style={SQ}>
              <X size={16} />
            </Button>
            <Button variant="ghost" onClick={() => setOpen(o => !o)} style={SQ}>
              {open ? <CaretDown size={16} /> : <CaretRight size={16} />}
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
                  <ConditionRow cond={c} onChange={nc => updateCond(i, nc)} onRemove={() => removeCond(i)} />
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
          <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'color-mix(in srgb, var(--surface-overlay) 30%, transparent)' }}>
                  <th style={{ ...TH, width: 100 }}>OFFSET</th>
                  <th style={TH}>LABEL</th>
                  <th style={{ width: 40 }} />
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
                      <Input value={b.label} onChange={(v) => updateByte(i, { ...b, label: v })} size="sm" placeholder="label" />
                    </td>
                    <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                      <Button variant="ghost" intent="danger" onClick={() => removeByte(i)} style={SQ}>
                        <X size={16} />
                      </Button>
                    </td>
                  </tr>
                ))}
                {variant.bytes.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
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
                <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                  <Button variant="ghost" intent="danger" onClick={() => removeParam(i)} style={SQ}>
                    <X size={16} />
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
      <div>
        <SectionHeader
          right={
            <span style={{ fontSize: 11, fontFamily: JBM, color: 'var(--text-muted)' }}>
              {requestBytes.length + 1}B
            </span>
          }
        >
          Request Frame
        </SectionHeader>
        <div style={{ marginTop: 14 }}>
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
        />
      ))}

      {responseVariants.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
          No response variants defined yet.
        </p>
      )}

      <Button variant="ghost" onClick={addVariant}>
        <Plus size={12} /> Add response variant
      </Button>

      {/* ── Save ── */}
      <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
        <Button variant="primary" onClick={() => onSave({ ...cmd, requestBytes, responseVariants })}>
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
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px', flexShrink: 0,
        borderBottom: '1px solid var(--border)',
      }}>
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
      <div style={{ flex: 1, overflowY: 'auto' }}>
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

function SortableCmdRow({ cmd, indent, onEdit }: { cmd: UserCmdDef; indent: number; onEdit: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `cmd:${cmd.id}`,
  });
  const { size, variants, ctrlBytes } = computeStats(cmd);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
        display: 'flex', alignItems: 'center', gap: 6,
        height: 32, paddingLeft: indent, paddingRight: 8,
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface-base)',
      }}
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
      <Button variant="ghost" onClick={onEdit} style={{ fontSize: 11, height: 22, padding: '0 8px', flexShrink: 0 }}>
        Edit
      </Button>
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

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        height: 30, paddingLeft: 8, paddingRight: 8,
        background: 'color-mix(in srgb, var(--surface-raised) 30%, transparent)',
        borderBottom: '1px solid var(--border)',
      }}>
        <span
          {...attributes}
          {...listeners}
          style={{ cursor: 'grab', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', flexShrink: 0, touchAction: 'none' }}
        >
          <DotsSixVertical size={12} />
        </span>
        <button
          onClick={onToggle}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 0, flexShrink: 0 }}
        >
          {isOpen ? <CaretDown size={10} /> : <CaretRight size={10} />}
        </button>
        <EditableName
          value={sub.name}
          onChange={onUpdateName}
          style={{ flex: 1, fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}
        />
        <button
          onClick={onDelete}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '0 2px', flexShrink: 0 }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--status-err)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
        >
          <X size={11} />
        </button>
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

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        height: 34, paddingLeft: 2, paddingRight: 8,
        background: 'color-mix(in srgb, var(--surface-raised) 50%, transparent)',
        borderBottom: '1px solid var(--border)',
      }}>
        <span
          {...attributes}
          {...listeners}
          style={{ cursor: 'grab', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '0 4px', flexShrink: 0, touchAction: 'none' }}
        >
          <DotsSixVertical size={14} />
        </span>
        <button
          onClick={onToggle}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 0, flexShrink: 0 }}
        >
          {isOpen ? <CaretDown size={12} /> : <CaretRight size={12} />}
        </button>
        <EditableName
          value={group.name}
          onChange={onUpdateName}
          style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <button
            onClick={onAddSubgroup}
            style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: 4,
              cursor: 'pointer', fontSize: 10, color: 'var(--text-muted)',
              display: 'flex', alignItems: 'center', gap: 3, padding: '1px 6px', height: 20,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
          >
            <Plus size={9} /> Subgroup
          </button>
          <button
            onClick={onDelete}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '0 2px' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--status-err)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
          >
            <X size={12} />
          </button>
        </div>
      </div>
      <Collapse open={isOpen}>
        {children}
      </Collapse>
    </div>
  );
}

// ── Drag overlay ghost ─────────────────────────────────────────────

function OverlayGhost({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface-raised)',
      border: '1px solid var(--accent)',
      borderRadius: 5, opacity: 0.92,
      boxShadow: '0 4px 14px var(--shadow-7)',
      pointerEvents: 'none',
    }}>
      {children}
    </div>
  );
}

// ── TreeView ───────────────────────────────────────────────────────

function TreeView({ onEdit }: { onEdit: (cmdId: string) => void }) {
  const userCmds     = useAppStore(s => s.userCmds);
  const setUserCmds  = useAppStore(s => s.setUserCmds);
  const cmdGroups    = useAppStore(s => s.cmdGroups);
  const setCmdGroups = useAppStore(s => s.setCmdGroups);
  const cmdSubgroups    = useAppStore(s => s.cmdSubgroups);
  const setCmdSubgroups = useAppStore(s => s.setCmdSubgroups);
  const setCmdData      = useAppStore(s => s.setCmdData);

  const [openGroups, setOpenGroups]       = useState<Set<string>>(() => new Set([]));
  const [openSubgroups, setOpenSubgroups] = useState<Set<string>>(() => new Set([]));
  const [activeId, setActiveId]           = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

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
    setUserCmds([...userCmds, cmd]);
  }

  // ── Import / export ──────────────────────────────────────────────

  function exportCmds() {
    const payload: UserCmdFileFormat = { version: 1, groups: cmdGroups, subgroups: cmdSubgroups, commands: userCmds };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'commands.ucmd'; a.click();
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
          setCmdData(parsed.commands, parsed.groups ?? [], parsed.subgroups ?? []);
        }
      } catch { /* malformed */ }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // ── Drag & drop ──────────────────────────────────────────────────

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
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

  // ── Render helpers ───────────────────────────────────────────────

  function renderOverlay(id: string) {
    if (id.startsWith('cmd:')) {
      const cmd = userCmds.find(c => `cmd:${c.id}` === id);
      if (!cmd) return null;
      const { size, variants, ctrlBytes } = computeStats(cmd);
      return (
        <OverlayGhost>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, paddingLeft: 8, paddingRight: 8 }}>
            <DotsSixVertical size={14} style={{ color: 'var(--text-muted)' }} />
            <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)' }}>{cmd.name}</span>
            <StatBadge>{size}B</StatBadge>
            <StatBadge>{variants} {variants === 1 ? 'struct' : 'structs'}</StatBadge>
            {ctrlBytes > 0 && <StatBadge>{ctrlBytes} ctrl</StatBadge>}
          </div>
        </OverlayGhost>
      );
    }
    if (id.startsWith('grp:')) {
      const group = cmdGroups.find(g => `grp:${g.id}` === id);
      if (!group) return null;
      return (
        <OverlayGhost>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, paddingLeft: 8, paddingRight: 8, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
            <DotsSixVertical size={14} style={{ color: 'var(--text-muted)' }} />
            {group.name}
          </div>
        </OverlayGhost>
      );
    }
    if (id.startsWith('sub:')) {
      const sub = cmdSubgroups.find(s => `sub:${s.id}` === id);
      if (!sub) return null;
      return (
        <OverlayGhost>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, height: 30, paddingLeft: 8, paddingRight: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
            <DotsSixVertical size={12} style={{ color: 'var(--text-muted)' }} />
            {sub.name}
          </div>
        </OverlayGhost>
      );
    }
    return null;
  }

  const uncategorized = userCmds.filter(c => !c.groupId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '6px 10px', flexShrink: 0,
        borderBottom: '1px solid var(--border)',
      }}>
        <Button variant="ghost" onClick={addGroup} style={{ gap: 4, fontSize: 11 }}>
          <Plus size={11} /> New Group
        </Button>
        <Button variant="ghost" onClick={addCmd} style={{ gap: 4, fontSize: 11 }}>
          <Plus size={11} /> New Command
        </Button>
        <div style={{ flex: 1 }} />
        <input ref={fileInputRef} type="file" accept=".ucmd" style={{ display: 'none' }} onChange={importCmds} />
        <Button variant="ghost" onClick={() => fileInputRef.current?.click()} style={{ gap: 4, fontSize: 11 }}>
          <Upload size={11} /> Import
        </Button>
        <Button variant="ghost" onClick={exportCmds} style={{ gap: 4, fontSize: 11 }}>
          <Download size={11} /> Export
        </Button>
      </div>

      {/* Tree */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
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
                  <SortableCmdRow key={cmd.id} cmd={cmd} indent={14} onEdit={() => onEdit(cmd.id)} />
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
                    {directCmds.map(cmd => (
                      <SortableCmdRow key={cmd.id} cmd={cmd} indent={28} onEdit={() => onEdit(cmd.id)} />
                    ))}
                    {directCmds.length === 0 && subs.length === 0 && (
                      <EmptyDropHint indent={28} />
                    )}
                  </SortableContext>

                  {/* Subgroups */}
                  <SortableContext items={subs.map(s => `sub:${s.id}`)} strategy={verticalListSortingStrategy}>
                    {subs.map(sub => {
                      const subCmds  = userCmds.filter(c => c.subgroupId === sub.id);
                      const isSubOpen = openSubgroups.has(sub.id);

                      return (
                        <SortableSubgroupRow
                          key={sub.id}
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
                            {subCmds.map(cmd => (
                              <SortableCmdRow key={cmd.id} cmd={cmd} indent={40} onEdit={() => onEdit(cmd.id)} />
                            ))}
                            {subCmds.length === 0 && (
                              <EmptyDropHint indent={40} />
                            )}
                          </SortableContext>
                        </SortableSubgroupRow>
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

          <DragOverlay>
            {activeId ? renderOverlay(activeId) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}

// ── UserCmdTab ─────────────────────────────────────────────────────

export function UserCmdTab() {
  const [view, setView] = useState<'tree' | { cmdId: string }>('tree');

  if (view !== 'tree') {
    return <EditorView key={view.cmdId} cmdId={view.cmdId} onBack={() => setView('tree')} />;
  }

  return <TreeView onEdit={(cmdId) => setView({ cmdId })} />;
}
