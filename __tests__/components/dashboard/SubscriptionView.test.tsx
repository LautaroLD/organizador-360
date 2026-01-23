/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
      return { data: null, isLoading: false };
    });

    renderComponent();

    expect(screen.getByText('Planes y Suscripción')).toBeInTheDocument();

    // Verificar que se muestre el botón "Actualizar a Pro"
    const upgradeButton = screen.getByText('Actualizar a Pro');
    expect(upgradeButton).toBeInTheDocument();
  });

  it('initiates checkout redirect when clicking upgrade', async () => {
    mockUseQuery.mockReturnValue({ data: null, isLoading: false });

    // Mock fetch response para checkout
    const mockInitPoint = 'https://mercadopago.com/checkout/123';
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ init_point: mockInitPoint }),
    });

    // Mock window.location
    delete (window as any).location;
    (window as any).location = { href: '' };

    renderComponent();

    const upgradeButton = screen.getByText('Actualizar a Pro');
    fireEvent.click(upgradeButton);

    await waitFor(() => {
      expect(screen.getByText('Redirigiendo...')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/checkout/mercadopago', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"planId":"pro"'),
      }));
      expect(window.location.href).toBe(mockInitPoint);
    });
  });

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
      return { data: null, isLoading: false };
    });

    renderComponent();

    // Check for "CANCELADO (ACTIVO)" badge
    expect(screen.getByText('CANCELADO (ACTIVO)')).toBeInTheDocument();

    // Check for "Reactivar Suscripción" button
    const reactivateButton = screen.getByText('Reactivar Suscripción');
    expect(reactivateButton).toBeInTheDocument();

    // Check key differentiator: button should NOT be disabled.
    // Usually "Plan actual" is disabled.
    expect(reactivateButton).not.toBeDisabled();
  });
});
