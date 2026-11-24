import { readFile } from 'node:fs/promises';
import { findExcerpts } from '../worker/rules.ts';
import { aiModel, classify } from '../worker/ai.ts';

const publicCases = process.argv.includes('--public');
const cases = publicCases
  ? JSON.parse(await readFile(new URL('./public-ko.json', import.meta.url))).map(c => ['ko', c.context, c.direct, c.text])
  : JSON.parse(await readFile(new URL('./cases.json', import.meta.url)));
const live = process.argv.includes('--llm');
const env = {
  AI_API_KEY: process.env.AI_API_KEY || process.env.OPENAI_API_KEY,
  AI_MODEL: process.env.AI_MODEL || process.env.EVAL_MODEL,
  AI_BASE_URL: process.env.AI_BASE_URL
};
const model = aiModel(env);
const rates = ['EVAL_INPUT_USD_PER_M', 'EVAL_OUTPUT_USD_PER_M'].map(key => {
  const value = process.env[key]?.trim();
  return value ? Number(value) : NaN;
});
if (live && (!model || !rates.every(n => Number.isFinite(n) && n >= 0))) {
  throw new Error('Set AI_API_KEY (or OPENAI_API_KEY) and both per-million USD token rates before running --llm.');
}

// Uses the same prompt and quote validation as the Worker.
async function viaModel(text) {
  const { result, usage } = await classify(text, env);
  const { prompt_tokens, completion_tokens } = usage ?? {};
  if (![prompt_tokens, completion_tokens].every(Number.isSafeInteger)) throw new Error('Missing usage');
  return { found: result.verdict === 'disclosed', usd: (prompt_tokens * rates[0] + completion_tokens * rates[1]) / 1e6 };
}

const methods = live ? ['rules', model] : ['rules'];
for (const method of methods) {
  const rows = [];
  for (const [language, category, expected, text] of cases) {
    const { found, usd } = method === 'rules'
      ? { found: findExcerpts(text).some(excerpt => !excerpt.context), usd: 0 }
      : await viaModel(text);
    rows.push({ language, expected, found, usd });
    if (found !== expected) console.log(method, language, category, expected ? 'MISS' : 'FALSE ALARM', text);
  }
  for (const language of new Set(rows.map(row => row.language))) {
    const subset = rows.filter(row => row.language === language);
    const positives = subset.filter(row => row.expected);
    const negatives = subset.filter(row => !row.expected);
    console.log(method, language, {
      falseAlarms: negatives.filter(row => row.found).length + '/' + negatives.length,
      misses: positives.filter(row => !row.found).length + '/' + positives.length,
      usdPer1000: subset.reduce((sum, row) => sum + row.usd, 0) * 1000 / subset.length
    });
  }
}
