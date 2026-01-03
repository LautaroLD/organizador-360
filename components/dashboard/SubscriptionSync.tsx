'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

export default function SubscriptionSync() {
  const searchParams = useSearchParams();
  const syncedRef = useRef(false);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (!sessionId || syncedRef.current) return;

    async function sync() {
      try {
        await fetch(`/api/stripe/sync-session?session_id=${encodeURIComponent(sessionId as string)}`);
        // Ignorar respuesta; si falla, no bloquear UI
      } catch {
        // noop
      } finally {
        syncedRef.current = true;
        // Limpia el query param sin recargar
        const url = new URL(window.location.href);
        url.searchParams.delete('session_id');
        window.history.replaceState({}, '', url.toString());
      }
    }

    sync();
  }, [searchParams]);

  return null;
}
