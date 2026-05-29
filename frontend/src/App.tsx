import { useSSE } from './hooks/useSSE';
import { TooltipProvider } from './context/TooltipContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Sidebar } from './components/Sidebar';
import { MtaBar } from './components/MtaBar';
import { ByteBar } from './components/ByteBar';
import { PacketTrace } from './components/PacketTrace';

function AppInner() {
  useSSE();
  return (
    <div className="bg-gray-950 text-gray-100 h-screen flex flex-col overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          <MtaBar />
          <ByteBar />
          <PacketTrace />
        </main>
      </div>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <TooltipProvider>
      <AppInner />
    </TooltipProvider>
  );
}
