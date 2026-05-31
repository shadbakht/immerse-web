import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppShell from '@/components/AppShell';

interface Props {
  params:       Promise<{ bookId: string }>;
  searchParams: Promise<{ guest?: string }>;
}

export default async function ReadPage({ params, searchParams }: Props) {
  const { bookId } = await params;
  const { guest } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    return <AppShell user={user} initialBookId={bookId} />;
  }

  if (guest === '1') {
    return <AppShell user={null} initialBookId={bookId} />;
  }

  redirect(`/login?redirect=/read/${bookId}`);
}
