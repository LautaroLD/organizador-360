/* eslint-disable @typescript-eslint/no-explicit-any */

import { fireEvent, render, screen } from '@testing-library/react';
import PlanCard from '@/components/ui/PlanCard';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

describe('PlanCard', () => {
  const queryClient = new QueryClient();

  const renderComponent = (props: any) =>
    render(
      <QueryClientProvider client={queryClient}>
        <PlanCard {...props} />
      </QueryClientProvider>,
    );

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    queryClient.clear();
  });

  it('muestra plan free local cuando planCode es free', () => {
    renderComponent({
      planCode: 'free',
      name: 'Free',
      description: 'Perfecto para comenzar',
      features: ['Hasta 3 proyectos', 'Hasta 100 MB de recursos'],
      isCurrent: false,
      isCanceled: false,
    });
    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('Perfecto para comenzar')).toBeInTheDocument();
    expect(screen.getByText('Hasta 3 proyectos')).toBeInTheDocument();
  });

  it('muestra los features del plan PRO desde el catálogo', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        name: 'Plan PRO',
        price: '$12.00/mes',
        hasFreeTrial: false,
        trialDays: 0,
        buy_url: 'https://example.com/buy',
      }),
    } as any);

    renderComponent({
      planCode: 'pro',
      name: 'Pro',
      description: 'Para usuarios avanzados',
      features: ['Hasta 10 proyectos', 'Asistente IA con Gemini'],
      external_id: '1773666',
      provider: 'lemon_squeezy',
      checkout_url: 'https://example.com/checkout',
      isCurrent: false,
      isCanceled: false,
    });

    expect(
      await screen.findByText('Para usuarios avanzados'),
    ).toBeInTheDocument();
    expect(await screen.findByText('Hasta 10 proyectos')).toBeInTheDocument();
    expect(await screen.findByText('Actualizar plan')).toBeInTheDocument();
  });

  it('muestra el badge de plan actual', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        name: 'Plan PRO',
        price: '$12.00/mes',
        hasFreeTrial: false,
        trialDays: 0,
      }),
    } as any);

    renderComponent({
      planCode: 'pro',
      features: ['Hasta 10 proyectos'],
      external_id: '1773666',
      provider: 'lemon_squeezy',
      isCurrent: true,
      isCanceled: false,
    });

    expect((await screen.findAllByText('Plan actual')).length).toBeGreaterThan(
      0,
    );
  });

  it('muestra el badge cancelado', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        name: 'Plan PRO',
        price: '$12.00/mes',
        hasFreeTrial: false,
        trialDays: 0,
      }),
    } as any);

    renderComponent({
      planCode: 'pro',
      features: ['Hasta 10 proyectos'],
      external_id: '1773666',
      provider: 'lemon_squeezy',
      isCurrent: true,
      isCanceled: true,
    });

    expect(await screen.findByText('Cancelado')).toBeInTheDocument();
  });

  it('permite elegir entre variantes y muestra solo el precio seleccionado', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async (input: any) => {
      const url = String(input);
      if (url.includes('/1773666')) {
        return {
          ok: true,
          json: async () => ({
            name: 'Pro Base',
            price: '$10.00/mes',
            hasFreeTrial: false,
            trialDays: 0,
            buy_url: 'https://example.com/pro-base',
          }),
        } as any;
      }
      if (url.includes('/1773999')) {
        return {
          ok: true,
          json: async () => ({
            name: 'Pro Extra Storage',
            price: '$12.00/mes',
            hasFreeTrial: false,
            trialDays: 0,
            buy_url: 'https://example.com/pro-extra',
          }),
        } as any;
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    renderComponent({
      planCode: 'pro',
      name: 'Pro',
      description: 'Para usuarios avanzados',
      features: [
        'Hasta 10 proyectos',
        'Hasta 5 GB de recursos',
        'Hasta 30 miembros por proyecto',
        'Asistente IA con Gemini',
      ],
      limits: {
        max_projects: 10,
        max_members_per_project: 30,
        max_storage_bytes: 5 * 1024 * 1024 * 1024,
        ai_features_enabled: true,
        ai_monthly_credits: 250,
        workspace_enabled: true,
        google_calendar_sync: true,
      },
      provider: 'lemon_squeezy',
      isCurrent: false,
      isCanceled: false,
      variants: [
        {
          external_id: '1773666',
          interval: 'month',
          is_default: true,
          checkout_url: 'https://example.com/pro-base',
          limits: {
            max_projects: 10,
            max_members_per_project: 30,
            max_storage_bytes: 5 * 1024 * 1024 * 1024,
            ai_features_enabled: true,
            ai_monthly_credits: 250,
            workspace_enabled: true,
            google_calendar_sync: true,
          },
          feature_catalog: [
            'Hasta 10 proyectos',
            'Hasta 5 GB de recursos',
            'Hasta 30 miembros por proyecto',
            'Asistente IA con Gemini',
          ],
        },
        {
          external_id: '1773999',
          interval: 'month',
          is_default: false,
          checkout_url: 'https://example.com/pro-extra',
          limits: {
            max_projects: 10,
            max_members_per_project: 30,
            max_storage_bytes: 10 * 1024 * 1024 * 1024,
            ai_features_enabled: true,
            ai_monthly_credits: 250,
            workspace_enabled: true,
            google_calendar_sync: true,
          },
          feature_catalog: [
            'Hasta 10 proyectos',
            'Hasta 5 GB de recursos',
            'Hasta 30 miembros por proyecto',
            'Asistente IA con Gemini',
          ],
        },
      ],
    });

    expect(await screen.findByText('Variante')).toBeInTheDocument();
    expect(await screen.findByText('$10.00/mes')).toBeInTheDocument();
    expect(screen.getByText('Hasta 5 GB de recursos')).toBeInTheDocument();
    expect(screen.queryByText(/\$10\.00 - \$12\.00/)).not.toBeInTheDocument();

    fireEvent.click(await screen.findByLabelText(/Pro Extra Storage/i));
    expect(await screen.findByText('$12.00/mes')).toBeInTheDocument();
    expect(screen.queryByText('$10.00/mes')).not.toBeInTheDocument();
    expect(await screen.findByText('Hasta 10 GB de recursos')).toBeInTheDocument();
    expect(screen.queryByText('Hasta 5 GB de recursos')).not.toBeInTheDocument();
    expect(screen.getByText('Asistente IA con Gemini')).toBeInTheDocument();
  });

  it('preselects currentVariantId and only disables checkout for that variant', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async (input: any) => {
      const url = String(input);
      if (url.includes('/1773666')) {
        return {
          ok: true,
          json: async () => ({
            name: 'Pro Base',
            price: '$10.00/mes',
            hasFreeTrial: false,
            trialDays: 0,
            buy_url: 'https://example.com/pro-base',
          }),
        } as any;
      }
      if (url.includes('/1773999')) {
        return {
          ok: true,
          json: async () => ({
            name: 'Pro Extra Storage',
            price: '$12.00/mes',
            hasFreeTrial: false,
            trialDays: 0,
            buy_url: 'https://example.com/pro-extra',
          }),
        } as any;
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    renderComponent({
      planCode: 'pro',
      name: 'Pro',
      description: 'Para usuarios avanzados',
      features: ['Asistente IA con Gemini'],
      limits: {
        max_projects: 10,
        max_members_per_project: 30,
        max_storage_bytes: 5 * 1024 * 1024 * 1024,
        ai_features_enabled: true,
        ai_monthly_credits: 250,
        workspace_enabled: true,
        google_calendar_sync: true,
      },
      provider: 'lemon_squeezy',
      isCurrent: true,
      currentVariantId: '1773666',
      isCanceled: false,
      variants: [
        {
          external_id: '1773666',
          interval: 'month',
          is_default: true,
          checkout_url: 'https://example.com/pro-base',
          limits: {
            max_projects: 10,
            max_members_per_project: 30,
            max_storage_bytes: 5 * 1024 * 1024 * 1024,
            ai_features_enabled: true,
            ai_monthly_credits: 250,
            workspace_enabled: true,
            google_calendar_sync: true,
          },
          feature_catalog: ['Hasta 5 GB de recursos'],
        },
        {
          external_id: '1773999',
          interval: 'month',
          is_default: false,
          checkout_url: 'https://example.com/pro-extra',
          limits: {
            max_projects: 10,
            max_members_per_project: 30,
            max_storage_bytes: 10 * 1024 * 1024 * 1024,
            ai_features_enabled: true,
            ai_monthly_credits: 250,
            workspace_enabled: true,
            google_calendar_sync: true,
          },
          feature_catalog: ['Hasta 10 GB de recursos'],
        },
      ],
    });

    expect(await screen.findByText('Hasta 5 GB de recursos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Plan actual' })).toBeDisabled();

    fireEvent.click(await screen.findByLabelText(/Pro Extra Storage/i));
    expect(await screen.findByText('Hasta 10 GB de recursos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actualizar plan' })).toBeEnabled();
  });
});
