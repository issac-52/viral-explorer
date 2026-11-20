import { postUrl, readPost } from './naver';
import { findExcerpts, rulesVersion, type Excerpt } from './rules';

const reply = (data: unknown, status = 200) => Response.json(data, {
  status, headers: { 'Cache-Control': 'no-store' }
});
type Row = { id: string; evidence: string };
function result(row: Row, status = 200) {
  const stored: (string | Excerpt)[] = JSON.parse(row.evidence);
  const excerpts = stored.map(item => typeof item === 'string'
    ? { before: '', match: item, after: '' }
    : item);
  return reply({ id: row.id, evidence: excerpts.map(item => item.match), excerpts }, status);
}

export default {
  async fetch(request: Request, env: { DB: D1Database; ANALYSIS_LIMIT: RateLimit }) {
    const path = new URL(request.url).pathname;
    const id = path.match(/^\/api\/analyses\/([a-f0-9-]{36})$/)?.[1];
    if (id && request.method === 'GET') {
      const row = await env.DB.prepare('SELECT id, evidence FROM analyses WHERE id = ?').bind(id).first<Row>();
      return row ? result(row) : reply({ error: 'not_found' }, 404);
    }
    if (path !== '/api/analyses') return reply({ error: 'not_found' }, 404);
    if (request.method !== 'POST') return reply({ error: 'method' }, 405);
    if (!request.headers.get('content-type')?.startsWith('application/json')) return reply({ error: 'content_type' }, 415);
    const client = request.headers.get('CF-Connecting-IP') || 'local';
    const { success } = await env.ANALYSIS_LIMIT.limit({ key: client });
    if (!success) return reply({ error: 'rate_limited' }, 429);
    const reader = request.body?.getReader();
    if (!reader) return reply({ error: 'input' }, 400);
    const decoder = new TextDecoder();
    let bytes = 0;
    let raw = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 120032) {
        await reader.cancel();
        return reply({ error: 'too_large' }, 413);
      }
      raw += decoder.decode(value, { stream: true });
    }
    let body;
    try { body = JSON.parse(raw + decoder.decode()); }
    catch { return reply({ error: 'input' }, 400); }
    let text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (body?.url !== undefined) {
      const url = typeof body.url === 'string' && postUrl(body.url);
      if (!url || body.text !== undefined) return reply({ error: 'unsupported_url' }, 422);
      try { text = await readPost(url); }
      catch (err) { console.warn('Import failed', err instanceof Error ? err.name + ' ' + err.message : 'unknown'); return reply({ error: 'manual_input' }, 422); }
    }
    if (!text || text.length > 20000) return reply({ error: 'input' }, 400);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rulesVersion + '\n' + text));
    const key = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    const lookup = env.DB.prepare('SELECT id, evidence FROM analyses WHERE cache_key = ?').bind(key);
    const cached = await lookup.first<Row>();
    if (cached) return result(cached);
    const evidence = JSON.stringify(findExcerpts(text));
    const newId = crypto.randomUUID();
    await env.DB.prepare('INSERT INTO analyses(id, cache_key, evidence) VALUES (?, ?, ?) ON CONFLICT(cache_key) DO NOTHING')
      .bind(newId, key, evidence).run();
    const row = await lookup.first<Row>();
    return row ? result(row, row.id === newId ? 201 : 200) : reply({ error: 'storage' }, 503);
  }
};
