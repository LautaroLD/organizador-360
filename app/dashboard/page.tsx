import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/ui/Header';
import { ProjectsView } from '@/components/dashboard/ProjectsView';
import { InvitationsWidget } from '@/components/dashboard/InvitationsWidget';

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/auth');
  }

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('status, price_id')
    .eq('user_id', user.id)
    .single();

  const isPremium = subscription?.status === 'active' || subscription?.status === 'trialing';

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Header
        title="Mis Proyectos"
        subtitle={isPremium ? "Plan Premium Activo" : "Plan Gratuito"}
      />

      <main className="min-h-[calc(100vh-73px)]">
        <div className="p-6">
          <InvitationsWidget />
        </div>

        <ProjectsView />

        {!isPremium && (
          <div className="m-6 p-4 bg-yellow-100 border border-yellow-400 rounded-md">
            <p className="text-yellow-700">
              Estás limitado a 3 proyectos.
              <a href="/pricing" className="font-bold underline ml-1">¡Pásate a Pro!</a>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}