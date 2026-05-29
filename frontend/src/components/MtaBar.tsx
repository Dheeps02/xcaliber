import { useState } from 'react';
import { api } from '../lib/api';

export function MtaBar() {
  const [mta, setMta] = useState('0x00000000');
  const [size, setSize] = useState(8);
  const [autoMta, setAutoMta] = useState(true);

  async function handleUpload() {
    const addr = parseInt(mta.replace(/^0x/i, ''), 16);
    if (isNaN(addr)) return;
    try {
      if (autoMta) await api.setMta(0, addr);
      await api.upload(size);
    } catch (e) {
      console.error('Upload failed:', e);
    }
  }

  return (
    <div className="flex items-center gap-4 px-4 h-10 border-b border-gray-800 bg-gray-900 shrink-0">
      <div className="flex items-center gap-2">
        <label className="text-[10px] text-gray-500 shrink-0">MTA</label>
        <input
          value={mta}
          onChange={(e) => setMta(e.target.value)}
          className="w-28 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs font-mono text-gray-200 focus:outline-none focus:border-blue-500"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-[10px] text-gray-500 shrink-0">SIZE</label>
        <input
          type="number"
          min={1}
          value={size}
          onChange={(e) => setSize(Math.max(1, Number(e.target.value)))}
          className="no-spinner w-10 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs font-mono text-gray-200 focus:outline-none focus:border-blue-500"
        />
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={handleUpload}
          className="px-3 py-1 rounded text-xs font-medium bg-green-600/15 text-green-400 border border-green-500/30 hover:bg-green-600/25 transition-colors"
        >
          Upload
        </button>
        <button
          disabled
          title="Download (write to slave) — not yet implemented"
          className="px-3 py-1 rounded text-xs font-medium bg-orange-600/15 text-orange-400 border border-orange-500/30 opacity-40 cursor-not-allowed"
        >
          Download
        </button>
      </div>

      {/* Auto MTA toggle */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <div
          className={`w-7 h-3.5 rounded-full relative transition-colors ${
            autoMta ? 'bg-blue-600' : 'bg-gray-700'
          }`}
          onClick={() => setAutoMta(!autoMta)}
        >
          <div
            className={`w-2.5 h-2.5 bg-white rounded-full absolute top-0.5 transition-transform ${
              autoMta ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </div>
        <span className={`text-[10px] ${autoMta ? 'text-gray-400' : 'text-gray-600'}`}>
          Auto SET_MTA
        </span>
      </label>
    </div>
  );
}
