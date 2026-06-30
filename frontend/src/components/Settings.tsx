import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { Palette, X, Sun, Moon, Monitor, ArrowCounterClockwise, PlugsConnected, Globe, ArrowsLeftRight, ArrowsDownUp, Network, Scroll, Timer, Clock, Lightning, Plus, Terminal } from '@phosphor-icons/react';
import { UserCmdTab } from './UserCmdTab';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { DialInput } from './ui/DialInput';
import { IpInput } from './ui/IpInput';
import { MacInput } from './ui/MacInput';
import { Select } from './ui/Select';
import { SegmentControl } from './ui/SegmentControl';
import { Slider } from './ui/Slider';
import { Toggle } from './ui/Toggle';
import { ColorPicker } from './ui/ColorPicker';
import { useAppStore } from '../stores/app-store';
import type { AppConfig, EventDef } from '../lib/types';
import { api } from '../lib/api';

interface Props {
  onClose: () => void;
  initialTab?: string;
}

// ── Save bar context ──────────────────────────────────────────────

type SaveBarState = { save: () => Promise<void>; dirty: boolean; saving: boolean } | null;
const SaveBarCtx = createContext<(s: SaveBarState) => void>(() => {});

function useSaveBar(save: () => Promise<void>, dirty: boolean, saving: boolean) {
  const set = useContext(SaveBarCtx);
  const saveRef = useRef(save);
  saveRef.current = save;
  const stableSave = useCallback(() => saveRef.current(), []);
  useEffect(() => {
    set({ save: stableSave, dirty, saving });
    return () => set(null);
  }, [stableSave, dirty, saving, set]);
}

type Tab = 'appearance' | 'connection' | 'trace' | 'events' | 'usercmds';

// ── Theme data ────────────────────────────────────────────────────

type ThemeId     = 'default' | 'light';
type ThemeFamily = 'default';
type ThemeMode   = 'dark' | 'light' | 'system';

interface ThemePreview { bg: string; sidebar: string; accent: string; text: string }

interface ThemeFamilyDef {
  id:       ThemeFamily;
  label:    string;
  dark:     ThemeId;
  light:    ThemeId;
  previews: { dark: ThemePreview; light: ThemePreview };
}

const THEME_FAMILIES: ThemeFamilyDef[] = [
  {
    id: 'default', label: 'Default',
    dark: 'default', light: 'light',
    previews: {
      dark:  { bg: '#090d0b', sidebar: '#141c18', accent: '#10b981', text: '#eef5f1' },
      light: { bg: '#f2f7f5', sidebar: '#e8f0ed', accent: '#059669', text: '#0d1f18' },
    },
  },
];

function familyOf(id: ThemeId): ThemeFamily {
  return THEME_FAMILIES.find(f => f.dark === id || f.light === id)?.id ?? 'default';
}

function modeOf(id: ThemeId): 'dark' | 'light' {
  return THEME_FAMILIES.find(f => f.light === id) ? 'light' : 'dark';
}

function resolveId(family: ThemeFamily, mode: ThemeMode): ThemeId {
  const f = THEME_FAMILIES.find(t => t.id === family)!;
  const variant = mode === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : mode;
  return variant === 'light' ? f.light : f.dark;
}

function commitTheme(id: ThemeId) {
  const html = document.documentElement;
  if (id === 'default') html.removeAttribute('data-theme');
  else html.setAttribute('data-theme', id);
}

function applyTheme(id: ThemeId) {
  const html = document.documentElement;
  const canAnimate = !html.classList.contains('no-animations') && 'startViewTransition' in document;
  if (canAnimate) {
    (document as Document & { startViewTransition(cb: () => void): void })
      .startViewTransition(() => commitTheme(id));
  } else {
    commitTheme(id);
  }
}

// ── Mini skeletal preview ─────────────────────────────────────────

function ThemeSwatch({ p }: { p: ThemePreview }) {
  return (
    <div style={{
      width: 40, height: 26, background: p.bg, borderRadius: 3,
      overflow: 'hidden', position: 'relative', flexShrink: 0,
      border: '1px solid rgba(0,0,0,0.18)',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: p.sidebar, display: 'flex', alignItems: 'center', gap: 1.5, padding: '0 3px' }}>
        <div style={{ width: 2, height: 2, borderRadius: '50%', background: p.accent, flexShrink: 0 }} />
        <div style={{ flex: 1, height: 1, borderRadius: 1, background: p.text, opacity: 0.25 }} />
      </div>
      <div style={{ position: 'absolute', left: 0, top: 6, bottom: 0, width: 9, background: p.sidebar, display: 'flex', flexDirection: 'column', gap: 1.5, padding: '2px 1.5px' }}>
        <div style={{ height: 1.5, borderRadius: 1, background: p.accent }} />
        <div style={{ height: 1.5, borderRadius: 1, background: p.text, opacity: 0.25 }} />
        <div style={{ height: 1.5, borderRadius: 1, background: p.text, opacity: 0.15 }} />
      </div>
      <div style={{ position: 'absolute', left: 9, top: 6, right: 0, bottom: 0, padding: '2px 3px', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <div style={{ height: 1.5, borderRadius: 1, background: p.accent, width: '55%' }} />
        <div style={{ height: 1.5, borderRadius: 1, background: p.text, opacity: 0.3, width: '80%' }} />
        <div style={{ height: 1.5, borderRadius: 1, background: p.text, opacity: 0.18, width: '60%' }} />
      </div>
    </div>
  );
}

const MODE_ITEMS: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { value: 'light',  label: 'Light',        icon: <Sun     size={14} /> },
  { value: 'dark',   label: 'Dark',         icon: <Moon    size={14} /> },
  { value: 'system', label: 'Match System', icon: <Monitor size={14} /> },
];

// ── Section header ────────────────────────────────────────────────

function SectionHeader({ children, icon: Icon }: { children: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {Icon && <Icon size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
      <span style={{
        width: 2,
        alignSelf: 'stretch',
        borderRadius: 1,
        flexShrink: 0,
        background: 'linear-gradient(180deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 40%, transparent) 100%)',
        boxShadow: '0 0 8px 1px color-mix(in srgb, var(--accent) 40%, transparent)',
      }} />
      <span className="text-[14px] font-semibold tracking-tight uppercase" style={{ color: 'var(--text-primary)' }}>
        {children}
      </span>
    </div>
  );
}

// ── Appearance tab ────────────────────────────────────────────────

function AppearanceTab() {
  const theme    = useAppStore(s => s.theme);
  const setTheme = useAppStore(s => s.setTheme);
  const uiZoom             = useAppStore(s => s.uiZoom);
  const setUiZoom          = useAppStore(s => s.setUiZoom);
  const [draftZoom, setDraftZoom] = useState(uiZoom);
  const animationsEnabled    = useAppStore(s => s.animationsEnabled);
  const setAnimationsEnabled = useAppStore(s => s.setAnimationsEnabled);
  const accentColor          = useAppStore(s => s.accentColor);
  const setAccentColor       = useAppStore(s => s.setAccentColor);

  const [family, setFamily] = useState<ThemeFamily>(() => familyOf(theme as ThemeId));
  const [mode,   setMode]   = useState<ThemeMode>  (() => modeOf(theme as ThemeId));

  function handleFamilyChange(f: ThemeFamily) {
    setFamily(f);
    const id = resolveId(f, mode);
    setTheme(id);
    applyTheme(id);
  }

  function handleModeChange(m: ThemeMode) {
    setMode(m);
    const id = resolveId(family, m);
    setTheme(id);
    commitTheme(id);
  }

  const familyOptions = THEME_FAMILIES.map(f => ({
    value: f.id,
    label: f.label,
    prefix: <ThemeSwatch p={mode === 'light' ? f.previews.light : f.previews.dark} />,
  }));

  return (
    <div className="space-y-7">
      {/* Theme */}
      <section className="space-y-3">
        <SectionHeader icon={Palette}>Theme</SectionHeader>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between h-8">
            <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-widest">Family</p>
            <Select value={family} onChange={handleFamilyChange} options={familyOptions} style={{ height: 30 }} />
          </div>
          <div className="flex items-center justify-between h-8">
            <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-widest">Mode</p>
            <SegmentControl
              value={mode}
              onChange={handleModeChange}
              items={MODE_ITEMS}
            />
          </div>
          <div className="flex items-center justify-between h-8">
            <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-widest">Accent</p>
            <div className="flex items-center gap-1.5">
              <ColorPicker value={accentColor} onChange={setAccentColor} />
              <Button variant="ghost" disabled={!accentColor} onClick={() => setAccentColor('')} className="!p-1 shrink-0" title="Reset">
                <ArrowCounterClockwise size={12} />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Display */}
      <section className="space-y-3">
        <SectionHeader icon={Monitor}>Display</SectionHeader>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between h-8">
            <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-widest">Enable animations</p>
            <Toggle checked={animationsEnabled} onChange={() => setAnimationsEnabled(!animationsEnabled)} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-widest">Zoom</p>
              <span className="text-[11px] font-mono text-[var(--text-muted)]">{Math.round(draftZoom * 100)}%</span>
            </div>
            <Slider
              min={0.7}
              max={1.5}
              step={0.01}
              value={draftZoom}
              onChange={setDraftZoom}
              onRelease={setUiZoom}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

// ── Connection tab ────────────────────────────────────────────────

interface ConnDraft {
  server_ip:   string;
  server_port: number;
  protocol:    string;
  timeout_ms:  number;
  listen_port: number;
  bind_ip:     string;
  source_port: number;
  src_mac:     string;
  dst_mac:     string;
  vlan_id:     number;
  endian:      string;
}

function ConnectionTab() {
  const config    = useAppStore(s => s.config);
  const setConfig = useAppStore(s => s.setConfig);
  const showToast = useAppStore(s => s.showToast);
  const [saving, setSaving] = useState(false);
  const [flashKeys, setFlashKeys] = useState<Set<string>>(new Set());

  const toDraft = (c: AppConfig): ConnDraft => ({
    server_ip:   c.connection.server_ip,
    server_port: c.connection.server_port,
    protocol:    c.connection.protocol,
    timeout_ms:  c.connection.timeout_ms,
    listen_port: c.server.listen_port,
    bind_ip:     c.connection.bind_ip     ?? '',
    source_port: c.connection.source_port ?? 0,
    src_mac:     c.connection.src_mac     ?? '',
    dst_mac:     c.connection.dst_mac     ?? '',
    vlan_id:     c.connection.vlan_id     ?? 0,
    endian:      c.endian                 ?? 'little',
  });

  const [draft, setDraft] = useState<ConnDraft | null>(() => config ? toDraft(config) : null);

  useEffect(() => {
    if (config && !draft) setDraft(toDraft(config));
  }, [config]);

  if (!draft || !config) return null;

  const saved = toDraft(config);

  function isDirty(...keys: (keyof ConnDraft)[]) {
    return keys.some(k => draft[k] !== saved[k]);
  }

  const ethernetKeys = new Set<keyof ConnDraft>(['src_mac', 'dst_mac', 'vlan_id']);
  const activeKeys   = (Object.keys(draft) as (keyof ConnDraft)[]).filter(
    k => draft.protocol === 'raw_ethernet' || !ethernetKeys.has(k),
  );
  const anyDirty = isDirty(...activeKeys);

  async function save() {
    setSaving(true);
    try {
      const isEth = draft.protocol === 'raw_ethernet';
      await api.updateConfig({
        server_ip:   draft.server_ip,
        server_port: draft.server_port,
        protocol:    draft.protocol,
        timeout_ms:  draft.timeout_ms,
        listen_port: draft.listen_port,
        bind_ip:     draft.bind_ip,
        source_port: draft.source_port,
        src_mac:     isEth ? draft.src_mac  : undefined,
        dst_mac:     isEth ? draft.dst_mac  : undefined,
        vlan_id:     isEth ? draft.vlan_id  : undefined,
        endian:      draft.endian,
        events:      config.events,
      });
      setConfig({
        ...config,
        connection: {
          ...config.connection,
          server_ip:   draft.server_ip,
          server_port: draft.server_port,
          protocol:    draft.protocol,
          timeout_ms:  draft.timeout_ms,
          bind_ip:     draft.bind_ip    || undefined,
          source_port: draft.source_port || undefined,
          src_mac:     isEth ? (draft.src_mac  || undefined) : undefined,
          dst_mac:     isEth ? (draft.dst_mac  || undefined) : undefined,
          vlan_id:     isEth ? (draft.vlan_id  || undefined) : undefined,
        },
        server: { ...config.server, listen_port: draft.listen_port },
        endian: draft.endian,
      });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  }

  useSaveBar(save, anyDirty, saving);

  function set<K extends keyof ConnDraft>(key: K, value: ConnDraft[K]) {
    setDraft(d => d ? { ...d, [key]: value } : d);
  }

  function resetKeys(...keys: (keyof ConnDraft)[]) {
    setDraft(d => {
      if (!d) return d;
      const next = { ...d };
      for (const k of keys) (next as Record<string, unknown>)[k] = saved[k];
      return next;
    });
    setFlashKeys(s => {
      const next = new Set(s);
      for (const k of keys) next.add(k as string);
      return next;
    });
    setTimeout(() => {
      setFlashKeys(s => {
        const next = new Set(s);
        for (const k of keys) next.delete(k as string);
        return next;
      });
    }, 700);
  }

  function glowStyle(...keys: (keyof ConnDraft)[]): React.CSSProperties {
    if (keys.some(k => flashKeys.has(k as string))) {
      return { animation: 'conn-reset-flash 650ms ease-out forwards', borderRadius: 5 };
    }
    if (isDirty(...keys)) {
      return {
        borderRadius: 5,
        boxShadow: '0 0 0 2px var(--status-warn), 0 0 10px 2px color-mix(in srgb, var(--status-warn) 30%, transparent)',
        transition: 'box-shadow 350ms ease',
      };
    }
    return { borderRadius: 5, boxShadow: 'none', transition: 'box-shadow 350ms ease' };
  }

  function ResetBtn({ keys }: { keys: (keyof ConnDraft)[] }) {
    const dirty    = isDirty(...keys);
    const flashing = keys.some(k => flashKeys.has(k as string));
    return (
      <Button
        variant="ghost"
        onClick={() => resetKeys(...keys)}
        disabled={!dirty || flashing}
        className="!p-1 shrink-0"
        title="Reset"
      >
        <ArrowCounterClockwise size={12} />
      </Button>
    );
  }

  const isEthernet = draft.protocol === 'raw_ethernet';
  const LABEL = 'text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-widest';

  return (
    <>
      <style>{`
        @keyframes conn-reset-flash {
          0%   { box-shadow: 0 0 0 2px var(--status-ok), 0 0 12px 3px color-mix(in srgb, var(--status-ok) 40%, transparent); }
          100% { box-shadow: none; }
        }
      `}</style>
      <div className="space-y-7">
        {/* Protocol */}
        <section className="space-y-3">
          <SectionHeader icon={PlugsConnected}>Protocol</SectionHeader>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between h-8">
              <p className={LABEL}>Protocol</p>
              <SegmentControl
                value={draft.protocol}
                onChange={v => set('protocol', v)}
                items={[
                  { value: 'udp',          label: 'UDP' },
                  { value: 'raw_ethernet', label: 'Raw Ethernet' },
                ]}
              />
            </div>
            <div className="flex items-center justify-between h-8">
              <p className={LABEL}>Endian</p>
              <SegmentControl
                value={draft.endian}
                onChange={v => set('endian', v)}
                items={[{ value: 'little', label: 'Little Endian' }, { value: 'big', label: 'Big Endian' }]}
              />
            </div>
            <div className="flex items-center justify-between h-8">
              <p className={LABEL}>Timeout</p>
              <DialInput value={draft.timeout_ms} onChange={v => set('timeout_ms', v)} min={0} max={30000} digits={5} />
            </div>
          </div>
        </section>

        {/* Endpoints */}
        <section className="space-y-3">
          <SectionHeader icon={ArrowsDownUp}>Endpoints</SectionHeader>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between h-8">
              <p className={LABEL}>Source</p>
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1.5" style={glowStyle('bind_ip', 'source_port')}>
                  <IpInput value={draft.bind_ip} onChange={v => set('bind_ip', v)} />
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>:</span>
                  <DialInput value={draft.source_port} onChange={v => set('source_port', v)} min={0} max={65535} digits={5} />
                </div>
                <ResetBtn keys={['bind_ip', 'source_port']} />
              </div>
            </div>
            <div className="flex items-center justify-between h-8">
              <p className={LABEL}>Destination</p>
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1.5" style={glowStyle('server_ip', 'server_port')}>
                  <IpInput value={draft.server_ip} onChange={v => set('server_ip', v)} />
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>:</span>
                  <DialInput value={draft.server_port} onChange={v => set('server_port', v)} min={0} max={65535} digits={5} />
                </div>
                <ResetBtn keys={['server_ip', 'server_port']} />
              </div>
            </div>
            <div className="flex items-center justify-between h-8">
              <p className={LABEL}>Listen Port</p>
              <div className="flex items-center gap-1.5">
                <div style={glowStyle('listen_port')}>
                  <DialInput value={draft.listen_port} onChange={v => set('listen_port', v)} min={0} max={65535} digits={5} />
                </div>
                <ResetBtn keys={['listen_port']} />
              </div>
            </div>
          </div>
        </section>

        {/* Ethernet — shown only for Raw Ethernet protocol */}
        {isEthernet && (
          <section className="space-y-3">
            <SectionHeader icon={ArrowsLeftRight}>Ethernet</SectionHeader>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between h-8">
                <p className={LABEL}>Src MAC</p>
                <div className="flex items-center gap-1.5">
                  <div style={glowStyle('src_mac')}>
                    <MacInput value={draft.src_mac} onChange={v => set('src_mac', v)} />
                  </div>
                  <ResetBtn keys={['src_mac']} />
                </div>
              </div>
              <div className="flex items-center justify-between h-8">
                <p className={LABEL}>Dst MAC</p>
                <div className="flex items-center gap-1.5">
                  <div style={glowStyle('dst_mac')}>
                    <MacInput value={draft.dst_mac} onChange={v => set('dst_mac', v)} />
                  </div>
                  <ResetBtn keys={['dst_mac']} />
                </div>
              </div>
              <div className="flex items-center justify-between h-8">
                <p className={LABEL}>VLAN ID</p>
                <div className="flex items-center gap-1.5">
                  <div style={glowStyle('vlan_id')}>
                    <DialInput value={draft.vlan_id} onChange={v => set('vlan_id', v)} min={0} max={4094} digits={4} />
                  </div>
                  <ResetBtn keys={['vlan_id']} />
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </>
  );
}

// ── Trace tab ─────────────────────────────────────────────────────

// [RECONSTRUCTED — verify against original]
function TraceTab() {
  const displayTimeoutMs    = useAppStore(s => s.displayTimeoutMs);
  const setDisplayTimeoutMs = useAppStore(s => s.setDisplayTimeoutMs);
  const timestampFormat     = useAppStore(s => s.timestampFormat);
  const setTimestampFormat  = useAppStore(s => s.setTimestampFormat);

  return (
    <div className="space-y-7">
      <section className="space-y-3">
        <SectionHeader icon={Timer}>Display</SectionHeader>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between h-8">
            <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-widest">Row Timeout</p>
            <DialInput
              value={displayTimeoutMs}
              onChange={setDisplayTimeoutMs}
              min={0}
              max={60000}
              digits={5}
            />
          </div>
          <div className="flex items-center justify-between h-8">
            <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-widest">Timestamp</p>
            <SegmentControl
              value={timestampFormat}
              onChange={setTimestampFormat}
              items={[
                { value: 'absolute', label: 'Absolute' },
                { value: 'relative', label: 'Relative' },
              ]}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

// ── Events tab ────────────────────────────────────────────────────

// [RECONSTRUCTED start — verify against original]
function EventsTab() {
  const config    = useAppStore(s => s.config);
  const setConfig = useAppStore(s => s.setConfig);
  const setEvents = useAppStore(s => s.setEvents);
  const showToast = useAppStore(s => s.showToast);
  const [draft, setDraft] = useState<EventDef[]>(() => config?.events ?? []);
  const [saving, setSaving] = useState(false);

  const anyUnsaved = JSON.stringify(draft) !== JSON.stringify(config?.events ?? []);

  function addEvent() {
    setDraft(d => [...d, { id: 0, name: '' }]);
  }

  function removeEvent(idx: number) {
    setDraft(d => d.filter((_, i) => i !== idx));
  }

  function setField(idx: number, key: keyof EventDef, value: string | number) {
    setDraft(d => d.map((e, i) => i === idx ? { ...e, [key]: value } : e));
  }

  async function save() {
    if (!config) return;
    setSaving(true);
    try {
      await api.updateConfig({
        server_ip:   config.connection.server_ip,
        server_port: config.connection.server_port,
        protocol:    config.connection.protocol,
        timeout_ms:  config.connection.timeout_ms,
        listen_port: config.server.listen_port,
        bind_ip:     config.connection.bind_ip,
        source_port: config.connection.source_port,
        src_mac:     config.connection.src_mac,
        dst_mac:     config.connection.dst_mac,
        vlan_id:     config.connection.vlan_id,
        endian:      config.endian,
        events:      draft,
      });
      setEvents(draft);
      setConfig({ ...config, events: draft });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to save events', 'error');
    } finally {
      setSaving(false);
    }
  }

  useSaveBar(save, anyUnsaved, saving);

  const LABEL = 'text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-widest';

  return (
    <div className="space-y-7">
      <section className="space-y-3">
        <SectionHeader icon={Lightning}>Event Channels</SectionHeader>

        {/* Column headers */}
        <div className="flex items-center gap-2 px-0.5">
          <span className={`${LABEL} shrink-0`} style={{ width: 52 }}>ID</span>
          <span className={`${LABEL} flex-1`}>Name</span>
          <div style={{ width: 24 }} />
        </div>

        {/* Rows */}
        <div className="space-y-1.5">
          {draft.length === 0 && (
            <p className="text-[11px] py-1 px-0.5" style={{ color: 'var(--text-muted)' }}>
              No events defined.
            </p>
          )}
          {draft.map((ev, i) => (
            <div key={i} className="flex items-center gap-2">
              <DialInput
                value={ev.id}
                onChange={v => setField(i, 'id', v)}
                min={0}
                max={255}
                digits={3}
                style={{ flexShrink: 0 }}
              />
              <Input
                value={ev.name}
                onChange={v => setField(i, 'name', v)}
                placeholder="e.g. 1 ms"
              />
              <Button variant="ghost" onClick={() => removeEvent(i)} className="!p-1 shrink-0">
                <X size={12} />
              </Button>
            </div>
          ))}
        </div>

        {/* Add row */}
        <Button variant="primary" onClick={addEvent} className="gap-1.5 !text-[11px] !py-1.5">
          <Plus size={13} /> Add Event
        </Button>
      </section>

    </div>
  );
}

// ── Tab config ────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'connection', label: 'Connection', icon: PlugsConnected },
  { id: 'trace',      label: 'Trace',      icon: Scroll },
  { id: 'events',     label: 'Events',     icon: Lightning },
  { id: 'usercmds',  label: 'USER_CMDs',  icon: Terminal },
];

// ── Settings modal ────────────────────────────────────────────────

export function Settings({ onClose, initialTab: _initialTab }: Props) {
  const [tab, setTab] = useState<Tab>('appearance');
  const [closing, setClosing] = useState(false);
  const [saveBar, setSaveBar] = useState<SaveBarState>(null);

  function handleClose() {
    setClosing(true);
    setTimeout(onClose, 180);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className={`absolute inset-0 bg-black/50 ${closing ? 'overlay-out' : 'overlay-in'}`}
        onClick={handleClose}
      />

      <div
        className={`relative flex overflow-hidden w-[90vw] max-w-5xl h-[85vh] max-h-[800px] rounded-2xl ${closing ? 'modal-out' : 'modal-in'}`}
        style={{
          background: 'color-mix(in srgb, var(--surface-base) 55%, transparent)',
          backdropFilter: 'blur(40px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
          border: '1px solid var(--border)',
          boxShadow: '0 32px 72px var(--shadow-9), 0 4px 20px var(--shadow-6), inset 0 1px 0 var(--shine-2)',
        }}
      >
        {/* Left nav */}
        <nav
          className="w-52 flex flex-col shrink-0"
          style={{
            background: 'color-mix(in srgb, var(--surface-raised) 35%, transparent)',
            borderRight: '1px solid var(--border)',
          }}
        >
          <div className="px-5 py-4" style={{ borderBottom: '1px solid color-mix(in srgb, var(--border) 60%, transparent)' }}>
            <span className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">Settings</span>
          </div>

          <div className="flex-1 p-2.5 overflow-y-auto">
            <SegmentControl
              items={TABS.map(t => ({
                value: t.id,
                label: t.label,
                icon: (
                  <span className="relative inline-flex shrink-0" style={{ width: 16, height: 16 }}>
                    <span style={{ opacity: tab === t.id ? 0 : 1, transition: 'opacity 180ms ease', position: 'absolute', inset: 0 }}>
                      <t.icon size={16} weight="regular" />
                    </span>
                    <span style={{ opacity: tab === t.id ? 1 : 0, transition: 'opacity 180ms ease', position: 'absolute', inset: 0 }}>
                      <t.icon size={16} weight="duotone" />
                    </span>
                  </span>
                ),
              }))}
              value={tab}
              onChange={setTab}
              variant="icon-text"
              direction="vertical"
            />
          </div>

          <div className="p-2.5" style={{ borderTop: '1px solid color-mix(in srgb, var(--border) 60%, transparent)' }}>
            <Button variant="ghost" onClick={handleClose} className="w-full justify-start gap-2 px-3">
              <X size={13} /> Close
            </Button>
          </div>
        </nav>

        {/* Content */}
        <SaveBarCtx.Provider value={setSaveBar}>
          <div className="flex-1 flex flex-col overflow-hidden">
            <div key={tab} className={`flex-1 tab-content-anim ${tab === 'usercmds' ? 'overflow-hidden' : 'overflow-y-auto p-6'}`}>
              {tab === 'appearance' && <AppearanceTab />}
              {tab === 'connection' && <ConnectionTab />}
              {tab === 'trace'      && <TraceTab />}
              {tab === 'events'     && <EventsTab />}
              {tab === 'usercmds'   && <UserCmdTab />}
            </div>
            {saveBar && (
              <div
                className="px-6 py-3 flex items-center justify-end shrink-0"
                style={{
                  borderTop: '1px solid color-mix(in srgb, var(--border) 60%, transparent)',
                  background: 'color-mix(in srgb, var(--surface-raised) 80%, transparent)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                }}
              >
                <Button variant="primary" onClick={saveBar.save} disabled={!saveBar.dirty || saveBar.saving}>
                  {saveBar.saving ? 'Applying…' : 'Apply'}
                </Button>
              </div>
            )}
          </div>
        </SaveBarCtx.Provider>
      </div>
    </div>
  );
}
