'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

type SubscriptionSnapshot = {
  id: string;
  status: string | null;
  plan_tier: string | null;
  current_period_end: string | null;
};

function buildSignature(snapshot: SubscriptionSnapshot | null): string {
  if (!snapshot) return 'none';
  return [
    snapshot.id,
    snapshot.status ?? '',
    snapshot.plan_tier ?? '',
    snapshot.current_period_end ?? '',
  ].join('|');
}

export default function SubscriptionRealtimeRefresh() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const previousSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const fetchSnapshot = async (): Promise<SubscriptionSnapshot | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) return null;

      const { data } = await supabase
        .from('subscriptions')
        .select(
          'id, status, plan_tier, current_period_end'
        )
        .eq('user_id', user.id)
        .maybeSingle();

      return (data ?? null) as SubscriptionSnapshot | null;
    };

    const refreshIfChanged = async () => {
      const snapshot = await fetchSnapshot();
      const signature = buildSignature(snapshot);
      if (previousSignatureRef.current === null) {
        previousSignatureRef.current = signature;
        return;
      }
      if (previousSignatureRef.current !== signature) {
        previousSignatureRef.current = signature;
        if (snapshot?.id) {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['subscription'], exact: false }),
            queryClient.invalidateQueries({ queryKey: ['lemon-subscription-details'], exact: false }),
            queryClient.invalidateQueries({ queryKey: ['plan-context'], exact: false }),
            queryClient.invalidateQueries({ queryKey: ['plan-tier'], exact: false }),
            queryClient.invalidateQueries({ queryKey: ['projects'], exact: false }),
            queryClient.invalidateQueries({ queryKey: ['ai-credits'], exact: false }),
          ]);
        }
        router.refresh();
      }
    };

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active || !user?.id) return;

      await refreshIfChanged();

      channel = supabase
        .channel(`subscription-refresh-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'subscriptions',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            void refreshIfChanged();
          }
        )
        .subscribe();
    };

    void init();

    const interval = window.setInterval(() => {
      void refreshIfChanged();
    }, 15000);

    return () => {
      active = false;
      window.clearInterval(interval);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [queryClient, router]);

  return null;
}

