// Increment when changing the rules or evidence format.
export const rulesVersion = '2';
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
export function findEvidence(text: string): string[] {
  const quotes = new Set<string>();
  for (const rule of disclosures) {
    for (const match of text.matchAll(rule)) {
      quotes.add(match[0]);
      if (quotes.size === 8) return [...quotes];
    }
  }
  return [...quotes];
}
