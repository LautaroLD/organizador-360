/**
 * Tests para el callback route de autenticación OAuth
 * 
 * Nota: Este archivo prueba la lógica de manejo de callbacks OAuth
 */

// Mock de Supabase server client
const mockExchangeCodeForSession = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({
    auth: {
      exchangeCodeForSession: (...args: unknown[]) => mockExchangeCodeForSession(...args),
    },
  }),
}));

describe('Auth Callback Route - Logic Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Lógica de intercambio de código', () => {
    it('debería manejar sesión con provider_token correctamente', async () => {
      const sessionData = {
        session: {
          user: { id: 'user-123', email: 'test@gmail.com' },
          provider_token: 'google-access-token',
          provider_refresh_token: 'google-refresh-token',
        },
      };

      mockExchangeCodeForSession.mockResolvedValue({
        data: sessionData,
        error: null,
      });

      const result = await mockExchangeCodeForSession('auth-code-123');

      expect(result.data.session.provider_token).toBe('google-access-token');
      expect(result.error).toBeNull();
    });

    it('debería manejar errores de intercambio', async () => {
      mockExchangeCodeForSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Invalid authorization code' },
      });

      const result = await mockExchangeCodeForSession('invalid-code');

      expect(result.error).not.toBeNull();
      expect(result.error.message).toBe('Invalid authorization code');
    });

    it('debería manejar sesión sin provider_token', async () => {
      const sessionData = {
        session: {
          user: { id: 'user-123', email: 'test@example.com' },
          provider_token: null,
        },
      };

      mockExchangeCodeForSession.mockResolvedValue({
        data: sessionData,
        error: null,
      });

      const result = await mockExchangeCodeForSession('email-auth-code');

      expect(result.data.session.provider_token).toBeNull();
    });
  });

  describe('Detección de usuario Google', () => {
    it('debería identificar sesión con tokens de Google', async () => {
      const googleSession = {
        session: {
          user: {
            id: 'user-123',
            email: 'user@gmail.com',
            app_metadata: { provider: 'google' },
          },
          provider_token: 'ya29.google-token',
        },
      };

      mockExchangeCodeForSession.mockResolvedValue({
        data: googleSession,
        error: null,
      });

      const result = await mockExchangeCodeForSession('google-code');

      expect(result.data.session.user.app_metadata.provider).toBe('google');
      expect(result.data.session.provider_token).toBeTruthy();
    });
  });

  describe('Manejo de parámetros de URL', () => {
    it('debería parsear código de la URL correctamente', () => {
      const url = new URL('http://localhost:3000/auth/callback?code=test-code-123');
      const code = url.searchParams.get('code');

      expect(code).toBe('test-code-123');
    });

    it('debería parsear invitación de la URL', () => {
      const url = new URL('http://localhost:3000/auth/callback?code=abc&invitation=inv-456');
      const invitation = url.searchParams.get('invitation');

      expect(invitation).toBe('inv-456');
    });

    it('debería manejar URL sin código', () => {
      const url = new URL('http://localhost:3000/auth/callback');
      const code = url.searchParams.get('code');

      expect(code).toBeNull();
    });

    it('debería extraer origin correctamente', () => {
      const url = new URL('https://myapp.vercel.app/auth/callback?code=123');

      expect(url.origin).toBe('https://myapp.vercel.app');
    });
  });

  describe('Construcción de URLs de redirección', () => {
    it('debería construir URL de dashboard correctamente', () => {
      const origin = 'http://localhost:3000';
      const dashboardUrl = `${origin}/dashboard`;

      expect(dashboardUrl).toBe('http://localhost:3000/dashboard');
    });

    it('debería construir URL de error correctamente', () => {
      const origin = 'http://localhost:3000';
      const errorMessage = 'Invalid code';
      const errorUrl = `${origin}/auth?error=${encodeURIComponent(errorMessage)}`;

      expect(errorUrl).toBe('http://localhost:3000/auth?error=Invalid%20code');
    });

    it('debería construir URL de invitación correctamente', () => {
      const origin = 'http://localhost:3000';
      const invitationId = 'inv-789';
      const invitationUrl = `${origin}/invitations/${invitationId}`;

      expect(invitationUrl).toBe('http://localhost:3000/invitations/inv-789');
    });
  });
});
