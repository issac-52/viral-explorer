export const recentKey = 'exitviral.recent.v1';
type Item = { id: string; label: string; source: string | null };

function isSource(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\/\S+$/i.test(value);
}
export function readRecent(): Item[] {
  try {
    const data = JSON.parse(localStorage.getItem(recentKey) || '[]');
    return Array.isArray(data) ? data.filter((row): row is Item =>
      row && typeof row.id === 'string' && typeof row.label === 'string' &&
      (row.source === null || isSource(row.source))).slice(0, 10) : [];
  } catch { return []; }
}
export function remember(id: string, input: string, current: Item[]): Item[] {
  const value = input.trim();
  const source = isSource(value) ? value : null;
  const label = source ?? Array.from(value.replace(/\s+/g, ' ')).slice(0, 80).join('');
  const previous = current.filter(item => source ? item.source !== source : item.source !== null || item.id !== id);
  const next = [{ id, label, source }, ...previous].slice(0, 10);
  try { localStorage.setItem(recentKey, JSON.stringify(next)); } catch { /* Keep the in-memory list. */ }
  return next;
}
export function forgetRecent(): Item[] {
  try { localStorage.removeItem(recentKey); } catch { /* Nothing stored. */ }
  return [];
}
