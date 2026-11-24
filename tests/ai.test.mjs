import test from 'node:test';
import assert from 'node:assert/strict';
import { aiModel, classify, parseAi } from '../worker/ai.ts';

const review = '사장님이 이번 신메뉴를 맛봐 달라고 하셔서 무료로 먹고 왔어요.\n맛은 괜찮았어요.';
const reply = content => async () => Response.json({ choices: [{ message: { content: JSON.stringify(content) } }], usage: { prompt_tokens: 120, completion_tokens: 20 } });

test('AI stays off without a key', () => {
  assert.equal(aiModel({}), undefined);
  assert.equal(aiModel({ AI_API_KEY: ' ' }), undefined);
  assert.equal(aiModel({ AI_API_KEY: 'k' }), 'gpt-4o-mini');
  assert.equal(aiModel({ AI_API_KEY: 'k', AI_MODEL: 'other-model' }), 'other-model');
});

test('a disclosed verdict keeps the quote with its paragraph context', async () => {
  const { result, usage } = await classify(review, { AI_API_KEY: 'k' }, reply({ verdict: 'disclosed', kind: 'gift', quote: '무료로 먹고 왔어요' }));
  assert.equal(result.verdict, 'disclosed');
  assert.equal(result.kind, 'gift');
  assert.equal(result.excerpt.match, '무료로 먹고 왔어요');
  assert.equal(result.excerpt.before + result.excerpt.match + result.excerpt.after, review.split('\n')[0]);
  assert.equal(usage.prompt_tokens, 120);
});

test('the request sends the review as data to the configured endpoint', async () => {
  let call;
  await classify(review, { AI_API_KEY: 'k', AI_BASE_URL: 'https://llm.example/v1/', AI_MODEL: 'm' }, async (url, init) => {
    call = { url, body: JSON.parse(init.body), auth: init.headers.Authorization };
    return reply({ verdict: 'none', kind: null, quote: null })();
  });
  assert.equal(call.url, 'https://llm.example/v1/chat/completions');
  assert.equal(call.auth, 'Bearer k');
  assert.equal(call.body.model, 'm');
  assert.equal(call.body.messages[1].content, review);
});

test('fabricated quotes, unknown verdicts and HTTP errors are rejected', async () => {
  assert.throws(() => parseAi(review, JSON.stringify({ verdict: 'disclosed', kind: 'gift', quote: '협찬받았어요' }), 'm'), /quote/);
  assert.throws(() => parseAi(review, JSON.stringify({ verdict: 'probably' }), 'm'), /verdict/);
  assert.throws(() => parseAi(review, 'not json', 'm'));
  await assert.rejects(classify(review, { AI_API_KEY: 'k' }, async () => new Response('', { status: 500 })), /HTTP 500/);
});

test('none and unclear verdicts carry no quote', () => {
  assert.deepEqual(parseAi(review, JSON.stringify({ verdict: 'unclear', kind: 'affiliate', quote: '맛은' }), 'm'), { verdict: 'unclear', model: 'm' });
});
