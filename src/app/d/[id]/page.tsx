// A Discover share. Same page as /c/<id> — the path differs only so the OS can
// route it: /d/* is a universal / App Link (opens the app's Discover tab when
// Immerse is installed), /c/* is browser-only. Same shared_sets row either way.
export { default, generateMetadata } from '../../c/[id]/page';
