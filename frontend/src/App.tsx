import { useEffect, useRef } from 'react';
import { useSSE } from './hooks/useSSE';
import { TooltipProvider } from './context/TooltipContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
import { CommandBar } from './components/CommandBar';
import { MemoryBar } from './components/MemoryBar';
import { PacketTrace } from './components/PacketTrace';
import { Daq } from './components/Daq';
import { Sequence } from './components/Sequence';
import { AlertModal } from './components/AlertModal';
import { useAppStore } from './stores/app-store';

function AppInner() {
  useSSE();
  const theme             = useAppStore((s) => s.theme);
  const uiZoom            = useAppStore((s) => s.uiZoom);
  const animationsEnabled = useAppStore((s) => s.animationsEnabled);
  const accentColor       = useAppStore((s) => s.accentColor);
  const activeMainTab     = useAppStore((s) => s.activeMainTab);

  useEffect(() => {
    const html = document.documentElement;
    if (theme === 'default') {
      html.removeAttribute('data-theme');
    } else {
      html.setAttribute('data-theme', theme);
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.toggle('no-animations', !animationsEnabled);
  }, [animationsEnabled]);

  useEffect(() => {
    const el = document.documentElement;
    if (accentColor) el.style.setProperty('--accent', accentColor);
    else el.style.removeProperty('--accent');
  }, [accentColor]);

  const zoomRef = useRef(uiZoom);
  useEffect(() => {
    const target = uiZoom;
    const from   = zoomRef.current;
    const delta  = target - from;
    if (Math.abs(delta) < 0.001) {
      window.electron?.setZoom(target).catch(() => {});
      return;
    }
    let cancelled = false;
    const duration = 250;
    const start    = performance.now();
    function tick(now: number) {
      if (cancelled) return;
      const t      = Math.min((now - start) / duration, 1);
      const eased  = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const z      = from + delta * eased;
      zoomRef.current = z;
      window.electron?.setZoom(z).catch(() => {});
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    return () => { cancelled = true; };
  }, [uiZoom]);

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ position: 'relative', color: 'var(--text-primary)' }}
    >
      <div className="gradient-bg" aria-hidden="true" />
      <Header />
      <CommandBar />
      <MemoryBar />

      {/* Tab content — all mounted, CSS controls visibility */}
      <div className="flex-1 relative overflow-hidden" style={{ background: 'var(--surface-base)' }}>
        <div className={`tab-panel ${activeMainTab === 'trace'    ? 'tab-panel-active' : 'tab-panel-inactive'}`}>
          <PacketTrace />
        </div>
        <div className={`tab-panel ${activeMainTab === 'daq'      ? 'tab-panel-active' : 'tab-panel-inactive'}`}>
          <Daq />
        </div>
        <div className={`tab-panel ${activeMainTab === 'sequence' ? 'tab-panel-active' : 'tab-panel-inactive'}`}>
          <Sequence />
        </div>
      </div>

      <AlertModal />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <TooltipProvider>
        <AppInner />
      </TooltipProvider>
    </ErrorBoundary>
  );
}
