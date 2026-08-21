// Funnel analytics — queue item #3, project_session_aug21_growth_websync_queue.md.
// There was no event logging anywhere between signup and Pro before this, only
// endpoint hits; 81 of 91 signups going quiet after day 1 had no visibility
// into where they actually drop.
//
// Fire-and-forget by design: a failed insert (offline, RLS reject, whatever)
// must never surface to the reader or block the action it's describing.
'use client';

import { createClient } from './supabase/client';

export type AnalyticsEvent = 'book_opened' | 'search_run' | 'selection_made' | 'paywall_seen';

const SESSION_KEY = 'immerse_analytics_session';
let cachedSessionId: string | null = null;

// One id per browser tab (sessionStorage, not localStorage) — enough to group
// a guest's events into one browsing session server-side without it becoming
// a durable cross-visit identifier.
function sessionId(): string {
  if (cachedSessionId) return cachedSessionId;
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return (cachedSessionId = id);
  } catch {
    // Storage blocked (private mode, etc.) — fall back to a per-load id.
    return (cachedSessionId = crypto.randomUUID());
  }
}

export function logEvent(
  event: AnalyticsEvent,
  properties: Record<string, unknown> = {},
  userId?: string | null,
): void {
  try {
    const supabase = createClient();
    void supabase.from('analytics_events').insert({
      user_id: userId ?? null,
      session_id: sessionId(),
      event_type: event,
      properties,
    }).then(({ error }) => {
      if (error) console.warn('[analytics] logEvent failed:', error.message);
    });
  } catch (e) {
    console.warn('[analytics] logEvent threw:', e);
  }
}
