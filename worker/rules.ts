// Increment when changing the rules or evidence format.
export const rulesVersion = '4';
const disclosures = [
  /(?:광고비|원고료)(?:를)?\s*받(?:았습니다|았어요|고 작성)/gu,
  /(?:저에게|제게)\s*(?:일정액의\s*)?수수료가\s*(?:지급됩니다|지급돼요)/gu,
  /(?:謝礼|報酬)をいただ(?:いています|きました)/gu,
  /私に(?:紹介料|手数料)が入ります/gu,
  /\b(?:the (?:company|brand) paid me to (?:write|review)|I (?:earn|receive) (?:a |an affiliate )?commission)\b/gi,
  /(?:제품|상품|원고료)(?:을|를)?\s*(?:무상으로\s*)?(?:제공받았|제공받아|제공받았습니다)/gi,
  /(?:商品|製品)(?:の提供を受け|をご提供いただき|を提供していただき)/gu,
  /\b(?:this (?:post|video) is sponsored by|i received (?:this|the) product for free)\b/gi,
  /(?:^|(?<=\s))#(?:광고|협찬|PR|広告|提供|ad|sponsored)(?![\p{L}\p{N}_])/giu
];
export type Excerpt = { before: string; match: string; after: string; context?: 'quoted' | 'denied' | 'general' };

function contextHint(before: string, after: string): Excerpt['context'] {
  if (/^(?:냐고요\?|たわけでは(?:ありま|ない)|.{0,32}[.!?]\s*It isn['’]t\b)/i.test(after)) return 'denied';
  if (/[‘“「『"]\s*$/.test(before) && /[’”」』"]/.test(after)) return 'quoted';
  if (/^(?:\s*사용한 뒤.{0,20}프로그램|다는 사실이.{0,15}표시되어야)/.test(after)) return 'general';
}

export function findExcerpts(text: string): Excerpt[] {
  const excerpts = new Map<string, Excerpt>();
  for (const rule of disclosures) {
    for (const match of text.matchAll(rule)) {

      const end = match.index + match[0].length;
      // Keep nearby context within the paragraph. Count Unicode code points
      // after slicing a bounded window so emoji at the edges stay intact.
      const left = text.slice(Math.max(0, match.index - 96), match.index).split(/[\r\n]/).at(-1)!;
      const right = text.slice(end, end + 144).split(/[\r\n]/, 1)[0];
      const before = Array.from(left).slice(-48).join('');
      const after = Array.from(right).slice(0, 72).join('');
      const context = contextHint(before, after);
      const key = JSON.stringify([match[0], context]);
      if (excerpts.has(key)) continue;
      excerpts.set(key, {
        before, context,
        match: match[0],
        after
      });
      if (excerpts.size === 8) return [...excerpts.values()];
    }
  }
  return [...excerpts.values()];
}

export function findEvidence(text: string): string[] {
  return findExcerpts(text).map(excerpt => excerpt.match);
}
