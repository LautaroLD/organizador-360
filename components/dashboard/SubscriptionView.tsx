'use client';

import React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { toast } from 'react-toastify';
import {
  Check,
  Star,
  Zap,
  Users,
  HardDrive,
  Calendar,
  Lock,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface PricingPlan {
  name: string;
  price: number;
  billing: string;
  description: string;
  features: string[];
  icon: React.ReactNode;
  popular?: boolean;
  id: 'free' | 'pro';
}

export const SubscriptionView: React.FC = () => {
  const supabase = createClient();
  const { user } = useAuthStore();

  // Fetch subscription data
  const { data: subscription, isLoading: subscriptionLoading } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      return data;
    },
    enabled: !!user?.id,
  });

  // Mutation para iniciar checkout
  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Error al crear sesión de checkout');
      }

      const { url } = await response.json();
      return url;
    },
    onSuccess: (url) => {
      if (url) {
        window.location.href = url;
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Error al iniciar pago');
    },
  });

  // Mutation para cancelar suscripción
  const cancelMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Error al cancelar suscripción');
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success('Suscripción cancelada. Tu plan finalizará al fin del período.');
    },
    onError: (error) => {
      toast.error(error.message || 'Error al cancelar');
    },
  });

  const plans: PricingPlan[] = [
    {
      id: 'free',
      name: 'Gratuito',
      price: 0,
      billing: 'siempre',
      description: 'Perfecto para comenzar',
      icon: <Zap className='h-8 w-8' />,
      features: [
        'Hasta 3 proyectos',
        'Canales y chat ilimitados',
        'Hasta 100 MB de recursos',
        'Hasta 10 miembros por proyecto',
        'Soporte por email',
      ],
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 2,
      billing: '/mes',
      description: 'Para equipos en crecimiento',
      icon: <Star className='h-8 w-8' />,
      popular: true,
      features: [
        'Proyectos ilimitados',
        'Canales y chat ilimitados',
        'Hasta 5 GB de recursos',
        'Hasta 20 miembros por proyecto',
        'Almacenamiento prioritario',
        'Soporte prioritario',
        'Integraciones avanzadas',
        'Exportar datos',
      ],
    },
  ];

  const isPro = subscription?.status === 'active';

  if (subscriptionLoading) {
    return (
      <div className='flex items-center justify-center h-full p-12'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent-primary)] mx-auto mb-4'></div>
          <p className='text-[var(--text-secondary)]'>
            Cargando datos de suscripción...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className='p-6 max-w-6xl mx-auto'>
      {/* Encabezado */}
      <div className='mb-8'>
        <h1 className='text-3xl font-bold text-[var(--text-primary)] mb-2'>
          Planes y Suscripción
        </h1>
        <p className='text-[var(--text-secondary)]'>
          Elige el plan que mejor se adapte a tus necesidades
        </p>
      </div>

      {/* Estado actual de suscripción */}
      {isPro && subscription && (
        <Card className='mb-8 border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/5'>
          <CardHeader>
            <div className='flex items-center justify-between'>
              <div>
                <CardTitle className='flex items-center gap-2'>
                  <Star className='h-5 w-5 text-[var(--accent-primary)]' />
                  Estás en el plan Pro
                </CardTitle>
                <CardDescription>
                  Tu suscripción está activa y renovable
                </CardDescription>
              </div>
              <div className='text-right'>
                <div className='text-sm text-[var(--text-secondary)]'>
                  Próxima renovación:
                </div>
                <div className='text-lg font-semibold text-[var(--text-primary)]'>
                  {formatDate(subscription.current_period_end)}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className='flex items-center gap-4 text-sm'>
              <div>
                <span className='text-[var(--text-secondary)]'>
                  Período actual: {formatDate(subscription.current_period_start)} a{' '}
                  {formatDate(subscription.current_period_end)}
                </span>
              </div>
              {!subscription.cancel_at_period_end && (
                <Button
                  variant='secondary'
                  size='sm'
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending}
                >
                  {cancelMutation.isPending ? 'Cancelando...' : 'Cancelar suscripción'}
                </Button>
              )}
              {subscription.cancel_at_period_end && (
                <div className='px-3 py-1 bg-orange-500/10 border border-orange-500/30 rounded text-orange-600 text-xs font-medium'>
                  Cancelada al final del período
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grid de planes */}
      <div className='grid md:grid-cols-2 gap-6 mb-8'>
        {plans.map((plan) => (
          <div key={plan.id} className='relative'>
            {plan.popular && (
              <div className='absolute -top-4 left-1/2 transform -translate-x-1/2'>
                <span className='bg-[var(--accent-primary)] text-white text-xs font-bold px-4 py-1 rounded-full'>
                  MÁS POPULAR
                </span>
              </div>
            )}

            <Card
              className={`h-full flex flex-col ${plan.popular
                ? 'border-[var(--accent-primary)]/50 bg-[var(--accent-primary)]/5'
                : ''
                }`}
            >
              <CardHeader>
                <div className='flex items-start justify-between mb-4'>
                  <div className='text-[var(--accent-primary)]'>{plan.icon}</div>
                  {isPro && plan.id === 'pro' && (
                    <div className='text-xs font-bold px-2 py-1 bg-green-500/20 text-green-700 rounded'>
                      ACTUAL
                    </div>
                  )}
                </div>

                <CardTitle className='text-2xl'>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>

                <div className='mt-4'>
                  <div className='flex items-baseline gap-1'>
                    <span className='text-4xl font-bold text-[var(--text-primary)]'>
                      ${plan.price}
                    </span>
                    <span className='text-[var(--text-secondary)]'>
                      {plan.billing}
                    </span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className='flex-1 flex flex-col'>
                {/* Features */}
                <div className='space-y-3 mb-6 flex-1'>
                  {plan.features.map((feature) => (
                    <div
                      key={feature}
                      className='flex items-start gap-3 text-sm text-[var(--text-secondary)]'
                    >
                      <Check className='h-5 w-5 text-green-500 flex-shrink-0 mt-0.5' />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Button */}
                <Button
                  className='w-full'
                  disabled={
                    checkoutMutation.isPending ||
                    (isPro && plan.id === 'pro')
                  }
                  onClick={() => {
                    if (plan.id === 'pro') {
                      checkoutMutation.mutate();
                    }
                  }}
                  variant={plan.popular ? 'primary' : 'secondary'}
                >
                  {isPro && plan.id === 'pro' ? (
                    'Plan actual'
                  ) : plan.id === 'free' ? (
                    'Ya estás aquí'
                  ) : checkoutMutation.isPending ? (
                    'Procesando...'
                  ) : (
                    'Actualizar a Pro'
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* FAQ / Información adicional */}
      <div className='grid md:grid-cols-2 gap-6'>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <HardDrive className='h-5 w-5' />
              Almacenamiento
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-2 text-sm text-[var(--text-secondary)]'>
            <p>
              <strong>Gratuito:</strong> Hasta 100 MB por proyecto
            </p>
            <p>
              <strong>Pro:</strong> Hasta 5 GB por proyecto
            </p>
            <p className='text-xs mt-4'>
              El almacenamiento se calcula a partir de tus recursos y archivos
              subidos.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Users className='h-5 w-5' />
              Colaboradores
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-2 text-sm text-[var(--text-secondary)]'>
            <p>
              <strong>Gratuito:</strong> Hasta 10 miembros por proyecto
            </p>
            <p>
              <strong>Pro:</strong> Hasta 20 miembros por proyecto
            </p>
            <p className='text-xs mt-4'>
              Invita a tu equipo a colaborar en proyectos. Los permisos se
              asignan por rol.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Lock className='h-5 w-5' />
              Seguridad
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-2 text-sm text-[var(--text-secondary)]'>
            <p>✓ Encriptación end-to-end</p>
            <p>✓ Backups automáticos</p>
            <p>✓ Autenticación de dos factores</p>
            <p className='text-xs mt-4'>
              Tus datos están protegidos en servidores certificados.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Calendar className='h-5 w-5' />
              Facturación
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-2 text-sm text-[var(--text-secondary)]'>
            <p>
              <strong>Ciclo de facturación:</strong> Mensual (renovación automática)
            </p>
            <p>
              <strong>Cancelación:</strong> Válida hasta fin de período
            </p>
            <p className='text-xs mt-4'>
              Recibe recibos por email. Puedes cambiar o cancelar en cualquier
              momento.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
