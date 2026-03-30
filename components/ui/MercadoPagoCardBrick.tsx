'use client';

import { useThemeStore } from '@/store/themeStore';
import { CardPayment, initMercadoPago } from '@mercadopago/sdk-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';

type BrickSubmitPayload = {
  token?: string;
  token_id?: string;
  payment_method_id?: string;
  issuer_id?: string;
  installments?: number | string;
  payer?: {
    email?: string;
    identification?: {
      type?: string;
      number?: string;
    };
  };
};

interface MercadoPagoCardBrickProps {
  planId: string;
  planName: string;
  amount: number;
  payerEmail?: string;
  disabled?: boolean;
  onSubscriptionCreated?: (subscriptionId: string) => Promise<void> | void;
  onProcessingChange?: (processing: boolean) => void;
  onCheckoutSuccess?: () => void;
}

function extractBrickPayload(payload: unknown): BrickSubmitPayload {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  const maybeWithFormData = payload as { formData?: BrickSubmitPayload; };
  if (maybeWithFormData.formData && typeof maybeWithFormData.formData === 'object') {
    return maybeWithFormData.formData;
  }

  return payload as BrickSubmitPayload;
}

export default function MercadoPagoCardBrick({
  planId,
  planName,
  amount,
  payerEmail,
  disabled = false,
  onSubscriptionCreated,
  onProcessingChange,
  onCheckoutSuccess,
}: MercadoPagoCardBrickProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { theme } = useThemeStore();
  const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
  const isAutomation =
    typeof navigator !== 'undefined' && navigator.webdriver === true;

  useEffect(() => {
    if (!publicKey) return;
    initMercadoPago(publicKey, { locale: 'es-AR' });
  }, [publicKey]);

  const initialization = useMemo(
    () => ({
      amount,
      payer: {
        email: payerEmail ?? '',
      },
    }),
    [amount, payerEmail]
  );

  const handleSubmit = async (payload: unknown) => {
    if (disabled || isSubmitting) return;

    setIsSubmitting(true);
    onProcessingChange?.(true);

    try {
      const normalized = extractBrickPayload(payload);
      const token = normalized.token ?? normalized.token_id;

      if (!token) {
        throw new Error('No se recibió token de tarjeta desde Mercado Pago');
      }

      const response = await fetch('/api/checkout/mercadopago', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          cardTokenId: token,
          planId,
          payerEmail: normalized.payer?.email ?? payerEmail,
          paymentMethodId: normalized.payment_method_id,
          issuerId: normalized.issuer_id,
          installments: Number(normalized.installments ?? 1),
          identificationType: normalized.payer?.identification?.type,
          identificationNumber: normalized.payer?.identification?.number,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'No se pudo crear la suscripción');
      }

      const subscriptionId = typeof data.id === 'string' ? data.id : '';

      if (subscriptionId) {
        await fetch(
          `/api/mercadopago/sync-preapproval?preapproval_id=${encodeURIComponent(subscriptionId)}`,
          { credentials: 'include' }
        );
        await onSubscriptionCreated?.(subscriptionId);
      }

      onCheckoutSuccess?.();
      toast.success(`Suscripción ${planName} creada correctamente`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error procesando el pago';
      toast.error(message);
      throw error;
    } finally {
      setIsSubmitting(false);
      onProcessingChange?.(false);
    }
  };

  if (!publicKey) {
    return (
      <div className='rounded-md border border-[var(--accent-danger)]/30 bg-[var(--accent-danger)]/5 px-3 py-2 text-xs text-[var(--accent-danger)]'>
        Falta configurar NEXT_PUBLIC_MP_PUBLIC_KEY para habilitar el pago con tarjeta.
      </div>
    );
  }
  return (
    <div className='rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3'>
      <p className='text-sm font-medium text-[var(--text-primary)] mb-2'>
        Completa tu pago con Card Payment Brick
      </p>
      <CardPayment
        initialization={initialization}
        onSubmit={handleSubmit}
        customization={{
          visual: {
            style: {
              theme: theme === 'dark' ? 'dark' : 'light',
            }
          }
        }}
        onError={(error) => {
          console.error('Error en Card Payment Brick:', error);
          toast.error('Hubo un problema en el formulario de pago');
        }}
        onReady={() => {
          // Callback requerido por el Brick para notificar render completo.
        }}
      />
      {isSubmitting && (
        <p className='text-xs text-[var(--text-secondary)] mt-2'>
          Procesando pago y confirmando suscripción...
        </p>
      )}

      {isAutomation && (
        <button
          type='button'
          data-testid='mp-mock-submit'
          className='mt-3 w-full rounded-md border border-dashed border-[var(--accent-primary)]/40 px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]'
          onClick={() => {
            void handleSubmit({ token: 'tok_e2e_mock', payer: { email: payerEmail } });
          }}
          disabled={isSubmitting || disabled}
        >
          Simular pago (solo pruebas E2E)
        </button>
      )}
    </div>
  );
}
