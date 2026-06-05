import { create } from 'zustand';
import type { ConnectResponse, PacketEntry, AppConfig, CmdDef, FieldDef, DaqList, DaqStatus, DaqLiveValue, DaqEntryType, EventDef, A2lVariable, UserCmdDef, Sequence, SeqRunResult, SeqStepResult } from '../lib/types';
import { CMD_DEFS } from '../lib/cmd-defs';

const NUM_CELLS = 8;

export const SPARK_ZOOM_MIN_MS     =  500;
export const SPARK_ZOOM_MAX_MS     = 30_000;
export const SPARK_ZOOM_DEFAULT_MS =  8_000;

const HISTORY_WINDOW_MS  = SPARK_ZOOM_MAX_MS + 2_000; // always enough for max zoom
const HISTORY_MAX_POINTS = 10_000; // safety cap for very fast event channels

function trimHistory(
  existing: { value: number; ts: number }[],
  newEntry: { value: number; ts: number },
): { value: number; ts: number }[] {
  const cutoff = newEntry.ts - HISTORY_WINDOW_MS;
  let start = 0;
  // history is oldest-first, so walk from the front until we reach the cutoff
  while (start < existing.length - 1 && existing[start].ts < cutoff) start++;
  const base = start > 0 ? existing.slice(start) : existing;
  const next = [...base, newEntry];
  return next.length > HISTORY_MAX_POINTS ? next.slice(-HISTORY_MAX_POINTS) : next;
}

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
  theme: 'default' | 'light';
  uiZoom: number;
  sparkWindowMs: number;
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
  setTheme: (theme: 'default' | 'light') => void;
  setUiZoom: (zoom: number) => void;
  setSparkWindowMs: (ms: number) => void;
  setDisplayTimeoutMs: (ms: number) => void;
  setAnimationsEnabled: (v: boolean) => void;
  showToast: (message: string, type?: Toast['type'], detail?: string) => void;
  dismissToast: (id: number) => void;
  setAnimationWatermark: (v: number) => void;
  activeMainTab: 'trace' | 'daq' | 'sequence';
  setActiveMainTab: (tab: 'trace' | 'daq' | 'sequence') => void;
  byteBarCollapsed: boolean;
  setByteBarCollapsed: (v: boolean) => void;
  memBarCollapsed: boolean;
  setMemBarCollapsed: (v: boolean) => void;

  // ── DAQ ──────────────────────────────────────────────────────────
  daqStatus: DaqStatus;
  daqLists: DaqList[];
  daqLiveValues: Map<string, DaqLiveValue>;
  daqDtoRate: number;
  setDaqStatus: (s: DaqStatus) => void;
  setDaqLists: (lists: DaqList[]) => void;
  updateDaqLiveValue: (listId: number, odtId: number, name: string, addr: number, type: DaqEntryType, value: number, ts: number) => void;
  batchUpdateDaqLiveValues: (updates: { listId: number; odtId: number; name: string; addr: number; type: DaqEntryType; value: number; ts: number }[]) => void;
  setDaqDtoRate: (n: number) => void;
  clearDaqLiveValues: () => void;
  a2lVariables: A2lVariable[];
  setA2lVariables: (vars: A2lVariable[]) => void;

  userCmds: UserCmdDef[];
  userCmdDefs: Record<string, CmdDef>;
  setUserCmds: (cmds: UserCmdDef[]) => void;

  alertMsg: string | null;
  alertAction: { label: string; fn: () => Promise<void> } | null;
  showAlert: (msg: string, action?: { label: string; fn: () => Promise<void> }) => void;
  clearAlert: () => void;

  settingsOpen: boolean;
  settingsInitialTab: string;
  openSettings: (tab?: string) => void;
  closeSettings: () => void;

  daqListsFromFile: boolean;
  slaveDropped: boolean;
  setDaqListsFromFile: (v: boolean) => void;
  setSlaveDropped: (v: boolean) => void;
  resetSession: () => void;

  // ── Sequence ──────────────────────────────────────────────────────
  sequences: Sequence[];
  activeSequenceId: string | null;
  seqSelectedStepId: string | null;
  seqRunResult: SeqRunResult | null;
  setSequences: (seqs: Sequence[]) => void;
  setActiveSequenceId: (id: string | null) => void;
  setSeqSelectedStepId: (id: string | null) => void;
  updateSequence: (seq: Sequence) => void;
  setSeqRunResult: (r: SeqRunResult | null) => void;
  updateSeqStepResult: (sr: SeqStepResult) => void;
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
  theme: 'default' as const,
  uiZoom: Number(localStorage.getItem('uiZoom') ?? 1.2),
  sparkWindowMs: Math.min(Number(localStorage.getItem('sparkWindowMs') ?? SPARK_ZOOM_DEFAULT_MS), SPARK_ZOOM_MAX_MS),
  displayTimeoutMs: 2000,
  animationsEnabled: true,
  toasts: [],
  animationWatermark: null,
  activeMainTab: 'trace',
  byteBarCollapsed: false,
  memBarCollapsed: false,
  daqStatus: 'idle',
  daqLists: [],
  daqLiveValues: new Map(),
  daqDtoRate: 0,
  a2lVariables: [],
  userCmds: [],
  userCmdDefs: {},
  daqListsFromFile: false,
  slaveDropped: false,
  sequences: [],
  activeSequenceId: null,
  seqSelectedStepId: null,
  seqRunResult: null,

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
  setUiZoom: (uiZoom) => { localStorage.setItem('uiZoom', String(uiZoom)); set({ uiZoom }); },
  setSparkWindowMs: (sparkWindowMs) => { localStorage.setItem('sparkWindowMs', String(sparkWindowMs)); set({ sparkWindowMs }); },
  setDisplayTimeoutMs: (displayTimeoutMs) => set({ displayTimeoutMs }),
  setAnimationsEnabled: (animationsEnabled) => set({ animationsEnabled }),
  showToast: (message, type = 'info', detail) =>
    set((s) => ({ toasts: [...s.toasts, { id: ++toastSeq, message, type, detail }] })),
  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setAnimationWatermark: (v) => set({ animationWatermark: v }),
  setActiveMainTab: (tab) => set({
    activeMainTab: tab,
    ...(tab === 'daq' ? { byteBarCollapsed: true } : tab === 'sequence' ? { byteBarCollapsed: false } : {}),
    ...(tab !== 'trace' ? { memBarCollapsed: true } : {}),
  }),
  setByteBarCollapsed: (byteBarCollapsed) => set({ byteBarCollapsed }),
  setMemBarCollapsed: (memBarCollapsed) => set({ memBarCollapsed }),

  setDaqStatus: (daqStatus) => set({ daqStatus }),
  setDaqLists: (daqLists) => set({ daqLists }),
  setDaqDtoRate: (daqDtoRate) => set({ daqDtoRate }),
  clearDaqLiveValues: () => set({ daqLiveValues: new Map() }),
  setA2lVariables: (a2lVariables) => set({ a2lVariables }),
  setUserCmds: (userCmds) => set({ userCmds, userCmdDefs: buildUserCmdDefs(userCmds) }),

  alertMsg: null,
  alertAction: null,
  showAlert: (msg, action) => set({ alertMsg: msg, alertAction: action ?? null }),
  clearAlert: () => set({ alertMsg: null, alertAction: null }),

  setDaqListsFromFile: (daqListsFromFile) => set({ daqListsFromFile }),
  setSlaveDropped: (slaveDropped) => set({ slaveDropped }),
  resetSession: () =>
    set((s) => ({
      packets: [],
      txCount: 0,
      rxCount: 0,
      lastPacketId: 0,
      connected: false,
      slaveInfo: null,
      daqStatus: 'idle' as DaqStatus,
      daqLiveValues: new Map(),
      daqDtoRate: 0,
      animationWatermark: null,
      activeCmd: null,
      byteValues: Array<string>(NUM_CELLS).fill(''),
      toasts: [],
      alertMsg: null,
      alertAction: null,
      ...(s.daqListsFromFile ? {} : { daqLists: [] }),
    })),

  settingsOpen: false,
  settingsInitialTab: 'appearance',
  openSettings: (tab = 'appearance') => set({ settingsOpen: true, settingsInitialTab: tab }),
  closeSettings: () => set({ settingsOpen: false }),
  updateDaqLiveValue: (listId, odtId, name, addr, type, value, ts) =>
    set((s) => {
      const key = `${listId}:${odtId}:${name}`;
      const existing = s.daqLiveValues.get(key);
      const entry = { value, ts };
      const history = existing ? trimHistory(existing.history, entry) : [entry];
      const next = new Map(s.daqLiveValues);
      next.set(key, { listId, odtId, entryName: name, addr, typeName: type, value, history });
      return { daqLiveValues: next };
    }),

  batchUpdateDaqLiveValues: (updates) =>
    set((s) => {
      const next = new Map(s.daqLiveValues);
      for (const { listId, odtId, name, addr, type, value, ts } of updates) {
        const key = `${listId}:${odtId}:${name}`;
        const existing = next.get(key);
        const entry = { value, ts };
        const history = existing ? trimHistory(existing.history, entry) : [entry];
        next.set(key, { listId, odtId, entryName: name, addr, typeName: type, value, history });
      }
      return { daqLiveValues: next };
    }),

  setSequences: (sequences) => set({ sequences }),
  setActiveSequenceId: (activeSequenceId) => set({ activeSequenceId }),
  setSeqSelectedStepId: (seqSelectedStepId) => set({ seqSelectedStepId }),
  updateSequence: (seq) =>
    set((s) => ({ sequences: s.sequences.map((q) => (q.id === seq.id ? seq : q)) })),
  setSeqRunResult: (seqRunResult) => set({ seqRunResult }),
  updateSeqStepResult: (sr) =>
    set((s) => {
      if (!s.seqRunResult) return {};
      const existing = s.seqRunResult.stepResults.find((r) => r.stepId === sr.stepId);
      const stepResults = existing
        ? s.seqRunResult.stepResults.map((r) => (r.stepId === sr.stepId ? sr : r))
        : [...s.seqRunResult.stepResults, sr];
      return { seqRunResult: { ...s.seqRunResult, stepResults } };
    }),
}));
