import { PaperPlaneTilt, DownloadSimple, WarningCircle } from '@phosphor-icons/react';
import { toTitleCase } from '../lib/utils';
import type { PacketEntry } from '../lib/types';

export function HexCell({ hex, dir }: { hex: string; dir: 'tx' | 'rx' }) {
  if (!hex) return <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>;
  const color = dir === 'tx' ? 'var(--tx)' : 'var(--rx)';
  return (
    <>
      {hex.split(' ').map((b, i) => (
        <span key={i} style={{ color }}>{b} </span>
      ))}
    </>
  );
}

export function dirBadgeCls(p: PacketEntry) {
  const isErr = p.pid === 'FE' || p.pid === 'ERR';
  if (p.direction === 'tx') return 'dir-badge tx';
  if (isErr)                return 'dir-badge err';
  return 'dir-badge rx';
}

export function flattenDecoded(decoded: Record<string, unknown>): [string, unknown][] {
  if (!decoded || typeof decoded !== 'object') return [];
  const type = decoded.type as string | undefined;
  const data = decoded.data;
  if (type && data && typeof data === 'object') {
    return [['type', type], ...Object.entries(data as Record<string, unknown>)];
  }
  return Object.entries(decoded);
}

export function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'number')
    return Number.isInteger(v)
      ? `0x${v.toString(16).toUpperCase().padStart(2, '0')} (${v})`
      : String(v);
  if (typeof v === 'string') return v;
  if (Array.isArray(v))
    return v.map((b) => (typeof b === 'number' ? b.toString(16).toUpperCase().padStart(2, '0') : String(b))).join(' ');
  return JSON.stringify(v);
}

export function ExpandDetailFlat({ p, open, extraFields }: {
  p: PacketEntry;
  open: boolean;
  extraFields?: [string, unknown][];
}) {
  const isErr = p.pid === 'FE' || p.pid === 'ERR';
  const valueColor = isErr
    ? 'var(--status-err)'
    : p.direction === 'tx' ? 'var(--tx)' : 'var(--rx)';
  const allFields = flattenDecoded(p.decoded);
  const baseRows  = p.direction === 'tx' ? allFields.filter(([k]) => k !== 'command') : allFields;
  const rows      = extraFields && extraFields.length > 0 ? extraFields : baseRows;

  return (
    <div style={{ background: 'var(--surface-base)', overflow: 'hidden' }}>
      <div className={`expand-content ${open ? 'px-6 pb-3 pt-1' : 'closed'}`} style={{ maxHeight: open ? '300px' : undefined }}>
        <div className="text-[10px] mb-1.5 uppercase tracking-wider" style={{ color: isErr ? 'var(--status-err)' : 'var(--text-muted)' }}>
          {p.direction === 'tx'
            ? <><PaperPlaneTilt size={11} className="inline mr-1" />TX · PID 0x{p.pid}</>
            : isErr
            ? <><WarningCircle size={11} className="inline mr-1" />ERR{p.pid === 'ERR' ? '' : ` · PID 0x${p.pid}`}</>
            : <><DownloadSimple size={11} className="inline mr-1" />RX · PID 0x{p.pid}</>
          }
        </div>
        <div className="space-y-0.5 text-xs font-mono">
          {rows.length > 0 ? (
            rows.map(([k, v]) => (
              <div key={k}>
                <span className="w-36 inline-block" style={{ color: 'var(--text-muted)' }}>{toTitleCase(k)}</span>
                <span style={{ color: valueColor }}>{formatValue(v)}</span>
              </div>
            ))
          ) : (
            <span style={{ color: 'var(--border-strong)', fontStyle: 'italic' }}>no field data</span>
          )}
        </div>
      </div>
    </div>
  );
}
