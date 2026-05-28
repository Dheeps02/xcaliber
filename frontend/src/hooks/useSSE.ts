import { useEffect, useRef } from 'react';
import { useAppStore } from '../stores/app-store';
import { api } from '../lib/api';
import type { PacketEntry, ConnectResponse } from '../lib/types';

export function useSSE() {
  const addPacket = useAppStore((s) => s.addPacket);
  const prependPackets = useAppStore((s) => s.prependPackets);
  const setConnected = useAppStore((s) => s.setConnected);
  const setConfig = useAppStore((s) => s.setConfig);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    function connect() {
      esRef.current?.close();
      const es = new EventSource('http://localhost:8080/events');
      esRef.current = es;

      es.onmessage = (e: MessageEvent) => {
        const msg = JSON.parse(e.data as string) as {
          event: string;
          data: unknown;
        };
        if (msg.event === 'packet_tx' || msg.event === 'packet_rx') {
          addPacket(msg.data as PacketEntry);
        } else if (msg.event === 'state_changed') {
          const d = msg.data as { state: string; slave?: ConnectResponse };
          setConnected(d.state === 'connected', d.slave);
        }
      };
      es.onerror = () => {
        es.close();
        setTimeout(connect, 2000);
      };
    }

    connect();

    api.status()
      .then((r) => setConnected(r.connected, r.slave))
      .catch(() => {});
    api.config()
      .then((c) => setConfig(c))
      .catch(() => {});
    api.packets()
      .then((r) => prependPackets(r.packets))
      .catch(() => {});

    return () => {
      esRef.current?.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
