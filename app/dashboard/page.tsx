import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/ui/Header';
import { ProjectsView } from '@/components/dashboard/ProjectsView';
import { InvitationsWidget } from '@/components/dashboard/InvitationsWidget';
import SubscriptionRealtimeRefresh from '@/components/dashboard/SubscriptionRealtimeRefresh';
import { hasPaidAccess } from '@/lib/subscriptionUtils';
// import { supabaseAdmin } from '@/lib/supabase/admin';

// type SearchParams = { [key: string]: string | string[] | undefined; };

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/auth');
  }

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('status, plan_tier, cancel_at_period_end, current_period_end')
    .eq('user_id', user.id)
    .maybeSingle();

  const { data: planTierRaw } = await supabase.rpc('get_user_plan', {
    p_user_id: user.id,
  });
  const contextPlanTier =
    typeof planTierRaw === 'string' &&
      (planTierRaw.toLowerCase() === 'starter' ||
        planTierRaw.toLowerCase() === 'pro')
      ? planTierRaw.toLowerCase()
      : 'free';

  const subscriptionPlanTier =
    typeof subscription?.plan_tier === 'string' &&
      (subscription.plan_tier.toLowerCase() === 'starter' ||
        subscription.plan_tier.toLowerCase() === 'pro')
      ? subscription.plan_tier.toLowerCase()
      : 'free';

  const paidAccessFromSubscription = hasPaidAccess({
    status: subscription?.status,
    cancel_at_period_end: subscription?.cancel_at_period_end,
    current_period_end: subscription?.current_period_end,
  });

  const effectivePlanTier =
    contextPlanTier !== 'free'
      ? contextPlanTier
      : paidAccessFromSubscription && subscriptionPlanTier !== 'free'
        ? subscriptionPlanTier
        : 'free';

  const isPaid = effectivePlanTier !== 'free';

  // Calcular días restantes si la cancelación está programada
  let daysRemaining: number | null = null;
  if (subscription?.cancel_at_period_end && subscription?.current_period_end) {
    const now = new Date();
    const periodEnd = new Date(subscription.current_period_end);
    const diff = periodEnd.getTime() - now.getTime();
    daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  const subtitleText = isPaid
    ? daysRemaining && daysRemaining > 0
      ? `Plan ${effectivePlanTier.toUpperCase()} Activo - ${daysRemaining} día${daysRemaining === 1 ? '' : 's'} restante${daysRemaining === 1 ? '' : 's'}`
      : `Plan ${effectivePlanTier.toUpperCase()} Activo`
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
        <ProjectsView />
      </main>
    </div>
  );
}