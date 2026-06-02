import { useState, useEffect } from 'react';
import { useAppStore } from '../stores/app-store';
import { api } from '../lib/api';
import type { A2lVariable } from '../lib/types';
import { Info, MapPin, ArrowLineUp, ArrowLineDown } from '@phosphor-icons/react';
import { Toggle } from './Toggle';

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
  const connected = useAppStore((s) => s.connected);

  const [mta, setMta]         = useState('');
  const [size, setSize]       = useState(8);
  const [autoMta, setAutoMta] = useState(true);
  const [suggestions, setSuggestions] = useState<A2lVariable[]>([]);
  const [suggOpen, setSuggOpen]       = useState(false);
  const [mtaPinning, setMtaPinning]             = useState(false);
  const [mtaJiggling, setMtaJiggling]           = useState(false);
  const [uploadFlying, setUploadFlying]         = useState(false);
  const [uploadJiggling, setUploadJiggling]     = useState(false);
  const [downloadFlying, setDownloadFlying]     = useState(false);
  const [downloadJiggling, setDownloadJiggling] = useState(false);
  const [downloadData, setDownloadData]         = useState('');

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
    if (!t) {
      showToast('Enter an address or variable name first', 'info');
      return null;
    }
    const isHex = /^(?:0x)?[0-9a-fA-F]+$/i.test(t);
    if (!isHex && a2lVars.length === 0) {
      showToast('No A2L file loaded — load one to resolve variable names', 'error');
      return null;
    }
    const addr = resolveAddr(t, a2lVars);
    if (addr === null) {
      showToast(isHex ? 'Invalid hex address' : 'Unknown variable name', 'error');
    }
    return addr;
  }

  function jiggle(set: (v: boolean) => void) {
    set(true);
    setTimeout(() => set(false), 380);
  }

  async function handleSetMta() {
    if (!connected) {
      showToast('Not connected to slave', 'error');
      jiggle(setMtaJiggling);
      return;
    }
    const addr = resolveOrWarn(mta);
    if (addr === null) { jiggle(setMtaJiggling); return; }
    setMtaPinning(true);
    setTimeout(() => setMtaPinning(false), 300);
    await api.setMta(0, addr).catch((e: Error) => showToast(e.message, 'error'));
  }

  async function handleDownload() {
    if (!connected) {
      showToast('Not connected to slave', 'error');
      jiggle(setDownloadJiggling);
      return;
    }
    const addr = resolveOrWarn(mta);
    if (addr === null) { jiggle(setDownloadJiggling); return; }

    const bytes = downloadData
      .trim()
      .split(/\s+/)
      .map((b) => parseInt(b, 16))
      .filter((n) => !isNaN(n));

    if (bytes.length === 0) {
      showToast('Enter hex bytes to write (e.g. FF 01 A3)', 'info');
      jiggle(setDownloadJiggling);
      return;
    }

    setDownloadFlying(true);
    setTimeout(() => setDownloadFlying(false), 500);
    try {
      if (autoMta) await api.setMta(0, addr);
      await api.download(bytes);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Download failed', 'error');
    }
  }

  async function handleUpload() {
    if (!connected) {
      showToast('Not connected to slave', 'error');
      jiggle(setUploadJiggling);
      return;
    }
    const addr = resolveOrWarn(mta);
    if (addr === null) { jiggle(setUploadJiggling); return; }

    setUploadFlying(true);
    setTimeout(() => setUploadFlying(false), 500);
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
        disabled={autoMta}
        className={`px-2.5 py-1 rounded text-xs font-medium bg-purple-600/15 text-purple-400 border border-purple-500/30 hover:bg-purple-600/25 transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none ${mtaJiggling ? 'btn-jiggle' : ''}`}
      >
        <span className={mtaPinning ? 'icon-pin-drop' : ''}><MapPin size={14} /></span>Set MTA
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

      {/* Download data */}
      <input
        value={downloadData}
        onChange={(e) => setDownloadData(e.target.value)}
        placeholder="hex bytes to write…"
        className="w-36 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs font-mono text-gray-200 focus:outline-none focus:border-orange-500 placeholder:text-gray-700"
      />

      {/* Upload / Download */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={handleUpload}
          className={`px-3 py-1 rounded text-xs font-medium bg-green-600/15 text-green-400 border border-green-500/30 hover:bg-green-600/25 transition-colors active:scale-95 flex items-center gap-1.5 ${uploadJiggling ? 'btn-jiggle' : ''}`}
        >
          <span className={uploadFlying ? 'icon-upload-cycle' : ''}><ArrowLineUp size={14} /></span>Upload
        </button>
        <button
          onClick={handleDownload}
          className={`px-3 py-1 rounded text-xs font-medium bg-orange-600/15 text-orange-400 border border-orange-500/30 hover:bg-orange-600/25 transition-colors active:scale-95 flex items-center gap-1.5 ${downloadJiggling ? 'btn-jiggle' : ''}`}
        >
          <span className={downloadFlying ? 'icon-download-cycle' : ''}><ArrowLineDown size={14} /></span>Download
        </button>
      </div>

      <div className="flex items-center gap-1">
        <Toggle active={autoMta} onClick={() => setAutoMta(!autoMta)} label="Auto SET_MTA" />
        <div className="relative group">
          <Info size={12} className="text-gray-600 hover:text-gray-400 transition-colors cursor-default shrink-0" />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-gray-800 border border-gray-700 rounded shadow-xl px-2.5 py-2 text-[10px] text-gray-300 leading-relaxed opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-[9999]">
            When enabled, a SET_MTA is sent automatically using the address above before every Upload — no need to click Set MTA manually each time.
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-700" />
          </div>
        </div>
      </div>
    </div>
  );
}
