import test from 'node:test';
import assert from 'node:assert/strict';
import { postUrl, readPost } from '../worker/naver.ts';
const url = 'https://m.blog.naver.com/reviewer/123';
test('desktop and PostView URLs resolve to a fixed mobile post', () => {
  assert.equal(postUrl('https://blog.naver.com/PostView.naver?blogId=reviewer&logNo=123'), url);
  assert.equal(postUrl('https://blog.naver.com/reviewer/123?tracking=test'), url);
  assert.equal(postUrl('https://example.com/reviewer/123'), undefined);
});
test('extracts only the article and preserves paragraph boundaries', async () => {
  const text = await readPost(url, async path => path.endsWith('robots.txt')
    ? new Response('User-agent: *\nAllow: /')
    : new Response('<aside>#ad</aside><div class="se-main-container"><p>First</p><p>#협찬</p></div>', {headers:{'Content-Type':'text/html'}}));
  assert.equal(text, 'First\n#협찬');
});
test('robots denial prevents the post request', async () => {
  let calls = 0;
  await assert.rejects(readPost(url, async () => {
    calls++;
    return new Response('User-agent: *\nDisallow: /');
  }));
  assert.equal(calls, 1);
});
