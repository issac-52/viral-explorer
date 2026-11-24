import type { Excerpt, LinkKind } from './rules';

// Hosts whose links pay the author a commission. Keep entries to services whose
// link format is documented; a missing host only means a missed link.
const affiliateHosts = [
  'link.coupang.com', 'coupa.ng',
  'amzn.to', 'amzn.asia',
  's.click.aliexpress.com',
  'hb.afl.rakuten.co.jp', 'af.moshimo.com', 'px.a8.net',
  'click.linksynergy.com', 'shareasale.com'
];
// Korean review-campaign (체험단) platforms. Campaign banners in Naver posts are
// images, so the link to the platform is often the only machine-readable trace.
const campaignHosts = [
  'revu.net', 'reviewnote.co.kr', 'dinnerqueen.net',
  '4blog.net', 'mrblog.net', 'seoulouba.co.kr'
];
const amazon = /(?:^|\.)amazon\.(?:com|co\.jp|co\.uk|de|fr|it|es|ca|com\.au|in)$/;

const onHost = (host: string, list: string[]) => list.some(item => host === item || host.endsWith('.' + item));

export function classifyLink(href: string): LinkKind | undefined {
  let url;
  try { url = new URL(href); } catch { return; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;
  const host = url.hostname.toLowerCase();
  if (onHost(host, affiliateHosts)) return 'affiliate';
  if (amazon.test(host) && url.searchParams.has('tag')) return 'affiliate';
  if ((host === 'coupang.com' || host.endsWith('.coupang.com')) && url.searchParams.has('lptag')) return 'affiliate';
  if (onHost(host, campaignHosts)) return 'campaign';
}

export function urlsIn(text: string): string[] {
  return Array.from(text.matchAll(/https?:\/\/[^\s<>"'`)\]）」』]+/gi), match => match[0].replace(/[.,!?。、]+$/, ''));
}

// Shows host and path only. Query strings can carry tracking identifiers that
// add nothing for a reader deciding whether the post is commercial.
function display(href: string) {
  const url = new URL(href);
  const path = url.pathname === '/' ? '' : url.pathname;
  const text = url.hostname.replace(/^www\./, '') + path;
  const chars = Array.from(text);
  return chars.length > 60 ? chars.slice(0, 59).join('') + '…' : text;
}

export function findLinkExcerpts(hrefs: string[]): Excerpt[] {
  const excerpts = new Map<string, Excerpt>();
  for (const href of hrefs) {
    const link = classifyLink(href);
    if (!link) continue;
    const match = display(href);
    if (!excerpts.has(match)) excerpts.set(match, { before: '', match, after: '', link });
    if (excerpts.size === 5) break;
  }
  return [...excerpts.values()];
}
