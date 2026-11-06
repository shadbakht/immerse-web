// App store identities, shared by the mobile-browser AppBanner (layout.tsx)
// and the /get share page.

// iOS: the numeric Apple ID (App Store Connect → App Information → Apple ID).
export const APP_STORE_ID = '6774657926';
// Android: the package name.
export const PLAY_STORE_ID = 'com.shadbakht.immerse';

export const APP_STORE_URL = `https://apps.apple.com/app/id${APP_STORE_ID}`;
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${PLAY_STORE_ID}`;
