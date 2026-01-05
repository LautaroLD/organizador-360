/**
 * Tests para el hook useGoogleCalendarTokens
 * 
 * Verifica la lógica de detección de usuarios Google y manejo de tokens
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useGoogleCalendarTokens } from '@/hooks/useGoogleCalendarTokens';

// Mock de los stores
const mockSetTokens = jest.fn();
const mockDisconnect = jest.fn();
let mockUser: { id: string } | null = { id: 'test-user-id' };

jest.mock('@/store/authStore', () => ({
  useAuthStore: () => ({
    user: mockUser,
  }),
}));

jest.mock('@/store/googleCalendarStore', () => ({
  useGoogleCalendarStore: () => ({
    tokens: null,
    isConnected: false,
    userEmail: null,
    setTokens: mockSetTokens,
    disconnect: mockDisconnect,
  }),
}));

// Mock de Supabase con diferentes escenarios
const mockGetSession = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: mockGetSession,
    },
    from: mockFrom,
  }),
}));

// Mock de fetch para la API de auth-url
global.fetch = jest.fn();

describe('useGoogleCalendarTokens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { id: 'test-user-id' };
  });

  describe('Detección de usuario Google', () => {
    it('debería detectar usuario de Google por app_metadata.provider', async () => {
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            user: {
              id: 'test-user-id',
              email: 'user@gmail.com',
              app_metadata: { provider: 'google' },
              identities: [],
            },
            provider_token: 'google-access-token',
            provider_refresh_token: 'google-refresh-token',
          },
        },
      });

      const { result } = renderHook(() => useGoogleCalendarTokens());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isGoogleUser).toBe(true);
      expect(result.current.authMethod).toBe('google_login');
    });

    it('debería detectar usuario de Google por identities', async () => {
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            user: {
              id: 'test-user-id',
              email: 'user@gmail.com',
              app_metadata: {},
              identities: [{ provider: 'google' }],
            },
            provider_token: 'google-access-token',
          },
        },
      });

      const { result } = renderHook(() => useGoogleCalendarTokens());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isGoogleUser).toBe(true);
    });

    it('debería identificar usuario de email/password como no-Google', async () => {
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            user: {
              id: 'test-user-id',
              email: 'user@email.com',
              app_metadata: { provider: 'email' },
              identities: [{ provider: 'email' }],
            },
            provider_token: null,
          },
        },
      });

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      });

      const { result } = renderHook(() => useGoogleCalendarTokens());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isGoogleUser).toBe(false);
      expect(result.current.needsReconnect).toBe(false);
    });
  });

  describe('needsReconnect', () => {
    it('debería indicar needsReconnect cuando usuario Google no tiene provider_token', async () => {
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            user: {
              id: 'test-user-id',
              email: 'user@gmail.com',
              app_metadata: { provider: 'google' },
              identities: [],
            },
            provider_token: null, // Sin token de provider
          },
        },
      });

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      });

      const { result } = renderHook(() => useGoogleCalendarTokens());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isGoogleUser).toBe(true);
      expect(result.current.needsReconnect).toBe(true);
    });

    it('no debería indicar needsReconnect cuando usuario Google tiene provider_token', async () => {
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            user: {
              id: 'test-user-id',
              email: 'user@gmail.com',
              app_metadata: { provider: 'google' },
              identities: [],
            },
            provider_token: 'valid-token',
          },
        },
      });

      const { result } = renderHook(() => useGoogleCalendarTokens());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.needsReconnect).toBe(false);
    });
  });

  describe('Vinculación manual de tokens', () => {
    it('debería cargar tokens de la tabla google_calendar_tokens', async () => {
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            user: {
              id: 'test-user-id',
              email: 'user@email.com',
              app_metadata: { provider: 'email' },
              identities: [],
            },
            provider_token: null,
          },
        },
      });

      const mockTokenData = {
        access_token: 'manual-access-token',
        refresh_token: 'manual-refresh-token',
        scope: 'https://www.googleapis.com/auth/calendar',
        token_type: 'Bearer',
        expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hora en el futuro
        user_email: 'user@gmail.com',
      };

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: mockTokenData, error: null }),
      });

      const { result } = renderHook(() => useGoogleCalendarTokens());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockSetTokens).toHaveBeenCalled();
    });

    it('debería eliminar tokens expirados', async () => {
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            user: {
              id: 'test-user-id',
              email: 'user@email.com',
              app_metadata: { provider: 'email' },
              identities: [],
            },
            provider_token: null,
          },
        },
      });

      const mockExpiredTokenData = {
        access_token: 'expired-token',
        refresh_token: 'expired-refresh',
        expires_at: new Date(Date.now() - 3600000).toISOString(), // 1 hora en el pasado
        user_email: 'user@gmail.com',
      };

      const mockDelete = jest.fn().mockReturnThis();
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: mockExpiredTokenData, error: null }),
        delete: mockDelete,
      });

      const { result } = renderHook(() => useGoogleCalendarTokens());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  describe('Sin usuario autenticado', () => {
    it('debería terminar de cargar sin errores cuando no hay usuario', async () => {
      mockUser = null;

      const { result } = renderHook(() => useGoogleCalendarTokens());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isGoogleUser).toBe(false);
      expect(result.current.isConnected).toBe(false);
    });
  });

  describe('connectGoogleCalendar', () => {
    it('debería llamar a la API de auth-url', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue({ authUrl: 'https://accounts.google.com/oauth...' }),
      });

      const { result } = renderHook(() => useGoogleCalendarTokens());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Mockear window.location usando Object.defineProperty para evitar errores de tipos
      const originalHref = window.location.href;
      Object.defineProperty(window, 'location', {
        value: { href: '' },
        writable: true,
        configurable: true,
      });

      await result.current.connectGoogleCalendar('project-123');

      expect(global.fetch).toHaveBeenCalledWith('/api/google/auth-url?projectId=project-123');

      // Restaurar location
      Object.defineProperty(window, 'location', {
        value: { href: originalHref },
        writable: true,
        configurable: true,
      });
    });
  });
});
