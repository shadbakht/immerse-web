import { NextResponse } from 'next/server';

// No app claims immerseresearch.app paths any more — /c/ share links are
// browser-only by design (the app hands off via the immerse:// scheme from the
// in-page buttons instead). Kept as a live route so nothing 404s and so
// re-adding a claim later is a one-line change.
const AASA = {
  applinks: {
    apps: [],
    details: [],
  },
};

export function GET() {
  return NextResponse.json(AASA, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
}
