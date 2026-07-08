import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CalendarView } from '@/components/dashboard/CalendarView';
import { getUserPlanTier } from '@/lib/subscriptionUtils';

let mockGoogleIsConnected = false;
let mockGoogleTokens: { access_token: string; } | null = null;
const mockDisconnectGoogleCalendar = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/subscriptionUtils', () => ({
  getUserPlanTier: jest.fn(),
}));

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({}),
}));

jest.mock('@/store/authStore', () => ({
  useAuthStore: () => ({
    user: { id: 'user-1' },
  }),
}));

jest.mock('@/store/projectStore', () => ({
  useProjectStore: () => ({
    currentProject: {
      id: 'project-1',
      userRole: 'Collaborator',
    },
  }),
}));

jest.mock('@/hooks/useGoogleCalendarTokens', () => ({
  useGoogleCalendarTokens: () => ({
    tokens: mockGoogleTokens,
    isConnected: mockGoogleIsConnected,
    isLoading: false,
    userEmail: null,
    authMethod: null,
    isGoogleUser: false,
    needsReconnect: false,
    connectGoogleCalendar: jest.fn(),
    disconnectGoogleCalendar: mockDisconnectGoogleCalendar,
    refreshTokensFromSession: jest.fn(),
    processOAuthCallback: jest.fn().mockResolvedValue({
      handled: false,
      status: 'none',
    }),
  }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/components/calendar/EventModal', () => ({
  EventModal: () => null,
}));

jest.mock('@/components/calendar/EventList', () => ({
  EventList: () => <div>EventList</div>,
}));

const mockUseQuery = jest.fn();

jest.mock('@tanstack/react-query', () => {
  const original = jest.requireActual('@tanstack/react-query');
  return {
    ...original,
    useQuery: (...args: unknown[]) => mockUseQuery(...args),
  };
});

describe('CalendarView - Google Calendar PRO gating', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGoogleIsConnected = false;
    mockGoogleTokens = null;
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={ queryClient }>
        <CalendarView />
      </QueryClientProvider>,
    );

  it('oculta conexión Google para usuarios no PRO', async () => {
    (getUserPlanTier as jest.Mock).mockResolvedValue('free');

    renderComponent();

    await waitFor(() => {
      expect(getUserPlanTier).toHaveBeenCalled();
    });

    expect(
      screen.getByText(/Sincronizar Google Calendar es exclusivo del plan PRO/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Conectar Google Calendar/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Sincronizar Todos/i }),
    ).not.toBeInTheDocument();
  });

  it('muestra conexión Google para usuarios PRO', async () => {
    (getUserPlanTier as jest.Mock).mockResolvedValue('pro');

    renderComponent();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Conectar Google Calendar/i }),
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByText(/Sincronizar Google Calendar es exclusivo del plan PRO/i),
    ).not.toBeInTheDocument();
  });

  it('desconecta automáticamente Google cuando deja de ser PRO', async () => {
    mockGoogleIsConnected = true;
    mockGoogleTokens = { access_token: 'token-1' };
    (getUserPlanTier as jest.Mock).mockResolvedValue('free');

    renderComponent();

    await waitFor(() => {
      expect(mockDisconnectGoogleCalendar).toHaveBeenCalled();
    });
  });
});
