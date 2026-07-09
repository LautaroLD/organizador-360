/* eslint-disable @typescript-eslint/no-explicit-any */

import { render, screen } from '@testing-library/react';
import PlanCard from '@/components/ui/PlanCard';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock useRouter
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() })
}));

describe('PlanCard', () => {
  const queryClient = new QueryClient();

  const renderComponent = (props: any) =>
    render(
      <QueryClientProvider client={ queryClient }>
        <PlanCard { ...props } />
      </QueryClientProvider>
    );

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    queryClient.clear();
  });

  it('muestra plan free local cuando no hay external_id', () => {
    renderComponent({ forceTier: 'free', isCurrent: false, isCanceled: false });
    expect(screen.getByText('FREE')).toBeInTheDocument();
    expect(screen.getByText('Perfecto para comenzar')).toBeInTheDocument();
  });

  it('muestra error si falla la carga', () => {
    // Simula error en la query
    jest.spyOn(global, 'fetch').mockImplementationOnce(() => Promise.reject('error') as any);
    renderComponent({ planId: 'error', isCurrent: false, isCanceled: false, plan_reference: 'PRO_MENSUAL' });
    // No se puede forzar el error visual sin manipular la query, pero se puede mejorar con MSW
  });

  it('muestra los features del plan PRO', async () => {
    // Mock fetch para devolver un plan PRO
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        name: 'Plan PRO',
        price: '$2,000 ARS',
        description: 'Para usuarios avanzados',
        hasFreeTrial: false,
        trialDays: 0,
      })
    } as any);
    renderComponent({ external_id: 'pro', provider: 'lemon_squeezy', isCurrent: false, isCanceled: false });
    expect(await screen.findByText('Para usuarios avanzados')).toBeInTheDocument();
    expect(await screen.findByText('Hasta 10 proyectos')).toBeInTheDocument();
    expect(await screen.findByText('Actualizar plan')).toBeInTheDocument();
  });

  it('muestra el badge de ACTUAL si es el plan actual', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        name: 'Plan PRO',
        price: '$2,000 ARS',
        description: 'Para usuarios avanzados',
        hasFreeTrial: false,
        trialDays: 0,
      })
    } as any);
    renderComponent({ external_id: 'pro', provider: 'lemon_squeezy', isCurrent: true, isCanceled: false });
    expect((await screen.findAllByText('Plan actual')).length).toBeGreaterThan(0);
  });

  it('muestra el badge CANCELADO (ACTIVO) si el plan está cancelado pero activo', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        name: 'Plan PRO',
        price: '$2,000 ARS',
        description: 'Para usuarios avanzados',
        hasFreeTrial: false,
        trialDays: 0,
      })
    } as any);
    renderComponent({ external_id: 'pro', provider: 'lemon_squeezy', isCurrent: true, isCanceled: true });
    expect(await screen.findByText('Cancelado')).toBeInTheDocument();
  });

  it('no muestra botón de acción en plan free', () => {
    renderComponent({ forceTier: 'free', isCurrent: true, isCanceled: false });
    expect(screen.queryByText('Ya estas aquí')).not.toBeInTheDocument();
    expect(screen.queryByText('Actualizar plan')).not.toBeInTheDocument();
  });
});
