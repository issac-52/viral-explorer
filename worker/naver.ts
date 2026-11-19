import robotsParser from 'robots-parser';
import { load } from 'cheerio/slim';

const origin = 'https://m.blog.naver.com';
const agent = 'ExitViral';
export function postUrl(input: string): string | undefined {
  let url;
  try { url = new URL(input); } catch { return; }
  if (url.protocol !== 'https:' || url.port || url.username || url.password ||
      !['blog.naver.com', 'm.blog.naver.com'].includes(url.hostname)) return;
  const path = url.pathname === '/PostView.naver'
    ? '/' + url.searchParams.get('blogId') + '/' + url.searchParams.get('logNo')
    : url.pathname;
  if (url.pathname === '/PostView.naver' && !url.searchParams.has('blogId')) return;
  if (!/^\/[a-z\d_-]{1,64}\/\d{1,20}\/?$/i.test(path)) return;
  return origin + path.replace(/\/$/, '');
}

async function readLimited(response: Response, limit: number) {
  if (!response.ok || !response.body) throw Error('Unavailable');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let count = 0;
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    count += value.byteLength;
    if (count > limit) { await reader.cancel(); throw Error('Too large'); }
    text += decoder.decode(value, { stream: true });
  }
}

export async function readPost(url: string, request = fetch) {
  const options = { redirect: 'manual' as const, signal: AbortSignal.timeout(10000), headers: { 'User-Agent': agent } };
  const robotsUrl = origin + '/robots.txt';
  const policy = await readLimited(await request(robotsUrl, options), 512000);
  if (!/^\s*user-agent\s*:/im.test(policy) || !robotsParser(robotsUrl, policy).isAllowed(url, agent)) throw Error('Restricted');
  const response = await request(url, options);
  if (!response.headers.get('Content-Type')?.toLowerCase().includes('text/html')) throw Error('Expected HTML');
  const $ = load(await readLimited(response, 1500000));
  const article = $('.se-main-container, #postViewArea').first();
  const modern = article.find('.se-main-container').addBack('.se-main-container').first();
  const body = modern.length ? modern : article;
  body.find('script, style, noscript').remove();
  body.find('br').replaceWith('\n');
  body.find('p, div, li').append('\n');
  const text = body.text().trim();
  if (!text || text.length > 20000) throw Error('Manual input required');
  return text;
}
