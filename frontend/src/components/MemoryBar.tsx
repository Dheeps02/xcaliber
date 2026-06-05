import { useState, useEffect, useRef } from 'react';
import { MapPin, ArrowLineUp, ArrowLineDown, Info, CornersIn, CornersOut } from '@phosphor-icons/react';
import { useAppStore } from '../stores/app-store';
import { useTooltip } from '../context/TooltipContext';
import { api } from '../lib/api';
import type { A2lVariable } from '../lib/types';
import { Button } from './ui/Button';
import { useRotatingPreview } from '../hooks/useRotatingPreview';

// ── helpers ───────────────────────────────────────────────────────────────────

function resolveAddr(input: string, a2lVars: A2lVariable[]): number | null {
  const t = input.trim();
  if (/^(?:0x)?[0-9a-fA-F]+$/i.test(t)) {
    const n = parseInt(t.replace(/^0x/i, ''), 16);
    return isNaN(n) ? null : n;
  }
  const v = a2lVars.find((v) => v.name === t);
  return v ? v.addr : null;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-[9px] font-semibold uppercase tracking-widest leading-none"
      style={{ color: 'var(--text-muted)' }}
    >
      {children}
    </span>
  );
}

// ── MemoryBar ─────────────────────────────────────────────────────────────────

export function MemoryBar() {
  const connected        = useAppStore((s) => s.connected);
  const showToast        = useAppStore((s) => s.showToast);
  const a2lVars          = useAppStore((s) => s.a2lVariables);
  const collapsed        = useAppStore((s) => s.memBarCollapsed);
  const setCollapsed     = useAppStore((s) => s.setMemBarCollapsed);

  const { showTip, hideTip } = useTooltip();

  // ── state ─────────────────────────────────────────────────────────────────
  const [mta, setMta]                   = useState('');
  const [size, setSize]                 = useState(8);
  const [autoMta, setAutoMta]           = useState(true);
  const [suggestions, setSuggestions]   = useState<A2lVariable[]>([]);
  const [suggOpen, setSuggOpen]         = useState(false);
  const [downloadData, setDownloadData] = useState('');
  const [dataAnimKey, setDataAnimKey]   = useState(0);
  const [dataAnimCls, setDataAnimCls]   = useState('');
  const [dataError, setDataError]       = useState(false);

  const [expandKey, setExpandKey]             = useState(0);
  const prevCollapsedRef                      = useRef(collapsed);

  const [mtaPinning, setMtaPinning]           = useState(false);
  const [mtaJiggling, setMtaJiggling]         = useState(false);
  const [uploadFlying, setUploadFlying]       = useState(false);
  const [uploadJiggling, setUploadJiggling]   = useState(false);
  const [downloadFlying, setDownloadFlying]   = useState(false);
  const [downloadJiggling, setDownloadJiggling] = useState(false);

  // ── rotating previews — single shared epoch keeps both fields in sync ────
  const [previewEpoch, setPreviewEpoch] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPreviewEpoch((e) => e + 1), 3400);
    return () => clearInterval(id);
  }, []);

  const mtaPreview  = useRotatingPreview(['0x20003A40', 'VarName', '0x00000000'], { epoch: previewEpoch });
  const dataPreview = useRotatingPreview(['FF 01 A3', '0xFF', '255', '01 02 03'], { epoch: previewEpoch });
  const [mtaAnimKey, setMtaAnimKey]     = useState(0);
  const prevMtaPreview  = useRef(mtaPreview);
  const prevDataPreview = useRef(dataPreview);

  useEffect(() => {
    if (mta || mtaPreview === prevMtaPreview.current) return;
    prevMtaPreview.current = mtaPreview;
    setMtaAnimKey((k) => k + 1);
  }, [mtaPreview, mta]);

  useEffect(() => {
    if (downloadData.trim().length > 0 || dataPreview === prevDataPreview.current) return;
    prevDataPreview.current = dataPreview;
    setDataAnimCls('preview-fade');
    setDataAnimKey((k) => k + 1);
  }, [dataPreview, downloadData]);

  useEffect(() => {
    if (prevCollapsedRef.current && !collapsed) setExpandKey((k) => k + 1);
    prevCollapsedRef.current = collapsed;
  }, [collapsed]);

  // ── A2L suggestions ───────────────────────────────────────────────────────
  useEffect(() => {
    const t = mta.trim();
    if (!t || /^0x/i.test(t) || a2lVars.length === 0) { setSuggestions([]); return; }
    setSuggestions(a2lVars.filter((v) => v.name.toLowerCase().includes(t.toLowerCase())).slice(0, 6));
    setSuggOpen(true);
  }, [mta, a2lVars]);

  // ── handlers ─────────────────────────────────────────────────────────────
  function jiggle(set: (v: boolean) => void) {
    set(true); setTimeout(() => set(false), 380);
  }

  function resolveOrWarn(input: string): number | null {
    const t = input.trim();
    if (!t) { showToast('Enter an address or variable name first', 'info'); return null; }
    const isHex = /^(?:0x)?[0-9a-fA-F]+$/i.test(t);
    if (!isHex && a2lVars.length === 0) {
      showToast('No A2L file loaded — load one to resolve variable names', 'error');
      return null;
    }
    const addr = resolveAddr(t, a2lVars);
    if (addr === null) showToast(isHex ? 'Invalid hex address' : 'Unknown variable name', 'error');
    return addr;
  }

  async function handleSetMta() {
    if (!connected) { showToast('Not connected to slave', 'error'); jiggle(setMtaJiggling); return; }
    const addr = resolveOrWarn(mta);
    if (addr === null) { jiggle(setMtaJiggling); return; }
    setMtaPinning(true);
    setTimeout(() => setMtaPinning(false), 300);
    await api.setMta(0, addr).catch((e: Error) => showToast(e.message, 'error'));
  }

  async function handleUpload() {
    if (!connected) { showToast('Not connected to slave', 'error'); jiggle(setUploadJiggling); return; }
    const addr = resolveOrWarn(mta);
    if (addr === null) { jiggle(setUploadJiggling); return; }
    setUploadFlying(true);
    setTimeout(() => setUploadFlying(false), 500);
    try {
      if (autoMta) await api.setMta(0, addr);
      const result = await api.upload(size);
      const resp = result.response as { Upload?: { data: number[] } } | null;
      const bytes = resp?.Upload?.data ?? [];
      if (bytes.length > 0) {
        const hex = bytes.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
        setDownloadData(hex);
        setDataAnimCls('count-tick');
        setDataAnimKey((k) => k + 1);
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Upload failed', 'error');
    }
  }

  async function handleDownload() {
    if (!connected) { showToast('Not connected to slave', 'error'); jiggle(setDownloadJiggling); return; }
    const addr = resolveOrWarn(mta);
    if (addr === null) { jiggle(setDownloadJiggling); return; }
    const tokens = downloadData.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      showToast('Enter bytes to write (e.g. FF 01 A3)', 'info');
      setDataError(true);
      setTimeout(() => setDataError(false), 600);
      jiggle(setDownloadJiggling);
      return;
    }
    if (autoMta) {
      try { await api.setMta(0, addr); }
      catch (e) {
        showToast(`SET_MTA failed: ${e instanceof Error ? e.message : 'unknown error'}`, 'error');
        jiggle(setDownloadJiggling);
        return;
      }
    }
    setDownloadFlying(true);
    setTimeout(() => setDownloadFlying(false), 500);
    try {
      await api.download(tokens);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Download failed', 'error');
    }
  }

  const hasData = downloadData.trim().length > 0;

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
        <span
          className="text-[11px] font-semibold tracking-[0.07em] uppercase"
          style={{ color: 'var(--text-secondary)' }}
          onClick={(e) => e.stopPropagation()}
        >
          Memory
        </span>

        <div className="flex-1" />

        {collapsed
          ? <CornersOut size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          : <CornersIn  size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        }
      </div>

      {/* ── Collapsible body ────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateRows: collapsed ? '0fr' : '1fr',
          transition: 'grid-template-rows 180ms ease',
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          <div className="flex items-end gap-2 px-3.5 py-2">

            {/* Group 1: MTA address + Set MTA */}
            <div
              key={`g0-${expandKey}`}
              className="flex items-end gap-2"
              style={expandKey > 0 ? { animation: 'bar-enter 200ms ease-out 0ms both' } : undefined}
            >
              <div className="flex flex-col gap-1">
                <FieldLabel>MTA Address</FieldLabel>
                <div className="relative">
                  <input
                    value={mta}
                    onChange={(e) => setMta(e.target.value)}
                    onFocus={() => suggestions.length > 0 && setSuggOpen(true)}
                    onBlur={() => setTimeout(() => setSuggOpen(false), 120)}
                    className="xcb-input px-2 py-1 font-mono text-xs focus:outline-none"
                    style={{
                      width: 148,
                      color: 'transparent',
                      caretColor: 'var(--text-secondary)',
                    }}
                    onFocusCapture={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)')}
                    onBlurCapture={(e) => ((e.currentTarget as HTMLElement).style.borderColor = '')}
                  />
                  <span
                    key={mta ? 'val' : mtaAnimKey}
                    className={`absolute inset-0 flex items-center px-2 text-xs font-mono pointer-events-none select-none ${!mta ? 'preview-fade' : ''}`}
                    style={{ color: mta ? 'var(--text-primary)' : 'var(--text-muted)' }}
                  >{mta || mtaPreview}</span>
                  {suggOpen && suggestions.length > 0 && (
                    <div
                      className="xcb-glass absolute z-[9998] left-0 top-full mt-0.5 w-60 rounded shadow-xl max-h-40 overflow-y-auto"
                      style={{ border: '1px solid var(--border-strong)' }}
                    >
                      {suggestions.map((v) => (
                        <div
                          key={v.name}
                          className="flex items-center justify-between px-2 py-1 cursor-pointer transition-colors"
                          style={{ color: 'var(--text-primary)' }}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setMta(`0x${v.addr.toString(16).padStart(8, '0').toUpperCase()}`);
                            setSuggestions([]);
                            setSuggOpen(false);
                          }}
                          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)')}
                          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                        >
                          <span className="text-xs truncate">{v.name}</span>
                          <span className="text-[10px] font-mono ml-2 shrink-0" style={{ color: 'var(--text-muted)' }}>
                            0x{v.addr.toString(16).toUpperCase().padStart(8, '0')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                className={`!text-[11px] !py-1 !px-2 ${mtaJiggling ? 'btn-jiggle' : ''}`}
                disabled={autoMta}
                onClick={handleSetMta}
              >
                <span className={mtaPinning ? 'icon-pin-drop' : ''}>
                  <MapPin size={12} />
                </span>
                Set MTA
              </Button>
            </div>

            <div className="xcb-vdiv" />

            {/* Group 2: Size + Upload */}
            <div
              key={`g1-${expandKey}`}
              className="flex items-end gap-2"
              style={expandKey > 0 ? { animation: 'bar-enter 200ms ease-out 50ms both' } : undefined}
            >
              <div className="flex flex-col gap-1">
                <FieldLabel>Size</FieldLabel>
                <input
                  type="number"
                  min={1}
                  value={size}
                  onChange={(e) => setSize(Math.max(1, Number(e.target.value)))}
                  className="xcb-input no-spinner px-2 py-1 font-mono text-xs text-center focus:outline-none"
                  style={{ width: 48 }}
                  onFocusCapture={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)')}
                  onBlurCapture={(e) => ((e.currentTarget as HTMLElement).style.borderColor = '')}
                />
              </div>
              <Button
                variant="upload"
                className={`!text-[11px] !py-1 !px-2.5 ${uploadJiggling ? 'btn-jiggle' : ''}`}
                onClick={handleUpload}
              >
                <span className={uploadFlying ? 'icon-upload-cycle' : ''}>
                  <ArrowLineUp size={12} />
                </span>
                Upload
              </Button>
            </div>

            <div className="xcb-vdiv" />

            {/* Group 3: Data + Download */}
            <div
              key={`g2-${expandKey}`}
              className="flex items-end gap-2 flex-1 min-w-0"
              style={expandKey > 0 ? { animation: 'bar-enter 200ms ease-out 100ms both' } : undefined}
            >
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                <FieldLabel>Data</FieldLabel>
                <div className="relative">
                  <input
                    value={downloadData}
                    onChange={(e) => {
                      setDownloadData(e.target.value);
                      setDataAnimCls('type-fade');
                      setDataAnimKey((k) => k + 1);
                    }}
                    className="xcb-input w-full px-2 py-1 font-mono text-xs focus:outline-none"
                    style={{
                      border: dataError ? '1px solid var(--status-err)' : undefined,
                      color: 'transparent',
                      caretColor: 'var(--text-secondary)',
                    }}
                    onFocusCapture={(e) => {
                      if (!dataError) (e.currentTarget as HTMLElement).style.borderColor = 'var(--tx)';
                    }}
                    onBlurCapture={(e) => {
                      if (!dataError) (e.currentTarget as HTMLElement).style.borderColor = '';
                    }}
                  />
                  <span
                    key={dataAnimKey}
                    className={`absolute inset-0 flex items-center px-2 text-xs font-mono pointer-events-none select-none ${dataAnimCls}`}
                    style={{ color: hasData ? 'var(--text-primary)' : 'var(--text-muted)' }}
                  >{downloadData || dataPreview}</span>
                </div>
              </div>
              <Button
                variant="download"
                className={`!text-[11px] !py-1 !px-2.5 ${downloadJiggling ? 'btn-jiggle' : ''}`}
                onClick={handleDownload}
              >
                <span className={downloadFlying ? 'icon-download-cycle' : ''}>
                  <ArrowLineDown size={12} />
                </span>
                Download
              </Button>
            </div>

            <div className="xcb-vdiv" />

            {/* Group 4: Auto SET_MTA + Info */}
            <div
              key={`g3-${expandKey}`}
              className="flex items-center gap-1"
              style={expandKey > 0 ? { animation: 'bar-enter 200ms ease-out 150ms both' } : undefined}
            >
              <Button
                variant="ghost"
                on={autoMta}
                className="!text-[11px] !py-1 !px-2.5 !gap-1"
                onClick={() => setAutoMta(!autoMta)}
              >
                Auto SET_MTA
              </Button>
              <Info
                size={12}
                className="shrink-0 cursor-default transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as SVGElement).style.color = 'var(--text-secondary)';
                  showTip(
                    e.currentTarget as unknown as HTMLElement,
                    'When enabled, a SET_MTA is sent automatically before every Upload or Download.'
                  );
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as SVGElement).style.color = 'var(--text-muted)';
                  hideTip();
                }}
              />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
