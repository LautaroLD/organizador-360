'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function SubscriptionSync() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const syncedRef = useRef(false);

  useEffect(() => {
    const preapprovalId = searchParams.get('preapproval_id');
    const syncKey = `mp_sync_${preapprovalId ?? 'fallback'}`;

    if (syncedRef.current) return;
    if (typeof window !== 'undefined' && sessionStorage.getItem(syncKey)) return;

    async function sync() {
      try {
        if (preapprovalId) {
          // Sincronizar suscripción de MercadoPago
          const response = await fetch(`/api/mercadopago/sync-preapproval?preapproval_id=${encodeURIComponent(preapprovalId)}`);
          const data = await response.json();

          if (data.success) {
            syncedRef.current = true;
            sessionStorage.setItem(syncKey, '1');
            const cleanUrl = new URL(window.location.href);
            cleanUrl.searchParams.delete('preapproval_id');
            cleanUrl.searchParams.delete('redirect');
            window.history.replaceState({}, '', cleanUrl.toString());
            router.refresh();
            return;
          } else {
            console.error('[SYNC] Error en la respuesta:', data.error);
          }
        } else {
          // Fallback: si ya hay suscripción en MP pero la BD no refleja el plan
          const detailsRes = await fetch('/api/mercadopago/subscription-details');
          if (!detailsRes.ok) return;
          const details = await detailsRes.json();

          if (details?.hasSubscription && details?.internalPlanId && details.internalPlanId !== 'free') {
            const mpId = details?.details?.id as string | undefined;
            if (mpId) {
              const syncRes = await fetch(`/api/mercadopago/sync-preapproval?preapproval_id=${encodeURIComponent(mpId)}`);
              const syncData = await syncRes.json();
              if (syncData.success) {
                syncedRef.current = true;
                sessionStorage.setItem(syncKey, '1');
                router.refresh();
                return;
              }
            }
          }
        }
      } catch (error) {
        console.error('[SYNC] Error:', error);
      } finally {
        syncedRef.current = true;
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(syncKey, '1');
        }
        // Limpia los query params sin recargar (fallback si no se recargó antes)
        const url = new URL(window.location.href);
        url.searchParams.delete('preapproval_id');
        url.searchParams.delete('redirect');
        window.history.replaceState({}, '', url.toString());
      }
    }

    sync();
  }, [router, searchParams]);

  return null;
}
