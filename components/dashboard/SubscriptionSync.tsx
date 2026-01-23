'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

export default function SubscriptionSync() {
  const searchParams = useSearchParams();
  const syncedRef = useRef(false);

  useEffect(() => {
    const preapprovalId = searchParams.get('preapproval_id');

    if (!preapprovalId || syncedRef.current) return;

    async function sync() {
      try {
        if (preapprovalId) {
          // Sincronizar suscripción de MercadoPago
          console.log('[SYNC] Sincronizando preapproval:', preapprovalId);
          const response = await fetch(`/api/mercadopago/sync-preapproval?preapproval_id=${encodeURIComponent(preapprovalId)}`);
          const data = await response.json();
          console.log('[SYNC] Resultado:', data);

          if (data.success) {
            console.log('[SYNC] Suscripción sincronizada exitosamente, recargando página...');
            syncedRef.current = true;
            // Recargar la página completamente sin los parámetros para mostrar el nuevo estado
            window.location.href = window.location.pathname;
            return;
          } else {
            console.error('[SYNC] Error en la respuesta:', data.error);
          }
        }
      } catch (error) {
        console.error('[SYNC] Error:', error);
      } finally {
        syncedRef.current = true;
        // Limpia los query params sin recargar (fallback si no se recargó antes)
        const url = new URL(window.location.href);
        url.searchParams.delete('session_id');
        url.searchParams.delete('preapproval_id');
        url.searchParams.delete('redirect');
        window.history.replaceState({}, '', url.toString());
      }
    }

    sync();
  }, [searchParams]);

  return null;
}
