'use client';

import { useState, useRef, useEffect } from 'react';

export interface MenuOption {
  label: string;
  icon?: string;
  color?: 'default' | 'danger';
  onClick: () => void;
}

export function ContextMenu({ options }: { options: MenuOption[] }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
        title="Options"
      >
        <span className="text-gray-400 text-lg">⋮</span>
      </button>
      {open && (
        <div
          ref={menuRef}
          className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden"
        >
          {options.map((option, i) => (
            <button
              key={i}
              onClick={() => {
                option.onClick();
                setOpen(false);
              }}
              className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                option.color === 'danger' ? 'text-red-600 hover:bg-red-50' : 'text-gray-700'
              }`}
            >
              {option.icon && <span className="text-base">{option.icon}</span>}
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
