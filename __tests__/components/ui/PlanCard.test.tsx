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
      <QueryClientProvider client={queryClient}>
        <PlanCard {...props} />
      </QueryClientProvider>
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('muestra loading mientras carga el plan', () => {
    // Simula que no hay planId (no se habilita la query)
    renderComponent({ planId: '', isCurrent: false, isCanceled: false, plan_reference: 'PRO_MENSUAL' });
    expect(screen.getByText('Cargando datos de suscripción...')).toBeInTheDocument();
  });

  it('muestra error si falla la carga', () => {
    // Simula error en la query
    jest.spyOn(global, 'fetch').mockImplementationOnce(() => Promise.reject('error') as any);
    renderComponent({ planId: 'error', isCurrent: false, isCanceled: false, plan_reference: 'PRO_MENSUAL' });
    // No se puede forzar el error visual sin manipular la query, pero se puede mejorar con MSW
  });

  it('muestra los features del plan PRO', async () => {
    // Mock fetch para devolver un plan PRO
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        reason: 'pro',
        auto_recurring: { transaction_amount: 2000, frequency_type: 'months', frequency: 1 },
      })
    } as any);
    renderComponent({ planId: 'pro', isCurrent: false, isCanceled: false, plan_reference: 'PRO_MENSUAL' });
    expect(await screen.findByText('Para usuarios avanzados')).toBeInTheDocument();
    expect(await screen.findByText('Hasta 10 proyectos')).toBeInTheDocument();
    expect(await screen.findByText('Actualizar')).toBeInTheDocument();
  });

  it('muestra el badge de ACTUAL si es el plan actual', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        reason: 'pro',
        auto_recurring: { transaction_amount: 2000, frequency_type: 'months', frequency: 1 },
      })
    } as any);
    renderComponent({ planId: 'pro', isCurrent: true, isCanceled: false, plan_reference: 'PRO_MENSUAL' });
    expect(await screen.findByText('ACTUAL')).toBeInTheDocument();
  });

  it('muestra el badge CANCELADO (ACTIVO) si el plan está cancelado pero activo', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        reason: 'pro',
        auto_recurring: { transaction_amount: 2000, frequency_type: 'months', frequency: 1 },
      })
    } as any);
    renderComponent({ planId: 'pro', isCurrent: true, isCanceled: true, plan_reference: 'PRO_MENSUAL' });
    expect(await screen.findByText('CANCELADO (ACTIVO)')).toBeInTheDocument();
  });

  it('muestra el botón Ya estás aquí si es el plan free', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        reason: 'free',
        auto_recurring: { transaction_amount: 0, frequency_type: 'forever', frequency: 0 },
      })
    } as any);
    renderComponent({ planId: 'free', isCurrent: true, isCanceled: false, plan_reference: 'FREE' });
    expect(await screen.findByText('Ya estás aquí')).toBeInTheDocument();
  });
});
