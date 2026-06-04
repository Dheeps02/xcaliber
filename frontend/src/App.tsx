import { useEffect } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
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
    getCurrentWebviewWindow().setZoom(uiZoom).catch(() => {});
  }, [uiZoom]);

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: 'var(--surface-base)', color: 'var(--text-primary)' }}
    >
      <Header />
      <CommandBar />
      <MemoryBar />

      {/* Tab content — all mounted, CSS controls visibility */}
      <div className="flex-1 relative overflow-hidden">
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
