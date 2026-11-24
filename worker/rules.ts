// Increment when changing the rules or evidence format.
export const rulesVersion = '5';

// Korean "received" endings that state a completed or present fact. Hypothetical
// forms such as "받고 싶어요" or "받으면" deliberately do not match.
const received = String.raw`받(?:았|아서|아(?=[\s,])|고(?=\s*(?:작성|쓴|쓰|제작|촬영|방문)))`;
const ko = (source: string) => new RegExp(source, 'gu');

const disclosures = [
  // Korean
  ko(String.raw`(?:광고비|원고료|제작비|활동비)(?:를|을)?\s*(?:지원\s*)?${received}`),
  ko(String.raw`(?:저에게|제게)\s*(?:일정액의\s*)?수수료가\s*(?:지급됩니다|지급돼요)`),
  ko(String.raw`(?:제품|상품|서비스|식사|음식|메뉴|숙박|객실|이용권|체험권|시술|원고료)(?:을|를)?\s*(?:(?:업체로부터|무상으로|무료로)\s*)*(?:제공|지원)\s*${received}`),
  ko(String.raw`협찬(?:을|를)?\s*${received}`),
  ko(String.raw`체험단(?:으로|에)?\s*(?:선정|당첨)(?:되어|돼서|되었|됐)`),
  ko(String.raw`경제적\s*(?:대가|이익)(?:를|을)?\s*${received}`),
  ko(String.raw`쿠팡\s*파트너스\s*활동의\s*일환으로`),
  ko(String.raw`(?:일정액|소정)의\s*수수료를\s*(?:제공|지급)\s*받(?:습니다|아요|을 수 있습니다)`),
  // Japanese
  /(?:謝礼|報酬)をいただ(?:いています|きました)/gu,
  /私に(?:紹介料|手数料)が入ります/gu,
  /(?:商品|製品)(?:の提供を受け|をご提供いただき|を提供していただき)/gu,
  /(?:プロモーション|アフィリエイト広告)を(?:含みます|含んでいます|利用しています)|プロモーションが含まれ(?:ます|ています)/gu,
  // English
  /\b(?:the (?:company|brand) paid me to (?:write|review)|I (?:earn|receive) (?:a |an affiliate )?commission)\b/gi,
  /\b(?:this (?:post|video) is sponsored by|i received (?:this|the) product for free)\b/gi,
  /\bthis (?:post|article|page|video) (?:contains|includes|may contain) affiliate links\b/gi,
  /\bas an amazon associate,? i earn from qualifying purchases\b/gi,
  /\bpaid partnership with\b/gi,
  // Hashtags in any language
  /(?:^|(?<=\s))#(?:광고|협찬|체험단|원고료|쿠팡파트너스|PR|広告|提供|プロモーション|ad|sponsored)(?![\p{L}\p{N}_])/giu
];

export type LinkKind = 'affiliate' | 'campaign';
export type Excerpt = {
  before: string;
  match: string;
  after: string;
  context?: 'quoted' | 'denied' | 'general';
  link?: LinkKind;
};

function contextHint(before: string, after: string): Excerpt['context'] {
  if (/^(?:냐고요\?|たわけでは(?:ありま|ない)|.{0,32}[.!?]\s*It isn['’]t\b)/i.test(after)) return 'denied';
  if (/^[^.!?\n]{0,16}?(?:아닙니다|아니에요|아니고|아닌|아님)/.test(after)) return 'denied';
  if (/[‘“「『"]\s*$/.test(before) && /[’”」』"]/.test(after)) return 'quoted';
  if (/^(?:\s*사용한 뒤.{0,20}프로그램|다는 사실이.{0,15}표시되어야)/.test(after)) return 'general';
}

export function excerptAt(text: string, index: number, length: number): Excerpt {
  const match = text.slice(index, index + length);
  const end = index + length;
  // Keep nearby context within the paragraph. Count Unicode code points
  // after slicing a bounded window so emoji at the edges stay intact.
  const left = text.slice(Math.max(0, index - 96), index).split(/[\r\n]/).at(-1)!;
  const right = text.slice(end, end + 144).split(/[\r\n]/, 1)[0];
  const before = Array.from(left).slice(-48).join('');
  const after = Array.from(right).slice(0, 72).join('');
  return { before, context: contextHint(before, after), match, after };
}

export function findExcerpts(text: string): Excerpt[] {
  const excerpts = new Map<string, Excerpt>();
  for (const rule of disclosures) {
    for (const match of text.matchAll(rule)) {
      const excerpt = excerptAt(text, match.index, match[0].length);
      const key = JSON.stringify([excerpt.match, excerpt.context]);
      if (excerpts.has(key)) continue;
      excerpts.set(key, excerpt);
      if (excerpts.size === 8) return [...excerpts.values()];
    }
  }
  return [...excerpts.values()];
}

export function findEvidence(text: string): string[] {
  return findExcerpts(text).map(excerpt => excerpt.match);
}
