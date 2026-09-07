// Proximity-cluster anchoring for quoted-phrase / AI-phrase search recall.
//
// A loose (bag-of-words / cross-row) match hit because the phrase's words sit
// close together somewhere in a passage — but centring a snippet, or the search
// highlight, on the earliest single word instead lands on an unrelated part of
// the paragraph with "the" and "he" lit up. These helpers find WHERE the words
// actually cluster. Mirror of the mobile app's src/services/searchQuery.ts
// (proximityTokens / clusterCoverage / PROXIMITY_HL_STOP).
//
// Pure and framework-free: callers pass already-normalised text + tokens.

/** The words a loose phrase match keys on: > 2 chars, lower-cased, first 10. */
export function proximityTokens(phrase: string): string[] {
  return phrase
    .split(/\s+/)
    .map(w => w.replace(/[*":()&|]/g, '').toLowerCase())
    .filter(w => w.length > 2)
    .slice(0, 10);
}

// Function words per CONTENT language — articles, prepositions, conjunctions,
// pronouns, copulas/auxiliaries (+ the archaic forms that saturate scripture,
// for `en`). They carry no search signal: "the light of God" is a query for
// "light" and "God", and lighting up every "the"/"of" in a result — or anchoring
// the snippet on one, or requiring them as AND-terms — is pure noise (bug report
// 2026-09-07). Content search is scoped to ONE language at a time, so the list
// is picked by the library language, never unioned (that would collide: "die" is
// a German article and an English verb). Mirror of the mobile app's
// STOPWORDS_BY_LANG in src/services/searchQuery.ts — keep the two in sync.
export const STOPWORDS_BY_LANG: Record<string, Set<string>> = {
  en: new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'being', 'but', 'by',
    'did', 'do', 'does', 'for', 'from', 'had', 'has', 'have', 'he', 'her', 'him',
    'his', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'me', 'my', 'nor', 'not',
    'o', 'of', 'on', 'or', 'our', 'out', 'she', 'so', 'than', 'that', 'the',
    'their', 'them', 'then', 'there', 'these', 'they', 'this', 'those', 'to',
    'unto', 'up', 'upon', 'us', 'was', 'we', 'were', 'what', 'when', 'which',
    'who', 'whom', 'why', 'with', 'ye', 'you', 'your',
    'thou', 'thee', 'thy', 'thine', 'hath', 'doth', 'dost', 'art', 'shalt', 'wilt',
  ]),
  es: new Set([
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'lo', 'de', 'del',
    'a', 'al', 'y', 'e', 'o', 'u', 'que', 'en', 'por', 'para', 'con', 'sin',
    'su', 'sus', 'mi', 'mis', 'tu', 'tus', 'se', 'le', 'les', 'me', 'te', 'nos',
    'es', 'son', 'era', 'fue', 'ser', 'está', 'esta', 'estan', 'están', 'ha', 'han',
    'no', 'ni', 'más', 'mas', 'como', 'pero', 'este', 'estos', 'estas',
  ]),
  fr: new Set([
    'le', 'la', 'les', "l'", 'un', 'une', 'des', 'de', 'du', "d'", 'au', 'aux',
    'et', 'ou', 'que', 'qui', 'ne', 'pas', 'ce', 'cet', 'cette', 'ces', 'son',
    'sa', 'ses', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'se', 'on', 'nous',
    'vous', 'ils', 'elle', 'elles', 'il', 'est', 'sont', 'était', 'etait',
    'etre', 'être', 'ete', 'été',
    'à', 'a', 'dans', 'par', 'pour', 'avec', 'sans', 'plus', 'comme', 'mais',
    'ni', 'y', 'en', 'ceux', 'leur', 'leurs',
  ]),
  de: new Set([
    'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem',
    'einer', 'eines', 'und', 'oder', 'aber', 'nicht', 'ist', 'sind', 'war',
    'waren', 'sein', 'zu', 'zur', 'zum', 'in', 'im', 'an', 'am', 'auf', 'aus',
    'bei', 'mit', 'von', 'vor', 'für', 'fur', 'ich', 'du', 'er', 'sie', 'es',
    'wir', 'ihr', 'mich', 'dich', 'sich', 'uns', 'euch', 'als', 'auch', 'wie',
    'noch', 'nur', 'so', 'dass', 'daß', 'wenn', 'weil', 'kein', 'keine',
  ]),
  ru: new Set([
    'и', 'в', 'во', 'не', 'что', 'он', 'на', 'я', 'с', 'со', 'как', 'а', 'то',
    'все', 'она', 'так', 'его', 'но', 'да', 'ты', 'к', 'у', 'же', 'вы', 'за',
    'бы', 'по', 'её', 'ее', 'мне', 'от', 'меня', 'о', 'из', 'ему', 'ли', 'если',
    'или', 'быть', 'был', 'была', 'были', 'было', 'до', 'вас', 'нибудь', 'вам',
    'ведь', 'там', 'себя', 'ей', 'они', 'тут', 'где', 'есть', 'надо', 'для',
    'мы', 'тебя', 'их', 'чем', 'сам', 'без', 'чего', 'при', 'этот', 'этого',
    'этом', 'эта', 'эти', 'том', 'тем', 'чтобы', 'кто', 'когда',
  ]),
  tr: new Set([
    've', 'veya', 'ile', 'de', 'da', 'ki', 'bir', 'bu', 'şu', 'su', 'o', 'ben',
    'sen', 'biz', 'siz', 'onlar', 'için', 'icin', 'gibi', 'ama', 'fakat',
    'ancak', 'çok', 'cok', 'daha', 'en', 'ne', 'mi', 'mı', 'mu', 'mü', 'değil',
    'degil', 'çünkü', 'cunku', 'her', 'hiç', 'hic', 'ya', 'hem', 'ise',
  ]),
  fa: new Set([
    'و', 'در', 'به', 'از', 'که', 'این', 'آن', 'با', 'را', 'برای', 'تا', 'هم',
    'یا', 'اما', 'اگر', 'بر', 'است', 'بود', 'می', 'نه', 'چه', 'هر', 'همه', 'او',
    'ما', 'شما', 'آنها', 'یک', 'بی', 'نیز', 'چون', 'همین', 'همان', 'های', 'هایی',
    'ای', 'کرد', 'شد', 'باشد', 'کنید', 'دارد',
  ]),
  zh: new Set([
    '的', '了', '和', '是', '在', '我', '你', '他', '她', '它', '们', '这', '那',
    '有', '就', '不', '也', '与', '及', '或', '而', '之', '其', '于', '又', '都',
    '被', '把', '让', '从', '向', '对', '为', '以', '等', '并', '但',
  ]),
};

export function stopwordsFor(lang?: string): Set<string> {
  const base = (lang ?? 'en').split('-')[0].toLowerCase();
  return STOPWORDS_BY_LANG[base] ?? STOPWORDS_BY_LANG.en;
}

/** English stopwords — kept as a named export for existing call sites. */
export const SEARCH_STOPWORDS = STOPWORDS_BY_LANG.en;

/** @deprecated kept for existing call sites — same set as SEARCH_STOPWORDS. */
export const PROXIMITY_HL_STOP = STOPWORDS_BY_LANG.en;

const fold = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Drop `lang`'s stopwords from `tokens`, unless that would leave nothing (an
 * all-stopword query keeps every word so it still matches something). Matched
 * both lower-cased and diacritic-folded, so one list catches a raw "está" and a
 * folded "esta". Originals returned. `lang` is the CONTENT language.
 */
export function dropStopwords(tokens: string[], lang?: string): string[] {
  const stop = stopwordsFor(lang);
  const kept = tokens.filter(t => !(stop.has(t.toLowerCase()) || stop.has(fold(t))));
  return kept.length > 0 ? kept : tokens;
}

/**
 * The tightest window over `normText` covering the most of `tokens` (each already
 * normalised the same way as `normText`). `index` is where to anchor — the start
 * of the earliest covered token in that window — and `coverage` is how many
 * distinct tokens landed inside it. `{ index: -1, coverage: 0 }` when none occur.
 */
export function clusterCoverage(
  normText: string,
  tokens: string[],
  windowChars = 220,
): { index: number; coverage: number } {
  const occ: number[][] = tokens.map(tok => {
    const list: number[] = [];
    if (!tok) return list;
    let i = normText.indexOf(tok);
    while (i !== -1 && list.length < 400) {
      list.push(i);
      i = normText.indexOf(tok, i + tok.length);
    }
    return list;
  });

  let pivot = -1;
  let pivotCount = Infinity;
  for (let k = 0; k < occ.length; k++) {
    if (occ[k].length > 0 && occ[k].length < pivotCount) {
      pivotCount = occ[k].length;
      pivot = k;
    }
  }
  if (pivot === -1) return { index: -1, coverage: 0 };

  let bestIndex = -1;
  let bestCoverage = -1;
  for (const p of occ[pivot]) {
    let coverage = 0;
    let earliest = p;
    for (let k = 0; k < occ.length; k++) {
      let nearest = -1;
      let nd = Infinity;
      for (const q of occ[k]) {
        const d = q > p ? q - p : p - q;
        if (d < nd) { nd = d; nearest = q; }
      }
      if (nearest !== -1 && nd <= windowChars) {
        coverage++;
        if (nearest < earliest) earliest = nearest;
      }
    }
    if (coverage > bestCoverage) {
      bestCoverage = coverage;
      bestIndex = earliest;
    }
  }
  return { index: bestIndex, coverage: bestCoverage };
}
