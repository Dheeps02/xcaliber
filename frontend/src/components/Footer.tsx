import { useAppStore } from '../stores/app-store';
import { AnimatedCount } from './AnimatedCount';

export function Footer() {
  const slaveInfo    = useAppStore((s) => s.slaveInfo);
  const config       = useAppStore((s) => s.config);
  const packets      = useAppStore((s) => s.packets);
  const openSettings = useAppStore((s) => s.openSettings);

  const protocol = config?.connection.protocol.toUpperCase() ?? null;
  return (
    <footer className="flex items-center justify-between px-4 h-6 border-t border-gray-800 bg-gray-900 shrink-0 text-[10px] text-gray-600">
      {/* Left: protocol pill + address */}
      <div className="flex items-center gap-2">
        <span className="text-gray-600">Protocol:</span>
        {protocol ? (
          <button
            onClick={() => openSettings('connection')}
            title="Open connection settings"
            className="px-1.5 py-0.5 rounded border border-gray-700 bg-gray-800 text-gray-400 hover:text-blue-400 hover:border-blue-500/40 transition-colors font-mono text-[9px] font-semibold leading-none"
          >
            {protocol}
          </button>
        ) : (
          <span className="text-gray-700">—</span>
        )}
      </div>

      {/* Centre: packet count */}
      <span className="font-mono text-gray-600">
        <AnimatedCount value={packets.length} colorCls="text-gray-600" /> packets
      </span>

      {/* Right: slave CTO / DTO */}
      {slaveInfo ? (
        <span className="font-mono text-gray-500">
          CTO&nbsp;{slaveInfo.max_cto}B · DTO&nbsp;{slaveInfo.max_dto}B
        </span>
      ) : (
        <span className="font-mono text-gray-700">not connected</span>
      )}
    </footer>
  );
}
