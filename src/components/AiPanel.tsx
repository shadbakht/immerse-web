'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import PanelSheet from './PanelSheet';

interface AiResult {
  title:       string;
  explanation: string;
}

interface AiPanelProps {
  visible:       boolean;
  onClose:       () => void;
  selectionText: string;
  bookTitle:     string;
  authorName:    string;
  isPro:         boolean;
}

export default function AiPanel({ visible, onClose, selectionText, bookTitle, authorName, isPro }: AiPanelProps) {
  const supabase = createClient();
  const [result, setResult] = useState<AiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!visible) { setResult(null); setError(''); return; }
    if (isPro && selectionText) fetchSummary();
  }, [visible]);

  async function fetchSummary() {
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase.functions.invoke('explain-passage', {
        body: { text: selectionText, bookTitle, authorName },
      });
      if (error) throw error;
      setResult(data);
    } catch (e: any) {
      setError(e.message ?? 'Failed to get AI summary.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    await navigator.clipboard.writeText(`${result.title}\n\n${result.explanation}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <PanelSheet visible={visible} onClose={onClose} title="AI Summary">
      <div className="px-5 py-5">
        {!isPro ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-4">✨</div>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-5">
              AI passage summaries are a Pro feature. Upgrade to get instant explanations of any passage.
            </p>
            <button className="w-full bg-[#1B6B7B] text-white font-semibold py-3 rounded-xl hover:bg-[#155a68] transition-colors">
              Upgrade to Pro — $0.99/mo
            </button>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center py-8 gap-3">
            <div className="w-6 h-6 border-2 border-[#1B6B7B] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400 dark:text-gray-500">Thinking…</p>
          </div>
        ) : error ? (
          <div className="py-6 text-center">
            <p className="text-sm text-red-500 mb-4">{error}</p>
            <button
              onClick={fetchSummary}
              className="text-sm text-[#1B6B7B] hover:underline"
            >
              Try again
            </button>
          </div>
        ) : result ? (
          <div>
            {/* Selection preview */}
            <div className="bg-gray-50 dark:bg-[#20262d] rounded-xl px-3 py-2.5 border border-gray-100 dark:border-white/10 mb-5">
              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">"{selectionText}"</p>
            </div>

            {/* AI result */}
            <h3 className="text-base font-bold text-[#1B6B7B] mb-2">{result.title}</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{result.explanation}</p>

            {/* Copy button */}
            <button
              onClick={handleCopy}
              className="mt-5 w-full py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#20262d] transition-colors"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        ) : null}
      </div>
    </PanelSheet>
  );
}
