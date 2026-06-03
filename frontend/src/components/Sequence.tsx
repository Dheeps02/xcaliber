import { useRef, useState, useEffect } from 'react';
import {
  Play, Plus, X, ArrowSquareOut, FolderOpen, ListBullets, Timer,
} from '@phosphor-icons/react';
import { Toggle } from './Toggle';
import { SpinInput } from './SpinInput';
import { ExpandDetailFlat } from './PacketDetail';
import { useAppStore } from '../stores/app-store';
import { api } from '../lib/api';
import { CMD_DEFS } from '../lib/cmd-defs';
import type { Sequence as SeqType, SeqFile, SeqStepOutcome, SeqStepResp } from '../lib/types';

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

function statusLabelCls(status: string) {
  if (status === 'running') return 'text-green-400';
  if (status === 'done')    return 'text-green-400';
  if (status === 'aborted') return 'text-red-400';
  return 'text-gray-500';
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
  const importRef            = useRef<HTMLInputElement>(null);

  const activeSeq = sequences.find((s) => s.id === activeSequenceId) ?? null;
  const runStatus = seqRunResult?.status ?? 'idle';
  const isRunning = runStatus === 'running';
  const canRun    = !!activeSeq && connected && !isRunning && (activeSeq.steps.length > 0);

  // Animation state
  const [newStepIds, setNewStepIds]     = useState<Set<string>>(new Set());
  const [exitingIds, setExitingIds]     = useState<Set<string>>(new Set());
  const prevStepIdsRef                  = useRef<Set<string>>(new Set());

  // Detect newly added steps and trigger enter animation
  const stepIdKey = activeSeq?.steps.map((s) => s.id).join(',') ?? '';
  useEffect(() => {
    const currentIds = new Set(activeSeq?.steps.map((s) => s.id) ?? []);
    const added = new Set<string>();
    for (const id of currentIds) {
      if (!prevStepIdsRef.current.has(id)) added.add(id);
    }
    prevStepIdsRef.current = currentIds;
    if (added.size === 0) return;
    setNewStepIds((prev) => new Set([...prev, ...added]));
    const t = setTimeout(() => {
      setNewStepIds((prev) => { const n = new Set(prev); added.forEach((id) => n.delete(id)); return n; });
    }, 320);
    return () => clearTimeout(t);
  }, [stepIdKey]); // eslint-disable-line react-hooks/exhaustive-deps

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

  async function runSequence() {
    if (!canRun) return;
    setSeqRunResult({ status: 'running', stepResults: [] });
    const payload = {
      ...activeSeq,
      steps: activeSeq!.steps.map((step) => ({
        ...step,
        bytes: step.bytes.map((b) => (b.trim() ? parseInt(b, 16) & 0xff : 0)),
      })),
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
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'sequences.seq'; a.click();
    URL.revokeObjectURL(url);
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
      <div className="flex items-center gap-2 px-4 h-9 border-b border-gray-800 bg-gray-900/60 shrink-0">
        <input ref={importRef} type="file" accept=".seq,.json" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ''; }} />

        {/* Status LED + label */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${ledClass(runStatus)}`} />
          <span className={`text-[10px] w-14 ${statusLabelCls(runStatus)}`}>{statusLabel(runStatus)}</span>
        </div>
        <div className="w-px h-4 bg-gray-800 shrink-0" />

        {/* Run */}
        <button
          onClick={runSequence}
          disabled={!canRun}
          title="Run sequence"
          className={`h-6 px-2.5 rounded text-[10px] font-medium flex items-center gap-1.5 border transition-colors text-green-400 border-green-500/30 bg-green-500/10 ${
            canRun ? 'hover:bg-green-500/20 cursor-pointer' : 'opacity-40 cursor-not-allowed'
          }`}
        >
          <Play size={12} />Run
        </button>

        <div className="w-px h-4 bg-gray-800 shrink-0" />

        {/* Sequence selector */}
        <select
          value={activeSequenceId ?? ''}
          onChange={(e) => { setActiveSequenceId(e.target.value || null); setSeqSelectedStepId(null); }}
          className="h-6 bg-gray-800 border border-gray-700 text-gray-200 text-[10px] rounded px-2 max-w-[180px] focus:outline-none focus:border-blue-500"
        >
          {sequences.length === 0 && <option value="">— no sequences —</option>}
          {sequences.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        {/* New sequence */}
        <button
          onClick={addSequence}
          title="New sequence"
          className="w-6 h-6 rounded flex items-center justify-center border transition-colors text-blue-400 border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 cursor-pointer"
        >
          <Plus size={12} />
        </button>

        {/* Delete sequence */}
        <button
          onClick={deleteActiveSeq}
          disabled={!activeSeq}
          title="Delete sequence"
          className={`w-6 h-6 rounded flex items-center justify-center border transition-colors text-gray-400 border-gray-700 bg-gray-800 ${
            activeSeq ? 'hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/10 cursor-pointer' : 'opacity-40 cursor-not-allowed'
          }`}
        >
          <X size={12} />
        </button>

        <div className="w-px h-4 bg-gray-800 shrink-0" />

        {/* Abort-on-error toggle */}
        <div className={activeSeq ? '' : 'opacity-40 pointer-events-none'}>
          <Toggle
            active={activeSeq?.abortOnError ?? false}
            onClick={() => activeSeq && updateSequence({ ...activeSeq, abortOnError: !activeSeq.abortOnError })}
            label="Abort on error"
            activeColor="orange"
          />
        </div>

        {/* Step delay */}
        {activeSeq && (
          <>
            <div className="w-px h-4 bg-gray-800 shrink-0" />
            <div className="flex items-center gap-1.5 shrink-0">
              <Timer size={13} className="text-gray-600 shrink-0" />
              <SpinInput
                value={activeSeq.stepDelayMs}
                onChange={(v) => updateSequence({ ...activeSeq, stepDelayMs: v })}
                min={0}
                step={10}
                inputClassName="h-6 px-2 bg-gray-800 border border-gray-700 rounded text-[10px] font-mono text-gray-200 focus:outline-none focus:border-blue-500"
              />
              <span className="text-[10px] text-gray-600">ms</span>
            </div>
          </>
        )}

        <div className="flex-1" />

        {/* Export / Import */}
        <button
          onClick={handleExport}
          disabled={!sequences.length}
          title="Export sequences to .seq file"
          className={`h-6 px-2.5 rounded text-[10px] font-medium flex items-center gap-1.5 border transition-colors ${
            sequences.length
              ? 'text-gray-400 border-gray-700 bg-gray-800 hover:bg-gray-700 cursor-pointer'
              : 'text-gray-600 border-gray-800 bg-gray-900 cursor-not-allowed opacity-40'
          }`}
        >
          <ArrowSquareOut size={13} />Export
        </button>
        <button
          onClick={() => importRef.current?.click()}
          title="Import sequences from .seq file"
          className="h-6 px-2.5 rounded text-[10px] font-medium flex items-center gap-1.5 border transition-colors text-gray-400 border-gray-700 bg-gray-800 hover:bg-gray-700 cursor-pointer"
        >
          <FolderOpen size={13} />Import
        </button>
      </div>

      {/* Steps list header */}
      <div className="flex items-center justify-between px-3 h-8 border-b border-gray-800 shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 flex items-center gap-1.5">
          <ListBullets size={14} />Steps
        </span>
        {activeSeq && (
          <span className="text-[10px] text-gray-700 tabular-nums">
            {activeSeq.steps.length} step{activeSeq.steps.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Steps list */}
      <div className="flex-1 overflow-y-auto">
        {!activeSeq ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-700 text-xs">
            <ListBullets size={32} className="opacity-40" />
            Press <span className="text-gray-500 font-semibold">+</span> to create a sequence
          </div>
        ) : activeSeq.steps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-700 text-xs">
            <ListBullets size={32} className="opacity-40" />
            No steps — select a command and press <span className="text-gray-500 font-semibold mx-1">+ Add to Sequence</span>
          </div>
        ) : (
          activeSeq.steps.map((step, idx) => {
            const result = seqRunResult?.stepResults.find((r) => r.stepId === step.id);
            const isSelected = seqSelectedStepId === step.id;
            const isStepRunning = isRunning && !result;
            const isExiting = exitingIds.has(step.id);
            const isNew = newStepIds.has(step.id);
            // Find matching packets for ExpandDetailFlat
            const txPacket = result?.txHex ? [...packets].reverse().find((p) => p.hex === result.txHex && p.direction === 'tx') : undefined;
            const rxPacket = result?.rxHex ? [...packets].reverse().find((p) => p.hex === result.rxHex && p.direction === 'rx') : undefined;

            return (
              <div key={step.id} className={isExiting ? 'row-out' : isNew ? 'daq-row-enter' : ''}>
                <div
                  className={`seq-step-hdr group${isSelected ? ' active' : ''}`}
                  onClick={() => onStepClick(step.id)}
                >
                  {/* Status circle */}
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

                  {/* Index */}
                  <span className="text-[10px] text-gray-600 shrink-0 w-4 text-right tabular-nums">{idx + 1}</span>

                  {/* Command name */}
                  <span className="text-xs text-gray-300 font-medium flex-1 truncate min-w-0">
                    {cmdLabel(step.cmdKey)}
                  </span>

                  {/* Byte preview */}
                  <span className="font-mono text-[10px] text-gray-600 shrink-0 hidden group-hover:inline">
                    {bytePreview(step.bytes)}
                  </span>

                  {/* Response assertion toggle */}
                  <RespToggle value={step.resp} onChange={(v) => setStepResp(step.id, v)} />

                  {/* Delete */}
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteStep(step.id); }}
                    title="Remove step"
                    className="w-5 h-5 flex items-center justify-center rounded text-gray-700 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                  >
                    <X size={11} />
                  </button>
                </div>

                {/* Inline packet detail — same as trace view */}
                {isSelected && txPacket && (
                  <ExpandDetailFlat p={txPacket} open />
                )}
                {isSelected && rxPacket && (
                  <ExpandDetailFlat p={rxPacket} open />
                )}
                {isSelected && result?.errorMsg && (
                  <div className="seq-step-detail px-5 py-2 text-[10px] text-red-400">{result.errorMsg}</div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
