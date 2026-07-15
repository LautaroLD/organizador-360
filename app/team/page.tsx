import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/ui/Header';
import { TeamWorkspaceView } from '@/components/team/TeamWorkspaceView';

export default async function TeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth');
  }

  return (
    <div className="min-h-dvh bg-[var(--bg-primary)]">
      <Header title="Equipo" subtitle="Workspace · Directorio y mando multi-proyecto" />
      <main className="m-6">
        <TeamWorkspaceView />
      </main>
    </div>
  );
}
