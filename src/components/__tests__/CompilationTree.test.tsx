import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import { CompilationTree } from '../CompilationTree';

jest.mock('@/contexts/LanguageProvider', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'common.openInReader') return 'Open in reader';
      if (key === 'common.opening') return 'Opening';
      if (key === 'sharePage.fromPrivateImport') return 'from a private import';
      return key;
    },
  }),
}));

// CompilationTree pulls these in at module load; the importedReadOnly path
// never calls them, but jsdom still needs them to resolve.
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
jest.mock('@/lib/openInApp', () => ({ openInApp: jest.fn() }));
jest.mock('@/lib/catalog', () => ({
  loadCatalog: jest.fn().mockResolvedValue({}),
  bookLanguage: () => 'en',
}));

/** Root node holding one imported-book quote. */
const importedPayload = [
  {
    exportId: 'root',
    parentExportId: null,
    name: 'My Compilation',
    sortOrder: 0,
    selections: [
      {
        importedReadOnly: true,
        snapshotText: 'A quote from a private import',
        bookId: 'device-uuid-1234',
        citation: '— My Private Book.',
      },
    ],
  },
];

describe('CompilationTree — imported-book quotes', () => {
  it('renders the "from a private import" tag', () => {
    render(<CompilationTree payload={importedPayload} />);
    expect(screen.getByText('from a private import')).toBeTruthy();
  });

  it('never shows an "Open in reader" button, even when the quote is expanded', () => {
    render(<CompilationTree payload={importedPayload} />);
    // Expand the card by clicking its quote.
    fireEvent.click(screen.getByText(/A quote from a private import/));
    expect(screen.queryByText(/Open in reader/)).toBeNull();
  });
});
