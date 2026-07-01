import { useRef, useState, useEffect, useLayoutEffect } from 'react';
import {
  Plus, X, ListBullets, Timer,
} from '@phosphor-icons/react';
import { ImportExportButtons } from './ui/ImportExportButtons';
import {
  CommandIcon, ExpandPanel, HexCells,
  dirBgColor, dirBgHover, dirColor, getCommandName,
} from './PacketTrace';
import { useAppStore } from '../stores/app-store';
import { api } from '../lib/api';
import { CMD_DEFS } from '../lib/cmd-defs';
import { SEQUENCE_STEP_STAGGER_MS } from '../lib/constants';
import { formatTime } from '../lib/utils';
import type { PacketEntry, Sequence as SeqType, SeqFile, SeqStepOutcome, SeqStepResp } from '../lib/types';
import { ExportDialog } from './ExportDialog';
import { Button } from './ui/Button';
import { Select } from './ui/Select';
import { DialInput } from './ui/DialInput';
import { Toggle } from './ui/Toggle';
import { RunStopButton } from './ui/RunStopButton';

// ── helpers ───────────────────────────────────────────────────────

function ledClass(status: string) {
  if (status === 'running') return 'blinker-on';
  if (status === 'done')    return 'blinker-green';
  if (status === 'aborted') return 'blinker-red';
  return 'blinker-grey';
}

function statusLabel(status: string) {
  if (status === 'running') return 'Running';
  if (status === 'done')    return 'Done';
  if (status === 'aborted') return 'Aborted';
  return 'Idle';
}

function statusColor(status: string): string {
  if (status === 'running') return 'var(--status-ok)';
  if (status === 'done')    return 'var(--status-ok)';
  if (status === 'aborted') return 'var(--status-err)';
  return 'var(--text-muted)';
}

function outcomeClass(outcome: SeqStepOutcome | undefined, running: boolean) {
  if (outcome === 'pass')                           return 'seq-step-status pass';
  if (outcome === 'fail' || outcome === 'error')    return 'seq-step-status fail';
  if (outcome === 'skipped')                        return 'seq-step-status skipped';
  if (running)                                      return 'seq-step-status running';
  return 'seq-step-status';
}

function bytePreview(bytes: string[]) {
  return bytes.filter(Boolean).join(' ') || '—';
}

function cmdLabel(cmdKey: string) {
  const def = CMD_DEFS[cmdKey];
  if (def?.userCmdName) return def.userCmdName.toUpperCase();
  return cmdKey.replace(/-/g, ' ').toUpperCase();
}

// ── RespToggle ────────────────────────────────────────────────────

function RespToggle({ value, onChange }: { value: SeqStepResp; onChange: (v: SeqStepResp) => void }) {
  return (
    <div className="resp-toggle" onClick={(e) => e.stopPropagation()}>
      {(['neg', 'either', 'pos'] as SeqStepResp[]).map((v) => (
        <button key={v} data-val={v} onClick={() => onChange(v)} className={`resp-btn${value === v ? ' active' : ''}`}>
          {v === 'neg' ? 'NEG' : v === 'pos' ? 'POS' : '—'}
        </button>
      ))}
    </div>
  );
}

// ── Trace-style sequence packet row ────────────────────────────────

function packetDir(p: PacketEntry) {
  return p.pid === 'FE' ? 'err' : p.direction;
}

function SequenceTraceFrame({
  packet,
  open,
  onClick,
  fallbackText,
}: {
  packet: PacketEntry;
  open: boolean;
  onClick: () => void;
  fallbackText?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const dir = packetDir(packet);
  const color = dirColor(dir);

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '200px 110px 1fr',
          position: 'relative',
          cursor: 'pointer',
          transition: 'background 70ms',
          background: open ? 'var(--surface-overlay)' : hovered ? dirBgHover(dir) : dirBgColor(dir),
          borderBottom: '1px solid var(--border)',
          paddingRight: 16,
        }}
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div
          style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: 3,
            borderRadius: '0 2px 2px 0',
            background: color,
            boxShadow: `3px 0 10px color-mix(in srgb, ${color} 45%, transparent)`,
          }}
        />

        <div className="flex items-center gap-1.5 py-2 min-w-0 overflow-hidden" style={{ paddingLeft: 12 }}>
          <CommandIcon p={packet} />
          <span className="trace-mono font-medium text-[12px] truncate" style={{ color: 'var(--text-primary)' }}>
            {getCommandName(packet)}
          </span>
          <span className="text-[10px] font-mono shrink-0" style={{ color: 'var(--text-muted)' }}>
            #{packet.counter}
          </span>
        </div>

        <div className="flex items-center py-2 font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {packet.timestamp_ms > 0 ? formatTime(packet.timestamp_ms) : '—'}
        </div>

        <div className="flex items-center gap-1 py-2 font-mono text-[11px] overflow-hidden">
          {fallbackText
            ? <span className="truncate" style={{ color }}>{fallbackText}</span>
            : <HexCells hex={packet.hex} dir={dir} />
          }
        </div>
      </div>

      <ExpandPanel p={packet} open={open} />
    </>
  );
}

// ── Sequence ──────────────────────────────────────────────────────

export function Sequence() {
  const connected            = useAppStore((s) => s.connected);
  const sequences            = useAppStore((s) => s.sequences);
  const activeSequenceId     = useAppStore((s) => s.activeSequenceId);
  const seqSelectedStepId    = useAppStore((s) => s.seqSelectedStepId);
  const seqRunResult         = useAppStore((s) => s.seqRunResult);
  const packets              = useAppStore((s) => s.packets);
  const setSequences         = useAppStore((s) => s.setSequences);
  const setActiveSequenceId  = useAppStore((s) => s.setActiveSequenceId);
  const setSeqSelectedStepId = useAppStore((s) => s.setSeqSelectedStepId);
  const updateSequence       = useAppStore((s) => s.updateSequence);
  const setSeqRunResult      = useAppStore((s) => s.setSeqRunResult);
  const setActiveCmd         = useAppStore((s) => s.setActiveCmd);
  const setByteValue         = useAppStore((s) => s.setByteValue);
  const showToast            = useAppStore((s) => s.showToast);
  
  const activeSeq = sequences.find((s) => s.id === activeSequenceId) ?? null;
  const runStatus = seqRunResult?.status ?? 'idle';
  const isRunning = runStatus === 'running';
  const [exportContent,  setExportContent]  = useState<string | null>(null);
  const [runJiggling,    setRunJiggling]    = useState(false);

  const [expandedSteps,    setExpandedSteps]    = useState<Set<string>>(new Set());
  const [expandedSubRows,  setExpandedSubRows]  = useState<Set<string>>(new Set());
  const [newStepIds,       setNewStepIds]       = useState<Set<string>>(new Set());
  const [exitingIds,       setExitingIds]       = useState<Set<string>>(new Set());
  const prevStepIdsRef   = useRef<Set<string>>(new Set());
  const staggerDelaysRef = useRef<Map<string, number>>(new Map());

  const stepIdKey = activeSeq?.steps.map((s) => s.id).join(',') ?? '';
  useLayoutEffect(() => {
    const currentIds = new Set(activeSeq?.steps.map((s) => s.id) ?? []);
    const added: string[] = [];
    for (const id of currentIds) {
      if (!prevStepIdsRef.current.has(id)) added.push(id);
    }
    prevStepIdsRef.current = currentIds;
    if (added.length === 0) return;
    added.forEach((id, i) => staggerDelaysRef.current.set(id, i * SEQUENCE_STEP_STAGGER_MS));
    const addedSet = new Set(added);
    setNewStepIds((prev) => new Set([...prev, ...addedSet]));
    const maxDelay = (added.length - 1) * SEQUENCE_STEP_STAGGER_MS;
    const t = setTimeout(() => {
      setNewStepIds((prev) => { const n = new Set(prev); addedSet.forEach((id) => n.delete(id)); return n; });
    }, 280 + maxDelay + 50);
    return () => clearTimeout(t);
  }, [stepIdKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const [tick, setTick] = useState(0);
  const stepStartTimesRef = useRef<Map<string, number>>(new Map());
  const stepEndTimesRef   = useRef<Map<string, number>>(new Map());
  const stepResultsLen    = seqRunResult?.stepResults.length ?? 0;

  useEffect(() => {
    if (runStatus === 'running') {
      stepStartTimesRef.current = new Map();
      stepEndTimesRef.current   = new Map();
      const first = activeSeq?.steps.find((s) => !s.disabled);
      if (first) stepStartTimesRef.current.set(first.id, Date.now());
    }
  }, [runStatus === 'running']); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isRunning || !activeSeq) return;
    const completedIds = new Set(seqRunResult!.stepResults.map((r) => r.stepId));
    for (const r of seqRunResult!.stepResults) {
      if (!stepEndTimesRef.current.has(r.stepId)) stepEndTimesRef.current.set(r.stepId, Date.now());
    }
    const next = activeSeq.steps.find((s) => !completedIds.has(s.id) && !s.disabled);
    if (next && !stepStartTimesRef.current.has(next.id)) stepStartTimesRef.current.set(next.id, Date.now());
  }, [stepResultsLen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setTick(Date.now()), 10);
    return () => clearInterval(id);
  }, [isRunning]);

  // ── actions ───────────────────────────────────────────────────────

  function addSequence() {
    const id = crypto.randomUUID();
    const seq: SeqType = { id, name: `Sequence ${sequences.length + 1}`, abortOnError: false, stepDelayMs: 0, steps: [] };
    setSequences([...sequences, seq]);
    setActiveSequenceId(id);
    setSeqSelectedStepId(null);
  }

  function deleteActiveSeq() {
    if (!activeSeq) return;
    const remaining = sequences.filter((s) => s.id !== activeSeq.id);
    setSequences(remaining);
    setActiveSequenceId(remaining[0]?.id ?? null);
    setSeqSelectedStepId(null);
  }

  function onStepClick(stepId: string) {
    if (!activeSeq) return;
    const step = activeSeq.steps.find((s) => s.id === stepId);
    if (!step) return;
    setSeqSelectedStepId(stepId);
    setActiveCmd(step.cmdKey);
    step.bytes.forEach((b, i) => setByteValue(i, b));
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId); else next.add(stepId);
      return next;
    });
  }

  function toggleSubRow(key: string) {
    setExpandedSubRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function setStepResp(stepId: string, resp: SeqStepResp) {
    if (!activeSeq) return;
    updateSequence({ ...activeSeq, steps: activeSeq.steps.map((s) => s.id === stepId ? { ...s, resp } : s) });
  }

  function deleteStep(stepId: string) {
    if (!activeSeq) return;
    setExitingIds((prev) => new Set([...prev, stepId]));
    setTimeout(() => {
      updateSequence({ ...activeSeq, steps: activeSeq.steps.filter((s) => s.id !== stepId) });
      setExitingIds((prev) => { const n = new Set(prev); n.delete(stepId); return n; });
      if (seqSelectedStepId === stepId) setSeqSelectedStepId(null);
    }, 200);
  }

  function jiggleRun() { setRunJiggling(true); setTimeout(() => setRunJiggling(false), 380); }

  async function runSequence() {
    if (!activeSeq) { jiggleRun(); showToast('Select a sequence first', 'warning'); return; }
    if (!connected) { jiggleRun(); showToast('Not connected to slave', 'error'); return; }
    if (activeSeq.steps.length === 0) { jiggleRun(); showToast('Add steps to the sequence first', 'warning'); return; }
    if (isRunning) return;
    setSeqRunResult({ status: 'running', stepResults: [] });
    const payload = {
      ...activeSeq,
      steps: activeSeq!.steps.map((step) => {
        let lastFilled = -1;
        for (let i = step.bytes.length - 1; i >= 0; i--) {
          if (step.bytes[i]?.trim()) { lastFilled = i; break; }
        }
        const bytes = step.bytes
          .slice(0, lastFilled + 1)
          .map((b) => (b.trim() ? parseInt(b, 16) & 0xff : 0));
        return { ...step, bytes };
      }),
    };
    try {
      await api.seqRun(payload as unknown as SeqType);
    } catch (e) {
      showToast((e as Error).message, 'error');
      setSeqRunResult({ status: 'aborted', stepResults: seqRunResult?.stepResults ?? [] });
    }
  }

  function handleExport() {
    if (!sequences.length) return;
    const file: SeqFile = { version: 1, sequences };
    setExportContent(JSON.stringify(file, null, 2));
  }

  async function handleImport(file: File) {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as SeqFile;
      if (data.version !== 1 || !Array.isArray(data.sequences)) {
        showToast('Invalid .seq file', 'error'); return;
      }
      setSequences(data.sequences);
      setActiveSequenceId(data.sequences[0]?.id ?? null);
      showToast(`Loaded ${data.sequences.length} sequence(s)`, 'success');
    } catch {
      showToast('Failed to parse .seq file', 'error');
    }
  }

  // ── render ────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* Toolbar */}
      <div
        className="xcb-glass flex items-center gap-2 px-3 h-9 shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >

        {/* Status */}
        <span className={`w-2 h-2 rounded-full shrink-0 ${ledClass(runStatus)}`} />
        <span className="text-[10px] w-14 shrink-0" style={{ color: statusColor(runStatus) }}>{statusLabel(runStatus)}</span>
        <div className="xcb-vdiv" />

        {/* Run */}
        <RunStopButton
          running={false}
          pending={isRunning}
          canRun={!isRunning}
          className={runJiggling ? 'btn-jiggle' : ''}
          onRun={runSequence}
        />
        <div className="xcb-vdiv" />

        {/* Sequence selector */}
        <Select<string>
          value={activeSequenceId ?? ''}
          onChange={(v) => { setActiveSequenceId(v || null); setSeqSelectedStepId(null); }}
          options={sequences.length === 0
            ? [{ value: '', label: '— no sequences —' }]
            : sequences.map(s => ({ value: s.id, label: s.name }))
          }
          style={{ width: 160 }}
        />

        {/* New / Delete */}
        <Button variant="ghost" className="!w-7 !h-7 !p-0" title="New sequence" onClick={addSequence}>
          <Plus size={12} />
        </Button>
        <Button variant="ghost" className="!w-7 !h-7 !p-0" title="Delete sequence" disabled={!activeSeq} onClick={deleteActiveSeq}>
          <X size={12} />
        </Button>
        <div className="xcb-vdiv" />

        {/* Abort on error */}
        <div className="flex items-center gap-1.5" style={{ opacity: activeSeq ? 1 : 0.4, pointerEvents: activeSeq ? undefined : 'none' }}>
          <Toggle
            checked={activeSeq?.abortOnError ?? false}
            onChange={() => activeSeq && updateSequence({ ...activeSeq, abortOnError: !activeSeq.abortOnError })}
          />
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Abort on error</span>
        </div>
        <div className="xcb-vdiv" />

        {/* Step delay */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Timer size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <DialInput
            value={activeSeq?.stepDelayMs ?? 0}
            onChange={(v) => activeSeq && updateSequence({ ...activeSeq, stepDelayMs: v })}
            min={0}
            step={10}
            digits={4}
            style={{ opacity: activeSeq ? 1 : 0.4, pointerEvents: activeSeq ? undefined : 'none' }}
          />
          <span className="text-[10px] shrink-0" style={{ color: 'var(--text-muted)' }}>ms</span>
        </div>

        <div className="flex-1" />

        {/* Export / Import */}
        <ImportExportButtons onExport={handleExport} onImport={handleImport} accept=".seq,.json" exportDisabled={!sequences.length} />
      </div>

      {/* Steps list */}
      <div className="flex-1 overflow-y-auto relative" style={{ background: 'var(--surface-base)' }}>
        {!activeSeq ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <ListBullets size={32} style={{ opacity: 0.3 }} />
            Press <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>+</span> to create a sequence
          </div>
        ) : activeSeq.steps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <ListBullets size={32} style={{ opacity: 0.3 }} />
            No steps — select a command and press{' '}
            <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>+ Add to Sequence</span>
          </div>
        ) : (<>

          {/* Column header */}
          <div
            className="flex items-center h-[26px] border-b sticky top-0 z-10 select-none shrink-0"
            style={{ background: 'var(--surface-base)', borderColor: 'var(--border-strong)' }}
          >
            <div className="w-14 px-3 text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Status</div>
            <div className="flex-1 px-3 text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Command</div>
            <div className="w-24 px-3 text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Runtime</div>
            <div className="w-36 px-3 text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Expected</div>
          </div>

          {activeSeq.steps.map((step, idx) => {
            const result        = seqRunResult?.stepResults.find((r) => r.stepId === step.id);
            const isSelected    = seqSelectedStepId === step.id;
            const completedIds  = new Set(seqRunResult?.stepResults.map((r) => r.stepId) ?? []);
            const isCurrentStep = isRunning && !completedIds.has(step.id) &&
              activeSeq.steps.find((s) => !completedIds.has(s.id))?.id === step.id;
            const isStepRunning = isCurrentStep;
            const isExiting     = exitingIds.has(step.id);
            const isNew         = newStepIds.has(step.id);
            const staggerDelay  = staggerDelaysRef.current.get(step.id) ?? 0;
            const isCollapsed   = !expandedSteps.has(step.id);
            const txKey = `${step.id}:tx`;
            const rxKey = `${step.id}:rx`;

            const hasTx = !!(result?.txHex || isCurrentStep);
            const txHex = result?.txHex ?? bytePreview(step.bytes);
            const rxHex = result?.rxHex;
            const hasRx = !!(rxHex || (result?.errorMsg && result.outcome === 'error'));

            const startTime  = stepStartTimesRef.current.get(step.id);
            const endTime    = stepEndTimesRef.current.get(step.id);
            const runtimeMs  = startTime ? (endTime ?? (isStepRunning ? tick : 0)) - startTime : 0;
            const runtimeStr = startTime ? `${(runtimeMs / 1000).toFixed(2)}s` : result ? '—' : '';

            const txPacket = result?.txHex
              ? [...packets].reverse().find((p) => p.hex === result.txHex && p.direction === 'tx')
              : undefined;
            const rxPacket = result?.rxHex
              ? [...packets].reverse().find((p) => p.hex === result.rxHex && p.direction === 'rx')
              : undefined;
            const txFramePacket: PacketEntry = txPacket ?? {
              id: -idx - 1,
              direction: 'tx',
              counter: idx + 1,
              timestamp_ms: 0,
              hex: txHex,
              pid: txHex.trim().split(/\s+/)[0] || '00',
              decoded: { command: cmdLabel(step.cmdKey) },
            };
            const rxFramePacket: PacketEntry | undefined = hasRx
              ? rxPacket ?? {
                id: -idx - 10_000,
                direction: 'rx',
                counter: idx + 1,
                timestamp_ms: 0,
                hex: rxHex ?? '',
                pid: result?.errorMsg ? 'FE' : (rxHex?.trim().split(/\s+/)[0] || 'FF'),
                decoded: result?.errorMsg ? { type: 'error', data: { message: result.errorMsg } } : {},
              }
              : undefined;

            return (
              <div
                key={step.id}
                className={`seq-step-shell${isExiting ? ' row-out' : ''}${isNew ? ' packet-new packet-new-tx' : ''}`}
                style={isNew ? { animationDelay: `${staggerDelay}ms`, '--anim-delay': `${staggerDelay}ms` } as React.CSSProperties : undefined}
              >
                {/* Group header row */}
                <div
                  className={`seq-step-hdr group${isSelected ? ' active' : ''}`}
                  onClick={() => onStepClick(step.id)}
                >
                  <div className="seq-step-decoration" />
                  <div className="w-14 flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{isCollapsed ? '▸' : '▾'}</span>
                    <div className={outcomeClass(result?.outcome, isStepRunning)}>
                      {result?.outcome === 'pass' && (
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                      {(result?.outcome === 'fail' || result?.outcome === 'error') && (
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <path d="M2 2L6 6M6 2L2 6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      )}
                    </div>
                    <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>{idx + 1}</span>
                  </div>

                  <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider truncate min-w-0" style={{ color: 'var(--text-secondary)' }}>
                    {cmdLabel(step.cmdKey)}
                  </span>

                  <div className="w-24 shrink-0 text-right pr-3">
                    <span
                      className="tabular-nums font-mono text-[10px]"
                      style={{ color: isStepRunning ? 'var(--accent)' : runtimeStr ? 'var(--text-muted)' : 'var(--border-strong)' }}
                    >
                      {runtimeStr || '—'}
                    </span>
                  </div>

                  <div className="w-36 shrink-0 flex items-center gap-2 pr-2">
                    <RespToggle value={step.resp} onChange={(v) => setStepResp(step.id, v)} />
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteStep(step.id); }}
                      title="Remove step"
                      className="w-5 h-5 flex items-center justify-center rounded transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--status-err)')}
                      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
                    >
                      <X size={11} />
                    </button>
                  </div>
                </div>

                {/* Sub-rows */}
                <div style={{
                  display: 'grid',
                  gridTemplateRows: isCollapsed ? '0fr' : '1fr',
                  opacity: isCollapsed ? 0 : 1,
                  transition: 'grid-template-rows 180ms ease, opacity 120ms ease',
                }}>
                  <div className="seq-step-frames">

                    {hasTx && (
                      <SequenceTraceFrame
                        packet={txFramePacket}
                        open={expandedSubRows.has(txKey)}
                        onClick={() => toggleSubRow(txKey)}
                      />
                    )}

                    {rxFramePacket && (
                      <SequenceTraceFrame
                        packet={rxFramePacket}
                        open={expandedSubRows.has(rxKey)}
                        onClick={() => toggleSubRow(rxKey)}
                        fallbackText={rxHex ? undefined : result?.errorMsg}
                      />
                    )}

                  </div>
                </div>
              </div>
            );
          })}
        </>)}
      </div>

      {exportContent !== null && (
        <ExportDialog
          defaultFilename="sequences.seq"
          content={exportContent}
          onClose={() => setExportContent(null)}
          onSuccess={() => showToast('Sequences exported', 'success')}
        />
      )}
    </div>
  );
}
