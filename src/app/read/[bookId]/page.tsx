import { createClient } from '@/lib/supabase/server';
import AppShell from '@/components/AppShell';
import GuestReader from '@/components/GuestReader';

interface Props {
  params: Promise<{ bookId: string }>;
}

export default async function ReadPage({ params }: Props) {
  const { bookId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    return <AppShell user={user} initialBookId={bookId} />;
  }

  return <GuestReader bookId={bookId} />;
}
