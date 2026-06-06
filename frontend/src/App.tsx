import { useEffect } from 'react';
import { useSSE } from './hooks/useSSE';
import { TooltipProvider } from './context/TooltipContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Sidebar } from './components/Sidebar';
import { MtaBar } from './components/MtaBar';
import { ByteBar } from './components/ByteBar';
import { PacketTrace } from './components/PacketTrace';
import { Daq } from './components/Daq';
import { Sequence } from './components/Sequence';
import { AlertModal } from './components/AlertModal';
import { useAppStore } from './stores/app-store';

function AppInner() {
  useSSE();
  const theme = useAppStore((s) => s.theme);
  const uiZoom = useAppStore((s) => s.uiZoom);
  const animationsEnabled = useAppStore((s) => s.animationsEnabled);
  const activeMainTab = useAppStore((s) => s.activeMainTab);
  const setActiveMainTab = useAppStore((s) => s.setActiveMainTab);

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
    window.electron?.setZoom(uiZoom).catch(() => {});
  }, [uiZoom]);

  return (
    <div className="bg-gray-950 text-gray-100 h-screen flex flex-col overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Memory Access bar — visible only in Trace tab */}
          {activeMainTab === 'trace' && <MtaBar />}

          {/* Command Builder — always visible */}
          <ByteBar />

          {/* Main tab strip */}
          <div className="flex items-end gap-0 px-3 pt-1.5 border-b border-gray-800 bg-gray-900 shrink-0" style={{ height: 32 }}>
            <button
              onClick={() => setActiveMainTab('trace')}
              className={`px-3 pb-1 text-xs font-medium transition-colors ${
                activeMainTab === 'trace'
                  ? 'border-b-2 border-blue-500 text-blue-400'
                  : 'border-b-2 border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              Packet Trace
            </button>
            <button
              onClick={() => setActiveMainTab('daq')}
              className={`px-3 pb-1 text-xs font-medium transition-colors ${
                activeMainTab === 'daq'
                  ? 'border-b-2 border-blue-500 text-blue-400'
                  : 'border-b-2 border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              DAQ
            </button>
            <button
              onClick={() => setActiveMainTab('sequence')}
              className={`px-3 pb-1 text-xs font-medium transition-colors ${
                activeMainTab === 'sequence'
                  ? 'border-b-2 border-blue-500 text-blue-400'
                  : 'border-b-2 border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              Sequence
            </button>
          </div>

          {/* Tab content — both always mounted; CSS controls active/inactive */}
          <div className="flex-1 relative overflow-hidden">
            <div className={`tab-panel ${activeMainTab === 'trace' ? 'tab-panel-active' : 'tab-panel-inactive'}`}>
              <PacketTrace />
            </div>
            <div className={`tab-panel ${activeMainTab === 'daq' ? 'tab-panel-active' : 'tab-panel-inactive'}`}>
              <Daq />
            </div>
            <div className={`tab-panel ${activeMainTab === 'sequence' ? 'tab-panel-active' : 'tab-panel-inactive'}`}>
              <Sequence />
            </div>
          </div>
        </main>
      </div>
      <Footer />
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
