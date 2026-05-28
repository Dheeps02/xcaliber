import type { ConnectResponse, PacketEntry, AppConfig } from './types';

const BASE = 'http://localhost:8080';

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: body != null ? { 'Content-Type': 'application/json' } : {},
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'request failed' }));
    throw new Error((err as { error?: string }).error ?? 'Request failed');
  }
  return res.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error('Request failed');
  return res.json() as Promise<T>;
}

export const api = {
  connect: () => post<{ ok: boolean; slave: ConnectResponse }>('/api/connect'),
  disconnect: () => post<{ ok: boolean }>('/api/disconnect'),
  status: () => get<{ connected: boolean; slave?: ConnectResponse }>('/api/status'),
  getStatus: () => post<{ ok: boolean; response: unknown }>('/api/command/get-status'),
  getCommModeInfo: () =>
    post<{ ok: boolean; response: unknown }>('/api/command/get-comm-mode-info'),
  getId: (id_type: number) =>
    post<{ ok: boolean; response: unknown }>('/api/command/get-id', { id_type }),
  setMta: (addr_ext: number, addr: number) =>
    post<{ ok: boolean; response: unknown }>('/api/command/set-mta', { addr_ext, addr }),
  upload: (size: number) =>
    post<{ ok: boolean; response: unknown }>('/api/command/upload', { size }),
  raw: (bytes: number[]) =>
    post<{ ok: boolean; response: unknown }>('/api/command/raw', { bytes }),
  packets: (since?: number) =>
    get<{ packets: PacketEntry[] }>(
      `/api/packets${since != null ? `?since=${since}` : ''}`
    ),
  config: () => get<AppConfig>('/api/config'),
};
