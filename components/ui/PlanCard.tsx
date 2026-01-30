'use client';
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './Card';
import { Check, Star, Zap } from 'lucide-react';
import { Button } from './Button';
import { useRouter } from 'next/navigation';

export default function PlanCard({ planId, isCurrent, isCanceled, plan_reference }: { planId: string; isCurrent: boolean; isCanceled: boolean; plan_reference: string; }) {
  const router = useRouter();
  const { data: plan, isLoading, error } = useQuery({
    queryKey: ['plan', planId],
    queryFn: async () => {
      try {
        console.log(planId);

        const res = await fetch(`/api/mercadopago/plan/${planId}`);
        if (!res.ok) {
          throw new Error('Error fetching plan data');
        }
        const data = await res.json();
        console.log(data);

        return data;
      } catch (error) {
        console.log(error);

      }
    },
    enabled: !!planId,
  });

  console.log(plan);

  const planFeatures: Record<string, { icon: React.ReactNode; description: string; features: string[]; }> = {
    free: {
      icon: <Zap className='h-8 w-8' />,
      description: 'Perfecto para comenzar',
      features: [
        'Hasta 3 proyectos',
        'Canales y chat ilimitados',
        'Hasta 100 MB de recursos',
        'Hasta 10 miembros por proyecto',
        'Soporte por email',
      ]
    },
    starter: {
      icon: <>
        <Star className='h-8 w-8' />
      </>,
      description: 'Para usuarios intermedios',
      features: [
        'Hasta 5 proyectos',
        'Canales y chat ilimitados',
        'Hasta 1 GB de recursos',
        'Hasta 15 miembros por proyecto',
        'Soporte prioritario',
      ]
    },
    pro: {
      icon: <>
        <Star className='h-8 w-8' />
        <Star className='h-8 w-8' />
      </>,
      description: 'Para usuarios avanzados',
      features: [
        'Hasta 10 proyectos',
        'Canales y chat ilimitados',
        'Hasta 5 GB de recursos',
        'Hasta 20 miembros por proyecto',
        'Asistente IA con Gemini',
        'Generar tareas con IA',
        'Resúmenes de chat con IA',
        'Almacenamiento prioritario',
        'Soporte prioritario',
        'Integraciones avanzadas',
        'Exportar datos',
      ]
    },
    enterprise: {
      icon: <>
        <Star className='h-8 w-8' />
        <Star className='h-8 w-8' />
        <Star className='h-8 w-8' />
      </>,
      description: 'Para grandes equipos y empresas',
      features: [
        'Proyectos ilimitados',
        'Canales y chat ilimitados',
        'Recursos ilimitados',
        'Miembros ilimitados por proyecto',
        'Asistente IA con Gemini',
        'Generar tareas con IA',
        'Resúmenes de chat con IA',
        'Almacenamiento prioritario',
        'Soporte 24/7',
        'Integraciones avanzadas',
        'Exportar datos',
        'Gestión de cuentas dedicada',
      ]
    }
  };
  function getPlanType(plan_reason: string): string {
    if (plan_reason === 'free' || plan_reason.toLowerCase().includes('free')) return 'free';
    if (plan_reason === 'starter' || plan_reason.toLowerCase().includes('starter')) return 'starter';
    if (plan_reason === 'enterprise' || plan_reason.toLowerCase().includes('enterprise')) return 'enterprise';
    // Puedes mejorar esta lógica para detectar otros tipos de planes
    return 'pro';
  }
  const type = getPlanType(!isLoading && plan ? plan.reason : '');
  const features = planFeatures[type]?.features || [];
  const icon = planFeatures[type]?.icon || <Star className='h-8 w-8' />;
  const description = planFeatures[type]?.description || '';

  const isFree = !isLoading && plan ? plan.reason === 'free' : false;
  const handleSubscribe = async (init_point: string) => {
    router.push(init_point);
  };

  return (
    <div className='relative min-w-96 max-w-96 h-full bg-[var(--bg-secondary)] border-[var(--accent-primary)] border rounded-lg'>
      {
        !isLoading && error && (
          <div className='absolute top-2 right-2 bg-[var(--accent-danger)]/20 text-[var(--accent-danger)] text-xs px-2 py-1 rounded z-10'>
            Error cargando datos del plan
          </div>
        )
      }
      {isLoading && (
        <div className='flex items-center justify-center h-full p-12'>
          <div className='text-center'>
            <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent-primary)] mx-auto mb-4'></div>
            <p className='text-[var(--text-secondary)]'>
              Cargando datos de suscripción...
            </p>
          </div>
        </div>
      )}
      {!isLoading && !error && (
        <Card className='h-full flex flex-col border-0'>
          <CardHeader>
            <div className='flex items-start justify-between mb-2'>
              <div className='text-[var(--accent-primary)] mx-auto flex gap-2'>{icon}</div>
              {isCurrent && (
                <div className={`text-xs font-bold px-2 py-1 rounded ${isCanceled ? 'bg-[var(--accent-danger)]/20 text-[var(--accent-danger)]' : 'bg-green-500/20 text-green-700'}`}>
                  {isCanceled ? 'CANCELADO (ACTIVO)' : 'ACTUAL'}
                </div>
              )}
            </div>
            <CardTitle className='text-2xl uppercase text-center'>{plan.reason}</CardTitle>
            <CardDescription className='text-center'>{description}</CardDescription>
            {plan.auto_recurring.free_trial &&
              <div className='w-full mt-2'>
                <span className='border border-[var(--accent-success)] bg-[var(--accent-success)]/10 w-full rounded-2xl py-1 inline-block text-center text-[var(--accent-success)]  font-medium uppercase'>
                  {`${plan.auto_recurring.free_trial.frequency} días`} de prueba gratuita
                </span>
              </div>
            }
            <div className='mt-2'>
              <div className='flex items-baseline gap-1'>
                <span className='text-2xl font-bold text-[var(--text-primary)]'>
                  ${plan.auto_recurring.transaction_amount.toLocaleString()}
                </span>
                <span className='text-[var(--text-secondary)]'>
                  {plan.reason !== 'free' && (plan.auto_recurring.frequency_type === 'months' && plan.auto_recurring.frequency === 12 ? '/anual' : '/mensual')}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className='flex-1 flex flex-col'>
            <div className='grid grid-cols-2 mb-6'>
              {features.map((feature) => (
                <div
                  key={feature}
                  className='flex items-start gap-3 text-xs text-[var(--text-secondary)]'
                >
                  <Check className='h-4 w-4 text-green-500 flex-shrink-0 mt-0.5' />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
            <Button
              className='w-full mt-auto'
              disabled={
                (isCurrent && !isCanceled) || isLoading || isFree
              }
              onClick={() => {
                if (!isFree) handleSubscribe(plan.init_point);
              }}
              variant={isCurrent ? 'primary' : 'secondary'}
            >
              {isFree
                ? 'Ya estás aquí'
                : isLoading && isCurrent
                  ? 'Redirigiendo...'
                  : isCurrent
                    ? (isCanceled ? 'Reactivar Suscripción' : 'Plan actual')
                    : 'Actualizar'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>


  );
}
