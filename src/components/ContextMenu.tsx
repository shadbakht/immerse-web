'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/contexts/LanguageProvider';

export interface MenuOption {
  label: string;
  icon?: string;
  color?: 'default' | 'danger';
  onClick: () => void;
}

export function ContextMenu({ options }: { options: MenuOption[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClose(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClose);
    return () => document.removeEventListener('mousedown', handleClose);
  }, [open]);

  function handleOpen() {
    if (buttonRef.current) {
      const r = buttonRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setOpen(v => !v);
  }

  return (
    <div>
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className="p-1.5 hover:bg-gray-100 dark:hover:bg-[#2D4050] rounded-lg transition-colors shrink-0"
        title={t('common.options')}
      >
        <span className="text-gray-400 dark:text-[#5C7A8E] text-lg">⋮</span>
      </button>
      {open && pos && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: pos.top, right: pos.right }}
          className="w-48 bg-white dark:bg-[#1B2A38] rounded-lg shadow-lg border border-gray-200 dark:border-[#2D4050] z-[9999] overflow-hidden"
        >
          {options.map((option, i) => (
            <button
              key={i}
              onClick={() => {
                option.onClick();
                setOpen(false);
              }}
              className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-[#243040] transition-colors border-b border-gray-100 dark:border-[#2D4050] last:border-b-0 ${
                option.color === 'danger' ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 dark:text-[#B8C7D6]'
              }`}
            >
              {option.icon && <span className="text-base">{option.icon}</span>}
              {option.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
