@AGENTS.md

# Immerse Web — CLAUDE.md

## Project Overview

This is the **web version of Immerse** — a Next.js 16 (App Router) app that mirrors the React Native app's functionality in a browser. It is a separate repo from the mobile app (`/Documents/Claude/Projects/Immerse`).

- **Framework**: Next.js 16 (App Router) + Tailwind CSS + TypeScript
- **Database**: Same Supabase instance as the mobile app (shared user data: tags, notes, xrefs, selections)
- **Deployment**: Vercel — auto-deploys on every push to `main` branch of `shadbakht/immerse-web`
- **Live URL**: `https://immerse-two.vercel.app`

## User Tiers

Three tiers gate features. Use `profile.is_pro` and guest session state to enforce access.

| # | Feature | Guest | Standard | Pro |
|---|---------|-------|----------|-----|
| 1 | Read & search entire library | ✓ | ✓ | ✓ |
| 2 | Share quotes | ✓ | ✓ | ✓ |
| 3 | Tags (create compilations) | — | ✓ | ✓ |
| 4 | Notes (comments on quotes) | — | ✓ | ✓ |
| 5 | X-refs (cross-referenced quotes) | — | ✓ | ✓ |
| 6 | Quick tag from search results | — | ✓ | ✓ |
| 7 | Recently Viewed / reading progress | — | ✓ | ✓ |
| 8 | Sync across devices | — | ✓ | ✓ |
| 9 | Share Tags (PDF, DOCX, IMM, CSV, MD) | — | ✓ | ✓ |
| 10 | AI summary | — | — | ✓ |
| 11 | Import (ePub, PDF, DOCX, TXT) | — | — | ✓ |
| 12 | Community (view/share/import/subscribe) | — | — | ✓ |

**Guest**: no login required. **Standard**: free, login required. **Pro**: $0.99/mo, login required.

> Import caveat: DOCX with images/unusual formatting, non-text PDFs, and some other formats may not import or may import unreliably.

**Gating pattern:**
- Features 3–12: user must be logged in (not guest)
- Features 10–12: `profile.is_pro === true`
- Never show a Pro gate to a guest — show a sign-in prompt first

## Deployment Workflow

Always commit and push — Vercel redeploys automatically:

```bash
git add <files>
git commit -m "..."
git push
```

## Architecture

Single-page shell at `/`. `AppShell` manages the active tab and reader target.

### Navigation tabs
| Tab | Component | Notes |
|-----|-----------|-------|
| `home` | `HomePanel` | Stats tiles (clickable → tab), recently read books |
| `library` | `LibraryPanel` + `ReaderPanel` | Split-panel: library left, reader right |
| `tags` | `TagsScreen` | Tag list, expandable passages, search |
| `notes` | `NotesScreen` | Note list, expandable quotes, search |
| `xrefs` | `XRefsScreen` | Cross-reference list, side-by-side quotes, search |
| `community` | `CommunityPanel` | Public tags feed; guest overlay |
| `settings` | `SettingsPanel` | Profile, font, appearance, Stripe |

Guest users see a `SignInPrompt` on Tags/Notes/XRefs/Settings tabs and a sign-in card in the Home Recently Read section. Community shows the tag list dimmed behind an overlay.

### AppShell routing
`openBook(bookId, passageId?, highlightQuery?)` switches to the library tab and opens the reader. `onTabChange(tab)` switches tabs (used by HomePanel stat tiles).

## Key Files

| File | Purpose |
|------|---------|
| `src/components/AppShell.tsx` | Top-level layout, tab routing |
| `src/components/ReaderPanel.tsx` | Full reader: selection, annotations, footnotes, margin icons |
| `src/components/HomePanel.tsx` | Dashboard; stat tiles navigate to annotation tabs |
| `src/components/LibraryPanel.tsx` | Library browse + search |
| `src/components/TagsScreen.tsx` | Tags with expandable passages |
| `src/components/NotesScreen.tsx` | Notes with expandable quotes |
| `src/components/XRefsScreen.tsx` | XRefs with side-by-side expandable quotes |
| `src/components/CommunityPanel.tsx` | Community tag feed with guest overlay |
| `src/components/SettingsPanel.tsx` | Profile, font size, appearance, Stripe upgrade |
| `src/components/Sidebar.tsx` | Left nav drawer |
| `src/components/SignInPrompt.tsx` | Reusable guest sign-in prompt (✦ icon + button) |
| `src/lib/fetchAnnotationSelections.ts` | Shared helper: fetches selections→passages→books in 3 queries (avoids RLS cross-table join issues) |
| `src/proxy.ts` | Next.js middleware: redirects unauthenticated users to `/login` |
| `src/app/login/page.tsx` | Login page: sign-in / sign-up toggle, username validation |
| `src/app/privacy/page.tsx` | Privacy Policy, Terms of Service, Community Guidelines |
| `src/app/auth/callback/route.ts` | Supabase auth callback; redirects signup confirmations to `/auth/confirmed` |
| `src/app/auth/confirmed/page.tsx` | Email confirmation success page |
| `src/app/api/stripe/checkout/route.ts` | Creates Stripe Checkout session |
| `src/app/api/stripe/webhook/route.ts` | Stripe webhook: flips `profiles.is_pro` |
| `src/app/api/stripe/portal/route.ts` | Opens Stripe Customer Portal (manage/cancel) |

## Supabase Schema Notes

**`profiles` table columns** (relevant to web):
- `id`, `full_name`, `username`, `is_pro`, `font_size`, `seeded_defaults`
- `stripe_customer_id`, `stripe_subscription_id`, `stripe_subscription_status`
- ⚠️ **No `color_mode` column** — color mode is stored in `localStorage` only

**`selections` table** (web-created):
- Columns: `id`, `user_id`, `passage_id`, `start_offset`, `end_offset`, `snapshot_text`, `created_at`
- ⚠️ **No `book_id` column** — get book via `passage_id → passages.book_id`
- Querying `book_id` from selections causes the entire PostgREST query to fail silently

**RLS pattern**: Always filter by `user_id` on every table directly. Cross-table nested joins (e.g. `notes → selections`) fail silently due to RLS. Use `fetchSelectionsByUser()` helper which fetches in 3 separate queries.

**Footnotes**: `books.footnotes` is empty in Supabase — footnote text lives in the mobile SQLite `chunks` table and hasn't been migrated. Footnote clicks open a panel with a fallback message.

## Stripe Integration

$0.99/month Pro subscription. Required Vercel env vars:
- `STRIPE_SECRET_KEY` — `sk_live_...`
- `STRIPE_PRICE_ID` — `price_1TdN423sbi6DBTBwNUC5Yd7L`
- `STRIPE_WEBHOOK_SECRET` — `whsec_...`
- `NEXT_PUBLIC_SITE_URL` — `https://immerse-two.vercel.app`

Webhook endpoint: `https://immerse-two.vercel.app/api/stripe/webhook`
Listens to: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

Flow: Upgrade button → `/api/stripe/checkout` → Stripe Checkout → success redirect to `/settings?upgraded=1` → webhook flips `profiles.is_pro = true`.

## Login Page

- Sign-in mode: email + password
- Sign-up mode (toggled by Sign Up button): username (with real-time availability check) + full name + email + password
- After sign-up: shows email confirmation screen instead of navigating away
- Continue as Guest: plain `<a href="/?guest=1">` (not router.push — middleware must see the query param)
- ⚠️ Do not use `<form>` with `required` fields — browser validation blocks the Sign Up toggle button

## Middleware (`src/proxy.ts`)

Redirects unauthenticated users to `/login`. Public paths:
`/login`, `/auth`, `/read`, `/privacy`, `/?guest=1` (guest mode)

## Annotation Screens Pattern

Tags, Notes, XRefs all use **self-contained card components** (`TagCard`, `NoteCard`, `XRefCard`) with their own `useState(false)` for expand/collapse. This avoids shared state re-render issues.

- Clicking the card expands/collapses
- Quotes are truncated (`line-clamp-3`) when collapsed, full when expanded  
- "Open in reader →" appears when expanded
- Search highlights via `<Highlight>` component
- Data loaded via `fetchSelectionsByUser()` + separate tag/note/xref queries

## ReaderPanel Notes

- `taggedPassageIds` and `notedPassageIds` track which passages have annotations (for margin icons)
- `pendingSelectionRef` captures the selection before panels clear it
- Footnote clicks always open a panel; shows fallback if text unavailable
- Selection bar appears on text selection; triggers tag/note/xref panels
