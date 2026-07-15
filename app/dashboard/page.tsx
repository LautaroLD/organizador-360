import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { Header } from '@/components/ui/Header';
import { ProjectsView } from '@/components/dashboard/ProjectsView';
import { InvitationsWidget } from '@/components/dashboard/InvitationsWidget';
import { ApprovalsWidget } from '@/components/dashboard/ApprovalsWidget';
import SubscriptionRealtimeRefresh from '@/components/dashboard/SubscriptionRealtimeRefresh';

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/auth');
  }

  const { data: planContextRaw } = await supabase.rpc('get_user_plan_context', {
    p_user_id: user.id,
  });

  const planContext = (planContextRaw ?? {}) as {
    plan_tier?: string | null;
    source?: 'manual' | 'subscription' | 'free' | string;
  };

  const contextPlanTier =
    typeof planContext.plan_tier === 'string' &&
      (planContext.plan_tier.toLowerCase() === 'starter' ||
        planContext.plan_tier.toLowerCase() === 'pro')
      ? planContext.plan_tier.toLowerCase()
      : 'free';
  const effectivePlanTier = contextPlanTier;

  const isPaid = effectivePlanTier !== 'free';
  const isPro = effectivePlanTier === 'pro';

  const subtitleText = isPaid
    ? `Plan ${effectivePlanTier.toUpperCase()} Activo${planContext.source === 'manual' ? ' (Manual)' : ''}`
    : <span>Plan gratuito <a href="/settings/subscription" className="font-bold underline ml-1">Ver planes</a></span>;

  return (
    <div className="min-h-dvh bg-[var(--bg-primary)]">
      <Header
        title="Mis Proyectos"
        subtitle={ subtitleText }
      />

      <main className='m-6 space-y-6'>
        <SubscriptionRealtimeRefresh />
        {isPro && (
          <Link
            href="/team"
            className="flex items-center gap-3 rounded-lg border border-[var(--text-secondary)]/20 bg-[var(--bg-secondary)] px-4 py-3 hover:bg-[var(--bg-primary)] transition-colors"
          >
            <div className="rounded-md bg-[var(--bg-primary)] p-2 text-[var(--text-secondary)]">
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                Workspace del equipo
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                Directorio, tareas multi-proyecto, calendario unificado y riesgos
              </p>
            </div>
          </Link>
        )}
        <InvitationsWidget />
        <ApprovalsWidget />
        <ProjectsView />
      </main>
    </div>
  );
}