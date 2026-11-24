/**
 * Books read to the end in this browser, so the reader's end-of-book panel
 * celebrates each book once (a finished book reopens at its end). The web
 * twin of mobile `src/reminders/finishedBooks.ts`. Browser storage on purpose:
 * it only decides whether to show a panel.
 */
const KEY = 'reader.finishedBooks.v1';

function load(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Record the book as finished. True the first time, false if it already was. */
export function markBookFinished(bookId: string): boolean {
  const list = load();
  if (list.includes(bookId)) return false;
  try { localStorage.setItem(KEY, JSON.stringify([...list, bookId])); } catch { /* storage blocked */ }
  return true;
}
