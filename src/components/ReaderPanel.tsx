'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ReaderTarget } from './AppShell';

interface Passage {
  id: string;
  content: string;
  chapter_label: string | null;
  section_title: string | null;
  paragraph_number: number | null;
  sort_order: number;
}

interface BookMeta {
  title: string;
  authorName: string;
}

interface ReaderPanelProps {
  target: ReaderTarget;
  userId: string;
}

export default function ReaderPanel({ target, userId }: ReaderPanelProps) {
  const supabase = createClient();
  const [passages, setPassages] = useState<Passage[]>([]);
  const [book, setBook] = useState<BookMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!target?.bookId) return;
    loadBook(target.bookId, target.passageId);
  }, [target?.bookId]);

  async function loadBook(bookId: string, scrollToId?: string) {
    setLoading(true);
    setPassages([]);
    setBook(null);
    try {
      const [{ data: bookData }, { data: passageData }] = await Promise.all([
        supabase
          .from('books')
          .select('title, authors(name)')
          .eq('id', bookId)
          .single(),
        supabase
          .from('passages')
          .select('id, content, chapter_label, section_title, paragraph_number, sort_order')
          .eq('book_id', bookId)
          .order('sort_order'),
      ]);

      if (bookData) {
        setBook({ title: bookData.title, authorName: (bookData.authors as any)?.name ?? '' });
      }
      setPassages(passageData ?? []);

      if (scrollToId) {
        setTimeout(() => {
          document.getElementById(`p-${scrollToId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      } else {
        scrollRef.current?.scrollTo({ top: 0 });
      }
    } finally {
      setLoading(false);
    }
  }

  if (!target) {
    return (
      <div className="h-full flex items-center justify-center text-gray-300">
        <div className="text-center">
          <div className="text-5xl mb-3">✦</div>
          <p className="text-sm">Select a book to begin reading</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#1B6B7B] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Group passages by chapter
  let lastChapter = '';
  let lastSection = '';

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-8 py-12">
        {/* Book header */}
        {book && (
          <div className="mb-12 text-center">
            <h1 className="text-2xl font-semibold text-gray-900 leading-snug">{book.title}</h1>
            {book.authorName && (
              <p className="text-sm text-gray-400 mt-2">{book.authorName}</p>
            )}
          </div>
        )}

        {/* Passages */}
        {passages.map(passage => {
          const showChapter = passage.chapter_label && passage.chapter_label !== lastChapter;
          const showSection = passage.section_title && passage.section_title !== lastSection;
          if (showChapter) lastChapter = passage.chapter_label!;
          if (showSection) lastSection = passage.section_title!;

          return (
            <div key={passage.id} id={`p-${passage.id}`}>
              {showChapter && (
                <h2 className="text-lg font-semibold text-[#1B6B7B] mt-10 mb-4">
                  {passage.chapter_label}
                </h2>
              )}
              {showSection && (
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mt-6 mb-3">
                  {passage.section_title}
                </h3>
              )}
              <p className="text-gray-800 leading-relaxed mb-4 text-[17px]">
                {passage.content}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
