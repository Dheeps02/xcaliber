import {
  useRef,
  useState,
  useEffect,
  type ChangeEvent,
  type MouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { PaperPlaneTilt } from '@phosphor-icons/react';
import { useAppStore } from '../stores/app-store';
import { useTooltip } from '../context/TooltipContext';
import { CMD_DEFS } from '../lib/cmd-defs';
import { api } from '../lib/api';
import type { FieldOption } from '../lib/types';
import { toTitleCase } from '../lib/utils';

const BASE_CELLS = 8;
const EXIT_MS = 160;
const STAGGER_MS = 28;

interface Dropdown {
  cellIdx: number;
  options: FieldOption[];
  x: number;
  y: number;
  width: number;
}

function NavBtn({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-5 h-[30px] flex items-center justify-center rounded text-[11px] border transition-colors shrink-0 ${
        disabled
          ? 'border-gray-800 text-gray-700 cursor-not-allowed'
          : 'border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600'
      }`}
    >
      {children}
    </button>
  );
}

export function ByteBar() {
  const activeCmd = useAppStore((s) => s.activeCmd);
  const byteValues = useAppStore((s) => s.byteValues);
  const setByteValue = useAppStore((s) => s.setByteValue);
  const setActiveCmd = useAppStore((s) => s.setActiveCmd);
  const customCmdDefs = useAppStore((s) => s.customCmdDefs);
  const userCmdDefs = useAppStore((s) => s.userCmdDefs);
  const collapsed = useAppStore((s) => s.byteBarCollapsed);
  const setCollapsed = useAppStore((s) => s.setByteBarCollapsed);
  const showToast = useAppStore((s) => s.showToast);
  const { showTip, hideTip } = useTooltip();
  const [dropdown, setDropdown] = useState<Dropdown | null>(null);

  const def = activeCmd ? (CMD_DEFS[activeCmd] ?? customCmdDefs[activeCmd] ?? userCmdDefs[activeCmd]) : null;

  // Flat array of ALL bytes across all sections; local state only
  const [allBytes, setAllBytes] = useState<string[]>(() => [...byteValues]);
  const [section, setSection] = useState(0);

  // labelKey increments on section or cmd change → triggers label fade animation
  const [labelKey, setLabelKey] = useState(0);

  // Animation state for value overlays
  const [shownValues, setShownValues] = useState<string[]>(() => [...byteValues]);
  const [spanPhase, setSpanPhase] = useState<'idle' | 'exit' | 'enter'>('idle');
  const [phaseKey, setPhaseKey] = useState(0);
  const [typeKeys, setTypeKeys] = useState<number[]>(Array(BASE_CELLS).fill(0));
  const [sendFlying, setSendFlying] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  // Always-fresh reference to shownValues, avoids stale closure in useEffect
  const shownValuesRef = useRef(shownValues);
  shownValuesRef.current = shownValues;
  // Tracks label texts from the previous render so we know whether a label is newly appearing
  const prevLabelTextsRef = useRef<string[]>(Array(BASE_CELLS).fill(''));

  useEffect(() => {
    if (!dropdown) return;
    function onDown(e: globalThis.MouseEvent) {
      if (!(e.target as Element).closest('#byte-dropdown')) setDropdown(null);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [dropdown]);

  // After every render, snapshot current label texts so the next render can tell
  // whether a label is newly appearing (prev empty → current non-empty).
  useEffect(() => {
    prevLabelTextsRef.current = Array.from({ length: BASE_CELLS }, (_, i) => {
      const fd = section === 0 ? def?.fields[i] : undefined;
      return fd ? toTitleCase(fd.label) : '';
    });
  });

  // Get/set a cell value within the current section
  function getCellValue(i: number): string {
    return allBytes[section * BASE_CELLS + i] ?? '';
  }

  function setCellValue(i: number, v: string) {
    setAllBytes((prev) => {
      const next = [...prev];
      const idx = section * BASE_CELLS + i;
      while (next.length <= idx) next.push('');
      next[idx] = v;
      return next;
    });
  }

  // Shared animation driver — called for both cmd changes and section navigation
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

  // Detect cmd change: store's byteValues changed → new cmd selected
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

  function goBack() {
    if (section === 0) return;
    const newSec = section - 1;
    const newShown = Array.from(
      { length: BASE_CELLS },
      (_, i) => allBytes[newSec * BASE_CELLS + i] ?? ''
    );
    animate(newShown, shownValuesRef.current);
    setSection(newSec);
    setLabelKey((k) => k + 1);
    setTypeKeys(Array(BASE_CELLS).fill(0));
  }

  function goForward() {
    const newSec = section + 1;
    const newShown = Array.from(
      { length: BASE_CELLS },
      (_, i) => allBytes[newSec * BASE_CELLS + i] ?? ''
    );
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
    if (def?.directAction === 'connect') {
      await api.connect().catch(() => {});
      return;
    }
    if (def?.directAction === 'disconnect') {
      await api.disconnect().catch(() => {});
      return;
    }

    // Find the last non-empty byte across all sections
    let lastNonEmpty = -1;
    for (let i = allBytes.length - 1; i >= 0; i--) {
      if (allBytes[i]?.trim()) { lastNonEmpty = i; break; }
    }
    if (lastNonEmpty < 0) return;

    // Build payload: bytes 0..lastNonEmpty, empties become 0x00
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
      await api.raw(bytes)
        .catch((e: Error) => showToast(e.message, 'error'));
    }
  }

  const startByte = section * BASE_CELLS;
  const endByte = startByte + BASE_CELLS - 1;

  const cmdLabel = !activeCmd
    ? 'Command Bar'
    : (def?.userCmdName?.toUpperCase() ?? activeCmd.replace(/-/g, ' ').toUpperCase());

  return (
    <div className="border-b border-gray-800 bg-gray-900 shrink-0">
      {/* Command name header — click anywhere to collapse/expand */}
      <div
        className="flex items-center justify-between px-4 h-8 cursor-pointer select-none hover:bg-gray-800/20 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <span className="text-[11px] font-semibold tracking-widest text-gray-500 uppercase">
          {cmdLabel}
        </span>
        <span className="text-gray-600 hover:text-gray-400 transition-colors text-[11px] leading-none">
          {collapsed ? '▾' : '▴'}
        </span>
      </div>

      {/* Collapsible content — grid trick for smooth height animation */}
      <div
        style={{
          display: 'grid',
          gridTemplateRows: collapsed ? '0fr' : '1fr',
          transition: collapsed ? 'none' : 'grid-template-rows 180ms ease',
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          <div className="px-4 pb-2">
      {/* Section indicator row */}
      <div className="flex items-center justify-center gap-1.5 mb-3">
        <button
          onClick={goBack}
          disabled={section === 0}
          className={`text-[10px] px-1 rounded transition-colors ${
            section === 0
              ? 'text-gray-700 cursor-not-allowed'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          ‹
        </button>
        <span
          key={`sec-label-${labelKey}`}
          className="text-[10px] text-gray-600 font-mono label-fade select-none min-w-[72px] text-center"
        >
          Bytes {startByte}–{endByte}
        </span>
        <button
          onClick={goForward}
          className="text-[10px] px-1 rounded text-gray-500 hover:text-gray-300 transition-colors"
        >
          ›
        </button>
      </div>

      {/* Cells row with flanking nav buttons */}
      <div className="flex items-end gap-1.5">
        <NavBtn onClick={goBack} disabled={section === 0}>‹</NavBtn>

        <div className="flex-1 flex gap-2 min-w-0">
          {Array.from({ length: BASE_CELLS }, (_, i) => {
            const absIdx = startByte + i;
            // Only first section uses prefilled fields from def; higher sections are free-form
            const fieldDef = section === 0 ? def?.fields[i] : undefined;
            const isLocked = !!def && section === 0 && (i === 0 || (i === 1 && !!def.isUserCmd));

            const cellValue = getCellValue(i);
            const cellShown = shownValues[i] ?? '';

            // Use label-enter (fade-in only) when no label existed before;
            // use label-fade (fade-out + fade-in) when replacing an existing label.
            const prevLabelText = prevLabelTextsRef.current[i] ?? '';
            const currentLabelText = fieldDef ? toTitleCase(fieldDef.label) : '';
            const lblAnimClass = prevLabelText === '' && currentLabelText !== ''
              ? 'label-enter'
              : 'label-fade';

            const spanAnimClass =
              spanPhase === 'exit'  ? 'count-exit' :
              spanPhase === 'enter' ? 'count-tick' :
              typeKeys[i] > 0       ? 'type-fade'  : '';
            const spanAnimStyle =
              spanPhase !== 'idle'
                ? { animationDelay: `${i * STAGGER_MS}ms` }
                : undefined;

            return (
              <div key={i} className="flex-1 flex flex-col min-w-0">
                {/* Label row: absolute byte index + field name */}
                <div className="flex items-baseline justify-between mb-1 h-4 overflow-hidden pr-0.5">
                  <div className="flex items-baseline gap-2 min-w-0 overflow-hidden">
                    <span
                      key={`idx-${labelKey}-${i}`}
                      className="text-[9px] text-gray-600 font-mono shrink-0 label-fade"
                    >
                      {absIdx}
                    </span>
                    <span
                      key={`lbl-${labelKey}-${i}`}
                      className={`text-[10px] truncate ${lblAnimClass} ${
                        fieldDef ? 'text-gray-400' : 'text-gray-700'
                      }`}
                    >
                      {fieldDef ? toTitleCase(fieldDef.label) : ''}
                    </span>
                  </div>
                  {fieldDef && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      {fieldDef.options && (
                        <button
                          className="text-[10px] text-gray-500 hover:text-blue-400 px-0.5 leading-none transition-colors"
                          onClick={(e) => openDropdown(i, fieldDef.options!, e)}
                        >
                          ▾
                        </button>
                      )}
                      <button
                        className="text-[10px] text-gray-600 hover:text-gray-400 px-0.5 leading-none transition-colors"
                        onMouseEnter={(e) => showTip(e.currentTarget, fieldDef.tip)}
                        onMouseLeave={hideTip}
                      >
                        ℹ
                      </button>
                    </div>
                  )}
                </div>

                {/* Input cell */}
                <div
                  className={`relative group rounded border transition-colors ${
                    isLocked
                      ? 'bg-gray-800 border-gray-700'
                      : 'bg-gray-900 border-gray-700 focus-within:border-blue-500'
                  }`}
                >
                  <input
                    ref={(el) => { inputRefs.current[i] = el; }}
                    maxLength={2}
                    value={cellValue}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      if (!isLocked) {
                        const v = e.target.value
                          .replace(/[^0-9a-fA-F]/g, '')
                          .toUpperCase()
                          .slice(0, 2);
                        setCellValue(i, v);
                        // Keep shownValues in sync (typing, not a cmd/section change)
                        if (section === 0) {
                          setByteValue(i, v);
                        }
                        setShownValues((prev) => {
                          const n = [...prev];
                          n[i] = v;
                          return n;
                        });
                        setTypeKeys((prev) => {
                          const n = [...prev];
                          n[i]++;
                          return n;
                        });
                      }
                    }}
                    placeholder=""
                    disabled={isLocked}
                    className={`w-full px-1 py-1.5 rounded text-xs font-mono text-center focus:outline-none bg-transparent border-0 ${
                      isLocked ? 'cursor-not-allowed' : ''
                    }`}
                    style={{
                      color: 'transparent',
                      caretColor: isLocked ? 'transparent' : '#9ca3af',
                    }}
                  />
                  {/* Animated value overlay */}
                  <span
                    key={`${spanPhase}-${phaseKey}-${typeKeys[i]}-${i}`}
                    className={`absolute inset-0 flex items-center justify-center text-xs font-mono pointer-events-none ${
                      isLocked
                        ? 'text-gray-500'
                        : cellShown
                        ? 'text-gray-200'
                        : 'text-gray-600'
                    } ${spanAnimClass}`}
                    style={spanAnimStyle}
                  >
                    {cellShown || '00'}
                  </span>
                  <button
                    className="absolute top-0.5 right-0.5 w-[13px] h-[13px] text-[8px] flex items-center justify-center bg-gray-900/90 text-gray-600 hover:text-red-400 rounded cursor-pointer z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => {
                      if (isLocked) {
                        setActiveCmd(null);
                      } else {
                        setCellValue(i, '');
                        if (section === 0) {
                          setByteValue(i, '');
                        }
                        setShownValues((prev) => {
                          const n = [...prev];
                          n[i] = '';
                          return n;
                        });
                        inputRefs.current[i]?.focus();
                      }
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <NavBtn onClick={goForward}>›</NavBtn>
      </div>

      <button
        onClick={() => { setSendFlying(true); setTimeout(() => setSendFlying(false), 550); handleSend(); }}
        className="w-full mt-2 py-1.5 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center justify-center gap-1.5"
      >
        <span className={sendFlying ? 'icon-send-cycle' : ''}><PaperPlaneTilt size={15} /></span>Send
      </button>

          </div>{/* /px-4 pb-2 */}
        </div>{/* /overflow-hidden */}
      </div>{/* /grid */}

      {dropdown &&
        createPortal(
          <div
            id="byte-dropdown"
            className="fixed bg-gray-800 border border-gray-700 rounded-md shadow-2xl z-[9999] py-0.5"
            style={{ top: dropdown.y, left: dropdown.x, minWidth: dropdown.width }}
          >
            {dropdown.options.map((opt) => (
              <div
                key={opt.val}
                className="px-2.5 py-1 text-xs font-mono hover:bg-gray-700 cursor-pointer flex items-center gap-2 transition-colors"
                onClick={() => {
                  const i = dropdown.cellIdx;
                  setCellValue(i, opt.val);
                  if (section === 0) {
                    setByteValue(i, opt.val);
                  }
                  setShownValues((prev) => {
                    const n = [...prev];
                    n[i] = opt.val;
                    return n;
                  });
                  setDropdown(null);
                }}
              >
                <span className="text-blue-400 shrink-0">{opt.val}</span>
                <span className="text-gray-400">{opt.label}</span>
              </div>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
