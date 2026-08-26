import { createClient } from '@/lib/supabase/server';
import AppShell from '@/components/AppShell';

// The landing page for everyone, signed in or not — a signed-out visitor
// gets AppShell in guest mode (defaults to the Library tab, see AppShell)
// instead of being bounced to /login first. `proxy.ts` treats '/' as public
// for the same reason; keep both in sync.
export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return <AppShell user={user} />;
}
