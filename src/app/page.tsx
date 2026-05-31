import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppShell from '@/components/AppShell';

interface Props {
  searchParams: Promise<{ guest?: string }>;
}

export default async function Home({ searchParams }: Props) {
  const { guest } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user)          return <AppShell user={user} />;
  if (guest === '1') return <AppShell user={null} />;

  redirect('/login');
}
