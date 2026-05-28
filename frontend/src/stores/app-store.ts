import { create } from 'zustand';
import type { ConnectResponse, PacketEntry, AppConfig } from '../lib/types';
import { CMD_DEFS } from '../lib/cmd-defs';

const NUM_CELLS = 8;

interface AppStore {
  connected: boolean;
  slaveInfo: ConnectResponse | null;
  config: AppConfig | null;
  packets: PacketEntry[];
  txCount: number;
  rxCount: number;
  lastPacketId: number;
  autoScroll: boolean;
  activeCmd: string | null;
  byteValues: string[];

  setConnected: (connected: boolean, slave?: ConnectResponse) => void;
  setConfig: (cfg: AppConfig) => void;
  addPacket: (p: PacketEntry) => void;
  prependPackets: (packets: PacketEntry[]) => void;
  setAutoScroll: (v: boolean) => void;
  clearPackets: () => void;
  setActiveCmd: (cmd: string | null) => void;
  setByteValue: (idx: number, val: string) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  connected: false,
  slaveInfo: null,
  config: null,
  packets: [],
  txCount: 0,
  rxCount: 0,
  lastPacketId: 0,
  autoScroll: true,
  activeCmd: null,
  byteValues: Array<string>(NUM_CELLS).fill(''),

  setConnected: (connected, slave) =>
    set((s) => ({
      connected,
      slaveInfo: connected ? (slave ?? s.slaveInfo) : null,
    })),

  setConfig: (config) => set({ config }),

  addPacket: (p) =>
    set((s) => ({
      packets: [...s.packets, p],
      txCount: p.direction === 'tx' ? s.txCount + 1 : s.txCount,
      rxCount: p.direction === 'rx' ? s.rxCount + 1 : s.rxCount,
      lastPacketId: Math.max(s.lastPacketId, p.id),
    })),

  prependPackets: (incoming) =>
    set((s) => {
      const existingIds = new Set(s.packets.map((p) => p.id));
      const novel = incoming.filter((p) => !existingIds.has(p.id));
      const merged = [...novel, ...s.packets].sort((a, b) => a.id - b.id);
      return {
        packets: merged,
        txCount: merged.filter((p) => p.direction === 'tx').length,
        rxCount: merged.filter((p) => p.direction === 'rx').length,
        lastPacketId:
          merged.length > 0 ? Math.max(...merged.map((p) => p.id)) : s.lastPacketId,
      };
    }),

  setAutoScroll: (autoScroll) => set({ autoScroll }),

  clearPackets: () => set({ packets: [], txCount: 0, rxCount: 0, lastPacketId: 0 }),

  setActiveCmd: (activeCmd) =>
    set(() => {
      if (!activeCmd) return { activeCmd, byteValues: Array<string>(NUM_CELLS).fill('') };
      const def = CMD_DEFS[activeCmd];
      const byteValues = Array.from(
        { length: NUM_CELLS },
        (_, i) => def?.prefill?.[i] ?? ''
      );
      return { activeCmd, byteValues };
    }),

  setByteValue: (idx, val) =>
    set((s) => {
      const next = [...s.byteValues];
      next[idx] = val;
      return { byteValues: next };
    }),
}));
