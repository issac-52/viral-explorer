import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyLink, findLinkExcerpts, urlsIn } from '../worker/links.ts';

test('classifies affiliate and review-campaign links', () => {
  assert.equal(classifyLink('https://link.coupang.com/a/bXyz12'), 'affiliate');
  assert.equal(classifyLink('https://www.amazon.co.jp/dp/B000000?tag=reviewer-22'), 'affiliate');
  assert.equal(classifyLink('https://www.revu.net/campaign/123'), 'campaign');
  assert.equal(classifyLink('https://www.amazon.com/dp/B000000'), undefined);
  assert.equal(classifyLink('https://notrevu.net/'), undefined);
  assert.equal(classifyLink('javascript:alert(1)'), undefined);
});

test('finds links in pasted text without trailing punctuation', () => {
  assert.deepEqual(urlsIn('구매는 여기서 https://coupa.ng/abc123. 감사합니다'), ['https://coupa.ng/abc123']);
});

test('link excerpts show host and path, drop queries and repeat links', () => {
  const excerpts = findLinkExcerpts([
    'https://www.amazon.com/dp/B01?tag=me-20',
    'https://www.amazon.com/dp/B01?tag=me-20&ref=x',
    'https://example.com/plain'
  ]);
  assert.deepEqual(excerpts, [{ before: '', match: 'amazon.com/dp/B01', after: '', link: 'affiliate' }]);
});
