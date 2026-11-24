import { aiModel, aiPromptVersion, classify, type AiEnv, type AiResult } from './ai';
import { postUrl, readPost } from './articles';
import { findLinkExcerpts, urlsIn } from './links';
import { findExcerpts, rulesVersion, type Excerpt } from './rules';

type Env = AiEnv & { DB: D1Database; ANALYSIS_LIMIT: RateLimit };
type Row = { id: string; evidence: string; ai: string | null };

const reply = (data: unknown, status = 200) => Response.json(data, {
  status, headers: { 'Cache-Control': 'no-store' }
});

function result(row: Row, status = 200) {
  const stored: (string | Excerpt)[] = JSON.parse(row.evidence);
  const excerpts = stored.map(item => typeof item === 'string'
    ? { before: '', match: item, after: '' }
    : item);
  const ai: AiResult | null = row.ai ? JSON.parse(row.ai) : null;
  return reply({ id: row.id, evidence: excerpts.map(item => item.match), excerpts, ai }, status);
}

async function sha256(input: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request: Request, env: Env) {
    const path = new URL(request.url).pathname;
    const id = path.match(/^\/api\/analyses\/([a-f0-9-]{36})$/)?.[1];
    if (id && request.method === 'GET') {
      const row = await env.DB.prepare('SELECT id, evidence, ai FROM analyses WHERE id = ?').bind(id).first<Row>();
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
    let links: string[] = [];
    if (body?.url !== undefined) {
      const url = typeof body.url === 'string' && postUrl(body.url);
      if (!url || body.text !== undefined) return reply({ error: 'unsupported_url' }, 422);
      try { ({ text, links } = await readPost(url)); }
      catch (err) { console.warn('Import failed', err instanceof Error ? err.name + ' ' + err.message : 'unknown'); return reply({ error: 'manual_input' }, 422); }
    }
    if (!text || text.length > 20000) return reply({ error: 'input' }, 400);

    const wording = findExcerpts(text);
    // Links hidden behind banners are part of the input, so they belong in the key.
    const linkExcerpts = findLinkExcerpts([...links, ...urlsIn(text)]);
    // A clean rule match already answers the question. AI reads the context
    // only when the rules found nothing or only matches that may be quotes,
    // denials or general explanations.
    const model = aiModel(env);
    const useAi = model !== undefined && !wording.some(item => !item.context);
    const aiTag = useAi ? 'ai:' + model + ':' + aiPromptVersion : 'ai:off';
    let key = await sha256([rulesVersion, aiTag, text, '\0', ...linkExcerpts.map(item => item.match)].join('\n'));
    const lookup = (cacheKey: string) => env.DB.prepare('SELECT id, evidence, ai FROM analyses WHERE cache_key = ?').bind(cacheKey);
    const cached = await lookup(key).first<Row>();
    if (cached) return result(cached);

    let ai: AiResult | null = null;
    if (useAi) {
      try { ai = (await classify(text, env)).result; }
      catch (err) {
        console.warn('AI failed', err instanceof Error ? err.message : 'unknown');
        // Keep the result shareable, but never serve it from the cache so the
        // next request for the same text tries the model again.
        key += ':retry:' + crypto.randomUUID();
      }
    }
    const evidence = JSON.stringify([...wording, ...linkExcerpts]);
    const newId = crypto.randomUUID();
    await env.DB.prepare('INSERT INTO analyses(id, cache_key, evidence, ai) VALUES (?, ?, ?, ?) ON CONFLICT(cache_key) DO NOTHING')
      .bind(newId, key, evidence, ai && JSON.stringify(ai)).run();
    const row = await lookup(key).first<Row>();
    return row ? result(row, row.id === newId ? 201 : 200) : reply({ error: 'storage' }, 503);
  }
};
