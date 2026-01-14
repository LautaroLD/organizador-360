import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/ui/Header';
import { ProjectsView } from '@/components/dashboard/ProjectsView';
import { InvitationsWidget } from '@/components/dashboard/InvitationsWidget';
import SubscriptionSync from '@/components/dashboard/SubscriptionSync';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase/admin';
import Stripe from 'stripe';

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

  // Sincronizar suscripción si venimos de Stripe con session_id
  const resolvedParams = searchParams ? await searchParams : undefined;
  const sessionParam = resolvedParams?.session_id;
  const sessionId = Array.isArray(sessionParam) ? sessionParam[0] : sessionParam;
  if (sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['subscription'],
      });
      let sub: Stripe.Subscription | null = session.subscription as Stripe.Subscription | null;
      // Fallback: si viene como ID, recupera la suscripción completa
      if (typeof sub === 'string') {
        try {
          sub = await stripe.subscriptions.retrieve(sub);
        } catch (e) {
          console.error('Failed to retrieve subscription by ID:', e);
        }
      }
      if (sub) {
        const { error: upsertError } = await supabaseAdmin
          .from('subscriptions')
          .upsert(
            {
              id: sub.id,
              user_id: user.id,
              stripe_subscription_id: sub.id,
              status: sub.status,
              price_id: sub.items?.data?.[0]?.price?.id ?? null,
              current_period_start: sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null,
              current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
              cancel_at_period_end: !!sub.cancel_at_period_end,
              canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
              ended_at: sub.ended_at ? new Date(sub.ended_at * 1000).toISOString() : null,
            },
            { onConflict: 'user_id' }
          );
        if (upsertError) {
          console.error('Upsert subscription failed:', upsertError);
        }
      }
    } catch (e) {
      // No bloquear el render si falla la sincronización
      console.error('Sync subscription on server failed:', e);
    }
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
      <main className="min-h-[calc(100vh-73px)]">
        {/* Sincroniza la suscripción al volver de Stripe con session_id */}
        <SubscriptionSync />
        <div className="p-6">
          <InvitationsWidget />
        </div>

        <ProjectsView />


      </main>
    </div>
  );
}