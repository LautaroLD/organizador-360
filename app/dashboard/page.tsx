import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/ui/Header';
import { ProjectsView } from '@/components/dashboard/ProjectsView';
import { InvitationsWidget } from '@/components/dashboard/InvitationsWidget';
import { ApprovalsWidget } from '@/components/dashboard/ApprovalsWidget';
import SubscriptionRealtimeRefresh from '@/components/dashboard/SubscriptionRealtimeRefresh';
// import { supabaseAdmin } from '@/lib/supabase/admin';

// type SearchParams = { [key: string]: string | string[] | undefined; };

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
        {/* {planTier === 'free' && (
          <div className=' rounded-md'>
            <div className="p-3 bg-[var(--accent-warning)]/10  rounded-md border border-[var(--accent-warning)]">
              <p className="text-[var(--accent-warning)] text-sm">
                Estás limitado a 3 proyectos.
                <a href="/settings/subscription" className="font-bold underline ml-1">Ver planes</a>
              </p>
            </div>
          </div>
        )} */}
        <SubscriptionRealtimeRefresh />
        <InvitationsWidget />
        <ApprovalsWidget />
        <ProjectsView />
      </main>
    </div>
  );
}