import { useAppStore } from '../stores/app-store';

export function Footer() {
  const slaveInfo = useAppStore((s) => s.slaveInfo);
  const config = useAppStore((s) => s.config);
  const packets = useAppStore((s) => s.packets);

  const connStr = config
    ? `${config.connection.server_ip}:${config.connection.server_port} · ${config.connection.protocol.toUpperCase()}`
    : '—';

  return (
    <footer className="flex items-center justify-between px-4 h-6 border-t border-gray-800 bg-gray-900 shrink-0 text-[10px] text-gray-600">
      <span>{connStr}</span>
      <span>{packets.length} packets</span>
      {slaveInfo ? (
        <span className="font-mono text-gray-500">
          max_cto={slaveInfo.max_cto} · max_dto={slaveInfo.max_dto} · proto=
          {slaveInfo.proto_version}
        </span>
      ) : (
        <span className="font-mono">not connected</span>
      )}
    </footer>
  );
}
