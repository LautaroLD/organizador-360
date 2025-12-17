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

  const toggleMode = () => {
    setIsLogin(!isLogin);
    reset();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg-primary)]">
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
