'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ThemeToggle } from '@/components/ThemeToggle';
import { toast } from 'react-toastify';
import { LogIn, UserPlus, KeyRound } from 'lucide-react';
import Logo from '@/components/ui/Logo';
import { PASSWORD_REQUIREMENTS_MESSAGE, isStrongPassword } from '@/lib/passwordValidation';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 mr-2">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

interface AuthFormData {
  email: string;
  password: string;
  confirmPassword?: string;
  name?: string;
}

export default function AuthPage() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<AuthFormData>();

  const mode = searchParams?.get('mode');
  const email = searchParams?.get('email');
  const redirect = searchParams?.get('redirect');
  const preapprovalId = searchParams?.get('preapproval_id');
  const isForgotPassword = mode === 'forgot';
  const isRecoveryMode = mode === 'recovery';

  const buildRedirectUrl = (baseUrl: string) => {
    if (!preapprovalId) return baseUrl;
    const url = new URL(baseUrl, window.location.origin);
    url.searchParams.set('preapproval_id', preapprovalId);
    return url.pathname + url.search;
  };

  useEffect(() => {
    if (mode === 'signup') {
      setIsLogin(false);
    } else if (mode === 'login') {
      setIsLogin(true);
    }

    if (email) {
      setValue('email', email);
    }
  }, [mode, email, setValue]);

  const onSubmit = async (data: AuthFormData) => {
    setIsLoading(true);
    try {
      if (isForgotPassword) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
        const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
          redirectTo: `${appUrl}/auth?mode=recovery`,
        });

        if (error) throw error;

        toast.success('Te enviamos un enlace para recuperar tu contraseña.');
        return;
      }

      if (isRecoveryMode) {
        if (!data.password) {
          throw new Error('La nueva contraseña es requerida');
        }
        if (data.password !== data.confirmPassword) {
          throw new Error('Las contraseñas no coinciden');
        }

        const passwordValidation = isStrongPassword(data.password)
          ? null
          : PASSWORD_REQUIREMENTS_MESSAGE;

        if (passwordValidation) {
          throw new Error(passwordValidation);
        }

        const { error } = await supabase.auth.updateUser({
          password: data.password,
        });

        if (error) throw error;

        await supabase.auth.signOut();

        toast.success('Contraseña actualizada exitosamente. Ya puedes iniciar sesión.');
        router.push('/auth?mode=login');
        return;
      }

      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });

        if (error) throw error;

        toast.success('¡Bienvenido de nuevo!');

        const pendingInvitation = typeof window !== 'undefined'
          ? localStorage.getItem('pending_invitation')
          : null;

        if (pendingInvitation) {
          router.push(`/invitations/${pendingInvitation}`);
        } else if (redirect) {
          router.push(buildRedirectUrl(redirect));
        } else {
          router.push(buildRedirectUrl('/dashboard'));
        }
      } else {
        const { data: existingUsers, error: checkError } = await supabase
          .from('users')
          .select('id')
          .eq('email', data.email)
          .limit(1);

        if (checkError && checkError.code !== 'PGRST116') {
          console.error('Error checking user:', checkError);
        }

        if (existingUsers && existingUsers.length > 0) {
          throw new Error('Este email ya está registrado. Por favor inicia sesión.');
        }

        const { data: authData, error } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            data: {
              name: data.name,
            },
          },
        });

        if (error) {
          if (error.message?.includes('User already registered') ||
            error.message?.includes('already registered')) {
            throw new Error('Este email ya está registrado. Por favor inicia sesión.');
          }
          throw error;
        }

        if (authData.user && authData.session) {
          toast.success('¡Cuenta creada exitosamente!');

          const pendingInvitation = typeof window !== 'undefined'
            ? localStorage.getItem('pending_invitation')
            : null;

          if (pendingInvitation) {
            router.push(`/invitations/${pendingInvitation}`);
          } else if (redirect) {
            router.push(buildRedirectUrl(redirect));
          } else {
            router.push(buildRedirectUrl('/dashboard'));
          }
        } else {
          toast.success('Cuenta creada exitosamente. Por favor verifica tu email.');
          router.push(`/auth/confirm?email=${encodeURIComponent(data.email)}`);
        }
      }
    } catch (error) {
      const authError = error instanceof Error ? error : new Error(String(error));
      console.error('Auth error:', authError);

      if (authError?.message) {
        if (authError.message.includes('already registered') ||
          authError.message.includes('User already registered') ||
          authError.message.includes('already exists')) {
          toast.error('Este email ya está registrado. Por favor inicia sesión.');
        } else if (authError.message.includes('Invalid login credentials')) {
          toast.error('Credenciales inválidas. Verifica tu email y contraseña.');
        } else if (authError.message.includes('Email not confirmed')) {
          toast.error('Por favor confirma tu email antes de iniciar sesión.');
        } else {
          toast.error(authError.message);
        }
      } else {
        toast.error('Ocurrió un error. Por favor intenta de nuevo.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;
    } catch (error) {
      console.error('Google auth error:', error);
      toast.error('Error al iniciar sesión con Google');
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    reset();
  };

  const goToLogin = () => {
    reset();
    setIsLogin(true);
    router.push('/auth?mode=login');
  };

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-[var(--bg-primary)]">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="flex flex-col items-center gap-6 w-full max-w-md">
        <Logo />

        <Card className="w-full bg-[var(--bg-secondary)] border border-[var(--text-secondary)]/20">
          <CardHeader>
            <CardTitle className="text-center text-[var(--text-primary)]">
              {isForgotPassword
                ? 'Recuperar Contraseña'
                : isRecoveryMode
                  ? 'Nueva Contraseña'
                  : isLogin
                    ? 'Iniciar Sesión'
                    : 'Crear Cuenta'}
            </CardTitle>
            <CardDescription className="text-center text-[var(--text-secondary)]">
              {isForgotPassword
                ? 'Ingresa tu email y te enviaremos un enlace de recuperación'
                : isRecoveryMode
                  ? 'Elige una nueva contraseña para tu cuenta'
                  : isLogin
                    ? 'Ingresa a tu cuenta para continuar'
                    : 'Crea una nueva cuenta para comenzar'}
            </CardDescription>

            {email && (
              <div className="mt-4 p-3 bg-[var(--accent-primary)]/10 rounded-lg border border-[var(--accent-primary)]/30">
                <p className="text-sm text-[var(--text-primary)] text-center">
                  📧 Estás {isLogin ? 'iniciando sesión' : 'creando una cuenta'} para aceptar una invitación
                </p>
              </div>
            )}
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {!isLogin && !isForgotPassword && !isRecoveryMode && (
                <Input
                  label="Nombre"
                  {...register('name', {
                    required: !isLogin ? 'El nombre es requerido' : false,
                  })}
                  error={errors.name?.message}
                  placeholder="Tu nombre"
                />
              )}

              {!isRecoveryMode && (
                <Input
                  label="Email"
                  type="email"
                  {...register('email', {
                    required: 'El email es requerido',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Email inválido',
                    },
                  })}
                  error={errors.email?.message}
                  placeholder="tu@email.com"
                />
              )}

              {!isForgotPassword && (
                <Input
                  label={isRecoveryMode ? 'Nueva Contraseña' : 'Contraseña'}
                  type="password"
                  {...register('password', {
                    required: 'La contraseña es requerida',
                    validate: (value) => {
                      if (isLogin) return true;
                      return isStrongPassword(value) || PASSWORD_REQUIREMENTS_MESSAGE;
                    },
                  })}
                  error={errors.password?.message}
                  placeholder="••••••••"
                />
              )}

              {isRecoveryMode && (
                <Input
                  label="Confirmar Nueva Contraseña"
                  type="password"
                  {...register('confirmPassword', {
                    required: 'Debes confirmar la contraseña',
                  })}
                  error={errors.confirmPassword?.message}
                  placeholder="••••••••"
                />
              )}

              {!isLogin && !isForgotPassword && (
                <p className="text-xs text-[var(--text-secondary)]">
                  {PASSWORD_REQUIREMENTS_MESSAGE}
                </p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  'Cargando...'
                ) : isForgotPassword ? (
                  <>
                    <KeyRound className="mr-2 h-4 w-4" />
                    Enviar Enlace de Recuperación
                  </>
                ) : isRecoveryMode ? (
                  <>
                    <KeyRound className="mr-2 h-4 w-4" />
                    Guardar Nueva Contraseña
                  </>
                ) : isLogin ? (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Iniciar Sesión
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Crear Cuenta
                  </>
                )}
              </Button>
            </form>

            {!isForgotPassword && !isRecoveryMode && (
              <>
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-[var(--text-secondary)]/20" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-[var(--bg-secondary)] px-2 text-[var(--text-secondary)]">
                      O continúa con
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  className="w-full border-[var(--text-secondary)]/30 hover:bg-[var(--bg-primary)]"
                  onClick={signInWithGoogle}
                  disabled={isLoading}
                >
                  <GoogleIcon />
                  Continuar con Google
                </Button>

                <p className="mt-3 text-xs text-center text-[var(--text-secondary)]">
                  Al usar Google, tu calendario se vinculará automáticamente
                </p>
              </>
            )}

            <div className="mt-4 text-center">
              {!isForgotPassword && !isRecoveryMode && (
                <button
                  type="button"
                  onClick={toggleMode}
                  className="text-sm text-[var(--accent-primary)] hover:underline"
                >
                  {isLogin
                    ? '¿No tienes cuenta? Regístrate'
                    : '¿Ya tienes cuenta? Inicia sesión'}
                </button>
              )}

              {isLogin && !isForgotPassword && !isRecoveryMode && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => router.push('/auth?mode=forgot')}
                    className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              )}

              {(isForgotPassword || isRecoveryMode) && (
                <button
                  type="button"
                  onClick={goToLogin}
                  className="text-sm text-[var(--accent-primary)] hover:underline"
                >
                  Volver a iniciar sesión
                </button>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-[var(--text-secondary)]/20">
              <p className="text-xs text-center text-[var(--text-secondary)]">
                {!isLogin && 'Al crear una cuenta, aceptas nuestros '}
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent-primary)] hover:underline"
                >
                  Términos de Servicio
                </a>
                {' y '}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent-primary)] hover:underline"
                >
                  Política de Privacidad
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
