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

test('a quoted disclosure does not hide the author’s own disclosure later in the review', () => {
  const excerpts = findExcerpts('옆 글에는 ‘제품을 제공받아 작성했습니다’라고 썼다.\n업체로부터 제품을 제공받아 작성했습니다.');
  assert.deepEqual(excerpts.map(item => item.context), ['quoted', undefined]);
});

test('common Korean, Japanese and English disclosure templates match', () => {
  for (const review of [
    '소정의 원고료를 지원받아 작성한 후기입니다.',
    '이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.',
    '레뷰 체험단으로 선정되어 방문했어요.',
    '업체로부터 식사를 무상으로 제공받아 작성했습니다.',
    '협찬을 받아 작성한 글입니다.',
    '브랜드로부터 경제적 대가를 받고 작성했습니다.',
    '#체험단 사진 위주로 올려요.',
    '※本記事はプロモーションを含みます。',
    'As an Amazon Associate I earn from qualifying purchases.',
    'This post contains affiliate links.'
  ]) {
    const excerpts = findExcerpts(review);
    assert.ok(excerpts.some(item => !item.context), review);
  }
});

test('hypotheticals, denials and how-to explanations are not direct disclosures', () => {
  for (const review of [
    '원고료를 받고 싶지만 아직 그런 제안은 없네요.',
    '체험단에 선정되면 리뷰 기한을 지켜야 해요.',
    'プロモーションを含む記事の見分け方を解説します。',
    'I wish this post contained fewer affiliate links.'
  ]) assert.deepEqual(findEvidence(review), [], review);
  const [denied] = findExcerpts('협찬받아 쓴 글이 아닙니다. 제 돈 주고 샀어요.');
  assert.equal(denied.context, 'denied');
});
