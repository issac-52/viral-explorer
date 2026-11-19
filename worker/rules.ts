// Increment when changing the rules or evidence format.
export const rulesVersion = '1';
const disclosures = [
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
