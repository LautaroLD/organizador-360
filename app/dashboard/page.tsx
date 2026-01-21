import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/ui/Header';
import { ProjectsView } from '@/components/dashboard/ProjectsView';
import { InvitationsWidget } from '@/components/dashboard/InvitationsWidget';
import SubscriptionSync from '@/components/dashboard/SubscriptionSync';
import { supabaseAdmin } from '@/lib/supabase/admin';

type SearchParams = { [key: string]: string | string[] | undefined; };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/auth');
  }

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('status, price_id, cancel_at_period_end, current_period_end')
    .eq('user_id', user.id)
    .single();

  const isPro = subscription?.status === 'active' || subscription?.status === 'trialing';

  // Calcular días restantes si la cancelación está programada
  let daysRemaining: number | null = null;
  if (subscription?.cancel_at_period_end && subscription?.current_period_end) {
    const now = new Date();
    const periodEnd = new Date(subscription.current_period_end);
    const diff = periodEnd.getTime() - now.getTime();
    daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  const subtitleText = isPro
    ? daysRemaining && daysRemaining > 0
      ? `Plan Pro Activo - ${daysRemaining} día${daysRemaining === 1 ? '' : 's'} restante${daysRemaining === 1 ? '' : 's'}`
      : 'Plan Pro Activo'
    : 'Plan Gratuito';

  return (
    <div className="min-h-dvh bg-[var(--bg-primary)]">
      <Header
        title="Mis Proyectos"
        subtitle={subtitleText}
      />
      {!isPro && (
        <div className="m-6 p-2 bg-[var(--accent-warning)]/10 border border-[var(--accent-warning)] rounded-md">
          <p className="text-[var(--accent-warning)] text-sm">
            Estás limitado a 3 proyectos.
            <a href="/settings/subscription" className="font-bold underline ml-1">¡Pásate a Pro!</a>
          </p>
        </div>
      )}
      <main>
        {/* Sincroniza la suscripción al volver de Stripe con session_id */}
        <SubscriptionSync />
        <InvitationsWidget />
        <ProjectsView />
      </main>
    </div>
  );
}