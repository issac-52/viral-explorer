import test from 'node:test';
import assert from 'node:assert/strict';
import { findEvidence } from '../worker/rules.ts';
for (const review of ['제품을 제공받아 작성했습니다.', '商品をご提供いただきました。', 'This video is sponsored by a brand.']) {
  test(review, () => {
    const quotes = findEvidence(review);
    assert.ok(quotes.length && quotes.every(q => review.includes(q)));
  });
}
test('ordinary reviews and longer hashtags do not match', () => {
  assert.deepEqual(findEvidence('직접 구매했어요. #adventure #PR旅行'), []);
});
