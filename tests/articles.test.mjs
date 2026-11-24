import test from 'node:test';
import assert from 'node:assert/strict';
import { postUrl, readPost } from '../worker/articles.ts';
const url = 'https://m.blog.naver.com/reviewer/123';
test('desktop and PostView URLs resolve to a fixed mobile post', () => {
  assert.equal(postUrl('https://blog.naver.com/PostView.naver?blogId=reviewer&logNo=123'), url);
  assert.equal(postUrl('https://blog.naver.com/reviewer/123?tracking=test'), url);
  assert.equal(postUrl('https://example.com/reviewer/123'), undefined);
});
test('extracts only the article and preserves paragraph boundaries', async () => {
  const { text } = await readPost(url, async path => path.endsWith('robots.txt')
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

test('extracts hosted articles without site navigation or comment evidence', async () => {
  for (const [url, attribute] of [
    ['https://sample.tistory.com/21', 'class="tt_article_useless_p_margin"'],
    ['https://example.wordpress.com/2026/11/20/review', 'class="entry-content"'],
    ['https://dev.to/example/review-123', 'id="article-body"']
  ]) {
    const { text } = await readPost(url, async path => path.endsWith('robots.txt')
      ? new Response(null, {status:404})
      : new Response('<nav>#ad</nav><div ' + attribute + '><p>My review</p><aside>#ad</aside></div>', {headers:{'Content-Type':'text/html'}}));
    assert.equal(text, 'My review');
  }
});

test('collects links from the post body only, resolved against the post URL', async () => {
  const { links } = await readPost(url, async path => path.endsWith('robots.txt')
    ? new Response('User-agent: *\nAllow: /')
    : new Response('<nav><a href="https://coupa.ng/nav">x</a></nav><div class="se-main-container"><p><a href="https://www.revu.net/campaign/1"><img alt=""></a>후기</p><p><a href="/other/1">내 다른 글</a><a href="javascript:void(0)">x</a></p></div>', {headers:{'Content-Type':'text/html'}}));
  assert.deepEqual(links, ['https://www.revu.net/campaign/1', 'https://m.blog.naver.com/other/1']);
});
