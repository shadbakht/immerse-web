'use client';

import { dropStopwords } from '@/lib/proximitySnippet';

// Renders `text`, wrapping each whitespace-delimited term of `q` in a <mark>.
// Shared by the annotation list screens (Tags, Notes) and AnnotationCard.
// Function words (the/is/of/…) are not marked unless the query is all stopwords.
export function Highlight({ text, q }: { text: string; q: string }) {
  if (!q.trim()) return <>{text}</>;
  const terms = dropStopwords(q.trim().split(/\s+/).filter(Boolean));
  const pat = new RegExp(`(${terms.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return <>{text.split(pat).map((p, i) => pat.test(p)
    ? <mark key={i} className="bg-yellow-100 text-yellow-900 rounded px-0.5">{p}</mark>
    : <span key={i}>{p}</span>)}</>;
}

export default Highlight;
