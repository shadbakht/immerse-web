'use client';

import { useEffect, useRef } from 'react';

interface PanelSheetProps {
  visible:    boolean;
  onClose:    () => void;
  title:      string;
  children:   React.ReactNode;
  footer?:    React.ReactNode;
  maxHeight?: string;
}

export default function PanelSheet({ visible, onClose, title, children, footer, maxHeight = '70vh' }: PanelSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Close on backdrop mousedown (not click, to avoid conflict with text selection dismiss)
  useEffect(() => {
    if (!visible) return;
    function handleMouseDown(e: MouseEvent) {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="relative bg-white dark:bg-[#1b2128] rounded-t-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight, minHeight: '40vh' }}
      >
        {/* Handle + Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100 dark:border-white/10 shrink-0">
          <div className="w-8 h-1 rounded-full bg-gray-200 dark:bg-[#2f3740] absolute top-2 left-1/2 -translate-x-1/2" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-colors text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-5 py-4 border-t border-gray-100 dark:border-white/10 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
