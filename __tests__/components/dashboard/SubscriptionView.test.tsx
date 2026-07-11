/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen } from '@testing-library/react';
import { SubscriptionView } from '@/components/dashboard/SubscriptionView';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mocks
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({})),
}));

jest.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'user-123', email: 'test@example.com' } }),
}));

// Mock useQuery para controlar estados directamente
const mockUseQuery = jest.fn();

jest.mock('@tanstack/react-query', () => {
  const original = jest.requireActual('@tanstack/react-query');
  return {
    ...original,
    useQuery: (...args: any[]) => mockUseQuery(...args),
  };
});

// Mock global fetch
global.fetch = jest.fn();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

describe('SubscriptionView', () => {
  const originalEnv = process.env;

  beforeAll(() => {
    // Solo Lemon Squeezy con FREE, STARTER y PRO (sin MercadoPago ni Enterprise)
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_LEMON_STARTER_VARIANT_ID: 'starter-variant',
      NEXT_PUBLIC_LEMON_PRO_VARIANT_ID: 'pro-variant',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={ queryClient }>
        <SubscriptionView />
      </QueryClientProvider>
    );

  it('renders loading state initially', () => {
    // Primera llamada (subscription-details): loading
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    renderComponent();
    expect(screen.getByText('Cargando datos de suscripción...')).toBeInTheDocument();
  });

  it('renders plans when no subscription is active', () => {
    mockUseQuery.mockImplementation((options) => {
      if (options.queryKey[0] === 'plans') {
        return {
          data: {
            lemon_squeezy: [
              { provider: 'lemon_squeezy', external_id: 'starter-ext', plan_code: 'starter' },
              { provider: 'lemon_squeezy', external_id: 'pro-ext', plan_code: 'pro' },
            ],
          },
          isLoading: false,
        };
      }
      if (options.queryKey[0] === 'lemon-subscription-details') {
        return {
          data: {
            hasSubscription: false,
            source: null,
            planContext: { plan_tier: 'free', source: 'free', expires_at: null },
            details: null,
          },
          isLoading: false,
        };
      }
      return { data: null, isLoading: false };
    });

    renderComponent();

    expect(screen.getByText('Planes y Suscripción')).toBeInTheDocument();
    // Los planes no actuales muestran "Actualizar plan" y debe haber al menos un indicador de plan actual.
    expect(screen.getAllByText('Actualizar plan').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Plan actual').length).toBeGreaterThan(0);
  });

  // El test de redirección debe adaptarse a la nueva lógica de PlanCard, se recomienda testear en PlanCard.test.tsx

  it('renders active subscription details correctly', () => {
    // Mock suscripción activa
    const mockSub = {
      lemon_squeezy_subscription_id: 'sub-123',
      status: 'active',
      statusLabel: 'Activa',
      currentPeriodStart: '2023-01-01T00:00:00.000Z',
      currentPeriodEnd: '2099-02-01T00:00:00.000Z',
      cancelAtPeriodEnd: false,
      variantName: 'pro',
      customerPortalUrl: 'https://billing.lemonsqueezy.com/portal',
      updatePaymentMethodUrl: 'https://billing.lemonsqueezy.com/payment-method',
      updateSubscriptionUrl: 'https://billing.lemonsqueezy.com/subscription',
    };

    mockUseQuery.mockImplementation((options) => {
      if (options.queryKey[0] === 'lemon-subscription-details') {
        return {
          data: {
            hasSubscription: true,
            source: 'lemon_squeezy',
            planContext: { plan_tier: 'pro', source: 'subscription', expires_at: null },
            details: mockSub,
          },
          isLoading: false
        };
      }
      return { data: null, isLoading: false };
    });

    renderComponent();

    expect(screen.getAllByText('Plan PRO').length).toBeGreaterThan(0);
    expect(screen.getByText('Activa')).toBeInTheDocument();
    expect(screen.getByText('sub-123')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cambiar plan en Lemon' })).toHaveAttribute(
      'href',
      'https://billing.lemonsqueezy.com/subscription',
    );
    expect(screen.getByRole('link', { name: 'Actualizar método de pago' })).toHaveAttribute(
      'href',
      'https://billing.lemonsqueezy.com/payment-method',
    );
    expect(screen.getByRole('link', { name: 'Abrir portal de facturación' })).toHaveAttribute(
      'href',
      'https://billing.lemonsqueezy.com/portal',
    );
  });

  it('renders cancelled but still active subscription correctly', () => {
    // Fecha futura
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10); // 10 days from now

    const mockSubscription = {
      status: 'cancelled',
      statusLabel: 'Cancelado',
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: futureDate.toISOString(),
      cancelAtPeriodEnd: true,
      variantName: 'pro',
    };

    mockUseQuery.mockImplementation((options) => {
      if (options.queryKey[0] === 'lemon-subscription-details') {
        return {
          data: {
            hasSubscription: true,
            source: 'lemon_squeezy',
            planContext: { plan_tier: 'pro', source: 'subscription', expires_at: null },
            details: mockSubscription,
          },
          isLoading: false
        };
      }
      return { data: null, isLoading: false };
    });

    renderComponent();

    // Check for "Cancelado" badge (puede aparecer en el status label y en el badge del PlanCard)
    expect(screen.getAllByText('Cancelado').length).toBeGreaterThan(0);
  });
});
