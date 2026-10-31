import { NextResponse } from 'next/server';

// Only /d/* (shares made from Discover) opens the app directly — it lands on
// the shared card in the Discover tab. /c/* (shares of the owner's own
// Compilations / X-refs) stays browser-only by design: its in-page "Save to my
// …" button hands off via the immerse:// scheme instead.
const AASA = {
  applinks: {
    apps: [],
    details: [
      { appID: 'A7C4DXVVCJ.com.shadbakht.immerse', paths: ['/d/*'] },
    ],
  },
};

export function GET() {
  return NextResponse.json(AASA, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
}
