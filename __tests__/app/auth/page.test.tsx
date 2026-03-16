/**
 * Tests para la página de autenticación con Google
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AuthPage from '@/app/auth/page';

// Mock de react-toastify
jest.mock('react-toastify', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock de next/navigation
const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    prefetch: jest.fn(),
  }),
  useSearchParams: () => mockSearchParams,
}));

// Mock de Supabase
const mockSignInWithPassword = jest.fn();
const mockSignUp = jest.fn();
const mockSignInWithOAuth = jest.fn();
const mockResetPasswordForEmail = jest.fn();
const mockUpdateUser = jest.fn();
const mockSignOut = jest.fn();

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signUp: mockSignUp,
      signInWithOAuth: mockSignInWithOAuth,
      resetPasswordForEmail: mockResetPasswordForEmail,
      updateUser: mockUpdateUser,
      signOut: mockSignOut,
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
    })),
  }),
}));

describe('AuthPage - Google Authentication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    mockSignOut.mockResolvedValue({ error: null });
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: { origin: 'http://localhost:3000' },
      writable: true,
    });
  });

  it('debería renderizar el botón de Google', () => {
    render(<AuthPage />);

    const googleButton = screen.getByRole('button', { name: /continuar con google/i });
    expect(googleButton).toBeInTheDocument();
  });

  it('debería mostrar el separador "O continúa con"', () => {
    render(<AuthPage />);

    expect(screen.getByText(/o continúa con/i)).toBeInTheDocument();
  });

  it('debería mostrar mensaje sobre vinculación automática del calendario', () => {
    render(<AuthPage />);

    expect(screen.getByText(/al usar google, tu calendario se vinculará automáticamente/i)).toBeInTheDocument();
  });

  it('debería llamar a signInWithOAuth con los scopes de Calendar al hacer clic en Google', async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: null });

    render(<AuthPage />);

    const googleButton = screen.getByRole('button', { name: /continuar con google/i });
    fireEvent.click(googleButton);

    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: expect.objectContaining({
          scopes: expect.stringContaining('calendar'),
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        }),
      });
    });
  });

  it('debería incluir redirectTo con el callback correcto', async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: null });

    render(<AuthPage />);

    const googleButton = screen.getByRole('button', { name: /continuar con google/i });
    fireEvent.click(googleButton);

    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            redirectTo: 'http://localhost:3000/auth/callback',
          }),
        })
      );
    });
  });

  it('debería mostrar error si falla el login con Google', async () => {
    const toastModule = await import('react-toastify');
    mockSignInWithOAuth.mockResolvedValue({ error: new Error('OAuth failed') });

    render(<AuthPage />);

    const googleButton = screen.getByRole('button', { name: /continuar con google/i });
    fireEvent.click(googleButton);

    await waitFor(() => {
      expect(toastModule.toast.error).toHaveBeenCalledWith('Error al iniciar sesión con Google');
    });
  });

  it('debería deshabilitar el botón de Google mientras carga', async () => {
    // Simular una promesa que no se resuelve inmediatamente
    mockSignInWithOAuth.mockImplementation(() => new Promise(() => { }));

    render(<AuthPage />);

    const googleButton = screen.getByRole('button', { name: /continuar con google/i });
    fireEvent.click(googleButton);

    // El botón debería estar deshabilitado mientras isLoading es true
    await waitFor(() => {
      expect(googleButton).toBeDisabled();
    });
  });
});

describe('AuthPage - Email/Password Login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    mockSignOut.mockResolvedValue({ error: null });
  });

  it('debería renderizar el formulario de login', () => {
    render(<AuthPage />);

    expect(screen.getByPlaceholderText('tu@email.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeInTheDocument();
  });

  it('debería cambiar a modo registro al hacer clic en el link', () => {
    render(<AuthPage />);

    const registerLink = screen.getByText(/¿no tienes cuenta\? regístrate/i);
    fireEvent.click(registerLink);

    expect(screen.getByRole('button', { name: /crear cuenta/i })).toBeInTheDocument();
  });

  it('debería llamar a signInWithPassword al enviar el formulario', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });

    render(<AuthPage />);

    const emailInput = screen.getByPlaceholderText('tu@email.com');
    const passwordInput = screen.getByPlaceholderText('••••••••');
    const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });

  it('debería mostrar link de recuperación en modo login', () => {
    render(<AuthPage />);

    expect(screen.getByRole('button', { name: /olvidaste tu contraseña/i })).toBeInTheDocument();
  });
});

describe('AuthPage - Password Recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    mockSignOut.mockResolvedValue({ error: null });
    Object.defineProperty(window, 'location', {
      value: { origin: 'http://localhost:3000' },
      writable: true,
    });
  });

  it('debería solicitar email de recuperación en modo forgot', async () => {
    mockSearchParams = new URLSearchParams('mode=forgot');
    mockResetPasswordForEmail.mockResolvedValue({ error: null });

    render(<AuthPage />);

    fireEvent.change(screen.getByPlaceholderText('tu@email.com'), {
      target: { value: 'recover@test.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /enviar enlace de recuperación/i }));

    await waitFor(() => {
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
        'recover@test.com',
        expect.objectContaining({
          redirectTo: 'http://localhost:3000/auth?mode=recovery',
        })
      );
    });
  });

  it('debería actualizar contraseña en modo recovery', async () => {
    mockSearchParams = new URLSearchParams('mode=recovery');
    mockUpdateUser.mockResolvedValue({ error: null });

    render(<AuthPage />);

    const passwordInputs = screen.getAllByPlaceholderText('••••••••');
    fireEvent.change(passwordInputs[0], { target: { value: 'StrongP@ss1' } });
    fireEvent.change(passwordInputs[1], { target: { value: 'StrongP@ss1' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar nueva contraseña/i }));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({
        password: 'StrongP@ss1',
      });
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/auth?mode=login');
    });
  });
});

describe('AuthPage - UI Elements', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
  });

  it('debería mostrar el título correcto en modo login', () => {
    render(<AuthPage />);

    // Hay múltiples elementos con este texto (título y botón)
    const elements = screen.getAllByText('Iniciar Sesión');
    expect(elements.length).toBeGreaterThan(0);
  });

  it('debería mostrar el icono de Google en el botón', () => {
    render(<AuthPage />);

    const googleButton = screen.getByRole('button', { name: /continuar con google/i });
    const svg = googleButton.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});
