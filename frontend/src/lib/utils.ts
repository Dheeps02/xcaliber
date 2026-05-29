const ABBREVS = new Set([
  'PID', 'CTO', 'DTO', 'MTA', 'DAQ', 'XCP', 'TX', 'RX',
  'UDP', 'TCP', 'IP', 'CTR', 'DIR', 'SSE', 'ID', 'OBD',
]);

function fixAbbrevs(s: string): string {
  return s.replace(/\b[A-Za-z]+\b/g, (word) => {
    const up = word.toUpperCase();
    return ABBREVS.has(up) ? up : word;
  });
}

export function toTitleCase(str: string): string {
  const titled = str.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return fixAbbrevs(titled);
}

export function formatLabel(s: string): string {
  const titled = s
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return fixAbbrevs(titled);
}

export function formatTime(ms: number): string {
  const d = new Date(ms);
  return d.toTimeString().slice(0, 8) + '.' + String(d.getMilliseconds()).padStart(3, '0');
}
