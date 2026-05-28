import {
  useRef,
  useState,
  useEffect,
  type ChangeEvent,
  type MouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../stores/app-store';
import { useTooltip } from '../context/TooltipContext';
import { CMD_DEFS } from '../lib/cmd-defs';
import { api } from '../lib/api';
import type { FieldOption } from '../lib/types';
import { toTitleCase } from '../lib/utils';

const NUM_CELLS = 8;

interface Dropdown {
  cellIdx: number;
  options: FieldOption[];
  x: number;
  y: number;
  width: number;
}

export function ByteBar() {
  const activeCmd = useAppStore((s) => s.activeCmd);
  const byteValues = useAppStore((s) => s.byteValues);
  const setByteValue = useAppStore((s) => s.setByteValue);
  const setActiveCmd = useAppStore((s) => s.setActiveCmd);
  const { showTip, hideTip } = useTooltip();
  const [dropdown, setDropdown] = useState<Dropdown | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const def = activeCmd ? CMD_DEFS[activeCmd] : null;

  useEffect(() => {
    if (!dropdown) return;
    function onDown(e: globalThis.MouseEvent) {
      if (!(e.target as Element).closest('#byte-dropdown')) setDropdown(null);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [dropdown]);

  function openDropdown(
    cellIdx: number,
    options: FieldOption[],
    e: MouseEvent<HTMLButtonElement>
  ) {
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
    const bytes: number[] = [];
    for (let i = 0; i < NUM_CELLS; i++) {
      const v = byteValues[i].trim();
      if (v) {
        const n = parseInt(v, 16);
        if (!isNaN(n)) bytes.push(n & 0xff);
      }
    }
    if (bytes.length === 0) return;
    await api.raw(bytes).catch(() => {});
  }

  return (
    <div className="px-4 pt-2.5 pb-2 border-b border-gray-800 bg-gray-900 shrink-0">
      <div className="flex gap-2 w-full">
        {Array.from({ length: NUM_CELLS }, (_, i) => {
          const field = def?.fields[i];
          const isPid = i === 0 && !!def;

          return (
            <div key={i} className="flex-1 flex flex-col min-w-0">
              {/* Label row */}
              <div className="flex items-center justify-between mb-1 h-4">
                <span
                  className={`text-[10px] truncate ${
                    field ? 'text-gray-400' : 'text-gray-700'
                  }`}
                >
                  {field ? toTitleCase(field.label) : ''}
                </span>
                {field && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    {field.options && (
                      <button
                        className="text-[10px] text-gray-500 hover:text-blue-400 px-0.5 leading-none transition-colors"
                        onClick={(e) => openDropdown(i, field.options!, e)}
                      >
                        ▾
                      </button>
                    )}
                    <button
                      className="text-[10px] text-gray-600 hover:text-gray-400 px-0.5 leading-none transition-colors"
                      onMouseEnter={(e) => showTip(e.currentTarget, field.tip)}
                      onMouseLeave={hideTip}
                    >
                      ℹ
                    </button>
                  </div>
                )}
              </div>

              {/* Input wrapper */}
              <div className="relative group">
                <input
                  ref={(el) => {
                    inputRefs.current[i] = el;
                  }}
                  maxLength={2}
                  value={byteValues[i]}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    if (!isPid)
                      setByteValue(i, e.target.value.toUpperCase().slice(0, 2));
                  }}
                  placeholder="--"
                  disabled={isPid}
                  className={`w-full px-1 py-1.5 rounded text-xs font-mono text-center focus:outline-none transition-colors border ${
                    isPid
                      ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-900 border-gray-700 text-gray-200 focus:border-blue-500'
                  }`}
                />
                <button
                  className="absolute top-0.5 right-0.5 w-[13px] h-[13px] text-[8px] flex items-center justify-center bg-gray-900/90 text-gray-600 hover:text-red-400 rounded cursor-pointer z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => {
                    if (isPid) {
                      setActiveCmd(null);
                    } else {
                      setByteValue(i, '');
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

      <button
        onClick={handleSend}
        className="w-full mt-2 py-1.5 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
      >
        Send
      </button>

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
                  setByteValue(dropdown.cellIdx, opt.val);
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
