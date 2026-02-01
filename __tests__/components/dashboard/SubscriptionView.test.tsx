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

jest.mock('react-toastify', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock useQuery para controlar estados directamente
const mockUseQuery = jest.fn();
const mockUseMutation = jest.fn();

jest.mock('@tanstack/react-query', () => {
  const original = jest.requireActual('@tanstack/react-query');
  return {
    ...original,
    useQuery: (...args: any[]) => mockUseQuery(...args),
    useMutation: (...args: any[]) => mockUseMutation(...args),
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
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_MP_STARTER_MENSUAL_PLAN_ID: 'starter-month',
      NEXT_PUBLIC_MP_STARTER_ANUAL_PLAN_ID: 'starter-year',
      NEXT_PUBLIC_MP_PRO_MENSUAL_PLAN_ID: 'pro-month',
      NEXT_PUBLIC_MP_PRO_ANUAL_PLAN_ID: 'pro-year',
      NEXT_PUBLIC_MP_ENTERPRISE_MENSUAL_PLAN_ID: 'enterprise-month',
      NEXT_PUBLIC_MP_ENTERPRISE_ANUAL_PLAN_ID: 'enterprise-year',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMutation.mockReturnValue({ mutate: jest.fn(), isPending: false });
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <SubscriptionView />
      </QueryClientProvider>
    );

  it('renders loading state initially', () => {
    // Primera llamada (suscripción): loading
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    renderComponent();
    expect(screen.getByText('Cargando datos de suscripción...')).toBeInTheDocument();
  });

  it('renders plans when no subscription is active', () => {
    // Mockear useQuery para devolver null (no subscription)
    mockUseQuery.mockImplementation((options) => {
      if (options.queryKey[0] === 'subscription') {
        return { data: null, isLoading: false };
      }
      if (options.queryKey[0] === 'subscription-details') {
        return { data: null, isLoading: false };
      }
      if (options.queryKey[0] === 'plan') {
        return {
          data: {
            reason: 'pro',
            auto_recurring: { transaction_amount: 2000, frequency_type: 'months', frequency: 1 },
          },
          isLoading: false,
        };
      }
      return { data: null, isLoading: false };
    });

    renderComponent();

    expect(screen.getByText('Planes y Suscripción')).toBeInTheDocument();
    // Ahora los botones de acción de los planes pueden ser "Actualizar" o "Ya estás aquí" según el plan
    expect(screen.getAllByText('Actualizar').length).toBeGreaterThan(0);
    expect(screen.getByText('Ya estás aquí')).toBeInTheDocument();
  });

  // El test de redirección debe adaptarse a la nueva lógica de PlanCard, se recomienda testear en PlanCard.test.tsx

  it('renders active subscription details correctly', () => {
    // Mock suscripción activa
    const mockSub = {
      status: 'active',
      mercadopago_subscription_id: 'sub-123',
      current_period_start: '2023-01-01',
      current_period_end: '2023-02-01',
    };

    // Mock detalles MP
    const mockDetails = {
      status: 'authorized',
      statusLabel: 'Activa',
      reason: 'Plan Pro',
      nextPaymentDate: '2023-02-01T00:00:00.000Z',
      amount: 2000,
      currency: 'ARS',
      chargedQuantity: 1,
      totalChargedAmount: 2000,
      pendingChargeQuantity: 0,
    };

    mockUseQuery.mockImplementation((options) => {
      if (options.queryKey[0] === 'subscription') {
        return { data: mockSub, isLoading: false };
      }
      if (options.queryKey[0] === 'subscription-details') {
        return {
          data: {
            details: mockDetails,
            isPro: true,
            internalPlanId: 'pro'
          },
          isLoading: false
        };
      }
      if (options.queryKey[0] === 'plan') {
        return {
          data: {
            reason: 'pro',
            auto_recurring: { transaction_amount: 2000, frequency_type: 'months', frequency: 1 },
          },
          isLoading: false,
        };
      }
      return { data: null, isLoading: false };
    });

    renderComponent();

    expect(screen.getByText('Plan Pro')).toBeInTheDocument();
    expect(screen.getByText('Activa')).toBeInTheDocument();
    expect(screen.getAllByText('$2,000 ARS').length).toBeGreaterThan(0);
  });

  it('renders cancelled but still active subscription correctly', () => {
    // Fecha futura
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10); // 10 days from now

    const mockSubscription = {
      status: 'canceled', // Canceled status
      plan_id: 'pro',
      current_period_end: futureDate.toISOString(), // But still valid period
    };

    const mockDetails = {
      status: 'cancelled',
      statusLabel: 'Cancelado',
      reason: 'Plan Pro',
      nextPaymentDate: null, // No next payment
      amount: 2500,
      currency: 'ARS',
      chargedQuantity: 1,
      totalChargedAmount: 2500,
      pendingChargeQuantity: 0,
      daysUntilNextPayment: null,
    };

    mockUseQuery.mockImplementation((options) => {
      if (options.queryKey[0] === 'subscription') {
        return { data: mockSubscription, isLoading: false };
      }
      if (options.queryKey[0] === 'subscription-details') {
        return {
          data: {
            details: mockDetails,
            isPro: true, // Should be true for "Cancelled but Active" due to logic
            internalPlanId: 'pro'
          },
          isLoading: false
        };
      }
      if (options.queryKey[0] === 'plan') {
        return {
          data: {
            reason: 'pro',
            auto_recurring: { transaction_amount: 2000, frequency_type: 'months', frequency: 1 },
          },
          isLoading: false,
        };
      }
      return { data: null, isLoading: false };
    });

    renderComponent();

    // Check for "CANCELADO (ACTIVO)" badge
    expect(screen.getByText('CANCELADO (ACTIVO)')).toBeInTheDocument();

    // Check for "CANCELADO (ACTIVO)" badge
    expect(screen.getByText('CANCELADO (ACTIVO)')).toBeInTheDocument();
  });
});
