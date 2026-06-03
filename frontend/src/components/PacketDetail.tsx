import { PaperPlaneTilt, DownloadSimple, WarningCircle } from '@phosphor-icons/react';
import { toTitleCase } from '../lib/utils';
import type { PacketEntry } from '../lib/types';

export function HexCell({ hex, dir }: { hex: string; dir: 'tx' | 'rx' }) {
  const cls = dir === 'tx' ? 'text-blue-400' : 'text-green-400';
  if (!hex) return <span className="text-gray-600 italic">—</span>;
  return (
    <>
      {hex.split(' ').map((b, i) => (
        <span key={i} className={cls}>{b} </span>
      ))}
    </>
  );
}

export function dirBadgeCls(p: PacketEntry) {
  const isErr = p.pid === 'FE';
  return p.direction === 'tx'
    ? 'bg-[#1e3a8a] text-[#93c5fd] border border-[#3b82f6]'
    : isErr
    ? 'bg-red-900/30 text-red-400 border border-red-500/50'
    : 'bg-[#064e3b] text-[#6ee7b7] border border-[#10b981]';
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
  const isErr = p.pid === 'FE';
  const valueCls = isErr ? 'text-red-400' : p.direction === 'tx' ? 'text-blue-400' : 'text-green-400';
  const allFields = flattenDecoded(p.decoded);
  const baseRows = p.direction === 'tx' ? allFields.filter(([k]) => k !== 'command') : allFields;
  const rows = extraFields && extraFields.length > 0 ? extraFields : baseRows;

  return (
    <div className="bg-gray-900/60 overflow-hidden">
      <div className={`expand-content ${open ? 'px-6 pb-3 pt-1' : 'closed'}`} style={{ maxHeight: open ? '300px' : undefined }}>
        <div className={`text-[10px] mb-1.5 uppercase tracking-wider ${isErr ? 'text-red-500' : 'text-gray-500'}`}>
          {p.direction === 'tx'
            ? <><PaperPlaneTilt size={11} className="inline mr-1" />TX · PID 0x{p.pid}</>
            : isErr
            ? <><WarningCircle size={11} className="inline mr-1" />ERR · PID 0x{p.pid}</>
            : <><DownloadSimple size={11} className="inline mr-1" />RX · PID 0x{p.pid}</>
          }
        </div>
        <div className="space-y-0.5 text-xs font-mono">
          {rows.length > 0 ? (
            rows.map(([k, v]) => (
              <div key={k}>
                <span className="w-36 inline-block text-gray-500">{toTitleCase(k)}</span>
                <span className={valueCls}>{formatValue(v)}</span>
              </div>
            ))
          ) : (
            <span className="text-gray-700 italic">no field data</span>
          )}
        </div>
      </div>
    </div>
  );
}
