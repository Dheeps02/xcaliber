import { create } from 'zustand';
import type { ConnectResponse, PacketEntry, AppConfig, CmdDef, FieldDef } from '../lib/types';
import { CMD_DEFS } from '../lib/cmd-defs';

const NUM_CELLS = 8;

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

let toastSeq = 0;

interface AppStore {
  connected: boolean;
  slaveInfo: ConnectResponse | null;
  config: AppConfig | null;
  customCmdDefs: Record<string, CmdDef>;
  packets: PacketEntry[];
  txCount: number;
  rxCount: number;
  lastPacketId: number;
  autoScroll: boolean;
  activeCmd: string | null;
  byteValues: string[];
  theme: string;
  displayTimeoutMs: number;
  animationsEnabled: boolean;
  toasts: Toast[];
  animationWatermark: number | null;

  setConnected: (connected: boolean, slave?: ConnectResponse) => void;
  setConfig: (cfg: AppConfig) => void;
  addPacket: (p: PacketEntry) => void;
  prependPackets: (packets: PacketEntry[]) => void;
  setAutoScroll: (v: boolean) => void;
  clearPackets: () => void;
  setActiveCmd: (cmd: string | null) => void;
  setByteValue: (idx: number, val: string) => void;
  setTheme: (theme: string) => void;
  setDisplayTimeoutMs: (ms: number) => void;
  setAnimationsEnabled: (v: boolean) => void;
  showToast: (message: string, type?: Toast['type']) => void;
  dismissToast: (id: number) => void;
  setAnimationWatermark: (v: number) => void;
  activeMainTab: 'trace' | 'daq';
  setActiveMainTab: (tab: 'trace' | 'daq') => void;
}

function buildCustomCmdDefs(config: AppConfig): Record<string, CmdDef> {
  const defs: Record<string, CmdDef> = {};
  for (const cc of config.custom_commands ?? []) {
    const id = `user_${cc.code.toString(16).toUpperCase()}`;
    const codeHex = cc.code.toString(16).toUpperCase().padStart(2, '0');
    const fields: FieldDef[] = [
      { label: 'pid', tip: 'USER_CMD (0xF1)' },
      { label: 'sub_cmd', tip: `${cc.name} (0x${codeHex})` },
      ...(cc.fields ?? []).map((f) => ({ label: f.name, tip: `offset=${f.offset} size=${f.size} type=${f.type}` })),
    ];
    defs[id] = {
      pid: 'F1',
      isUserCmd: true,
      userCmdName: cc.name,
      group: cc.group,
      prefill: { 0: 'F1', 1: codeHex },
      fields,
    };
  }
  return defs;
}

export const useAppStore = create<AppStore>((set) => ({
  connected: false,
  slaveInfo: null,
  config: null,
  customCmdDefs: {},
  packets: [],
  txCount: 0,
  rxCount: 0,
  lastPacketId: 0,
  autoScroll: true,
  activeCmd: null,
  byteValues: Array<string>(NUM_CELLS).fill(''),
  theme: 'default',
  displayTimeoutMs: 2000,
  animationsEnabled: true,
  toasts: [],
  animationWatermark: null,
  activeMainTab: 'trace',

  setConnected: (connected, slave) =>
    set((s) => ({
      connected,
      slaveInfo: connected ? (slave ?? s.slaveInfo) : null,
    })),

  setConfig: (config) =>
    set({ config, customCmdDefs: buildCustomCmdDefs(config) }),

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
    set((s) => {
      if (!activeCmd) return { activeCmd, byteValues: Array<string>(NUM_CELLS).fill('') };
      const def = CMD_DEFS[activeCmd] ?? s.customCmdDefs[activeCmd];
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

  setTheme: (theme) => set({ theme }),
  setDisplayTimeoutMs: (displayTimeoutMs) => set({ displayTimeoutMs }),
  setAnimationsEnabled: (animationsEnabled) => set({ animationsEnabled }),
  showToast: (message, type = 'info') =>
    set((s) => ({ toasts: [...s.toasts, { id: ++toastSeq, message, type }] })),
  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setAnimationWatermark: (v) => set({ animationWatermark: v }),
  setActiveMainTab: (tab) => set({ activeMainTab: tab }),
}));
