import { useRef, useState, useEffect, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../stores/app-store';
import { CMD_CATEGORIES } from '../lib/cmd-defs';

interface CmdButton {
  id: string;
  label: string;
  pid: string;
}

function SidebarButton({
  cmd,
  active,
  onSelect,
}: {
  cmd: CmdButton;
  active: boolean;
  onSelect: () => void;
}) {
  const pid = cmd.pid.replace(/^0x/i, '');
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center rounded text-xs font-medium overflow-hidden border transition-colors ${
        active
          ? 'border-blue-500 bg-blue-900/20'
          : 'border-gray-700 bg-gray-850 hover:border-gray-600'
      }`}
    >
      <span
        className={`px-1.5 py-1 font-mono text-[10px] border-r shrink-0 flex items-center justify-center ${
          active
            ? 'bg-blue-900/40 border-blue-500/50 text-blue-400'
            : 'bg-gray-900 border-gray-700 text-gray-500'
        }`}
      >
        {pid}
      </span>
      <span
        className={`px-2 py-1 text-left flex-1 truncate font-mono tracking-tight ${
          active ? 'text-blue-300' : 'text-gray-300'
        }`}
      >
        {cmd.label}
      </span>
    </button>
  );
}

// ── Category / group filter popover ──────────────────────────────

interface FilterPopoverProps {
  anchor: HTMLElement;
  categories: string[];
  selected: Set<string>;
  onToggle: (cat: string) => void;
  onAll: () => void;
  onClose: () => void;
}

function FilterPopover({
  anchor,
  categories,
  selected,
  onToggle,
  onAll,
  onClose,
}: FilterPopoverProps) {
  const popRef = useRef<HTMLDivElement>(null);
  const rect = anchor.getBoundingClientRect();
  let x = rect.left;
  if (x + 176 > window.innerWidth - 8) x = Math.max(8, window.innerWidth - 176 - 8);

  useEffect(() => {
    function onDown(e: globalThis.MouseEvent) {
      const t = e.target as Node;
      if (popRef.current && !popRef.current.contains(t) && !anchor.contains(t)) onClose();
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [anchor, onClose]);

  return createPortal(
    <div
      ref={popRef}
      className="fixed bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-[9998]"
      style={{ top: rect.bottom + 4, left: x, width: 176 }}
    >
      <div className="p-1 max-h-52 overflow-y-auto">
        {categories.length === 0 ? (
          <p className="text-[10px] text-gray-600 px-2 py-1">No groups defined</p>
        ) : (
          categories.map((cat) => {
            const active = selected.has(cat);
            return (
              <div
                key={cat}
                className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-gray-800 transition-colors"
                onClick={() => onToggle(cat)}
              >
                <span
                  className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 text-[8px] ${
                    active ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-600 text-transparent'
                  }`}
                >
                  ✓
                </span>
                <span className={`text-xs ${active ? 'text-blue-300' : 'text-gray-400'}`}>{cat}</span>
              </div>
            );
          })
        )}
      </div>
      <div className="p-1.5 border-t border-gray-800">
        <button
          onClick={onAll}
          className="w-full py-0.5 rounded text-[10px] text-gray-400 hover:text-gray-200 hover:bg-gray-700 border border-gray-700 transition-colors"
        >
          Show All
        </button>
      </div>
    </div>,
    document.body
  );
}

// ── Main component ────────────────────────────────────────────────

type ExitData = { label: string; commands: CmdButton[] };

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);
  const [filteredSysCats, setFilteredSysCats] = useState<Set<string>>(new Set());
  const [filteredUserGroups, setFilteredUserGroups] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'system' | 'user'>('system');
  const [expandKeys, setExpandKeys] = useState<Record<string, number>>({});
  const [enteringCats, setEnteringCats] = useState<Set<string>>(new Set());
  const [exitingData, setExitingData] = useState<Map<string, ExitData>>(new Map());

  const ready = useRef(false);
  const prevSysKeysRef = useRef<string[]>([]);
  const prevUserKeysRef = useRef<string[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const activeCmd = useAppStore((s) => s.activeCmd);
  const setActiveCmd = useAppStore((s) => s.setActiveCmd);
  const customCmdDefs = useAppStore((s) => s.customCmdDefs);
  const userCmdDefs = useAppStore((s) => s.userCmdDefs);

  const userGroups = useMemo(
    () => {
      const allDefs = { ...customCmdDefs, ...userCmdDefs };
      return Object.entries(allDefs).reduce<Record<string, CmdButton[]>>((acc, [id, def]) => {
        const grp = def.group ?? 'General';
        if (!acc[grp]) acc[grp] = [];
        acc[grp].push({ id, label: def.userCmdName ?? id, pid: '0xF1' });
        return acc;
      }, {});
    },
    [customCmdDefs, userCmdDefs]
  );

  const allSysCatNames = useMemo(() => CMD_CATEGORIES.map((c) => c.name), []);
  const allUserGroupNames = useMemo(() => Object.keys(userGroups), [userGroups]);

  const visibleSysItems = useMemo(
    () =>
      CMD_CATEGORIES.filter(
        (c) => filteredSysCats.size === 0 || filteredSysCats.has(c.name)
      ).map((c) => ({ key: `sys:${c.name}`, label: c.name, commands: c.commands })),
    [filteredSysCats]
  );

  const visibleUserItems = useMemo(
    () =>
      Object.entries(userGroups)
        .filter(([n]) => filteredUserGroups.size === 0 || filteredUserGroups.has(n))
        .map(([n, cmds]) => ({ key: `user:${n}`, label: n, commands: cmds })),
    [userGroups, filteredUserGroups]
  );

  // Track filter changes → enter / exit animations.
  // useLayoutEffect runs before paint so exitingData is populated in the same
  // frame as the filter change — prevents the 1-render flash where items are
  // removed from visibleSysItems before exitingData has caught up.
  useLayoutEffect(() => {
    const currSysKeys = visibleSysItems.map((i) => i.key);
    const currUserKeys = visibleUserItems.map((i) => i.key);

    if (!ready.current) {
      ready.current = true;
      prevSysKeysRef.current = currSysKeys;
      prevUserKeysRef.current = currUserKeys;
      return;
    }

    const prevSysSet = new Set(prevSysKeysRef.current);
    const prevUserSet = new Set(prevUserKeysRef.current);
    const currSysSet = new Set(currSysKeys);
    const currUserSet = new Set(currUserKeys);

    const entering = [
      ...currSysKeys.filter((k) => !prevSysSet.has(k)),
      ...currUserKeys.filter((k) => !prevUserSet.has(k)),
    ];

    const exiting: { key: string; label: string; commands: CmdButton[] }[] = [
      ...prevSysKeysRef.current
        .filter((k) => !currSysSet.has(k))
        .map((k) => {
          const cat = CMD_CATEGORIES.find((c) => `sys:${c.name}` === k)!;
          return { key: k, label: cat.name, commands: cat.commands };
        }),
      ...prevUserKeysRef.current
        .filter((k) => !currUserSet.has(k))
        .map((k) => {
          const grpName = k.slice(5);
          return { key: k, label: grpName, commands: userGroups[grpName] ?? [] };
        }),
    ];

    if (entering.length > 0) {
      entering.forEach((k) => {
        const t = timers.current.get(`exit:${k}`);
        if (t) { clearTimeout(t); timers.current.delete(`exit:${k}`); }
      });
      setExitingData((prev) => {
        if (!entering.some((k) => prev.has(k))) return prev;
        const m = new Map(prev);
        entering.forEach((k) => m.delete(k));
        return m;
      });
      setEnteringCats((prev) => {
        const s = new Set(prev);
        entering.forEach((k) => s.add(k));
        return s;
      });
      entering.forEach((k) => {
        const old = timers.current.get(`enter:${k}`);
        if (old) clearTimeout(old);
        const t = setTimeout(() => {
          setEnteringCats((p) => { const s = new Set(p); s.delete(k); return s; });
          timers.current.delete(`enter:${k}`);
        }, 600);
        timers.current.set(`enter:${k}`, t);
      });
    }

    if (exiting.length > 0) {
      setExitingData((prev) => {
        const m = new Map(prev);
        exiting.forEach((item) => m.set(item.key, { label: item.label, commands: item.commands }));
        return m;
      });
      exiting.forEach((item) => {
        const exitMs = item.commands.length * 20 + 120 + 80;
        const old = timers.current.get(`exit:${item.key}`);
        if (old) clearTimeout(old);
        const t = setTimeout(() => {
          setExitingData((p) => { const m = new Map(p); m.delete(item.key); return m; });
          timers.current.delete(`exit:${item.key}`);
        }, exitMs);
        timers.current.set(`exit:${item.key}`, t);
      });
    }

    prevSysKeysRef.current = currSysKeys;
    prevUserKeysRef.current = currUserKeys;
  }, [visibleSysItems, visibleUserItems, userGroups]);

  useEffect(() => {
    return () => { timers.current.forEach(clearTimeout); };
  }, []);

  function toggleCollapse(key: string) {
    setCollapsedKeys((prev) => {
      const s = new Set(prev);
      if (s.has(key)) {
        s.delete(key);
        setExpandKeys((ek) => ({ ...ek, [key]: (ek[key] ?? 0) + 1 }));
      } else {
        s.add(key);
      }
      return s;
    });
  }

  function handleSelect(id: string) {
    setActiveCmd(activeCmd === id ? null : id);
  }

  function toggleFilter(cat: string) {
    const setter = activeTab === 'system' ? setFilteredSysCats : setFilteredUserGroups;
    setter((prev) => {
      const s = new Set(prev);
      if (s.has(cat)) s.delete(cat);
      else s.add(cat);
      return s;
    });
  }

  function clearFilter() {
    if (activeTab === 'system') setFilteredSysCats(new Set());
    else setFilteredUserGroups(new Set());
  }

  // Build render list preserving original order, with exiting items interleaved
  const visibleSysKeySet = new Set(visibleSysItems.map((i) => i.key));
  const visibleUserKeySet = new Set(visibleUserItems.map((i) => i.key));

  const sysRenderItems = CMD_CATEGORIES.filter((cat) => {
    const k = `sys:${cat.name}`;
    return visibleSysKeySet.has(k) || exitingData.has(k);
  }).map((cat) => {
    const k = `sys:${cat.name}`;
    return { key: k, label: cat.name, commands: cat.commands, isExiting: !visibleSysKeySet.has(k) };
  });

  const userRenderItems: { key: string; label: string; commands: CmdButton[]; isExiting: boolean }[] = [
    ...visibleUserItems.map((i) => ({ ...i, isExiting: false })),
    ...[...exitingData.entries()]
      .filter(([k]) => k.startsWith('user:') && !visibleUserKeySet.has(k))
      .map(([k, data]) => ({ key: k, label: data.label, commands: data.commands, isExiting: true })),
  ];

  const activeFilterSet = activeTab === 'system' ? filteredSysCats : filteredUserGroups;
  const activeFilterCategories = activeTab === 'system' ? allSysCatNames : allUserGroupNames;
  const hasFilter = activeFilterSet.size > 0;

  function renderBlock(item: { key: string; label: string; commands: CmdButton[]; isExiting: boolean }) {
    const { key, label, commands, isExiting } = item;
    const isEntering = enteringCats.has(key);
    const isCollapsed = collapsedKeys.has(key);
    const expandKey = expandKeys[key] ?? 0;
    const n = commands.length;

    // Outer wrapper animates the block's HEIGHT during filter enter/exit
    // so surrounding items shift smoothly instead of jumping.
    const outerStyle: React.CSSProperties = {
      display: 'grid',
      gridTemplateRows: '1fr',
      ...(isExiting
        ? { animation: `sidebar-block-out ${n * 20 + 150}ms ease forwards`, pointerEvents: 'none' as const }
        : isEntering
        ? { animation: 'sidebar-block-in 200ms ease both' }
        : {}),
    };

    const headerStyle: React.CSSProperties = isExiting
      ? { animation: `sidebar-header-out 120ms ease-in ${n * 20}ms forwards` }
      : isEntering
      ? { animation: 'sidebar-header-in 150ms ease-out both' }
      : {};

    return (
      <div key={key} style={outerStyle}>
        <div style={{ minHeight: 0, overflow: 'hidden' }}>
          <div className="border-t border-gray-800">
            <button
              className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-gray-800/50 transition-colors"
              onClick={() => toggleCollapse(key)}
              style={headerStyle}
            >
              <span className="text-[9px] font-semibold uppercase tracking-widest text-gray-600">
                {label}
              </span>
              <span className="text-gray-700 text-[9px]">{isCollapsed ? '▸' : '▾'}</span>
            </button>
            <div
              style={{
                display: 'grid',
                gridTemplateRows: isCollapsed ? '0fr' : '1fr',
                transition: 'grid-template-rows 220ms ease',
              }}
            >
              <div style={{ minHeight: 0, overflow: 'hidden' }}>
                <div key={expandKey} className="px-2.5 pb-2.5 space-y-1">
                  {commands.map((cmd, i) => {
                    const cmdStyle: React.CSSProperties = isExiting
                      ? { animation: `sidebar-cmd-out 80ms ease-in ${(n - 1 - i) * 20}ms forwards` }
                      : isEntering || (ready.current && expandKey > 0)
                      ? { animation: `sidebar-cmd-in 110ms ease-out ${50 + i * 30}ms both` }
                      : {};
                    return (
                      <div key={cmd.id} style={cmdStyle}>
                        <SidebarButton
                          cmd={cmd}
                          active={activeCmd === cmd.id}
                          onSelect={() => handleSelect(cmd.id)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <aside
      className="border-r border-gray-800 bg-gray-900 flex flex-col shrink-0 overflow-hidden"
      style={{ width: collapsed ? 28 : 220, transition: 'width 150ms ease' }}
    >
      {/* Header row: tabs (left) + filter + collapse (right) */}
      <div className="flex items-end px-1 pt-2 pb-0 gap-0.5 shrink-0">
        {!collapsed && (
          <div className="relative flex flex-1 mr-1">
            {(['system', 'user'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 pb-1 text-[10px] font-semibold uppercase tracking-widest transition-colors ${
                  activeTab === tab ? 'text-blue-400' : 'text-gray-600 hover:text-gray-400'
                }`}
              >
                {tab === 'system' ? 'System' : 'User'}
              </button>
            ))}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gray-800" />
            <div
              className="absolute bottom-0 h-[2px] bg-blue-500 rounded-full"
              style={{
                width: '50%',
                transform: `translateX(${activeTab === 'user' ? '100%' : '0%'})`,
                transition: 'transform 200ms cubic-bezier(0.4,0,0.2,1)',
              }}
            />
          </div>
        )}

        {!collapsed && (activeTab === 'system' || allUserGroupNames.length > 0) && (
          <button
            onClick={(e) => setFilterAnchor((prev) => (prev ? null : e.currentTarget))}
            className={`relative w-5 h-5 mb-0.5 rounded flex items-center justify-center transition-colors hover:bg-gray-800 ${
              hasFilter ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
            }`}
            title="Filter"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
              <path d="M1 2.5A.5.5 0 0 1 1.5 2h13a.5.5 0 0 1 .35.854L10 7.707V13.5a.5.5 0 0 1-.223.416l-3 2A.5.5 0 0 1 6 15.5V7.707L1.15 2.854A.5.5 0 0 1 1 2.5z" />
            </svg>
            {hasFilter && (
              <span className="absolute w-1.5 h-1.5 bg-blue-500 rounded-full top-0 right-0" />
            )}
          </button>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-5 h-5 mb-0.5 rounded flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-gray-800 text-xs transition-colors"
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      {!collapsed && (
        <div className="flex flex-col flex-1 overflow-y-auto mt-1">
          {activeTab === 'system'
            ? sysRenderItems.map((item) => renderBlock(item))
            : userRenderItems.length === 0
            ? (
              <p className="text-[10px] text-gray-600 text-center py-6 leading-relaxed">
                No custom commands
                <br />
                <span className="text-gray-700">Add via config.toml</span>
              </p>
            )
            : userRenderItems.map((item) => renderBlock(item))
          }
        </div>
      )}

      {filterAnchor && !collapsed && (
        <FilterPopover
          anchor={filterAnchor}
          categories={activeFilterCategories}
          selected={activeFilterSet}
          onToggle={toggleFilter}
          onAll={clearFilter}
          onClose={() => setFilterAnchor(null)}
        />
      )}
    </aside>
  );
}
