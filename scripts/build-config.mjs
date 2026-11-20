import { readFile, writeFile } from 'node:fs/promises';

const template = await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
const id = process.env.D1_DATABASE_ID?.trim();
const localId = '00000000-0000-0000-0000-000000000001';
if (!id || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id) || id === localId) {
  throw new Error('Set D1_DATABASE_ID in Workers Builds to the existing exitviral D1 UUID.');
}
const binding = /("database_id"\s*:\s*")[^"]+(")/g;
if (Array.from(template.matchAll(binding)).length !== 1) {
  throw new Error('Expected exactly one D1 binding. Check the production build configuration.');
}
await writeFile(new URL('../wrangler.build.jsonc', import.meta.url), template.replace(binding, (_, start, end) => start + id + end));
