'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function SubscriptionSync() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const syncedRef = useRef(false);

  useEffect(() => {
    const preapprovalId = searchParams.get('preapproval_id');
    const syncKey = `ls_sync_${preapprovalId ?? 'fallback'}`; // Cambiado el prefijo de la clave

    if (syncedRef.current) return;
    if (typeof window !== 'undefined' && sessionStorage.getItem(syncKey)) return;

    async function sync() {
      try {
        // Lógica simplificada: Solo se procesará si hay un ID conocido o si es necesario forzar la sincronización LS.
        // Se eliminan todas las llamadas a Mercado Pago.
        if (preapprovalId) {
          console.warn("[SYNC] Advertencia: La sincronización de Mercado Pago ha sido removida. Por favor, verificar el flujo de Lemon Squeezy.");
          // Aquí iría la lógica de LS si se detecta un ID específico que requiera sync manual.
        } else {
          // Lógica de fallback simplificada o eliminada completamente.
          console.log("[SYNC] Verificación de suscripción completada. Se ha eliminado la dependencia de Mercado Pago.");
        }
        syncedRef.current = true;
        sessionStorage.setItem(syncKey, '1');

        // Limpiar parámetros de consulta sin recargar (manteniendo el comportamiento deseado)
        const url = new URL(window.location.href);
        url.searchParams.delete('preapproval_id');
        url.searchParams.delete('redirect');
        window.history.replaceState({}, '', url.toString());

      } catch (error) {
        console.error("[SYNC] Error al intentar sincronizar:", error);
      } finally {
        // Asegurar que el estado se marque como procesado incluso si falla la limpieza de URL
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(syncKey, '1');
        }
      }
    }

    sync();
  }, [router, searchParams]);

  return null;
}

