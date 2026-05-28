import { useState } from 'react';
import { api } from '../lib/api';

export function MtaBar() {
  const [mta, setMta] = useState('0x00000000');
  const [size, setSize] = useState(8);

  async function handleUpload() {
    const addr = parseInt(mta.replace(/^0x/i, ''), 16);
    if (isNaN(addr)) return;
    try {
      await api.setMta(0, addr);
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
          className="w-16 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs font-mono text-gray-200 focus:outline-none focus:border-blue-500"
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
      <span className="text-[10px] text-gray-600">SET_MTA fires automatically</span>
    </div>
  );
}
