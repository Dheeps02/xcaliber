import { useState, useEffect, useRef } from 'react';

const GITHUB_URL = 'https://github.com/Dheeps02/xcaliber';
const RELEASES_URL = `${GITHUB_URL}/releases`;
import { useAppStore } from '../stores/app-store';
import { api } from '../lib/api';
import type { NetworkInterface, EventDef } from '../lib/types';
import { SpinInput } from './SpinInput';

interface Props {
  onClose: () => void;
}

type Tab = 'appearance' | 'connection' | 'trace' | 'events' | 'accessibility' | 'about';

// ── Theme definitions ─────────────────────────────────────────────

interface ThemeDef {
  id: string;
  label: string;
  preview: { bg: string; sidebar: string; accent: string; text: string };
}

const THEMES: ThemeDef[] = [
  { id: 'default',          label: 'Default Dark',     preview: { bg: '#030712', sidebar: '#111827', accent: '#3b82f6', text: '#e5e7eb' } },
  { id: 'oled',             label: 'OLED',             preview: { bg: '#000000', sidebar: '#090909', accent: '#3b82f6', text: '#f0f0f0' } },
  { id: 'nord-dark',        label: 'Nord Dark',        preview: { bg: '#1a1f2e', sidebar: '#2e3440', accent: '#5e81ac', text: '#eceff4' } },
  { id: 'nord-light',       label: 'Nord Light',       preview: { bg: '#eceff4', sidebar: '#e5e9f0', accent: '#5e81ac', text: '#2e3440' } },
  { id: 'catppuccin-mocha', label: 'Catppuccin Mocha', preview: { bg: '#11111b', sidebar: '#1e1e2e', accent: '#89b4fa', text: '#cdd6f4' } },
  { id: 'catppuccin-latte', label: 'Catppuccin Latte', preview: { bg: '#eff1f5', sidebar: '#e6e9ef', accent: '#1e66f5', text: '#4c4f69' } },
  { id: 'gruvbox-dark',      label: 'Gruvbox Dark',      preview: { bg: '#1d2021', sidebar: '#282828', accent: '#458588', text: '#ebdbb2' } },
  { id: 'gruvbox-light',     label: 'Gruvbox Light',     preview: { bg: '#f9f5d7', sidebar: '#fbf1c7', accent: '#458588', text: '#3c3836' } },
  { id: 'everforest-dark',   label: 'Everforest Dark',   preview: { bg: '#272e33', sidebar: '#1e2326', accent: '#83c092', text: '#d3c6aa' } },
  { id: 'everforest-light',  label: 'Everforest Light',  preview: { bg: '#fdf6e3', sidebar: '#f8f0d4', accent: '#3a94c5', text: '#5c6a72' } },
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
};

interface ConnDraft {
  server_ip: string;
  server_port: number;
  protocol: string;
  timeout_ms: number;
  listen_port: number;
  bind_ip: string;
}

// ── Tab content components ────────────────────────────────────────

function AppearanceTab() {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  function handleSelect(id: string) {
    setTheme(id);
    applyTheme(id);
  }

  return (
    <div>
      <p className="text-[11px] text-gray-500 mb-4">Choose a colour theme. Changes apply instantly.</p>
      <div className="grid grid-cols-2 gap-2.5">
        {THEMES.map((t) => {
          const active = theme === t.id;
          return (
            <button
              key={t.id}
              onClick={() => handleSelect(t.id)}
              className={`rounded-lg overflow-hidden border-2 transition-all text-left active:scale-95 ${
                active ? 'border-blue-500' : 'border-gray-700 hover:border-gray-500'
              }`}
            >
              <div className="h-12 relative" style={{ background: t.preview.bg }}>
                <div className="absolute left-0 top-0 bottom-0 w-4" style={{ background: t.preview.sidebar }} />
                <div className="absolute left-6 top-3 right-3 h-1.5 rounded-full" style={{ background: t.preview.accent }} />
                <div className="absolute left-6 top-6 right-6 h-1 rounded-full opacity-50" style={{ background: t.preview.text }} />
                <div className="absolute left-6 top-8 right-8 h-1 rounded-full opacity-25" style={{ background: t.preview.text }} />
              </div>
              <div className={`px-2.5 py-1.5 text-[10px] font-medium flex items-center justify-between ${active ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
                <span>{t.label}</span>
                {active && <span className="text-[8px]">✓</span>}
              </div>
            </button>
          );
        })}
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
  });
  const [draft, setDraft] = useState<ConnDraft>({ ...initial });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
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
    setDraft((d) => ({ ...d, [key]: CONN_DEFAULTS[key] }));
  }

  function set(key: keyof ConnDraft, value: string | number) {
    setSaved(false);
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      await api.updateConfig({
        ...draft,
        bind_ip: draft.bind_ip || undefined,
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
          },
          server: { ...config.server, listen_port: draft.listen_port },
        });
      }
      setInitial({ ...draft });
      setSaved(true);
    } catch {
      // keep form editable
    } finally {
      setSaving(false);
    }
  }

  const inputCls = (key: keyof ConnDraft) =>
    `w-full px-2.5 py-1.5 rounded-md bg-gray-800 border text-xs font-mono text-gray-200 focus:outline-none transition-colors no-spinner ${
      isDirty(key) ? 'border-amber-500/70 focus:border-amber-400' : 'border-gray-700 focus:border-blue-500'
    }`;

  return (
    <div className="space-y-3.5">
      <p className="text-[11px] text-gray-500">Restart the connection after saving for changes to take effect.</p>

      {(
        [
          { key: 'server_ip',   label: 'Server IP',   type: 'text' as const,   placeholder: '127.0.0.1' },
          { key: 'server_port', label: 'Server Port', type: 'number' as const, min: 1,    max: 65535 },
          { key: 'timeout_ms',  label: 'Timeout (ms)',type: 'number' as const, min: 100,  step: 100 },
          { key: 'listen_port', label: 'Listen Port', type: 'number' as const, min: 1024, max: 65535 },
        ]
      ).map(({ key, label, type, ...rest }) => (
        <Field key={key} label={label} dirty={isDirty(key)} onReset={() => resetField(key)}>
          {type === 'number' ? (
            <SpinInput
              value={draft[key] as number}
              onChange={(v) => set(key, v)}
              min={(rest as { min?: number }).min}
              max={(rest as { max?: number }).max}
              step={(rest as { step?: number }).step ?? 1}
              inputClassName={inputCls(key)}
            />
          ) : (
            <input
              type="text"
              placeholder={(rest as { placeholder?: string }).placeholder}
              value={draft[key] as string}
              onChange={(e) => set(key, e.target.value)}
              className={inputCls(key)}
            />
          )}
        </Field>
      ))}

      <Field label="Protocol" dirty={isDirty('protocol')} onReset={() => resetField('protocol')}>
        <select value={draft.protocol} onChange={(e) => set('protocol', e.target.value)} className={inputCls('protocol')}>
          <option value="udp">UDP</option>
          <option value="tcp">TCP</option>
        </select>
      </Field>

      <Field label="Network Interface" dirty={isDirty('bind_ip')} onReset={() => resetField('bind_ip')}>
        <select
          value={draft.bind_ip}
          onChange={(e) => set('bind_ip', e.target.value)}
          className={inputCls('bind_ip')}
        >
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

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-1.5 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors active:scale-95"
        >
          {saving ? 'Saving…' : 'Save to config.toml'}
        </button>
        {saved && <span className="text-[10px] text-green-400">✓ Saved</span>}
      </div>
    </div>
  );
}

function Field({ label, dirty, onReset, children }: { label: string; dirty: boolean; onReset: () => void; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <label className="text-[10px] text-gray-400 font-medium">{label}</label>
        {dirty && (
          <button onClick={onReset} title="Reset to default" className="text-[10px] text-amber-500 hover:text-amber-300 transition-colors flex items-center gap-0.5">
            <span>↺</span> <span>reset</span>
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
      <p className="text-[11px] text-gray-500">Configure packet trace display behaviour.</p>
      <div>
        <label className="text-[10px] text-gray-400 font-medium block mb-1">Response Timeout (ms)</label>
        <p className="text-[10px] text-gray-600 mb-2">Show a timeout indicator if no response arrives within this threshold.</p>
        <SpinInput
          value={displayTimeoutMs}
          onChange={(v) => setDisplayTimeoutMs(Math.max(100, v))}
          min={100}
          step={100}
          inputClassName="w-32 px-2.5 py-1.5 rounded-md bg-gray-800 border border-gray-700 text-xs font-mono text-gray-200 focus:outline-none focus:border-blue-500"
        />
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none group">
      <div
        className={`w-8 h-4.5 rounded-full relative shrink-0 mt-0.5 transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-700'}`}
        onClick={() => onChange(!checked)}
      >
        <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </div>
      <div>
        <p className="text-xs text-gray-300 font-medium">{label}</p>
        {description && <p className="text-[10px] text-gray-600 mt-0.5">{description}</p>}
      </div>
    </label>
  );
}

function AccessibilityTab() {
  const animationsEnabled = useAppStore((s) => s.animationsEnabled);
  const setAnimationsEnabled = useAppStore((s) => s.setAnimationsEnabled);

  return (
    <div className="space-y-5">
      <p className="text-[11px] text-gray-500">Adjust the interface to better suit your needs.</p>
      <Toggle
        checked={animationsEnabled}
        onChange={setAnimationsEnabled}
        label="Enable animations"
        description="Packet fade-in, counter ticks, expand transitions, and theme transitions. Disable for reduced motion."
      />
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
        events: draft,
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

  const inputCls = 'px-2 py-1 rounded bg-gray-800 border border-gray-700 text-xs font-mono text-gray-200 focus:outline-none focus:border-blue-500';

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-gray-500">
        Define XCP event channels shown in the DAQ list dropdown. Changes are saved to config.toml.
      </p>
      <div className="border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-800/60 text-left text-[10px] text-gray-500 uppercase tracking-wider">
              <th className="px-3 py-2 w-16">ID</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2 w-8" />
            </tr>
          </thead>
          <tbody>
            {draft.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-gray-700 text-[11px]">No events. Click + Add Event.</td>
              </tr>
            )}
            {draft.map((ev, i) => (
              <tr key={i} className="border-t border-gray-800">
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
                    className="text-gray-600 hover:text-red-400 transition-colors text-[11px]"
                    title="Remove"
                  >✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={addEvent}
        className="text-[11px] text-gray-500 hover:text-blue-400 transition-colors flex items-center gap-1"
      >
        <span style={{ fontSize: 14 }}>+</span> Add Event
      </button>
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="px-4 py-1.5 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors active:scale-95"
        >
          {saving ? 'Saving…' : 'Save to config.toml'}
        </button>
        {saved && <span className="text-[10px] text-green-400">✓ Saved</span>}
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
        <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center shrink-0">
          <span className="text-blue-400 font-bold text-lg font-mono tracking-tight">X</span>
        </div>
        <div>
          <p className="text-base font-semibold text-gray-100 tracking-tight">XCaliber</p>
          <p className="text-[11px] text-gray-500 mt-0.5">XCP measurement and calibration client</p>
        </div>
      </div>

      {/* Meta */}
      <div className="space-y-2.5">
        <Row label="Version">
          <span className="text-[11px] text-gray-300 font-mono">{__APP_VERSION__}</span>
        </Row>
        <Row label="Source">
          <button
            onClick={() => window.open(GITHUB_URL, '_blank')}
            className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors font-mono"
          >
            github.com/Dheeps02/xcaliber ↗
          </button>
        </Row>
      </div>

      {/* Update check */}
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={checkForUpdates}
            disabled={status === 'checking'}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-gray-800 hover:bg-gray-700 disabled:opacity-50 border border-gray-700 text-gray-300 transition-colors active:scale-95"
          >
            {status === 'checking' ? 'Checking…' : 'Check for Updates'}
          </button>
          {status === 'up-to-date' && (
            <span className="text-[11px] text-green-400">✓ Up to date</span>
          )}
          {status === 'available' && latestVersion && (
            <span className="text-[11px] text-amber-400 flex items-center gap-1.5">
              v{latestVersion} available —
              <button
                onClick={() => window.open(RELEASES_URL, '_blank')}
                className="text-blue-400 hover:text-blue-300 transition-colors underline"
              >
                Download ↗
              </button>
            </span>
          )}
          {status === 'no-releases' && (
            <span className="text-[11px] text-gray-500">No releases published yet</span>
          )}
          {status === 'error' && (
            <span className="text-[11px] text-red-400">Could not reach GitHub</span>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] text-gray-500 font-medium w-14 shrink-0">{label}</span>
      {children}
    </div>
  );
}

// ── Tab config ────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'appearance',    label: 'Appearance',    icon: '🎨' },
  { id: 'connection',    label: 'Connection',    icon: '🔌' },
  { id: 'trace',         label: 'Trace',         icon: '📋' },
  { id: 'events',        label: 'Events',        icon: '⚡' },
  { id: 'accessibility', label: 'Accessibility', icon: '♿' },
  { id: 'about',         label: 'About',         icon: 'ℹ️' },
];

// ── Modal ─────────────────────────────────────────────────────────

export function Settings({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('appearance');
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
      <div className={`absolute inset-0 bg-black/60 backdrop-blur-sm ${closing ? 'modal-backdrop-out' : 'modal-backdrop-in'}`} onClick={handleClose} />
      <div
        className={`relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl flex overflow-hidden ${closing ? 'modal-out' : 'modal-in'}`}
        style={{ width: 660, height: 480 }}
      >
        {/* Left nav */}
        <div className="w-40 bg-gray-950 border-r border-gray-800 flex flex-col shrink-0">
          <div className="px-4 py-3.5 border-b border-gray-800">
            <span className="font-semibold text-sm text-gray-100">Settings</span>
          </div>
          <nav className="flex-1 p-2 space-y-0.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => switchTab(t.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors active:scale-95 ${
                  tab === t.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`}
              >
                <span className="text-sm leading-none">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </nav>
          <div className="p-2 border-t border-gray-800">
            <button
              onClick={handleClose}
              className="w-full px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors text-left active:scale-95"
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          <div key={animKey} className="p-5 tab-content-anim">
            {tab === 'appearance'    && <AppearanceTab />}
            {tab === 'connection'    && <ConnectionTab />}
            {tab === 'trace'         && <TraceTab />}
            {tab === 'events'        && <EventsTab />}
            {tab === 'accessibility' && <AccessibilityTab />}
            {tab === 'about'         && <AboutTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
