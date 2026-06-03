import { useEffect, useRef } from 'react';
import { useAppStore } from '../stores/app-store';
import { api } from '../lib/api';
import type { PacketEntry, ConnectResponse, DaqDtoEvent, DaqStatus, SeqStepResult, SeqRunResult } from '../lib/types';

export function useSSE() {
  const batchAddPackets          = useAppStore((s) => s.batchAddPackets);
  const prependPackets           = useAppStore((s) => s.prependPackets);
  const setConnected             = useAppStore((s) => s.setConnected);
  const setConfig                = useAppStore((s) => s.setConfig);
  const setAnimationWatermark    = useAppStore((s) => s.setAnimationWatermark);
  const batchUpdateDaqLiveValues = useAppStore((s) => s.batchUpdateDaqLiveValues);
  const setDaqStatus             = useAppStore((s) => s.setDaqStatus);
  const setDaqLists              = useAppStore((s) => s.setDaqLists);
  const setDaqDtoRate            = useAppStore((s) => s.setDaqDtoRate);
  const setSlaveDropped          = useAppStore((s) => s.setSlaveDropped);
  const resetSession             = useAppStore((s) => s.resetSession);
  const showAlert                = useAppStore((s) => s.showAlert);

  const esRef          = useRef<EventSource | null>(null);
  const dtoCountRef    = useRef({ count: 0, windowStart: Date.now() });
  const pendingDaqRef  = useRef<Parameters<typeof batchUpdateDaqLiveValues>[0]>([]);
  const pendingPktsRef = useRef<Parameters<typeof batchAddPackets>[0]>([]);
  const rafRef         = useRef<number | null>(null);

  useEffect(() => {
    function scheduleFlush() {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        if (pendingPktsRef.current.length > 0) {
          batchAddPackets(pendingPktsRef.current);
          pendingPktsRef.current = [];
        }
        if (pendingDaqRef.current.length > 0) {
          batchUpdateDaqLiveValues(pendingDaqRef.current);
          pendingDaqRef.current = [];
        }
        rafRef.current = null;
      });
    }

    function connect() {
      esRef.current?.close();
      const es = new EventSource(import.meta.env.DEV ? '/events' : 'http://localhost:8080/events');
      esRef.current = es;

      es.onmessage = (e: MessageEvent) => {
        const msg = JSON.parse(e.data as string) as {
          event: string;
          data: unknown;
        };

        if (msg.event === 'packet_tx' || msg.event === 'packet_rx') {
          pendingPktsRef.current.push(msg.data as PacketEntry);
          scheduleFlush();

        } else if (msg.event === 'state_changed') {
          const d = msg.data as { state: string; slave?: ConnectResponse };
          const wasConnected = useAppStore.getState().connected;
          if (d.state === 'connected') {
            const wasDropped = useAppStore.getState().slaveDropped;
            if (wasDropped) resetSession();
            setSlaveDropped(false);
            setConnected(true, d.slave);
          } else {
            if (wasConnected) {
              setSlaveDropped(true);
              showAlert('The XCP slave disconnected unexpectedly.', {
                label: 'Retry',
                fn: () => api.connect().then(() => {}),
              });
            }
            setConnected(false);
          }

        } else if (msg.event === 'daq_dto') {
          const d = msg.data as DaqDtoEvent;
          const updates: Parameters<typeof batchUpdateDaqLiveValues>[0] = [];
          const daqLists = useAppStore.getState().daqLists;
          for (const list of daqLists) {
            if (list.id !== d.list_id) continue;
            for (const odt of list.odts) {
              if (odt.id !== d.odt_id) continue;
              for (const entry of odt.entries) {
                const val = d.values[entry.name];
                if (val !== undefined) {
                  updates.push({ listId: d.list_id, odtId: d.odt_id, name: entry.name, addr: entry.addr, type: entry.type_name, value: val });
                }
              }
            }
          }
          if (updates.length > 0) {
            pendingDaqRef.current.push(...updates);
            scheduleFlush();
          }
          const now = Date.now();
          dtoCountRef.current.count += 1;
          if (now - dtoCountRef.current.windowStart >= 1000) {
            const rate = Math.round(dtoCountRef.current.count / ((now - dtoCountRef.current.windowStart) / 1000));
            setDaqDtoRate(rate);
            dtoCountRef.current = { count: 0, windowStart: now };
          }

        } else if (msg.event === 'daq_state_changed') {
          const d = msg.data as { state: DaqStatus };
          setDaqStatus(d.state);

        } else if (msg.event === 'seq_step_done') {
          useAppStore.getState().updateSeqStepResult(msg.data as SeqStepResult);

        } else if (msg.event === 'seq_run_finished') {
          const d = msg.data as Pick<SeqRunResult, 'status'>;
          const cur = useAppStore.getState().seqRunResult;
          if (cur) useAppStore.getState().setSeqRunResult({ ...cur, ...d });
        }
      };

      es.onerror = () => {
        es.close();
        setConnected(false);
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

    api.daqStatus()
      .then((r) => {
        setDaqStatus(r.state);
        setDaqLists(r.lists);
      })
      .catch(() => {});

    return () => {
      esRef.current?.close();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
