import test from 'node:test';
import assert from 'node:assert/strict';
import { findEvidence, findExcerpts } from '../worker/rules.ts';
for (const review of ['제품을 제공받아 작성했습니다.', '商品をご提供いただきました。', 'This video is sponsored by a brand.']) {
  test(review, () => {
    const quotes = findEvidence(review);
    assert.ok(quotes.length && quotes.every(q => review.includes(q)));
  });
}
test('ordinary reviews and longer hashtags do not match', () => {
  assert.deepEqual(findEvidence('직접 구매했어요. #adventure #PR旅行'), []);
});

test('excerpts retain local attribution and denials in the source language', () => {
  for (const line of [
    '업체로부터 제품을 제공받아 작성했습니다.',
    '옆 글에는 ‘제품을 제공받아 작성했습니다’라고 쓰여 있네요.',
    '商品の提供を受けたわけではありません。',
    "People assume this video is sponsored by the shop. It isn't."
  ]) {
    const [excerpt] = findExcerpts('private paragraph\n' + line + '\nnext paragraph');
    assert.equal(excerpt.before + excerpt.match + excerpt.after, line);
  }
});
