import { useEffect, useRef } from 'react';
import { useAppStore } from '../stores/app-store';
import { api } from '../lib/api';
import type { PacketEntry, ConnectResponse, DaqDtoEvent, DaqStatus } from '../lib/types';

export function useSSE() {
  const addPacket            = useAppStore((s) => s.addPacket);
  const prependPackets       = useAppStore((s) => s.prependPackets);
  const setConnected         = useAppStore((s) => s.setConnected);
  const setConfig            = useAppStore((s) => s.setConfig);
  const setAnimationWatermark = useAppStore((s) => s.setAnimationWatermark);
  const updateDaqLiveValue   = useAppStore((s) => s.updateDaqLiveValue);
  const setDaqStatus         = useAppStore((s) => s.setDaqStatus);
  const setDaqLists          = useAppStore((s) => s.setDaqLists);
  const setDaqDtoRate        = useAppStore((s) => s.setDaqDtoRate);
  const esRef = useRef<EventSource | null>(null);
  // DTO rate counter: { count, windowStart }
  const dtoCountRef = useRef({ count: 0, windowStart: Date.now() });

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

        } else if (msg.event === 'daq_dto') {
          const d = msg.data as DaqDtoEvent;
          // Update live values for each signal in this DTO
          const liveValuesStore = useAppStore.getState().daqLists;
          for (const list of liveValuesStore) {
            if (list.id !== d.list_id) continue;
            for (const odt of list.odts) {
              if (odt.id !== d.odt_id) continue;
              for (const entry of odt.entries) {
                const val = d.values[entry.name];
                if (val !== undefined) {
                  updateDaqLiveValue(d.list_id, d.odt_id, entry.name, entry.addr, entry.type_name, val);
                }
              }
            }
          }
          // Compute DTOs/s over a 2-second rolling window
          const now = Date.now();
          dtoCountRef.current.count += 1;
          if (now - dtoCountRef.current.windowStart >= 2000) {
            const rate = Math.round(dtoCountRef.current.count / ((now - dtoCountRef.current.windowStart) / 1000));
            setDaqDtoRate(rate);
            dtoCountRef.current = { count: 0, windowStart: now };
          }

        } else if (msg.event === 'daq_state_changed') {
          const d = msg.data as { state: DaqStatus };
          setDaqStatus(d.state);
        }
      };

      es.onerror = () => {
        es.close();
        setTimeout(connect, 2000);
      };
    }

    connect();

    api.config()
      .then((c) => setConfig(c))
      .catch(() => {});

    api.packets()
      .then((r) => {
        prependPackets(r.packets);
        const watermark = r.packets.length > 0
          ? Math.max(...r.packets.map((p: PacketEntry) => p.id))
          : -1;
        setAnimationWatermark(watermark);
      })
      .catch(() => {
        setAnimationWatermark(-1);
      });

    // Sync DAQ status and lists on mount
    api.daqStatus()
      .then((r) => {
        setDaqStatus(r.state);
        setDaqLists(r.lists);
      })
      .catch(() => {});

    return () => {
      esRef.current?.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
