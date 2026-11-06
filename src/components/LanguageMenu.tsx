'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { initColorMode } from '@/lib/colorMode';

export interface LanguageLink {
  code: string;
  label: string;
  href: string;
}

// The A / ج / 哈 mark — three scripts overlapping, standing for "language".
// Drawn from text rather than an image so it inherits the text color in both
// themes; each glyph names a font every major OS ships for that script.
function LanguageGlyph() {
  return (
    <span aria-hidden className="relative block w-8 h-8 leading-none">
      <span className="absolute left-px top-px text-[19px]" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>A</span>
      <span className="absolute right-px top-px text-[20px]" style={{ fontFamily: '"Geeza Pro", "Noto Naskh Arabic", "Segoe UI", serif' }}>ج</span>
      <span className="absolute left-2 bottom-0 text-[14px]" style={{ fontFamily: '"PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif' }}>哈</span>
    </span>
  );
}

/**
 * Language picker for the standalone pages (/get, /privacy, /support). Each
 * entry is a plain link to the same page with ?lang=<code>, so the choice is
 * server-rendered and a link someone copies keeps its language.
 */
export default function LanguageMenu({ links, current, label }: { links: LanguageLink[]; current: string; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // These pages render outside AppShell, which is what normally applies the
  // stored light/dark choice — do it here so they follow the user's setting.
  useEffect(() => { initColorMode(); }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`p-1 rounded-[10px] border text-gray-900 dark:text-[#E2EAF2] transition-colors ${
          open
            ? 'bg-white dark:bg-[#1B2A38] border-gray-200 dark:border-[#2D4050]'
            : 'border-transparent hover:bg-white dark:hover:bg-[#1B2A38] hover:border-gray-200 dark:hover:border-[#2D4050]'
        }`}
      >
        <LanguageGlyph />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute end-0 top-full mt-1.5 z-20 w-48 p-1.5 rounded-xl border border-gray-200 dark:border-[#2D4050] bg-white dark:bg-[#1B2A38] shadow-[0_10px_30px_rgba(0,0,0,0.15)]"
        >
          {links.map(l => {
            const on = l.code === current;
            return (
              <Link
                key={l.code}
                href={l.href}
                role="menuitem"
                lang={l.code}
                aria-current={on ? 'true' : undefined}
                onClick={() => setOpen(false)}
                className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-sm text-gray-800 dark:text-[#D2DCE8] hover:bg-[#F8F7F4] dark:hover:bg-[#0F1923] ${
                  on ? 'font-semibold bg-[#F8F7F4] dark:bg-[#0F1923]' : ''
                }`}
              >
                <span>{l.label}</span>
                {on && <span className="text-[#1B6B7B] dark:text-[#2D9DB3]">✓</span>}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
