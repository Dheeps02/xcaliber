import { useState, useEffect, useRef } from 'react';
import {
  Palette, PlugsConnected, Scroll, Lightning, Terminal, Eye, Info,
  Globe, Stack, Circuitry, WifiHigh,
  ArrowCounterClockwise, Plus, X, ArrowSquareOut, ArrowsClockwise, ArrowsLeftRight,
} from '@phosphor-icons/react';

const GITHUB_URL = 'https://github.com/Dheeps02/xcaliber';
const RELEASES_URL = `${GITHUB_URL}/releases`;
import { useAppStore } from '../stores/app-store';
import { api } from '../lib/api';
import type { NetworkInterface, EventDef } from '../lib/types';
import { SpinInput } from './SpinInput';
import { UserCmdTab } from './UserCmdTab';
import { Button } from './ui/Button';
import { Toggle } from './ui/Toggle';

interface Props {
  onClose: () => void;
  initialTab?: string;
}

type Tab = 'appearance' | 'connection' | 'trace' | 'events' | 'accessibility' | 'about' | 'usercmd';

// ── Theme definitions ─────────────────────────────────────────────

type ThemeId = 'default' | 'light';

interface ThemeDef {
  id: ThemeId;
  label: string;
  preview: { bg: string; sidebar: string; accent: string; text: string };
}

const THEMES: ThemeDef[] = [
  { id: 'default', label: 'Dark',  preview: { bg: '#090d0b', sidebar: '#141c18', accent: '#10b981', text: '#eef5f1' } },
  { id: 'light',   label: 'Light', preview: { bg: '#f2f7f5', sidebar: '#e8f0ed', accent: '#059669', text: '#0d1f18' } },
];

function applyTheme(theme: string) {
  const html = document.documentElement;
  html.classList.add('theme-transitioning');
  if (theme === 'default') {
    html.removeAttribute('data-theme');
  } else {
    html.setAttribute('data-theme', theme);
  }
  setTimeout(() => html.classList.remove('theme-transitioning'), 280);
}

// ── Connection defaults ───────────────────────────────────────────

const CONN_DEFAULTS = {
  server_ip: '127.0.0.1',
  server_port: 5555,
  protocol: 'udp',
  timeout_ms: 1000,
  listen_port: 8080,
  bind_ip: '',
  source_port: 5555,
  src_mac: '',
  dst_mac: '',
  vlan_id: '',
  endian: 'little',
};

interface ConnDraft {
  server_ip: string;
  server_port: number;
  protocol: string;
  timeout_ms: number;
  listen_port: number;
  bind_ip: string;
  source_port: number;
  src_mac: string;
  dst_mac: string;
  vlan_id: string;
  endian: string;
}

// ── Tab content components ────────────────────────────────────────

function AppearanceTab() {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const uiZoom = useAppStore((s) => s.uiZoom);
  const setUiZoom = useAppStore((s) => s.setUiZoom);
  const [draftZoom, setDraftZoom] = useState(uiZoom);

  function handleSelect(id: ThemeId) {
    setTheme(id);
    applyTheme(id);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] text-[var(--text-muted)] mb-4">Choose a colour theme. Changes apply instantly.</p>
        <div className="grid grid-cols-2 gap-3">
        {THEMES.map((t) => {
          const active = theme === t.id;
          const { bg, sidebar, accent, text } = t.preview;
          return (
            <button
              key={t.id}
              onClick={() => handleSelect(t.id)}
              className={`rounded-lg overflow-hidden border-2 transition-all text-left active:scale-95 ${
                active
                  ? 'border-[var(--accent)]'
                  : 'border-[var(--border-strong)] hover:border-[var(--text-muted)]'
              }`}
            >
              {/* Mini app preview */}
              <div className="h-20 relative overflow-hidden" style={{ background: bg }}>
                {/* Topbar */}
                <div className="absolute top-0 left-0 right-0 h-5 flex items-center px-2 gap-1.5" style={{ background: sidebar }}>
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accent }} />
                  <div className="flex-1 h-1 rounded-full opacity-40" style={{ background: text }} />
                  <div className="w-3 h-1 rounded-full opacity-30 shrink-0" style={{ background: text }} />
                </div>
                {/* Sidebar */}
                <div className="absolute left-0 top-5 bottom-0 w-7 flex flex-col gap-1 pt-2 px-1.5" style={{ background: sidebar }}>
                  <div className="h-1.5 rounded-sm" style={{ background: accent }} />
                  <div className="h-1.5 rounded-sm opacity-40" style={{ background: text }} />
                  <div className="h-1.5 rounded-sm opacity-30" style={{ background: text }} />
                  <div className="h-1.5 rounded-sm opacity-20" style={{ background: text }} />
                </div>
                {/* Content */}
                <div className="absolute left-7 top-5 right-0 bottom-0 pt-2 px-2 flex flex-col gap-1.5">
                  <div className="h-1 rounded-full" style={{ background: accent, width: '55%' }} />
                  <div className="h-1 rounded-full opacity-50" style={{ background: text, width: '80%' }} />
                  <div className="h-1 rounded-full opacity-35" style={{ background: text, width: '65%' }} />
                  <div className="h-1 rounded-full opacity-25" style={{ background: text, width: '50%' }} />
                  <div className="h-1 rounded-full opacity-45" style={{ background: accent, width: '38%' }} />
                </div>
              </div>
              {/* Swatches + label */}
              <div
                className="px-2.5 py-1.5 flex items-center gap-2"
                style={{
                  background: active
                    ? 'color-mix(in srgb, var(--accent) 20%, var(--surface-overlay))'
                    : 'var(--surface-overlay)',
                }}
              >
                <div className="flex gap-1 shrink-0">
                  {([bg, sidebar, accent, text] as string[]).map((color, i) => (
                    <div key={i} className="w-2.5 h-2.5 rounded-full border border-black/20" style={{ background: color }} />
                  ))}
                </div>
                <span
                  className="text-[10px] font-medium flex-1 truncate"
                  style={{ color: active ? 'var(--accent)' : 'var(--text-muted)' }}
                >
                  {t.label}
                </span>
                {active && (
                  <span style={{ color: 'var(--accent)', fontSize: 10 }}>✓</span>
                )}
              </div>
            </button>
          );
        })}
        </div>
      </div>

      {/* Zoom */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] text-[var(--text-muted)] font-medium">UI Zoom</p>
          <span className="text-[11px] font-mono text-[var(--text-muted)]">{Math.round(draftZoom * 100)}%</span>
        </div>
        <input
          type="range"
          min={0.7}
          max={1.5}
          step={0.05}
          value={draftZoom}
          onChange={(e) => setDraftZoom(Number(e.target.value))}
          onPointerUp={(e) => setUiZoom(Number((e.target as HTMLInputElement).value))}
          className="w-full"
          style={{ accentColor: 'var(--accent)' }}
        />
        <div className="flex justify-between text-[10px] text-[var(--text-muted)]/50 mt-1">
          <span>70%</span>
          <span>100%</span>
          <span>150%</span>
        </div>
      </div>
    </div>
  );
}

function ConnectionTab() {
  const config = useAppStore((s) => s.config);
  const setConfig = useAppStore((s) => s.setConfig);

  const [initial, setInitial] = useState<ConnDraft>({
    server_ip: config?.connection.server_ip ?? CONN_DEFAULTS.server_ip,
    server_port: config?.connection.server_port ?? CONN_DEFAULTS.server_port,
    protocol: config?.connection.protocol ?? CONN_DEFAULTS.protocol,
    timeout_ms: config?.connection.timeout_ms ?? CONN_DEFAULTS.timeout_ms,
    listen_port: config?.server.listen_port ?? CONN_DEFAULTS.listen_port,
    bind_ip: config?.connection.bind_ip ?? CONN_DEFAULTS.bind_ip,
    source_port: config?.connection.source_port ?? config?.connection.server_port ?? CONN_DEFAULTS.source_port,
    src_mac: config?.connection.src_mac ?? CONN_DEFAULTS.src_mac,
    dst_mac: config?.connection.dst_mac ?? CONN_DEFAULTS.dst_mac,
    vlan_id: config?.connection.vlan_id != null ? String(config.connection.vlan_id) : CONN_DEFAULTS.vlan_id,
    endian: config?.endian ?? CONN_DEFAULTS.endian,
  });
  const [draft, setDraft] = useState<ConnDraft>({ ...initial });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ifaces, setIfaces] = useState<NetworkInterface[]>([]);

  useEffect(() => {
    api.getNetworkInterfaces()
      .then((r) => setIfaces(r.interfaces))
      .catch(() => {});
  }, []);

  function isDirty(key: keyof ConnDraft) {
    return draft[key] !== initial[key];
  }

  function resetField(key: keyof ConnDraft) {
    setSaved(false);
    setError(null);
    setDraft((d) => ({ ...d, [key]: CONN_DEFAULTS[key] }));
  }

  function set(key: keyof ConnDraft, value: string | number) {
    setSaved(false);
    setError(null);
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.updateConfig({
        ...draft,
        bind_ip: draft.bind_ip || undefined,
        source_port: draft.source_port || undefined,
        src_mac: draft.src_mac || undefined,
        dst_mac: draft.dst_mac || undefined,
        vlan_id: draft.vlan_id ? Number(draft.vlan_id) : undefined,
        endian: draft.endian,
      });
      if (config) {
        setConfig({
          ...config,
          connection: {
            ...config.connection,
            server_ip: draft.server_ip,
            server_port: draft.server_port,
            protocol: draft.protocol,
            timeout_ms: draft.timeout_ms,
            bind_ip: draft.bind_ip || undefined,
            source_port: draft.source_port || undefined,
            src_mac: draft.src_mac || undefined,
            dst_mac: draft.dst_mac || undefined,
            vlan_id: draft.vlan_id ? Number(draft.vlan_id) : undefined,
          },
          server: { ...config.server, listen_port: draft.listen_port },
          endian: draft.endian,
        });
      }
      setInitial({ ...draft });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = (key: keyof ConnDraft) =>
    `w-full px-2.5 py-1.5 rounded-md text-xs font-mono focus:outline-none transition-colors no-spinner ${
      isDirty(key)
        ? 'border border-[var(--status-warn)]/60 focus:border-[var(--status-warn)]'
        : 'border border-[var(--input-border)] focus:border-[var(--accent)]'
    }`
    + ' bg-[var(--input-bg)] text-[var(--text-secondary)]';

  const ipRowCls = 'grid gap-3 items-center';
  const ipGridStyle = { gridTemplateColumns: '68px 1fr 1fr' };

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-[var(--text-muted)]">Restart the connection after saving for changes to take effect.</p>

      {/* ── IP ── */}
      <ConnSection label="IP" icon={Globe} />
      <div className="space-y-2">
        <div className={ipRowCls} style={ipGridStyle}>
          <div />
          <span className="text-[10px] text-[var(--text-muted)] font-medium">IP Address</span>
          <span className="text-[10px] text-[var(--text-muted)] font-medium">Port</span>
        </div>
        <div className={ipRowCls} style={ipGridStyle}>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[var(--text-muted)] font-medium">Source</span>
            {(isDirty('bind_ip') || isDirty('source_port')) && (
              <button
                onClick={() => { resetField('bind_ip'); resetField('source_port'); }}
                className="text-[var(--status-warn)] hover:text-[var(--text-secondary)] transition-colors flex items-center"
                title="Reset row"
              >
                <ArrowCounterClockwise size={14} />
              </button>
            )}
          </div>
          <input type="text" placeholder="0.0.0.0 (any)" value={draft.bind_ip} onChange={(e) => set('bind_ip', e.target.value)} className={inputCls('bind_ip')} />
          <SpinInput value={draft.source_port} onChange={(v) => set('source_port', v)} min={1} max={65535} inputClassName={inputCls('source_port')} />
        </div>
        <div className={ipRowCls} style={ipGridStyle}>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[var(--text-muted)] font-medium">Destination</span>
            {(isDirty('server_ip') || isDirty('server_port')) && (
              <button
                onClick={() => { resetField('server_ip'); resetField('server_port'); }}
                className="text-[var(--status-warn)] hover:text-[var(--text-secondary)] transition-colors flex items-center"
                title="Reset row"
              >
                <ArrowCounterClockwise size={14} />
              </button>
            )}
          </div>
          <input type="text" placeholder="127.0.0.1" value={draft.server_ip} onChange={(e) => set('server_ip', e.target.value)} className={inputCls('server_ip')} />
          <SpinInput value={draft.server_port} onChange={(v) => set('server_port', v)} min={1} max={65535} inputClassName={inputCls('server_port')} />
        </div>
      </div>

      {/* ── Protocol ── */}
      <ConnSection label="Protocol" icon={Stack} />
      <div className="flex items-center gap-2">
        {([
          { id: 'udp', label: 'UDP Socket' },
          { id: 'ethernet', label: 'Raw Ethernet' },
        ] as const).map((opt) => (
          <Button
            key={opt.id}
            onClick={() => set('protocol', opt.id)}
            variant={draft.protocol === opt.id ? 'primary' : 'default'}
            className="flex-1 justify-center"
          >
            {opt.label}
          </Button>
        ))}
      </div>
      <p className="text-[10px] text-[var(--text-muted)]/60 -mt-2">
        UDP Socket works with any standard XCP-on-UDP slave. Raw Ethernet is for ECUs that
        need a specific source/destination MAC or VLAN tag.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Timeout (ms)" dirty={isDirty('timeout_ms')} onReset={() => resetField('timeout_ms')}>
          <SpinInput value={draft.timeout_ms} onChange={(v) => set('timeout_ms', v)} min={100} step={100} inputClassName={inputCls('timeout_ms')} />
        </Field>
      </div>

      {/* ── Byte Order ── */}
      <ConnSection label="Byte Order" icon={ArrowsLeftRight} />
      <div className="flex items-center gap-2">
        {(['little', 'big'] as const).map((opt) => (
          <Button
            key={opt}
            onClick={() => set('endian', opt)}
            variant={draft.endian === opt ? 'primary' : 'default'}
            className="flex-1 justify-center"
          >
            {opt === 'little' ? 'Little Endian' : 'Big Endian'}
          </Button>
        ))}
      </div>
      <p className="text-[10px] text-[var(--text-muted)]/60 -mt-2">
        Byte order for SET_MTA addresses and multi-byte DOWNLOAD values. Match your target ECU.
      </p>

      {/* ── Ethernet ── */}
      {draft.protocol === 'ethernet' && (
        <>
          <ConnSection label="Ethernet" icon={Circuitry} />
          <div className="grid grid-cols-3 gap-3">
            <Field label="Source MAC" dirty={isDirty('src_mac')} onReset={() => resetField('src_mac')}>
              <input type="text" placeholder="AA:BB:CC:DD:EE:FF" value={draft.src_mac} onChange={(e) => set('src_mac', e.target.value)} className={inputCls('src_mac')} />
            </Field>
            <Field label="Destination MAC" dirty={isDirty('dst_mac')} onReset={() => resetField('dst_mac')}>
              <input type="text" placeholder="AA:BB:CC:DD:EE:FF" value={draft.dst_mac} onChange={(e) => set('dst_mac', e.target.value)} className={inputCls('dst_mac')} />
            </Field>
            <Field label="VLAN ID" dirty={isDirty('vlan_id')} onReset={() => resetField('vlan_id')}>
              <input type="number" min={1} max={4094} placeholder="none" value={draft.vlan_id} onChange={(e) => set('vlan_id', e.target.value)} className={inputCls('vlan_id')} />
            </Field>
          </div>
        </>
      )}

      {/* ── Network Interface ── */}
      <ConnSection label="Network Interface" icon={WifiHigh} />
      <Field label="Interface" dirty={isDirty('bind_ip')} onReset={() => resetField('bind_ip')}>
        <select value={draft.bind_ip} onChange={(e) => set('bind_ip', e.target.value)} className={inputCls('bind_ip')}>
          <option value="">Any (all interfaces)</option>
          {ifaces.map((iface) =>
            iface.ips.map((ip) => (
              <option key={`${iface.name}-${ip}`} value={ip}>
                {iface.name} — {ip}
              </option>
            ))
          )}
        </select>
      </Field>

      {/* ── Backend ── */}
      <ConnSection label="Backend" icon={Terminal} />
      <Field label="HTTP Listen Port" dirty={isDirty('listen_port')} onReset={() => resetField('listen_port')}>
        <SpinInput value={draft.listen_port} onChange={(v) => set('listen_port', v)} min={1024} max={65535} inputClassName={inputCls('listen_port')} />
      </Field>

      <div className="flex items-center gap-2 pt-1">
        <Button variant="primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        {saved && <span className="text-[11px] text-[var(--status-ok)]">✓ Saved</span>}
        {error && <span className="text-[11px] text-[var(--status-err)]">{error}</span>}
      </div>
    </div>
  );
}

function ConnSection({ label, icon: Icon }: { label: string; icon?: React.ElementType }) {
  return (
    <div className="flex items-center gap-2.5 pt-1">
      <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest whitespace-nowrap flex items-center gap-1.5">
        {Icon && <Icon size={13} />}{label}
      </span>
      <div className="flex-1 h-px bg-[var(--border)]" />
    </div>
  );
}

function Field({ label, dirty, onReset, children }: { label: string; dirty: boolean; onReset: () => void; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <label className="text-[10px] text-[var(--text-muted)] font-medium">{label}</label>
        {dirty && (
          <button
            onClick={onReset}
            title="Reset to default"
            className="text-[10px] text-[var(--status-warn)] hover:text-[var(--text-secondary)] transition-colors flex items-center gap-0.5"
          >
            <ArrowCounterClockwise size={11} /> <span>reset</span>
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function TraceTab() {
  const displayTimeoutMs = useAppStore((s) => s.displayTimeoutMs);
  const setDisplayTimeoutMs = useAppStore((s) => s.setDisplayTimeoutMs);

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-[var(--text-muted)]">Configure packet trace display behaviour.</p>
      <div>
        <label className="text-[10px] text-[var(--text-muted)] font-medium block mb-1">Response Timeout (ms)</label>
        <p className="text-[10px] text-[var(--text-muted)]/60 mb-2">Show a timeout indicator if no response arrives within this threshold.</p>
        <SpinInput
          value={displayTimeoutMs}
          onChange={(v) => setDisplayTimeoutMs(Math.max(100, v))}
          min={100}
          step={100}
          inputClassName="w-32 px-2.5 py-1.5 rounded-md bg-[var(--input-bg)] border border-[var(--input-border)] text-xs font-mono text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
        />
      </div>
    </div>
  );
}

function AccessibilityTab() {
  const animationsEnabled = useAppStore((s) => s.animationsEnabled);
  const setAnimationsEnabled = useAppStore((s) => s.setAnimationsEnabled);

  return (
    <div className="space-y-5">
      <p className="text-[11px] text-[var(--text-muted)]">Adjust the interface to better suit your needs.</p>
      <label className="flex items-start gap-3 cursor-pointer select-none">
        <Toggle
          checked={animationsEnabled}
          onChange={() => setAnimationsEnabled(!animationsEnabled)}
        />
        <div>
          <p className="text-xs text-[var(--text-primary)] font-medium">Enable animations</p>
          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
            Packet fade-in, counter ticks, expand transitions, and theme transitions. Disable for reduced motion.
          </p>
        </div>
      </label>
    </div>
  );
}

function EventsTab() {
  const config = useAppStore(s => s.config);
  const setConfig = useAppStore(s => s.setConfig);
  const setEvents = useAppStore(s => s.setEvents);
  const storeEvents = useAppStore(s => s.events);

  const [draft, setDraft] = useState<EventDef[]>(() => storeEvents.length > 0 ? storeEvents : []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(storeEvents);

  function addEvent() {
    const nextId = draft.length > 0 ? Math.max(...draft.map(e => e.id)) + 1 : 1;
    setSaved(false);
    setDraft(d => [...d, { id: nextId, name: '' }]);
  }

  function removeEvent(idx: number) {
    setSaved(false);
    setDraft(d => d.filter((_, i) => i !== idx));
  }

  function setField(idx: number, key: keyof EventDef, value: string | number) {
    setSaved(false);
    setDraft(d => d.map((e, i) => i === idx ? { ...e, [key]: value } : e));
  }

  async function save() {
    setSaving(true);
    try {
      if (!config) return;
      await api.updateConfig({
        server_ip: config.connection.server_ip,
        server_port: config.connection.server_port,
        protocol: config.connection.protocol,
        timeout_ms: config.connection.timeout_ms,
        listen_port: config.server.listen_port,
        bind_ip: config.connection.bind_ip,
        source_port: config.connection.source_port,
        src_mac: config.connection.src_mac,
        dst_mac: config.connection.dst_mac,
        vlan_id: config.connection.vlan_id,
        events: draft,
        endian: config.endian,
      });
      setEvents(draft);
      setConfig({ ...config, events: draft });
      setSaved(true);
    } catch {
      // keep form editable
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'px-2 py-1 rounded bg-[var(--input-bg)] border border-[var(--input-border)] text-xs font-mono text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]';

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-[var(--text-muted)]">
        Define XCP event channels shown in the DAQ list dropdown. Changes are saved to config.toml.
      </p>
      <div className="border border-[var(--border)] rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr
              className="text-left text-[10px] uppercase tracking-wider"
              style={{ background: 'var(--surface-overlay)', color: 'var(--text-muted)' }}
            >
              <th className="px-3 py-2 w-16">ID</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2 w-8" />
            </tr>
          </thead>
          <tbody>
            {draft.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-[var(--text-muted)]/50 text-[11px]">
                  No events. Click + Add Event.
                </td>
              </tr>
            )}
            {draft.map((ev, i) => (
              <tr key={i} className="border-t border-[var(--border)]">
                <td className="px-3 py-1.5">
                  <input
                    type="number"
                    value={ev.id}
                    onChange={e => setField(i, 'id', parseInt(e.target.value) || 0)}
                    className={`${inputCls} w-14 no-spinner`}
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="text"
                    value={ev.name}
                    onChange={e => setField(i, 'name', e.target.value)}
                    placeholder="e.g. 1 ms"
                    className={`${inputCls} w-full`}
                  />
                </td>
                <td className="px-3 py-1.5 text-center">
                  <button
                    onClick={() => removeEvent(i)}
                    className="text-[var(--text-muted)]/40 hover:text-[var(--status-err)] transition-colors flex items-center justify-center"
                    title="Remove"
                  >
                    <X size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={addEvent}
        className="text-[11px] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors flex items-center gap-1"
      >
        <Plus size={13} /> Add Event
      </button>
      <div className="flex items-center gap-2 pt-1">
        <Button variant="primary" onClick={save} disabled={saving || !dirty}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        {saved && <span className="text-[11px] text-[var(--status-ok)]">✓ Saved</span>}
      </div>
    </div>
  );
}

// ── About tab ────────────────────────────────────────────────────

type UpdateStatus = 'idle' | 'checking' | 'up-to-date' | 'available' | 'no-releases' | 'error';

function AboutTab() {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  async function checkForUpdates() {
    setStatus('checking');
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(
        'https://api.github.com/repos/Dheeps02/xcaliber/releases/latest',
        { signal: controller.signal }
      ).finally(() => clearTimeout(timer));
      if (res.status === 404) { setStatus('no-releases'); return; }
      if (!res.ok) throw new Error();
      const data = await res.json() as { tag_name: string };
      const latest = data.tag_name.replace(/^v/, '');
      setLatestVersion(latest);
      setStatus(latest === __APP_VERSION__ ? 'up-to-date' : 'available');
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Branding block */}
      <div className="flex items-center gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: 'color-mix(in srgb, var(--accent) 10%, var(--surface-overlay))',
            border: '1px solid color-mix(in srgb, var(--accent) 25%, var(--border))',
          }}
        >
          <span className="font-bold text-lg font-mono tracking-tight" style={{ color: 'var(--accent)' }}>X</span>
        </div>
        <div>
          <p className="text-base font-semibold text-[var(--text-primary)] tracking-tight">ZenScope</p>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">XCP measurement and calibration client</p>
        </div>
      </div>

      {/* Meta */}
      <div className="space-y-2.5">
        <Row label="Version">
          <span className="text-[11px] text-[var(--text-secondary)] font-mono">{__APP_VERSION__}</span>
        </Row>
        <Row label="Source">
          <button
            onClick={() => window.open(GITHUB_URL, '_blank')}
            className="text-[11px] text-[var(--accent)] hover:brightness-110 transition-all font-mono flex items-center gap-1"
          >
            github.com/Dheeps02/xcaliber <ArrowSquareOut size={12} />
          </button>
        </Row>
      </div>

      {/* Update check */}
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            onClick={checkForUpdates}
            disabled={status === 'checking'}
          >
            <ArrowsClockwise size={13} className={status === 'checking' ? 'animate-spin' : ''} />
            {status === 'checking' ? 'Checking…' : 'Check for Updates'}
          </Button>
          {status === 'up-to-date' && (
            <span className="text-[11px] text-[var(--status-ok)]">✓ Up to date</span>
          )}
          {status === 'available' && latestVersion && (
            <span className="text-[11px] text-[var(--status-warn)] flex items-center gap-1.5">
              v{latestVersion} available —
              <button
                onClick={() => window.open(RELEASES_URL, '_blank')}
                className="text-[var(--accent)] hover:brightness-110 transition-all underline"
              >
                Download ↗
              </button>
            </span>
          )}
          {status === 'no-releases' && (
            <span className="text-[11px] text-[var(--text-muted)]">No releases published yet</span>
          )}
          {status === 'error' && (
            <span className="text-[11px] text-[var(--status-err)]">Could not reach GitHub</span>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] text-[var(--text-muted)] font-medium w-14 shrink-0">{label}</span>
      {children}
    </div>
  );
}

// ── Tab config ────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'appearance',    label: 'Appearance',    icon: Palette },
  { id: 'connection',    label: 'Connection',    icon: PlugsConnected },
  { id: 'trace',         label: 'Trace',         icon: Scroll },
  { id: 'events',        label: 'Events',        icon: Lightning },
  { id: 'usercmd',       label: 'USER_CMDs',     icon: Terminal },
  { id: 'accessibility', label: 'Accessibility', icon: Eye },
  { id: 'about',         label: 'About',         icon: Info },
];

// ── Modal ─────────────────────────────────────────────────────────

export function Settings({ onClose, initialTab }: Props) {
  const [tab, setTab] = useState<Tab>((initialTab as Tab | undefined) ?? 'appearance');
  const [animKey, setAnimKey] = useState(0);
  const [closing, setClosing] = useState(false);
  const prevTab = useRef(tab);

  function handleClose() {
    setClosing(true);
    setTimeout(onClose, 180);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function switchTab(t: Tab) {
    if (t === prevTab.current) return;
    prevTab.current = t;
    setTab(t);
    setAnimKey((k) => k + 1);
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 ${closing ? 'modal-backdrop-out' : 'modal-backdrop-in'}`}
        onClick={handleClose}
      />

      {/* Modal panel — frosted glass */}
      <div
        className={`relative flex overflow-hidden w-[90vw] max-w-5xl h-[85vh] max-h-[800px] rounded-xl ${closing ? 'modal-out' : 'modal-in'}`}
        style={{
          background: 'rgba(9,13,11, 0.84)',
          backdropFilter: 'blur(24px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
          border: '1px solid var(--border-strong)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        {/* Left nav */}
        <div
          className="w-48 flex flex-col shrink-0"
          style={{
            background: 'rgba(6,9,7, 0.55)',
            borderRight: '1px solid var(--border)',
          }}
        >
          <div
            className="px-4 py-3.5"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <span className="font-semibold text-sm text-[var(--text-primary)]">Settings</span>
          </div>
          <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => switchTab(t.id)}
                  className={`settings-nav-item w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors active:scale-95 ${active ? 'active' : ''}`}
                  style={active ? {
                    background: 'color-mix(in srgb, var(--accent) 15%, var(--surface-overlay))',
                    color: 'var(--accent)',
                    border: '1px solid color-mix(in srgb, var(--accent) 25%, var(--border))',
                  } : {
                    color: 'var(--text-muted)',
                    border: '1px solid transparent',
                  }}
                >
                  <span className="relative inline-flex shrink-0" style={{ width: 16, height: 16 }}>
                    <span style={{ opacity: active ? 0 : 1, transition: 'opacity 200ms ease' }}>
                      <t.icon size={16} weight="regular" />
                    </span>
                    <span
                      className="absolute inset-0"
                      style={{ opacity: active ? 1 : 0, transition: 'opacity 200ms ease' }}
                    >
                      <t.icon size={16} weight="fill" />
                    </span>
                  </span>
                  {t.label}
                </button>
              );
            })}
          </nav>
          <div className="p-2" style={{ borderTop: '1px solid var(--border)' }}>
            <Button
              variant="ghost"
              onClick={handleClose}
              className="w-full justify-start gap-1.5 px-3"
            >
              <X size={13} /> Close
            </Button>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          <div key={animKey} className="p-5 tab-content-anim">
            {tab === 'appearance'    && <AppearanceTab />}
            {tab === 'connection'    && <ConnectionTab />}
            {tab === 'trace'         && <TraceTab />}
            {tab === 'events'        && <EventsTab />}
            {tab === 'usercmd'       && <UserCmdTab />}
            {tab === 'accessibility' && <AccessibilityTab />}
            {tab === 'about'         && <AboutTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
