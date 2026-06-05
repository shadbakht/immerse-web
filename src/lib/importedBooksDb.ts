/**
 * importedBooksDb.ts — IndexedDB persistence for user-imported books.
 *
 * Imported books are local-only (never synced to Supabase), exactly like the
 * mobile app's SQLite-based "My Books". Annotations on these books also stay
 * local and are not sent to Supabase.
 */

const DB_NAME    = 'immerse-local';
const DB_VERSION = 1;
const STORE      = 'imported_books';

export interface LocalBook {
  id:         string;
  title:      string;
  format:     string;          // 'txt' | 'epub' | 'docx' | 'rtf' | 'pdf'
  paragraphs: string[];        // empty for PDFs
  pdfBlob:    Blob | null;     // populated only for PDFs
  createdAt:  number;          // Date.now()
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

export async function listLocalBooks(): Promise<Pick<LocalBook, 'id' | 'title' | 'format' | 'createdAt'>[]> {
  const db  = await openDb();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly');
    const idx = tx.objectStore(STORE).index('createdAt');
    const req = idx.getAll();
    req.onsuccess = () => {
      const rows = (req.result as LocalBook[])
        .map(r => ({ id: r.id, title: r.title, format: r.format, createdAt: r.createdAt }))
        .sort((a, b) => b.createdAt - a.createdAt);
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getLocalBook(id: string): Promise<LocalBook | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as LocalBook) ?? null);
    req.onerror   = () => reject(req.error);
  });
}

export async function saveLocalBook(book: LocalBook): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).put(book);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

export async function deleteLocalBook(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}
