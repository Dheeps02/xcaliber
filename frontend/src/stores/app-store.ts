import { create } from 'zustand';
import type { ConnectResponse, PacketEntry, AppConfig, CmdDef, FieldDef, DaqList, DaqStatus, DaqLiveValue, DaqEntryType, EventDef, A2lVariable, UserCmdDef } from '../lib/types';
import { CMD_DEFS } from '../lib/cmd-defs';

const NUM_CELLS = 8;

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
  detail?: string;
}

let toastSeq = 0;

interface AppStore {
  connected: boolean;
  slaveInfo: ConnectResponse | null;
  config: AppConfig | null;
  customCmdDefs: Record<string, CmdDef>;
  events: EventDef[];
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
  setEvents: (events: EventDef[]) => void;
  addPacket: (p: PacketEntry) => void;
  batchAddPackets: (packets: PacketEntry[]) => void;
  prependPackets: (packets: PacketEntry[]) => void;
  setAutoScroll: (v: boolean) => void;
  clearPackets: () => void;
  setActiveCmd: (cmd: string | null) => void;
  setByteValue: (idx: number, val: string) => void;
  setTheme: (theme: string) => void;
  setDisplayTimeoutMs: (ms: number) => void;
  setAnimationsEnabled: (v: boolean) => void;
  showToast: (message: string, type?: Toast['type'], detail?: string) => void;
  dismissToast: (id: number) => void;
  setAnimationWatermark: (v: number) => void;
  activeMainTab: 'trace' | 'daq';
  setActiveMainTab: (tab: 'trace' | 'daq') => void;
  byteBarCollapsed: boolean;
  setByteBarCollapsed: (v: boolean) => void;

  // ── DAQ ──────────────────────────────────────────────────────────
  daqStatus: DaqStatus;
  daqLists: DaqList[];
  daqLiveValues: Map<string, DaqLiveValue>;
  daqDtoRate: number;
  setDaqStatus: (s: DaqStatus) => void;
  setDaqLists: (lists: DaqList[]) => void;
  updateDaqLiveValue: (listId: number, odtId: number, name: string, addr: number, type: DaqEntryType, value: number) => void;
  batchUpdateDaqLiveValues: (updates: { listId: number; odtId: number; name: string; addr: number; type: DaqEntryType; value: number }[]) => void;
  setDaqDtoRate: (n: number) => void;
  clearDaqLiveValues: () => void;
  a2lVariables: A2lVariable[];
  setA2lVariables: (vars: A2lVariable[]) => void;

  userCmds: UserCmdDef[];
  userCmdDefs: Record<string, CmdDef>;
  setUserCmds: (cmds: UserCmdDef[]) => void;

  alertMsg: string | null;
  showAlert: (msg: string) => void;
  clearAlert: () => void;

  settingsOpen: boolean;
  settingsInitialTab: string;
  openSettings: (tab?: string) => void;
  closeSettings: () => void;
}

function buildUserCmdDefs(userCmds: UserCmdDef[]): Record<string, CmdDef> {
  const defs: Record<string, CmdDef> = {};
  for (const uc of userCmds) {
    const id = `ucmd_${uc.id}`;
    const prefill: Record<number, string> = { 0: 'F1' };
    uc.requestBytes.forEach((b, i) => {
      if (b.default) prefill[i + 1] = b.default.toUpperCase().padStart(2, '0');
    });
    const fields: FieldDef[] = [
      { label: 'pid', tip: 'USER_CMD (0xF1)' },
      ...uc.requestBytes.map((b) => ({
        label: b.label || 'byte',
        tip: b.tip,
        ...(b.options.length > 0 ? { options: b.options } : {}),
      })),
    ];
    defs[id] = {
      pid: 'F1',
      isUserCmd: true,
      userCmdName: uc.name,
      group: uc.group,
      prefill,
      fields,
    };
  }
  return defs;
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
  events: [],
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
  byteBarCollapsed: false,
  daqStatus: 'idle',
  daqLists: [],
  daqLiveValues: new Map(),
  daqDtoRate: 0,
  a2lVariables: [],
  userCmds: [],
  userCmdDefs: {},

  setConnected: (connected, slave) =>
    set((s) => ({
      connected,
      slaveInfo: connected ? (slave ?? s.slaveInfo) : null,
    })),

  setConfig: (config) => {
    const userCmds = config.user_cmds ?? [];
    set({ config, customCmdDefs: buildCustomCmdDefs(config), events: config.events ?? [], userCmds, userCmdDefs: buildUserCmdDefs(userCmds) });
  },

  setEvents: (events) => set({ events }),

  addPacket: (p) =>
    set((s) => {
      const packets = s.packets.length >= 2000
        ? [...s.packets.slice(-1999), p]
        : [...s.packets, p];
      return {
        packets,
        txCount: p.direction === 'tx' ? s.txCount + 1 : s.txCount,
        rxCount: p.direction === 'rx' ? s.rxCount + 1 : s.rxCount,
        lastPacketId: Math.max(s.lastPacketId, p.id),
      };
    }),

  batchAddPackets: (incoming) =>
    set((s) => {
      const all = [...s.packets, ...incoming];
      const packets = all.length > 2000 ? all.slice(-2000) : all;
      const txDelta = incoming.reduce((n, p) => n + (p.direction === 'tx' ? 1 : 0), 0);
      const rxDelta = incoming.reduce((n, p) => n + (p.direction === 'rx' ? 1 : 0), 0);
      const lastPacketId = incoming.reduce((m, p) => Math.max(m, p.id), s.lastPacketId);
      return { packets, txCount: s.txCount + txDelta, rxCount: s.rxCount + rxDelta, lastPacketId };
    }),

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
      const def = CMD_DEFS[activeCmd] ?? s.customCmdDefs[activeCmd] ?? s.userCmdDefs[activeCmd];
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
  showToast: (message, type = 'info', detail) =>
    set((s) => ({ toasts: [...s.toasts, { id: ++toastSeq, message, type, detail }] })),
  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setAnimationWatermark: (v) => set({ animationWatermark: v }),
  setActiveMainTab: (tab) => set({ activeMainTab: tab, ...(tab === 'daq' ? { byteBarCollapsed: true } : {}) }),
  setByteBarCollapsed: (byteBarCollapsed) => set({ byteBarCollapsed }),

  setDaqStatus: (daqStatus) => set({ daqStatus }),
  setDaqLists: (daqLists) => set({ daqLists }),
  setDaqDtoRate: (daqDtoRate) => set({ daqDtoRate }),
  clearDaqLiveValues: () => set({ daqLiveValues: new Map() }),
  setA2lVariables: (a2lVariables) => set({ a2lVariables }),
  setUserCmds: (userCmds) => set({ userCmds, userCmdDefs: buildUserCmdDefs(userCmds) }),

  alertMsg: null,
  showAlert: (msg) => set({ alertMsg: msg }),
  clearAlert: () => set({ alertMsg: null }),

  settingsOpen: false,
  settingsInitialTab: 'appearance',
  openSettings: (tab = 'appearance') => set({ settingsOpen: true, settingsInitialTab: tab }),
  closeSettings: () => set({ settingsOpen: false }),
  updateDaqLiveValue: (listId, odtId, name, addr, type, value) =>
    set((s) => {
      const key = `${listId}:${odtId}:${name}`;
      const existing = s.daqLiveValues.get(key);
      const history = existing ? [...existing.history.slice(-199), value] : [value];
      const next = new Map(s.daqLiveValues);
      next.set(key, { listId, odtId, entryName: name, addr, typeName: type, value, history });
      return { daqLiveValues: next };
    }),

  batchUpdateDaqLiveValues: (updates) =>
    set((s) => {
      const next = new Map(s.daqLiveValues);
      for (const { listId, odtId, name, addr, type, value } of updates) {
        const key = `${listId}:${odtId}:${name}`;
        const existing = next.get(key);
        const history = existing ? [...existing.history.slice(-199), value] : [value];
        next.set(key, { listId, odtId, entryName: name, addr, typeName: type, value, history });
      }
      return { daqLiveValues: next };
    }),
}));
