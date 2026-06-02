import type { ConnectResponse, PacketEntry, AppConfig, NetworkInterface, DaqList, DaqEntry, DaqStatus, EventDef } from './types';

const BASE = import.meta.env.DEV ? '' : 'http://localhost:8080';

async function post<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method: 'POST',
      headers: body != null ? { 'Content-Type': 'application/json' } : {},
      body: body != null ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach XCP client backend. Is the Tauri app running?');
  }
  if (!res.ok) throw new Error('Cannot reach XCP client backend. Is the Tauri app running?');
  const data = await res.json().catch(() => ({ ok: false, error: 'Invalid response from backend' })) as Record<string, unknown>;
  if (data['ok'] === false) throw new Error((data['error'] as string | undefined) ?? 'Request failed');
  return data as T;
}

async function get<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path);
  } catch {
    throw new Error('Cannot reach XCP client backend. Is the Tauri app running?');
  }
  if (!res.ok) throw new Error('Request failed');
  return res.json() as Promise<T>;
}

export const api = {
  connect: () => post<{ ok: boolean; slave: ConnectResponse }>('/api/connect'),
  disconnect: () => post<{ ok: boolean }>('/api/disconnect'),
  status: () => get<{ connected: boolean; slave?: ConnectResponse }>('/api/status'),
  getStatus: () => post<{ ok: boolean; response: unknown }>('/api/command/get-status'),
  sync: () => post<{ ok: boolean; response: unknown }>('/api/command/raw', { bytes: [0xfc] }),
  getCommModeInfo: () =>
    post<{ ok: boolean; response: unknown }>('/api/command/get-comm-mode-info'),
  getId: (id_type: number) =>
    post<{ ok: boolean; response: unknown }>('/api/command/get-id', { id_type }),
  setMta: (addr_ext: number, addr: number) =>
    post<{ ok: boolean; response: unknown }>('/api/command/set-mta', { addr_ext, addr }),
  upload: (size: number) =>
    post<{ ok: boolean; response: unknown }>('/api/command/upload', { size }),
  download: (data: number[]) =>
    post<{ ok: boolean; response: unknown }>('/api/command/download', { data }),
  raw: (bytes: number[]) =>
    post<{ ok: boolean; response: unknown }>('/api/command/raw', { bytes }),
  userCmd: (name: string, sub_cmd: number, data: number[]) =>
    post<{ ok: boolean; response: unknown }>('/api/command/user', { name, sub_cmd, data }),
  packets: (since?: number) =>
    get<{ packets: PacketEntry[] }>(
      `/api/packets${since != null ? `?since=${since}` : ''}`
    ),
  config: () => get<AppConfig>('/api/config'),
  updateConfig: (body: {
    server_ip: string;
    server_port: number;
    protocol: string;
    timeout_ms: number;
    listen_port: number;
    bind_ip?: string;
    src_mac?: string;
    dst_mac?: string;
    events?: EventDef[];
  }) => post<{ ok: boolean }>('/api/config', body),
  getNetworkInterfaces: () =>
    get<{ interfaces: NetworkInterface[] }>('/api/network-interfaces'),

  // ── DAQ ───────────────────────────────────────────────────────────
  daqGetLists: () =>
    get<{ lists: DaqList[] }>('/api/daq/lists'),
  daqAddList: (event_channel: number) =>
    post<{ list: DaqList }>('/api/daq/lists', { event_channel }),
  daqDeleteList: (id: number) =>
    post<{ ok: boolean }>(`/api/daq/lists/${id}/delete`),
  daqAddOdt: (listId: number) =>
    post<{ odt_id: number }>(`/api/daq/lists/${listId}/odts`),
  daqAddEntry: (listId: number, odtId: number, entry: DaqEntry) =>
    post<{ ok: boolean }>(`/api/daq/lists/${listId}/odts/${odtId}/entries`, entry),
  daqDeleteEntry: (listId: number, odtId: number, entryIdx: number) =>
    post<{ ok: boolean }>(`/api/daq/lists/${listId}/odts/${odtId}/entries/${entryIdx}/delete`),
  daqSetEvent: (listId: number, event_channel: number) =>
    post<{ ok: boolean }>(`/api/daq/lists/${listId}/event`, { event_channel }),
  daqReplaceLists: (lists: DaqList[]) =>
    post<{ ok: boolean }>('/api/daq/lists/replace', { lists }),
  daqConfigure: () =>
    post<{ ok: boolean }>('/api/daq/configure'),
  daqStart: () =>
    post<{ ok: boolean }>('/api/daq/start'),
  daqStop: () =>
    post<{ ok: boolean }>('/api/daq/stop'),
  daqFree: () =>
    post<{ ok: boolean }>('/api/daq/free'),
  daqStatus: () =>
    get<{ state: DaqStatus; lists: DaqList[] }>('/api/daq/status'),
};
