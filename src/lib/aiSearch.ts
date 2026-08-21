// AI search — the question-shaped half of the library search box.
//
// The reader never turns anything on. They type into the same field they always
// have; keyword search runs first exactly as before. When what they typed *looks
// like a question*, this module asks Claude Haiku (the `ai-search` edge function)
// to guess the wording the relevant passages actually use, and the caller runs
// those phrases back through the SAME Postgres search. Claude never sees the
// corpus and never names a passage, so it cannot invent a result: a phrase it
// made up matches nothing and vanishes.
//
// ⚠️ This is the web half of a deliberately duplicated pair — the mobile app has
// `src/services/aiSearch.ts` with the same detector and the same fusion, and the
// two MUST stay in step or the same question behaves differently per platform.
// Same arrangement as semanticSearch.ts, which is duplicated the same way. If you
// change a rule here, change it there.
//
// The retrieval half is NOT shared, because the indexes differ: mobile runs
// SQLite FTS5 over chunk rows, web runs Postgres FTS over passage rows. See
// LibraryPanel's runAiPhraseSearch for why that difference actually helps here.

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * AI search: when a library search reads as a QUESTION rather than a lookup, ask
 * Claude Haiku for the wording the relevant passages likely use, then run those
 * phrases through the same Postgres search and blend the hits in. No toggle and
 * no separate UI — the reader just notices that questions work too.
 *
 * Turning this off returns search to keyword-only. Keyword search is unaffected
 * either way: it always runs first.
 */
export const AI_SEARCH_ENABLED = true;

export interface AiSearchPlan {
  /** Multi-word fragments to look up, best first. */
  phrases: string[];
  /** Single distinctive words, used as a fallback when no phrase hits. */
  terms: string[];
}

export type AiSearchOutcome =
  /** Claude answered; `plan` may still be empty if it judged this a literal lookup. */
  | { status: 'ok'; plan: AiSearchPlan }
  /** Anything else — stay silent; keyword results are already on screen. */
  | { status: 'unavailable' };

// Mobile's copy of this file carries a third outcome, 'offline', and shows the
// reader a message for it. Web deliberately does not: the app is served over the
// network, so a browser with no connection never reaches the search box, and one
// that drops mid-session has lost ordinary keyword search too (it queries
// Supabase). Singling out AI search there would be actively misleading.

// ─── Question detection ───────────────────────────────────────────────────────

// Straight AND curly. A double quote anywhere means the reader is asking for a
// literal match and must never be second-guessed; a lone apostrophe is NOT a
// quote here — it is a letter in Bahá'u'lláh, Qur'án and a hundred other names.
const DOUBLE_QUOTE = /["“”„«»]/;
const QUESTION_MARK = /[?？؟]/;
const FTS_OPERATORS = /(^|\s)(AND|OR|NOT)(\s|$)|\*/;

// Words that open a question. Per language, lowercased, matched against the
// first word and the first two words joined (Spanish "por qué", French "est-ce
// que"). These are recall aids on top of the question mark, not a grammar.
const LEADING_INTERROGATIVES: Record<string, string[]> = {
  en: ['is', 'are', 'was', 'were', 'do', 'does', 'did', 'what', 'where', 'when',
       'why', 'how', 'who', 'whom', 'whose', 'which', 'can', 'could', 'should',
       'would', 'will', 'has', 'have', 'any', 'anyone', 'anything', 'tell',
       'find', 'show', 'is there', 'are there', 'what does', 'where does'],
  es: ['qué', 'que', 'dónde', 'donde', 'cuál', 'cuáles', 'cómo', 'como',
       'quién', 'quiénes', 'cuándo', 'cuando', 'hay', 'existe', 'existen',
       'puede', 'por qué', 'hay algún', 'hay alguna'],
  fr: ['quoi', 'où', 'quel', 'quelle', 'quels', 'quelles', 'comment', 'pourquoi',
       'qui', 'quand', 'existe', 'peut', 'y a-t-il', 'est-ce', 'qu’est-ce',
       "qu'est-ce", 'combien'],
  ru: ['что', 'где', 'как', 'почему', 'зачем', 'кто', 'когда', 'какой', 'какая',
       'какие', 'какое', 'есть', 'можно', 'существует', 'сколько'],
  tr: ['ne', 'nerede', 'nasıl', 'neden', 'niçin', 'kim', 'kimin', 'hangi',
       'kaç', 'var', 'ne zaman', 'var mı'],
  fa: ['آیا', 'چه', 'چرا', 'کجا', 'چگونه', 'چطور', 'کی', 'کدام', 'چند', 'چقدر'],
  zh: ['是否', '有没有', '什么', '哪', '为什么', '怎么', '怎样', '如何', '谁', '哪些'],
};

// Turkish and Chinese mark questions at the END, with a particle rather than an
// opening word — the single most reliable signal in either language, and one a
// leading-word list can't see.
const TRAILING_PARTICLES: Record<string, string[]> = {
  tr: ['mı', 'mi', 'mu', 'mü', 'mıdır', 'midir', 'mudur', 'müdür'],
  zh: ['吗', '呢', '吗？', '呢？'],
};

const CJK = /[㐀-鿿぀-ヿ]/;
const TRIM_EDGE = /^[\s.,;:!?()[\]…"'“”‘’]+|[\s.,;:!?()[\]…"'“”‘’]+$/g;

/**
 * True when `query` reads as a question rather than a lookup.
 *
 * `languages` is the set of language codes to test against — pass the reader's
 * UI and content languages; English is always included, since the interface
 * language is a poor predictor of what someone types into a search box.
 */
export function looksLikeQuestion(query: string, languages: string[] = []): boolean {
  const q = (query ?? '').trim();
  if (!q) return false;

  // Explicit literal-match requests are never reinterpreted. This is what keeps
  // a quoted verse that happens to end in "?" — "How long wilt thou forget me,
  // O Lord?" — an exact keyword search.
  if (DOUBLE_QUOTE.test(q) || FTS_OPERATORS.test(q)) return false;

  const isCjk = CJK.test(q);
  const words = q.split(/\s+/).filter(Boolean);
  // A question is a sentence. One or two words is a lookup, whatever the
  // punctuation. Chinese doesn't space its words, so it's measured in characters.
  if (isCjk ? q.length < 6 : words.length < 4) return false;

  if (QUESTION_MARK.test(q)) return true;

  const codes = ['en', ...languages].filter((c, i, a) => c && a.indexOf(c) === i);
  const first = words[0]?.toLowerCase().replace(TRIM_EDGE, '') ?? '';
  const firstTwo = words.slice(0, 2).join(' ').toLowerCase().replace(TRIM_EDGE, '');
  const last = words[words.length - 1]?.toLowerCase().replace(TRIM_EDGE, '') ?? '';

  for (const code of codes) {
    const leading = LEADING_INTERROGATIVES[code];
    if (leading && (leading.includes(first) || leading.includes(firstTwo))) return true;

    const trailing = TRAILING_PARTICLES[code];
    if (trailing) {
      if (trailing.includes(last)) return true;
      // Chinese has no spaces, so the particle is the final character.
      if (code === 'zh' && trailing.some((p) => q.replace(TRIM_EDGE, '').endsWith(p))) return true;
    }
  }
  return false;
}

// ─── Planning ─────────────────────────────────────────────────────────────────

/**
 * Asks the `ai-search` edge function for phrases to look up.
 *
 * Never throws. Every failure — network, rate limit, budget, an unparseable
 * reply — resolves to `unavailable`, which the UI says nothing about, because
 * the keyword results are already on screen and still correct.
 */
export async function planAiSearch(
  supabase: SupabaseClient,
  query: string,
  language: string,
): Promise<AiSearchOutcome> {
  const q = (query ?? '').trim();
  if (q.length < 8) return { status: 'unavailable' };

  try {
    const { data, error } = await supabase.functions.invoke('ai-search', {
      body: { query: q, language: language || 'en' },
    });

    if (error) return { status: 'unavailable' };
    if (!data || data.degraded) return { status: 'unavailable' };
    if (data.isQuestion === false) return { status: 'ok', plan: { phrases: [], terms: [] } };

    return {
      status: 'ok',
      plan: {
        phrases: Array.isArray(data.phrases) ? data.phrases.filter((p: unknown) => typeof p === 'string') : [],
        terms: Array.isArray(data.terms) ? data.terms.filter((t: unknown) => typeof t === 'string') : [],
      },
    };
  } catch {
    return { status: 'unavailable' };
  }
}

// ─── Ranking ──────────────────────────────────────────────────────────────────

/**
 * Weighted Reciprocal Rank Fusion — blends independently-ranked lists into one
 * order without having to calibrate their (incomparable) score scales. Each item
 * contributes `weight / (k + rank)` from every list it appears in; standard k=60.
 *
 * The weights are the whole point here: when the reader asked a question, the
 * keyword list is mostly noise (it matched "God" and "oppression" across the
 * whole library), so the AI list is given the heavier weight and an item that
 * appears in both rises above either. Dedup is by the caller-provided key.
 */
export function weightedRankFusion<T>(
  lists: Array<{ items: T[]; weight: number }>,
  keyOf: (item: T) => string,
  k = 60,
): T[] {
  const score = new Map<string, number>();
  const first = new Map<string, T>();
  for (const { items, weight } of lists) {
    items.forEach((item, i) => {
      const key = keyOf(item);
      score.set(key, (score.get(key) ?? 0) + weight / (k + i + 1));
      if (!first.has(key)) first.set(key, item);
    });
  }
  return [...first.entries()]
    .sort((a, b) => (score.get(b[0]) ?? 0) - (score.get(a[0]) ?? 0))
    .map(([, item]) => item);
}
