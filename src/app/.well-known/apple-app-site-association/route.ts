import { NextResponse } from 'next/server';

// Served as a route handler rather than a static public/ file so the
// Content-Type is guaranteed `application/json` — Next/Vercel serves the
// extensionless static file as `application/octet-stream`, which older iOS
// AASA fetches reject. `assetlinks.json` stays a static file (its `.json`
// extension already gets the right type).
//
// `applinks.details[].paths` scopes universal links to the Phase 5 share
// pages only. Team ID + bundle id are from ios/ImmerseResearch/project.pbxproj.
const AASA = {
  applinks: {
    apps: [],
    details: [
      { appID: 'A7C4DXVVCJ.com.shadbakht.immerse', paths: ['/c/*'] },
    ],
  },
};

export function GET() {
  return NextResponse.json(AASA, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
}
