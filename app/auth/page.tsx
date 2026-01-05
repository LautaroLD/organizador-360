'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import {
  createClient
} from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ThemeToggle } from '@/components/ThemeToggle';
import { toast } from 'react-toastify';
import { LogIn, UserPlus } from 'lucide-react';

// Icono de Google SVG
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
  name?: string;
}

export default function AuthPage() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<AuthFormData>();

  // Lee los parámetros de la URL
  const mode = searchParams?.get('mode');
  const email = searchParams?.get('email');
  const redirect = searchParams?.get('redirect');

  useEffect(() => {
    // Si hay un modo en la URL, úsalo
    if (mode === 'signup') {
      setIsLogin(false);
    } else if (mode === 'login') {
      setIsLogin(true);
    }

    // Si hay un email en la URL, pre-llénalo
    if (email) {
      setValue('email', email);
    }
  }, [mode, email, setValue]);

  const onSubmit = async (data: AuthFormData) => {
    setIsLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });

        if (error) throw error;

        toast.success('¡Bienvenido de nuevo!');

        // Verifica si hay una invitación pendiente o un redirect
        const pendingInvitation = typeof window !== 'undefined'
          ? localStorage.getItem('pending_invitation')
          : null;

        if (pendingInvitation) {
          router.push(`/invitations/${pendingInvitation}`);
        } else if (redirect) {
          router.push(redirect);
        } else {
          router.push('/dashboard');
        }
      } else {
        // Verifica si el usuario ya existe en la base de datos
        const { data: existingUsers, error: checkError } = await supabase
          .from('users')
          .select('id')
          .eq('email', data.email)
          .limit(1);

        if (checkError && checkError.code !== 'PGRST116') {
          // PGRST116 es "no rows returned", lo cual es esperado si no existe
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
          // Verifica si es un error de email duplicado
          if (error.message?.includes('User already registered') ||
            error.message?.includes('already registered')) {
            throw new Error('Este email ya está registrado. Por favor inicia sesión.');
          }
          throw error;
        }

        // Verifica si necesita confirmación de email o si el usuario fue creado inmediatamente
        if (authData.user && authData.session) {
          // Usuario creado y autenticado inmediatamente (email confirmado automáticamente)
          toast.success('¡Cuenta creada exitosamente!');

          // Verifica si hay una invitación pendiente
          const pendingInvitation = typeof window !== 'undefined'
            ? localStorage.getItem('pending_invitation')
            : null;

          if (pendingInvitation) {
            // Redirige a la página de invitación
            router.push(`/invitations/${pendingInvitation}`);
          } else if (redirect) {
            router.push(redirect);
          } else {
            router.push('/dashboard');
          }
        } else {
          // Usuario necesita confirmar email
          toast.success('Cuenta creada exitosamente. Por favor verifica tu email.');
          // Redirige a la página de confirmación
          router.push(`/auth/confirm?email=${encodeURIComponent(data.email)}`);
        }
      }
    } catch (error) {
      const authError = error instanceof Error ? error : new Error(String(error));
      console.error('Auth error:', authError);

      // Handle Supabase-specific errors
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

  // Login con Google (incluye permisos de Calendar)
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

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-[var(--bg-primary)]">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md bg-[var(--bg-secondary)] border border-[var(--text-secondary)]/20">
        <CardHeader>
          <CardTitle className="text-center text-[var(--text-primary)]">
            {isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </CardTitle>
          <CardDescription className="text-center text-[var(--text-secondary)]">
            {isLogin
              ? 'Ingresa a tu cuenta para continuar'
              : 'Crea una nueva cuenta para comenzar'}
          </CardDescription>

          {/* Mostrar mensaje si viene de una invitación */}
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
            {!isLogin && (
              <Input
                label="Nombre"
                {...register('name', {
                  required: !isLogin ? 'El nombre es requerido' : false,
                })}
                error={errors.name?.message}
                placeholder="Tu nombre"
              />
            )}

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

            <Input
              label="Contraseña"
              type="password"
              {...register('password', {
                required: 'La contraseña es requerida',
                minLength: {
                  value: 6,
                  message: 'La contraseña debe tener al menos 6 caracteres',
                },
              })}
              error={errors.password?.message}
              placeholder="••••••••"
            />

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                'Cargando...'
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

          {/* Separador */}
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

          {/* Botón de Google */}
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

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={toggleMode}
              className="text-sm text-[var(--accent-primary)] hover:underline"
            >
              {isLogin
                ? '¿No tienes cuenta? Regístrate'
                : '¿Ya tienes cuenta? Inicia sesión'}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
