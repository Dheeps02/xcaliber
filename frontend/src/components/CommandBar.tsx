import {
  useRef, useState, useEffect,
  type ChangeEvent, type MouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { PaperPlaneTilt, CaretUp } from '@phosphor-icons/react';
import { useAppStore } from '../stores/app-store';
import { useTooltip } from '../context/TooltipContext';
import { CMD_DEFS } from '../lib/cmd-defs';
import { api } from '../lib/api';
import type { FieldOption, SeqStep } from '../lib/types';
import { toTitleCase } from '../lib/utils';
import { Button } from './ui/Button';

// ── constants ────────────────────────────────────────────────────────────────

const BASE_CELLS = 8;
const EXIT_MS = 160;
const STAGGER_MS = 28;

interface DropdownState {
  cellIdx: number;
  options: FieldOption[];
  x: number;
  y: number;
  width: number;
}

// ── CommandBar ───────────────────────────────────────────────────────────────

export function CommandBar() {
  const activeCmd           = useAppStore((s) => s.activeCmd);
  const byteValues          = useAppStore((s) => s.byteValues);
  const setByteValue        = useAppStore((s) => s.setByteValue);
  const setActiveCmd        = useAppStore((s) => s.setActiveCmd);
  const customCmdDefs       = useAppStore((s) => s.customCmdDefs);
  const userCmdDefs         = useAppStore((s) => s.userCmdDefs);
  const collapsed           = useAppStore((s) => s.byteBarCollapsed);
  const setCollapsed        = useAppStore((s) => s.setByteBarCollapsed);
  const showToast           = useAppStore((s) => s.showToast);
  const activeMainTab       = useAppStore((s) => s.activeMainTab);
  const activeSequenceId    = useAppStore((s) => s.activeSequenceId);
  const seqSelectedStepId   = useAppStore((s) => s.seqSelectedStepId);
  const sequences           = useAppStore((s) => s.sequences);
  const updateSequence      = useAppStore((s) => s.updateSequence);
  const setSeqSelectedStepId = useAppStore((s) => s.setSeqSelectedStepId);

  const { showTip, hideTip } = useTooltip();

  const def = activeCmd
    ? (CMD_DEFS[activeCmd] ?? customCmdDefs[activeCmd] ?? userCmdDefs[activeCmd])
    : null;

  const [allBytes, setAllBytes]   = useState<string[]>(() => [...byteValues]);
  const [section, setSection]     = useState(0);
  const [labelKey, setLabelKey]   = useState(0);
  const [shownValues, setShownValues] = useState<string[]>(() => [...byteValues]);
  const [spanPhase, setSpanPhase] = useState<'idle' | 'exit' | 'enter'>('idle');
  const [phaseKey, setPhaseKey]   = useState(0);
  const [typeKeys, setTypeKeys]   = useState<number[]>(Array(BASE_CELLS).fill(0));
  const [sendFlying, setSendFlying] = useState(false);
  const [dropdown, setDropdown]   = useState<DropdownState | null>(null);

  const inputRefs      = useRef<(HTMLInputElement | null)[]>([]);
  const shownValuesRef = useRef(shownValues);
  shownValuesRef.current = shownValues;
  const prevLabelTextsRef = useRef<string[]>(Array(BASE_CELLS).fill(''));

  useEffect(() => {
    if (!dropdown) return;
    const onDown = (e: globalThis.MouseEvent) => {
      if (!(e.target as Element).closest('#cmd-dropdown')) setDropdown(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [dropdown]);

  useEffect(() => {
    prevLabelTextsRef.current = Array.from({ length: BASE_CELLS }, (_, i) => {
      const fd = section === 0 ? def?.fields[i] : undefined;
      return fd ? toTitleCase(fd.label) : '';
    });
  });

  useEffect(() => {
    const isDifferent = byteValues.some((v, i) => v !== (allBytes[i] ?? ''));
    if (!isDifferent && section === 0) return;
    const newShown = [...byteValues];
    animate(newShown, shownValuesRef.current);
    setAllBytes([...byteValues]);
    setSection(0);
    setLabelKey((k) => k + 1);
    setTypeKeys(Array(BASE_CELLS).fill(0));
  }, [byteValues]); // eslint-disable-line react-hooks/exhaustive-deps

  function getCellValue(i: number): string { return allBytes[section * BASE_CELLS + i] ?? ''; }

  function setCellValue(i: number, v: string) {
    setAllBytes((prev) => {
      const next = [...prev];
      const idx = section * BASE_CELLS + i;
      while (next.length <= idx) next.push('');
      next[idx] = v;
      return next;
    });
  }

  function animate(newShown: string[], oldShown: string[]) {
    const hasOld = oldShown.some((v) => v !== '');
    if (!hasOld) {
      setShownValues(newShown);
      setSpanPhase('enter');
      setPhaseKey((k) => k + 1);
      setTimeout(() => setSpanPhase('idle'), 350);
      return;
    }
    setSpanPhase('exit');
    setPhaseKey((k) => k + 1);
    const exitTotal = EXIT_MS + STAGGER_MS * (BASE_CELLS - 1);
    setTimeout(() => {
      setShownValues(newShown);
      setSpanPhase('enter');
      setPhaseKey((k) => k + 1);
      setTimeout(() => setSpanPhase('idle'), 350);
    }, exitTotal);
  }

  function goBack() {
    if (section === 0) return;
    const newSec = section - 1;
    const newShown = Array.from({ length: BASE_CELLS }, (_, i) => allBytes[newSec * BASE_CELLS + i] ?? '');
    animate(newShown, shownValuesRef.current);
    setSection(newSec);
    setLabelKey((k) => k + 1);
    setTypeKeys(Array(BASE_CELLS).fill(0));
  }

  function goForward() {
    const newSec = section + 1;
    const newShown = Array.from({ length: BASE_CELLS }, (_, i) => allBytes[newSec * BASE_CELLS + i] ?? '');
    animate(newShown, shownValuesRef.current);
    setSection(newSec);
    setLabelKey((k) => k + 1);
    setTypeKeys(Array(BASE_CELLS).fill(0));
  }

  function openDropdown(cellIdx: number, options: FieldOption[], e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    const input = inputRefs.current[cellIdx];
    if (!input) return;
    const rect = input.getBoundingClientRect();
    const width = Math.max(rect.width, 130);
    let x = rect.left;
    if (x + width > window.innerWidth - 8) x = Math.max(8, window.innerWidth - width - 8);
    setDropdown({ cellIdx, options, x, y: rect.bottom + 3, width });
  }

  async function handleSend() {
    if (def?.directAction === 'connect') { await api.connect().catch(() => {}); return; }
    if (def?.directAction === 'disconnect') { await api.disconnect().catch(() => {}); return; }
    let lastNonEmpty = -1;
    for (let i = allBytes.length - 1; i >= 0; i--) {
      if (allBytes[i]?.trim()) { lastNonEmpty = i; break; }
    }
    if (lastNonEmpty < 0) return;
    const bytes: number[] = [];
    for (let i = 0; i <= lastNonEmpty; i++) {
      const v = allBytes[i]?.trim();
      const n = v ? parseInt(v, 16) : 0;
      bytes.push(isNaN(n) ? 0 : n & 0xff);
    }
    if (def?.isUserCmd && def.userCmdName) {
      await api.userCmd(def.userCmdName, bytes[1] ?? 0, bytes.slice(2))
        .catch((e: Error) => showToast(e.message, 'error'));
    } else {
      await api.raw(bytes).catch((e: Error) => showToast(e.message, 'error'));
    }
  }

  function handleAddToSequence() {
    const seq = sequences.find((s) => s.id === activeSequenceId);
    if (!seq) return;
    const stepBytes = Array.from({ length: BASE_CELLS }, (_, i) => allBytes[i]?.trim() ?? '');
    const cmdKey = activeCmd ?? (CMD_DEFS[stepBytes[0]?.toLowerCase()] ? stepBytes[0].toLowerCase() : 'raw');
    const newStep: SeqStep = {
      id: crypto.randomUUID(), cmdKey, bytes: stepBytes, resp: 'either',
    };
    updateSequence({ ...seq, steps: [...seq.steps, newStep] });
  }

  function handleRemoveFromSequence() {
    const seq = sequences.find((s) => s.id === activeSequenceId);
    if (!seq || !seqSelectedStepId) return;
    updateSequence({ ...seq, steps: seq.steps.filter((s) => s.id !== seqSelectedStepId) });
    setSeqSelectedStepId(null);
  }

  const startByte = section * BASE_CELLS;
  const endByte   = startByte + BASE_CELLS - 1;
  const cmdLabel  = !activeCmd
    ? 'Command Bar'
    : (def?.userCmdName?.toUpperCase() ?? activeCmd.replace(/-/g, ' ').toUpperCase());

  return (
    <div
      className="xcb-glass shrink-0"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      {/* ── Title row ───────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-3.5 cursor-pointer"
        style={{ height: 34, borderBottom: collapsed ? 'none' : '1px solid var(--border)' }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <span
            className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.07em] uppercase"
            style={{ color: 'var(--text-secondary)' }}
          >
            <span style={{ color: 'var(--text-muted)' }}>⌘</span>
            {cmdLabel}
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={section === 0}
              onClick={(e) => { e.stopPropagation(); goBack(); }}
              className="w-[18px] h-5 flex items-center justify-center rounded text-[12px] border transition-colors"
              style={{
                borderColor: section === 0 ? 'var(--border)' : 'var(--border-strong)',
                color: section === 0 ? 'var(--text-muted)' : 'var(--text-secondary)',
                opacity: section === 0 ? 0.3 : 1,
                background: 'none',
                cursor: section === 0 ? 'not-allowed' : 'pointer',
              }}
            >‹</button>
            <span
              key={`sec-${labelKey}`}
              className="text-[10px] font-mono label-fade text-center"
              style={{ color: 'var(--text-muted)', minWidth: 56 }}
            >Bytes {startByte}–{endByte}</span>
            <button
              onClick={(e) => { e.stopPropagation(); goForward(); }}
              className="w-[18px] h-5 flex items-center justify-center rounded text-[12px] border transition-colors"
              style={{
                borderColor: 'var(--border-strong)',
                color: 'var(--text-secondary)',
                background: 'none',
                cursor: 'pointer',
              }}
            >›</button>
          </div>
        </div>

        <div className="flex-1" />

        <CaretUp
          size={12}
          style={{
            color: 'var(--text-muted)',
            flexShrink: 0,
            transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 150ms ease',
          }}
        />
      </div>

      {/* ── Collapsible body ────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateRows: collapsed ? '0fr' : '1fr',
          transition: collapsed ? 'none' : 'grid-template-rows 180ms ease',
        }}
      >
        <div style={{ overflow: 'hidden' }}>

          {/* Cells */}
          <div className="flex items-end gap-1.5 px-3.5 pt-2 pb-2">
            {Array.from({ length: BASE_CELLS }, (_, i) => {
              const absIdx    = startByte + i;
              const fieldDef  = section === 0 ? def?.fields[i] : undefined;
              const isLocked  = !!def && section === 0 && (i === 0 || (i === 1 && !!def.isUserCmd));
              const cellValue = getCellValue(i);
              const cellShown = shownValues[i] ?? '';
              const prevLbl   = prevLabelTextsRef.current[i] ?? '';
              const currLbl   = fieldDef ? toTitleCase(fieldDef.label) : '';
              const lblCls    = prevLbl === '' && currLbl !== '' ? 'label-enter' : 'label-fade';
              const spanCls   =
                spanPhase === 'exit'  ? 'count-exit' :
                spanPhase === 'enter' ? 'count-tick'  :
                typeKeys[i] > 0       ? 'type-fade'   : '';
              const spanStyle =
                spanPhase !== 'idle' ? { animationDelay: `${i * STAGGER_MS}ms` } : undefined;

              return (
                <div key={i} className="flex-1 flex flex-col min-w-0">
                  <div className="flex items-baseline justify-between mb-1 h-4 overflow-hidden pr-0.5">
                    <div className="flex items-baseline gap-2 min-w-0 overflow-hidden">
                      <span
                        key={`idx-${labelKey}-${i}`}
                        className="text-[9px] font-mono shrink-0 label-fade"
                        style={{ color: 'var(--text-muted)' }}
                      >{absIdx}</span>
                      <span
                        key={`lbl-${labelKey}-${i}`}
                        className={`text-[10px] truncate ${lblCls}`}
                        style={{ color: fieldDef ? 'var(--text-secondary)' : 'var(--text-muted)' }}
                      >{fieldDef ? toTitleCase(fieldDef.label) : ''}</span>
                    </div>
                    {fieldDef && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        {fieldDef.options && (
                          <button
                            className="text-[10px] px-0.5 leading-none transition-colors"
                            style={{ color: 'var(--text-muted)' }}
                            onClick={(e) => openDropdown(i, fieldDef.options!, e)}
                            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--accent)')}
                            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
                          >▾</button>
                        )}
                        <button
                          className="text-[10px] px-0.5 leading-none transition-colors"
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={(e) => showTip(e.currentTarget, fieldDef.tip)}
                          onMouseLeave={hideTip}
                        >ℹ</button>
                      </div>
                    )}
                  </div>

                  <div
                    className="relative group rounded"
                    style={{
                      border: '1px solid var(--border)',
                      background: isLocked ? 'var(--surface-overlay)' : 'var(--surface-base)',
                    }}
                  >
                    <input
                      ref={(el) => { inputRefs.current[i] = el; }}
                      maxLength={2}
                      value={cellValue}
                      disabled={isLocked}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        if (isLocked) return;
                        const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').toUpperCase().slice(0, 2);
                        setCellValue(i, v);
                        if (section === 0) setByteValue(i, v);
                        setShownValues((prev) => { const n = [...prev]; n[i] = v; return n; });
                        setTypeKeys((prev) => { const n = [...prev]; n[i]++; return n; });
                      }}
                      className="w-full px-1 py-1.5 rounded text-xs font-mono text-center focus:outline-none bg-transparent border-0"
                      style={{ color: 'transparent', caretColor: isLocked ? 'transparent' : 'var(--text-secondary)' }}
                    />
                    <span
                      key={`${spanPhase}-${phaseKey}-${typeKeys[i]}-${i}`}
                      className={`absolute inset-0 flex items-center justify-center text-xs font-mono pointer-events-none ${spanCls}`}
                      style={{
                        color: isLocked ? 'var(--text-muted)' : cellShown ? 'var(--text-primary)' : 'var(--text-muted)',
                        ...spanStyle,
                      }}
                    >{cellShown || '00'}</span>
                    <button
                      className="absolute top-0.5 right-0.5 w-[13px] h-[13px] text-[8px] flex items-center justify-center rounded cursor-pointer z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: 'var(--surface-overlay)', color: 'var(--text-muted)' }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--status-err)')}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
                      onClick={() => {
                        if (isLocked) {
                          setActiveCmd(null);
                        } else {
                          setCellValue(i, '');
                          if (section === 0) setByteValue(i, '');
                          setShownValues((prev) => { const n = [...prev]; n[i] = ''; return n; });
                          inputRefs.current[i]?.focus();
                        }
                      }}
                    >✕</button>
                  </div>
                </div>
              );
            })}

            {activeMainTab !== 'sequence' && (
              <Button
                variant="primary"
                className="!text-[11px] !py-1 !px-2.5 shrink-0"
                onClick={() => {
                  setSendFlying(true);
                  setTimeout(() => setSendFlying(false), 550);
                  handleSend();
                }}
              >
                <span className={sendFlying ? 'icon-send-cycle' : ''}>
                  <PaperPlaneTilt size={14} />
                </span>
                Send
              </Button>
            )}
          </div>

          {/* Action row — sequence mode only */}
          {activeMainTab === 'sequence' && (
            <div className="px-3.5 pb-2">
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  className="flex-1 justify-center"
                  disabled={!activeSequenceId}
                  onClick={handleAddToSequence}
                >+ Add to Sequence</Button>
                <Button
                  disabled={!seqSelectedStepId}
                  onClick={handleRemoveFromSequence}
                >Remove</Button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Byte dropdown portal */}
      {dropdown && createPortal(
        <div
          id="cmd-dropdown"
          className="fixed rounded-md shadow-2xl z-[9999] py-0.5"
          style={{
            top: dropdown.y, left: dropdown.x, minWidth: dropdown.width,
            background: 'var(--surface-overlay)',
            border: '1px solid var(--border-strong)',
          }}
        >
          {dropdown.options.map((opt) => (
            <div
              key={opt.val}
              className="px-2.5 py-1 text-xs font-mono cursor-pointer flex items-center gap-2 transition-colors"
              style={{ color: 'var(--text-primary)' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
              onClick={() => {
                const i = dropdown.cellIdx;
                setCellValue(i, opt.val);
                if (section === 0) setByteValue(i, opt.val);
                setShownValues((prev) => { const n = [...prev]; n[i] = opt.val; return n; });
                setDropdown(null);
              }}
            >
              <span style={{ color: 'var(--accent)' }}>{opt.val}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{opt.label}</span>
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
