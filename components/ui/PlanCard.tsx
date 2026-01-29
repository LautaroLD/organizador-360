'use client';
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './Card';
import { Check, Star, Zap } from 'lucide-react';
import { Button } from './Button';
import { useRouter } from 'next/navigation';

export default function PlanCard({ planId, isCurrent, isCanceled }: { planId: string; isCurrent: boolean; isCanceled: boolean; }) {
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
    pro: {
      icon: <Star className='h-8 w-8' />,
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
  };
  function getPlanType(plan_reason: string): string {
    if (plan_reason === 'free' || plan_reason.toLowerCase().includes('free')) return 'free';
    // Puedes mejorar esta lógica para detectar otros tipos de planes
    return 'pro';
  }
  if (isLoading) {
    return <div>Cargando...</div>;
  }
  if (error) {
    return <div>Error loading plan data</div>;
  }
  const type = getPlanType('');
  const features = planFeatures[type]?.features || [];
  const icon = planFeatures[type]?.icon || <Star className='h-8 w-8' />;
  const description = planFeatures[type]?.description || '';

  const isFree = plan.reason === 'free';
  const handleSubscribe = async (init_point: string) => {
    router.push(init_point);
  };

  return (
    <div className='relative'>
      <Card className='h-full flex flex-col border-[var(--accent-primary)]'>
        <CardHeader>
          <div className='flex items-start justify-between mb-4'>
            <div className='text-[var(--accent-primary)] mx-auto'>{icon}</div>
            {isCurrent && (
              <div className={`text-xs font-bold px-2 py-1 rounded ${isCanceled ? 'bg-[var(--accent-danger)]/20 text-[var(--accent-danger)]' : 'bg-green-500/20 text-green-700'}`}>
                {isCanceled ? 'CANCELADO (ACTIVO)' : 'ACTUAL'}
              </div>
            )}
          </div>
          <CardTitle className='text-2xl uppercase'>{plan.reason}</CardTitle>
          <CardDescription>{description}</CardDescription>
          {plan.auto_recurring.free_trial &&
            <div className='w-full mt-4'>
              <span className='border border-[var(--accent-success)] bg-[var(--accent-success)]/10 w-full rounded-2xl py-2 inline-block text-center text-[var(--accent-success)]  font-medium uppercase'>
                {`${plan.auto_recurring.free_trial.frequency} días`} de prueba gratuita
              </span>
            </div>
          }
          <div className='mt-4'>
            <div className='flex items-baseline gap-1'>
              <span className='text-4xl font-bold text-[var(--text-primary)]'>
                ${plan.auto_recurring.transaction_amount.toLocaleString()}
              </span>
              <span className='text-[var(--text-secondary)]'>
                {plan.reason !== 'free' && (plan.auto_recurring.frequency_type === 'months' && plan.auto_recurring.frequency === 12 ? '/anual' : '/mensual')}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className='flex-1 flex flex-col'>
          <div className='space-y-3 mb-6 flex-1'>
            {features.map((feature) => (
              <div
                key={feature}
                className='flex items-start gap-3 text-sm text-[var(--text-secondary)]'
              >
                <Check className='h-5 w-5 text-green-500 flex-shrink-0 mt-0.5' />
                <span>{feature}</span>
              </div>
            ))}
          </div>
          <Button
            className='w-full'
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
    </div>


  );
}
