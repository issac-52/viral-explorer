import robotsParser from 'robots-parser';
import { load } from 'cheerio/slim';

const naver = 'https://m.blog.naver.com';
const agent = 'ExitViral';
export function postUrl(input: string): string | undefined {
  let url;
  try { url = new URL(input); } catch { return; }
  if (url.protocol !== 'https:' || url.port || url.username || url.password) return;
  if (!['blog.naver.com', 'm.blog.naver.com'].includes(url.hostname)) {
    const hostedBlog = /^[a-z0-9-]+\.(?:tistory|wordpress)\.com$/.test(url.hostname);
    const devArticle = url.hostname === 'dev.to' && /^\/[\w-]+\/[\w-]+\/?$/.test(url.pathname);
    if ((!hostedBlog && !devArticle) || url.pathname === '/') return;
    url.hash = '';
    return url.href;
  }
  const path = url.pathname === '/PostView.naver'
    ? '/' + url.searchParams.get('blogId') + '/' + url.searchParams.get('logNo')
    : url.pathname;
  if (url.pathname === '/PostView.naver' && !url.searchParams.has('blogId')) return;
  if (!/^\/[a-z\d_-]{1,64}\/\d{1,20}\/?$/i.test(path)) return;
  return naver + path.replace(/\/$/, '');
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
  const canonical = postUrl(url);
  if (!canonical) throw Error('Unsupported URL');
  url = canonical;
  const origin = new URL(url).origin;
  const robotsUrl = origin + '/robots.txt';
  const robots = await request(robotsUrl, options);
  if (robots.status !== 404 || origin === naver) {
    const policy = await readLimited(robots, 512000);
    if (!/^\s*user-agent\s*:/im.test(policy) || !robotsParser(robotsUrl, policy).isAllowed(url, agent)) throw Error('Restricted');
  }
  const response = await request(url, options);
  if (!response.headers.get('Content-Type')?.toLowerCase().includes('text/html')) throw Error('Expected HTML');
  const $ = load(await readLimited(response, 1500000));
  const selector = origin === naver ? '.se-main-container, #postViewArea'
    : origin === 'https://dev.to' ? '#article-body'
    : '.tt_article_useless_p_margin, [data-ke-type="article"], .entry-content, .post .entry, .wp-block-post-content';
  const articles = $(selector);
  const body = articles.first();
  if (articles.length > 1 && articles.slice(1).toArray().some(el => !body.find(el).length)) {
    throw Error('Expected a single post');
  }
  body.find('script, style, noscript, nav, aside, form, .sharedaddy, #comments, [hidden]').remove();
  body.find('br').replaceWith('\n');
  body.find('p, div, li').append('\n');
  const text = body.text().trim();
  if (!text || text.length > 20000) throw Error('Manual input required');
  return text;
}
