/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen } from '@testing-library/react';
import { SubscriptionView } from '@/components/dashboard/SubscriptionView';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({})),
}));

jest.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'user-123', email: 'test@example.com' } }),
}));

const mockUseQuery = jest.fn();

jest.mock('@tanstack/react-query', () => {
  const original = jest.requireActual('@tanstack/react-query');
  return {
    ...original,
    useQuery: (...args: any[]) => mockUseQuery(...args),
  };
});

global.fetch = jest.fn();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const freePlan = {
  provider: 'local',
  plan_code: 'free',
  name: 'Free',
  description: 'Perfecto para comenzar',
  features: ['Hasta 3 proyectos'],
  limits: {
    max_projects: 3,
    max_members_per_project: 10,
    max_storage_bytes: 104857600,
    ai_features_enabled: false,
    ai_monthly_credits: 0,
    workspace_enabled: false,
    google_calendar_sync: false,
  },
  sort_order: 0,
};

const starterPlan = {
  provider: 'lemon_squeezy',
  plan_code: 'starter',
  name: 'Starter',
  description: 'Para usuarios intermedios',
  features: ['Hasta 5 proyectos'],
  limits: {
    max_projects: 5,
    max_members_per_project: 15,
    max_storage_bytes: 1073741824,
    ai_features_enabled: false,
    ai_monthly_credits: 0,
    workspace_enabled: false,
    google_calendar_sync: false,
  },
  sort_order: 10,
  external_id: 'starter-ext',
  checkout_url: 'https://example.com/starter',
};

const proPlan = {
  provider: 'lemon_squeezy',
  plan_code: 'pro',
  name: 'Pro',
  description: 'Para usuarios avanzados',
  features: ['Hasta 10 proyectos'],
  limits: {
    max_projects: 10,
    max_members_per_project: 30,
    max_storage_bytes: 5368709120,
    ai_features_enabled: true,
    ai_monthly_credits: 250,
    workspace_enabled: true,
    google_calendar_sync: true,
  },
  sort_order: 20,
  external_id: 'pro-ext',
  checkout_url: 'https://example.com/pro',
};

describe('SubscriptionView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <SubscriptionView />
      </QueryClientProvider>,
    );

  it('renders loading state initially', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    renderComponent();
    expect(
      screen.getByText('Cargando datos de suscripción...'),
    ).toBeInTheDocument();
  });

  it('renders plans when no subscription is active', () => {
    mockUseQuery.mockImplementation((options) => {
      if (options.queryKey[0] === 'plans') {
        return {
          data: {
            free: freePlan,
            lemon_squeezy: [starterPlan, proPlan],
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
      if (options.queryKey[0] === 'lemon-variant') {
        return {
          data: {
            name: 'Plan',
            price: '$6/month',
            hasFreeTrial: false,
            trialDays: 0,
            buy_url: 'https://example.com/buy',
          },
          isLoading: false,
        };
      }
      return { data: null, isLoading: false };
    });

    renderComponent();

    expect(screen.getByText('Planes y Suscripción')).toBeInTheDocument();
    expect(screen.getAllByText('Plan actual').length).toBeGreaterThan(0);
    expect(screen.getByText('Hasta 100 MB por proyecto')).toBeInTheDocument();
  });

  it('renders active subscription details correctly', () => {
    const mockSub = {
      id: 'sub-123',
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
      if (options.queryKey[0] === 'plans') {
        return {
          data: {
            free: freePlan,
            lemon_squeezy: [starterPlan, proPlan],
          },
          isLoading: false,
        };
      }
      if (options.queryKey[0] === 'lemon-subscription-details') {
        return {
          data: {
            hasSubscription: true,
            source: 'lemon_squeezy',
            planContext: {
              plan_tier: 'pro',
              source: 'subscription',
              expires_at: null,
            },
            details: mockSub,
          },
          isLoading: false,
        };
      }
      if (options.queryKey[0] === 'lemon-variant') {
        return {
          data: {
            name: 'Plan PRO',
            price: '$12/month',
            hasFreeTrial: false,
            trialDays: 0,
          },
          isLoading: false,
        };
      }
      return { data: null, isLoading: false };
    });

    renderComponent();

    expect(screen.getAllByText('Plan PRO').length).toBeGreaterThan(0);
    expect(screen.getByText('Activa')).toBeInTheDocument();
    expect(screen.getByText('sub-123')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Cambiar plan en Lemon' }),
    ).toHaveAttribute(
      'href',
      'https://billing.lemonsqueezy.com/subscription',
    );
  });

  it('renders cancelled but still active subscription correctly', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);

    const mockSubscription = {
      status: 'cancelled',
      statusLabel: 'Cancelado',
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: futureDate.toISOString(),
      cancelAtPeriodEnd: true,
      variantName: 'pro',
    };

    mockUseQuery.mockImplementation((options) => {
      if (options.queryKey[0] === 'plans') {
        return {
          data: {
            free: freePlan,
            lemon_squeezy: [starterPlan, proPlan],
          },
          isLoading: false,
        };
      }
      if (options.queryKey[0] === 'lemon-subscription-details') {
        return {
          data: {
            hasSubscription: true,
            source: 'lemon_squeezy',
            planContext: {
              plan_tier: 'pro',
              source: 'subscription',
              expires_at: null,
            },
            details: mockSubscription,
          },
          isLoading: false,
        };
      }
      if (options.queryKey[0] === 'lemon-variant') {
        return {
          data: {
            name: 'Plan PRO',
            price: '$12/month',
            hasFreeTrial: false,
            trialDays: 0,
          },
          isLoading: false,
        };
      }
      return { data: null, isLoading: false };
    });

    renderComponent();

    expect(screen.getAllByText('Cancelado').length).toBeGreaterThan(0);
  });
});
