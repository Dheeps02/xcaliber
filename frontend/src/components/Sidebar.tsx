import { useState } from 'react';
import { useAppStore } from '../stores/app-store';
import { CMD_CATEGORIES } from '../lib/cmd-defs';

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const activeCmd = useAppStore((s) => s.activeCmd);
  const setActiveCmd = useAppStore((s) => s.setActiveCmd);

  function handleSelect(id: string) {
    setActiveCmd(activeCmd === id ? null : id);
  }

  return (
    <aside
      className="border-r border-gray-800 bg-gray-900 flex flex-col shrink-0 overflow-hidden"
      style={{
        width: collapsed ? 28 : 208,
        transition: 'width 150ms ease',
      }}
    >
      <div className="flex items-center justify-end px-1 pt-2 pb-1 shrink-0">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-5 h-5 rounded flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-gray-800 text-xs transition-colors"
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      {!collapsed && (
        <div className="flex flex-col flex-1 overflow-y-auto">
          {CMD_CATEGORIES.map((cat, ci) => (
            <div
              key={cat.name}
              className={`px-3 pb-3 ${
                ci === 0 ? 'border-b border-gray-800' : 'pt-3'
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">
                {cat.name}
              </p>
              <div className="space-y-1.5">
                {cat.commands.map((cmd) => {
                  const active = activeCmd === cmd.id;
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => handleSelect(cmd.id)}
                      className={`w-full px-2 py-1.5 rounded-md text-xs font-medium text-left transition-colors flex items-center justify-between border ${
                        active
                          ? 'border-blue-500 text-blue-300 bg-blue-900/20'
                          : 'border-gray-700 text-gray-300 bg-gray-800 hover:bg-gray-700'
                      }`}
                    >
                      <span>{cmd.label}</span>
                      <span className="text-gray-600 font-mono text-[10px]">
                        {cmd.pid}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
