import { useState, useEffect } from 'react';
import { useAppStore } from '../stores/app-store';
import { api } from '../lib/api';
import type { A2lVariable } from '../lib/types';

function resolveAddr(input: string, a2lVars: A2lVariable[]): number | null {
  const t = input.trim();
  if (/^(?:0x)?[0-9a-fA-F]+$/i.test(t)) {
    const n = parseInt(t.replace(/^0x/i, ''), 16);
    return isNaN(n) ? null : n;
  }
  const v = a2lVars.find((v) => v.name === t);
  return v ? v.addr : null;
}

export function MtaBar() {
  const a2lVars   = useAppStore((s) => s.a2lVariables);
  const showToast = useAppStore((s) => s.showToast);
  const showAlert = useAppStore((s) => s.showAlert);

  const [mta, setMta]         = useState('');
  const [size, setSize]       = useState(8);
  const [autoMta, setAutoMta] = useState(true);
  const [suggestions, setSuggestions] = useState<A2lVariable[]>([]);
  const [suggOpen, setSuggOpen]       = useState(false);

  useEffect(() => {
    const t = mta.trim();
    if (!t || /^0x/i.test(t) || a2lVars.length === 0) { setSuggestions([]); return; }
    const q = t.toLowerCase();
    setSuggestions(a2lVars.filter((v) => v.name.toLowerCase().includes(q)).slice(0, 6));
    setSuggOpen(true);
  }, [mta, a2lVars]);

  function selectSuggestion(v: A2lVariable) {
    setMta(`0x${v.addr.toString(16).padStart(8, '0').toUpperCase()}`);
    setSuggestions([]);
    setSuggOpen(false);
  }

  function resolveOrWarn(input: string): number | null {
    const t = input.trim();
    const isHex = /^(?:0x)?[0-9a-fA-F]+$/i.test(t);
    if (!isHex && a2lVars.length === 0) {
      showAlert('No A2L file loaded.\n\nLoad an A2L JSON file first to resolve variable names.');
      return null;
    }
    const addr = resolveAddr(t, a2lVars);
    if (addr === null) { showToast('Invalid address or unknown variable', 'error'); }
    return addr;
  }

  async function handleSetMta() {
    const addr = resolveOrWarn(mta);
    if (addr === null) return;
    await api.setMta(0, addr).catch((e: Error) => showToast(e.message, 'error'));
  }

  async function handleUpload() {
    const addr = resolveOrWarn(mta);
    if (addr === null) return;
    try {
      if (autoMta) await api.setMta(0, addr);
      await api.upload(size);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Upload failed', 'error');
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 h-10 border-b border-gray-800 bg-gray-900 shrink-0">
      {/* MTA input */}
      <div className="flex items-center gap-2">
        <label className="text-[10px] text-gray-500 shrink-0">MTA</label>
        <div className="relative">
          <input
            value={mta}
            onChange={(e) => setMta(e.target.value)}
            onFocus={() => suggestions.length > 0 && setSuggOpen(true)}
            onBlur={() => setTimeout(() => setSuggOpen(false), 120)}
            placeholder="0x... or VarName"
            className="w-40 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs font-mono text-gray-200 focus:outline-none focus:border-blue-500"
          />
          {suggOpen && suggestions.length > 0 && (
            <div className="absolute z-[9998] left-0 top-full mt-0.5 w-60 bg-gray-800 border border-gray-700 rounded shadow-xl max-h-40 overflow-y-auto">
              {suggestions.map((v) => (
                <div
                  key={v.name}
                  className="flex items-center justify-between px-2 py-1 hover:bg-gray-700 cursor-pointer transition-colors"
                  onMouseDown={(e) => { e.preventDefault(); selectSuggestion(v); }}
                >
                  <span className="text-xs text-gray-200 truncate">{v.name}</span>
                  <span className="text-[10px] text-gray-500 font-mono ml-2 shrink-0">
                    0x{v.addr.toString(16).toUpperCase().padStart(8, '0')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={handleSetMta}
        className="px-2.5 py-1 rounded text-xs font-medium bg-purple-600/15 text-purple-400 border border-purple-500/30 hover:bg-purple-600/25 transition-colors active:scale-95"
      >
        Set MTA
      </button>

      <div className="w-px h-4 bg-gray-800" />

      {/* Size */}
      <div className="flex items-center gap-2">
        <label className="text-[10px] text-gray-500 shrink-0">SIZE</label>
        <input
          type="number"
          min={1}
          value={size}
          onChange={(e) => setSize(Math.max(1, Number(e.target.value)))}
          className="no-spinner w-10 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs font-mono text-gray-200 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Upload / Download */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={handleUpload}
          className="px-3 py-1 rounded text-xs font-medium bg-green-600/15 text-green-400 border border-green-500/30 hover:bg-green-600/25 transition-colors active:scale-95"
        >
          Upload
        </button>
        <button
          disabled
          title="Download (write to slave) — not yet implemented"
          className="px-3 py-1 rounded text-xs font-medium bg-orange-600/15 text-orange-400 border border-orange-500/30 opacity-40 cursor-not-allowed"
        >
          Download
        </button>
      </div>

      {/* Auto SET_MTA toggle */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <div
          className={`w-7 h-3.5 rounded-full relative transition-colors ${autoMta ? 'bg-blue-600' : 'bg-gray-700'}`}
          onClick={() => setAutoMta(!autoMta)}
        >
          <div className={`w-2.5 h-2.5 bg-white rounded-full absolute top-0.5 transition-transform ${autoMta ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </div>
        <span className={`text-[10px] ${autoMta ? 'text-gray-400' : 'text-gray-600'}`}>
          Auto SET_MTA
        </span>
      </label>
    </div>
  );
}
