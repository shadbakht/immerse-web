@AGENTS.md

# Immerse Web — CLAUDE.md

## Project Overview

This is the **web version of Immerse** — a Next.js (App Router) app that mirrors the React Native app's functionality in a browser. It is a separate repo from the mobile app (`/Documents/Claude/Projects/Immerse`).

- **Framework**: Next.js (App Router) + Tailwind CSS + TypeScript
- **Database**: Same Supabase instance as the mobile app (shared user data: tags, notes, xrefs, selections)
- **Deployment**: Vercel — connected to this GitHub repo (`immerse-web`), auto-deploys on every push to `main`

## Deployment Workflow

**Always commit and push changes to GitHub.** Vercel automatically picks up the push and redeploys. No manual deploy step needed.

```bash
git add <files>
git commit -m "..."
git push   # triggers Vercel redeploy automatically
```

## Architecture

Single-page shell layout — `AppShell` manages the active tab and reader target:

- **Sidebar** (`src/components/Sidebar.tsx`) — left nav, tab switching
- **HomePanel** (`src/components/HomePanel.tsx`) — dashboard with stats tiles and recently viewed books
- **LibraryPanel** + **ReaderPanel** — split-panel view for reading (Library left, Reader right)
- **NotesScreen** (`src/components/NotesScreen.tsx`) — notes list with search and open-in-reader
- **SettingsPanel** — user settings
- Tabs `tags`, `xrefs`, `community` — currently show "Coming Soon"

`AppShell` uses `openBook(bookId, passageId?, highlightQuery?)` to navigate into the reader from any panel.

## Key Files

- `src/components/AppShell.tsx` — top-level layout, tab routing
- `src/components/ReaderPanel.tsx` — full reader with selection, annotations, margin icons
- `src/components/HomePanel.tsx` — home/dashboard
- `src/components/LibraryPanel.tsx` — library browse
- `src/components/NotesScreen.tsx` — notes list
- `src/components/Sidebar.tsx` — navigation sidebar
- `src/lib/supabase.ts` — Supabase client

## ReaderPanel Notes

- Margin annotation icons appear at `-left-8` of each passage; uses `taggedPassageIds` and `notedPassageIds` state sets (split separately so tag 🏷 and note 📝 icons render independently)
- Selection bar triggers tag/note/xref panels
- `pendingSelectionRef` captures the selection before panels clear it
