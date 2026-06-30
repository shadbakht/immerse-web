'use client';

import React from 'react';
import { Highlight } from './Highlight';

export type AnnotationVariant = 'tag' | 'note' | 'xref' | 'discover';

// Accent rail + marker color/shape per variant, mirroring the in-reader markers
// and the mobile DARK_COLORS / LIGHT_COLORS annotation palette. Discover uses the
// teal brand accent (it isn't an in-reader annotation type, so it gets a dot).
const ACCENT: Record<AnnotationVariant, { rail: string; marker: string; symbol: string }> = {
  tag:      { rail: 'bg-[#5B8EC4] dark:bg-[#7BAFD8]', marker: 'text-[#5B8EC4] dark:text-[#7BAFD8]', symbol: '●' },
  note:     { rail: 'bg-[#D4BC6A] dark:bg-[#E8CC78]', marker: 'text-[#D4BC6A] dark:text-[#E8CC78]', symbol: '■' },
  xref:     { rail: 'bg-[#5A9460] dark:bg-[#6BB073]', marker: 'text-[#5A9460] dark:text-[#6BB073]', symbol: '⬢' },
  discover: { rail: 'bg-[#1B6B7B] dark:bg-[#2D9DB3]', marker: 'text-[#1B6B7B] dark:text-[#2D9DB3]', symbol: '●' },
};

export interface AnnotationCardProps {
  variant:    AnnotationVariant;
  /** The highlighted passage. Quotation marks are added by the card. */
  quote:      string;
  citation?:  string;
  /** Optional eyebrow label beside the marker (e.g. tag name). Omit inside grouped lists. */
  kicker?:    string;
  /** Pre-formatted date shown on the citation row. */
  date?:      string;
  /** Search term to highlight within the quote and citation. */
  query?:     string;
  /** Collapse the quote to 3 lines. */
  clampQuote?: boolean;
  /** Clamp the quote to an exact number of lines (1–3). Overrides clampQuote. */
  quoteLines?: 1 | 2 | 3;
  /** Top-right action (e.g. a context menu). */
  action?:    React.ReactNode;
  onClick?:   () => void;
  /** Slot rendered directly below the quote, above the reflection (open-in-reader…). */
  belowQuote?: React.ReactNode;
  /** Content slot rendered between the quote and the citation (note reflection…). */
  children?:  React.ReactNode;
  /** Slot rendered after the citation row (open-in-reader link…). */
  footer?:    React.ReactNode;
  className?: string;
}

// Shared "soft card" used across the annotation list screens (Tags, Notes, and
// later XRefs + Discover). Skeleton = accent rail + marker shape + serif
// pull-quote + small-caps citation + flexible content slots.
export function AnnotationCard({
  variant, quote, citation, kicker, date, query = '',
  clampQuote, quoteLines, action, onClick, belowQuote, children, footer, className = '',
}: AnnotationCardProps) {
  const a = ACCENT[variant];
  // Tailwind needs literal class names — map explicitly.
  const quoteClamp =
    quoteLines === 1 ? 'line-clamp-1' :
    quoteLines === 2 ? 'line-clamp-2' :
    quoteLines === 3 ? 'line-clamp-3' :
    clampQuote       ? 'line-clamp-3' : '';
  return (
    <div className={`flex rounded-xl border border-gray-200 dark:border-[#2D4050] bg-white dark:bg-[#1B2A38] overflow-hidden ${className}`}>
      <div className={`w-1 shrink-0 ${a.rail}`} aria-hidden />
      <div className="flex-1 min-w-0 px-3.5 py-3">
        <div className="flex items-start gap-2">
          <div className={`flex-1 min-w-0 ${onClick ? 'cursor-pointer select-none' : ''}`} onClick={onClick}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className={`text-[9px] leading-none ${a.marker}`} aria-hidden>{a.symbol}</span>
              {kicker && <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-[#5C7A8E] truncate">{kicker}</span>}
            </div>
            <p className={`font-serif text-gray-700 dark:text-[#B8C7D6] leading-relaxed ${quoteClamp}`} style={{ fontSize: 'var(--quote-font-size)' }}>
              &quot;<Highlight text={quote} q={query} />&quot;
            </p>
            {belowQuote}
            {children}
            {(citation || date) && (
              <div className="flex items-center justify-between gap-2 mt-1.5">
                {citation
                  ? <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-[#5C7A8E] truncate"><Highlight text={citation} q={query} /></p>
                  : <span />}
                {date && <p className="text-[10px] text-gray-400 dark:text-[#5C7A8E] shrink-0">{date}</p>}
              </div>
            )}
            {footer}
          </div>
          {action && <div className="shrink-0" onClick={e => e.stopPropagation()}>{action}</div>}
        </div>
      </div>
    </div>
  );
}

export default AnnotationCard;
