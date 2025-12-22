'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { CheckCircle, XCircle, Clock, Mail, UserPlus, AlertCircle, LogIn, Moon, Sun } from 'lucide-react';
import { toast } from 'react-toastify';
import { useQueryClient } from '@tanstack/react-query';

interface Invitation {
  id: string;
  project_id: string;
  inviter_id: string;
  invitee_email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
  project?: {
    name?: string;
    description?: string;
  } | null;
  inviter?: {
    name?: string;
    email?: string;
  } | null;
}

export default function InvitationPage() {
  const supabase = createClient();
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsRegistration, setNeedsRegistration] = useState(false);

  const token = params?.token as string;

  useEffect(() => {
    if (!authLoading) {
      loadInvitation();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, authLoading]);

  useEffect(() => {
    // Si el usuario se autentica y la invitación está cargada
    if (user && invitation && !authLoading) {
      if (user.email === invitation.invitee_email) {
        setNeedsRegistration(false);
        // Si venía del registro, mostrar mensaje
        const wasRegistering = typeof window !== 'undefined'
          ? localStorage.getItem('just_registered')
          : null;

        if (wasRegistering === 'true') {
          toast.success('¡Cuenta creada! Ahora puedes aceptar la invitación.');
          localStorage.removeItem('just_registered');
        }
      } else {
        setError(`Esta invitación es para ${invitation.invitee_email}. Has iniciado sesión con ${user.email}. Por favor, cierra sesión y crea una cuenta con el email correcto.`);
      }
    }
  }, [user, invitation, authLoading]);

  const loadInvitation = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('project_invitations')
        .select(`
    *,
    project:projects (
      name,
      description
    ),
    inviter:users (
      name,
      email
    )
  `)
        .eq('token', token)
        .maybeSingle(); // <--- IMPORTANTE: No explota si no hay datos

      if (error || !data) {
        setError('Invitación no encontrada');
        return;
      }

      // Check if expired
      if (new Date(data.expires_at) < new Date()) {
        setError('Esta invitación ha expirado');
        return;
      }

      // Check if already responded
      if (data.status !== 'pending') {
        if (data.status === 'accepted') {
          setError('Ya has aceptado esta invitación');
          setTimeout(() => router.push('/dashboard'), 2000);
        } else {
          setError('Esta invitación ya fue rechazada');
        }
        return;
      }

      setInvitation(data);
      console.log(data);

      // Check if user needs to register
      if (!user) {
        setNeedsRegistration(true);
      } else if (user.email !== data.invitee_email) {
        setError(`Esta invitación es para ${data.invitee_email}. Has iniciado sesión con ${user.email}. Por favor, cierra sesión y crea una cuenta con el email correcto.`);
      }

    } catch (err) {
      console.error('Error loading invitation:', err);
      setError('Error al cargar la invitación');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterClick = () => {
    // Store the invitation token to return after registration
    if (typeof window !== 'undefined') {
      localStorage.setItem('pending_invitation', token);
      localStorage.setItem('just_registered', 'true');
    }
    router.push(`/auth?mode=signup&email=${encodeURIComponent(invitation?.invitee_email || '')}`);
  };

  const handleLoginClick = () => {
    // Store the invitation token to return after login
    if (typeof window !== 'undefined') {
      localStorage.setItem('pending_invitation', token);
    }
    router.push(`/auth?redirect=/invitations/${token}`);
  };
  const queryClient = useQueryClient();
  const handleAccept = async () => {
    if (!invitation || !user) return;

    setIsProcessing(true);
    try {
      // Call the accept_project_invitation function
      const { data, error } = await supabase.rpc('accept_project_invitation', {
        invitation_token: token
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.message);
      }

      // Clear stored invitation token
      if (typeof window !== 'undefined') {
        localStorage.removeItem('pending_invitation');
        localStorage.removeItem('just_registered');
      }
      queryClient.invalidateQueries({ queryKey: ['pending-invitations'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['projects'], exact: false });

      toast.success('¡Invitación aceptada! Bienvenido al proyecto.');

      setTimeout(() => router.push('/dashboard'), 1500);
    } catch (error) {
      console.error('Error accepting invitation:', error);
      toast.error('Error al aceptar la invitación');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!invitation) return;

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('project_invitations')
        .update({
          status: 'rejected',
          responded_at: new Date().toISOString()
        })
        .eq('id', invitation.id);

      if (error) throw error;

      // Clear stored invitation token
      if (typeof window !== 'undefined') {
        localStorage.removeItem('pending_invitation');
        localStorage.removeItem('just_registered');
      }

      toast.info('Invitación rechazada');

      setTimeout(() => router.push(user ? '/dashboard' : '/'), 1500);
    } catch (error) {
      console.error('Error rejecting invitation:', error);
      toast.error('Error al rechazar la invitación');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading || authLoading) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-[var(--bg-primary)]'>
        {/* Theme Toggle - Floating */}
        <button
          onClick={toggleTheme}
          className="fixed top-6 right-6 rounded-lg p-3 bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors shadow-lg border border-[var(--text-secondary)]/20 z-50"
          aria-label="Toggle theme"
        >
          {theme === 'light' ? (
            <Moon className="h-5 w-5" />
          ) : (
            <Sun className="h-5 w-5" />
          )}
        </button>

        <div className='text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent-primary)] mx-auto mb-4'></div>
          <p className='text-[var(--text-secondary)]'>Cargando invitación...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-[var(--bg-primary)] p-4'>
        {/* Theme Toggle - Floating */}
        <button
          onClick={toggleTheme}
          className="fixed top-6 right-6 rounded-lg p-3 bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors shadow-lg border border-[var(--text-secondary)]/20 z-50"
          aria-label="Toggle theme"
        >
          {theme === 'light' ? (
            <Moon className="h-5 w-5" />
          ) : (
            <Sun className="h-5 w-5" />
          )}
        </button>

        <Card className='max-w-md w-full bg-[var(--bg-secondary)] border border-[var(--text-secondary)]/20'>
          <CardHeader>
            <div className='flex items-center justify-center mb-4'>
              <div className='bg-red-500/10 p-4 rounded-full'>
                <AlertCircle className='h-16 w-16 text-red-500' />
              </div>
            </div>
            <CardTitle className='text-center text-[var(--text-primary)]'>Error</CardTitle>
            <CardDescription className='text-center text-[var(--text-secondary)]'>{error}</CardDescription>
          </CardHeader>
          <CardContent className='text-center'>
            <Button onClick={() => router.push(user ? '/dashboard' : '/')}>
              {user ? 'Ir al Dashboard' : 'Ir al Inicio'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invitation) return null;

  const getRoleDescription = (role: string) => {
    switch (role) {
      case 'Admin':
        return 'Gestionar proyecto, invitar usuarios, crear canales';
      case 'Developer':
        return 'Participar en chat, subir recursos, crear eventos';
      case 'Viewer':
        return 'Solo ver contenido, sin permisos de edición';
      default:
        return '';
    }
  };

  const daysUntilExpiration = Math.ceil(
    (new Date(invitation.expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  // Show registration prompt if user is not logged in
  if (needsRegistration) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-[var(--bg-primary)] p-4'>
        {/* Theme Toggle - Floating */}
        <button
          onClick={toggleTheme}
          className="fixed top-6 right-6 rounded-lg p-3 bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors shadow-lg border border-[var(--text-secondary)]/20 z-50"
          aria-label="Toggle theme"
        >
          {theme === 'light' ? (
            <Moon className="h-5 w-5" />
          ) : (
            <Sun className="h-5 w-5" />
          )}
        </button>

        <Card className='max-w-2xl w-full bg-[var(--bg-secondary)] border border-[var(--text-secondary)]/20 shadow-lg'>
          <CardHeader>
            <div className='flex items-center justify-center mb-4'>
              <div className='bg-[var(--accent-primary)]/10 p-4 rounded-full'>
                <Mail className='h-12 w-12 text-[var(--accent-primary)]' />
              </div>
            </div>
            <CardTitle className='text-center text-2xl text-[var(--text-primary)]'>¡Bienvenido!</CardTitle>
            <CardDescription className='text-center text-[var(--text-secondary)]'>
              {(invitation.inviter?.name ?? invitation.inviter?.email ?? 'Usuario desconocido')} te ha invitado a colaborar
            </CardDescription>
          </CardHeader>

          <CardContent className='space-y-6'>
            {/* Project Info */}
            <div className='bg-[var(--bg-primary)] p-5 rounded-lg border-2 border-[var(--accent-primary)]/20'>
              <div className='flex items-start'>
                <div className='bg-[var(--accent-primary)]/10 p-2 rounded-lg'>
                  <UserPlus className='h-6 w-6 text-[var(--accent-primary)]' />
                </div>
                <div className='flex-1 ml-4'>
                  <h3 className='font-semibold text-[var(--text-primary)] text-lg mb-2'>
                    {invitation.project?.name ?? 'Proyecto sin nombre'}
                  </h3>
                  <p className='text-sm text-[var(--text-secondary)] mb-3'>
                    {invitation.project?.description || 'Sin descripción'}
                  </p>
                  <div className='inline-flex items-center gap-2 bg-[var(--accent-primary)]/10 px-3 py-1.5 rounded-full'>
                    <span className='text-sm font-medium text-[var(--text-primary)]'>Rol:</span>
                    <span className='text-sm font-bold text-[var(--accent-primary)]'>{invitation.role}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Registration required notice */}
            <div className='bg-[var(--accent-primary)]/5 p-5 rounded-lg border-2 border-[var(--accent-primary)]/30'>
              <div className='flex items-start gap-3 mb-3'>
                <span className='text-2xl'>📝</span>
                <div>
                  <h4 className='font-semibold text-[var(--text-primary)] mb-2'>
                    Necesitas crear una cuenta
                  </h4>
                  <p className='text-sm text-[var(--text-secondary)] mb-3'>
                    Para aceptar esta invitación, primero debes crear tu cuenta con el email:
                  </p>
                  <div className='bg-[var(--bg-secondary)] px-3 py-2 rounded-lg border border-[var(--accent-primary)]/30 inline-block'>
                    <span className='text-sm font-mono font-medium text-[var(--accent-primary)]'>
                      {invitation.invitee_email}
                    </span>
                  </div>
                </div>
              </div>

              <div className='bg-[var(--bg-secondary)] p-4 rounded-lg border border-[var(--text-secondary)]/20 mt-4'>
                <p className='text-sm font-semibold text-[var(--text-primary)] mb-3'>
                  ¿Cómo funciona?
                </p>
                <ol className='text-sm text-[var(--text-secondary)] space-y-2'>
                  <li className='flex items-start'>
                    <span className='font-bold text-[var(--accent-primary)] mr-2'>1.</span>
                    <span>Crea tu cuenta (es gratis y toma 1 minuto)</span>
                  </li>
                  <li className='flex items-start'>
                    <span className='font-bold text-[var(--accent-primary)] mr-2'>2.</span>
                    <span>Regresa automáticamente a esta página</span>
                  </li>
                  <li className='flex items-start'>
                    <span className='font-bold text-[var(--accent-primary)] mr-2'>3.</span>
                    <span>Acepta la invitación y comienza a colaborar</span>
                  </li>
                </ol>
              </div>
            </div>

            {/* Role Info */}
            <div className='bg-[var(--accent-success)]/5 p-5 rounded-lg border-2 border-[var(--accent-success)]/30'>
              <h4 className='font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2'>
                <span className='text-xl'>✨</span>
                Como {invitation.role} podrás:
              </h4>
              <p className='text-sm text-[var(--text-secondary)] leading-relaxed'>
                {getRoleDescription(invitation.role)}
              </p>
            </div>

            {/* Expiration Warning */}
            <div className='bg-orange-500/5 p-5 rounded-lg border-2 border-orange-500/30'>
              <div className='flex items-start gap-3'>
                <Clock className='h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0' />
                <div>
                  <p className='text-sm font-semibold text-[var(--text-primary)] mb-1'>
                    La invitación expira en <span className='text-orange-500'>{daysUntilExpiration} {daysUntilExpiration === 1 ? 'día' : 'días'}</span>
                  </p>
                  <p className='text-xs text-[var(--text-secondary)]'>
                    No pierdas la oportunidad de unirte al equipo
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className='space-y-3 pt-4'>
              <Button
                className='w-full bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/90 text-white font-semibold py-3'
                onClick={handleRegisterClick}
              >
                <UserPlus className='h-5 w-5 mr-2' />
                Crear Cuenta y Aceptar Invitación
              </Button>

              <div className='relative'>
                <div className='absolute inset-0 flex items-center'>
                  <div className='w-full border-t-2 border-[var(--text-secondary)]/20'></div>
                </div>
                <div className='relative flex justify-center text-sm'>
                  <span className='px-3 py-1 bg-[var(--bg-secondary)] text-[var(--text-secondary)] font-medium'>
                    ¿Ya tienes cuenta?
                  </span>
                </div>
              </div>

              <Button
                className='w-full font-semibold py-3'
                variant='secondary'
                onClick={handleLoginClick}
              >
                <LogIn className='h-5 w-5 mr-2' />
                Iniciar Sesión
              </Button>
            </div>

            {/* Additional Info */}
            <div className='text-center pt-4 border-t-2 border-[var(--text-secondary)]/20'>
              <p className='text-xs text-[var(--text-secondary)] leading-relaxed'>
                Al crear tu cuenta, aceptas los términos de servicio. La invitación se aceptará automáticamente después del registro.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show acceptance interface if user is logged in with correct email
  return (
    <div className='min-h-screen flex items-center justify-center bg-[var(--bg-primary)] p-4'>
      {/* Theme Toggle - Floating */}
      <button
        onClick={toggleTheme}
        className="fixed top-6 right-6 rounded-lg p-3 bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors shadow-lg border border-[var(--text-secondary)]/20 z-50"
        aria-label="Toggle theme"
      >
        {theme === 'light' ? (
          <Moon className="h-5 w-5" />
        ) : (
          <Sun className="h-5 w-5" />
        )}
      </button>

      <Card className='max-w-2xl w-full bg-[var(--bg-secondary)] border border-[var(--text-secondary)]/20 shadow-lg'>
        <CardHeader>
          <div className='flex items-center justify-center mb-4'>
            <div className='bg-[var(--accent-primary)]/10 p-4 rounded-full'>
              <Mail className='h-12 w-12 text-[var(--accent-primary)]' />
            </div>
          </div>
          <CardTitle className='text-center text-2xl text-[var(--text-primary)]'>¡Has sido invitado!</CardTitle>
          <CardDescription className='text-center text-[var(--text-secondary)]'>
            {(invitation.inviter?.name ?? invitation.inviter?.email ?? 'Usuario desconocido')} te ha invitado a colaborar
          </CardDescription>
        </CardHeader>

        <CardContent className='space-y-6'>
          {/* Project Info */}
          <div className='bg-[var(--bg-primary)] p-5 rounded-lg border-2 border-[var(--accent-primary)]/20'>
            <div className='flex items-start'>
              <div className='bg-[var(--accent-primary)]/10 p-2 rounded-lg'>
                <UserPlus className='h-6 w-6 text-[var(--accent-primary)]' />
              </div>
              <div className='flex-1 ml-4'>
                <h3 className='font-semibold text-[var(--text-primary)] text-lg mb-2'>
                  {invitation.project?.name ?? 'Proyecto sin nombre'}
                </h3>
                <p className='text-sm text-[var(--text-secondary)]'>
                  {invitation.project?.description || 'Sin descripción'}
                </p>
              </div>
            </div>
          </div>

          {/* Role Info */}
          <div className='bg-[var(--accent-success)]/5 p-5 rounded-lg border-2 border-[var(--accent-success)]/30'>
            <h4 className='font-semibold text-[var(--text-primary)] mb-2'>
              Rol asignado: <span className='text-[var(--accent-primary)] font-bold'>{invitation.role}</span>
            </h4>
            <p className='text-sm text-[var(--text-secondary)] leading-relaxed'>
              {getRoleDescription(invitation.role)}
            </p>
          </div>

          {/* Expiration Warning */}
          <div className='bg-orange-500/5 p-5 rounded-lg border-2 border-orange-500/30'>
            <div className='flex items-start gap-3'>
              <Clock className='h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0' />
              <div className='flex-1'>
                <p className='text-sm font-semibold text-[var(--text-primary)] mb-1'>
                  Invitación expira en <span className='text-orange-500'>{daysUntilExpiration} {daysUntilExpiration === 1 ? 'día' : 'días'}</span>
                </p>
                <p className='text-xs text-[var(--text-secondary)]'>
                  {new Date(invitation.expires_at).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className='flex flex-col sm:flex-row gap-3 pt-4'>
            <Button
              className='flex-1 bg-[var(--accent-success)] hover:bg-[var(--accent-success)]/90 text-white font-semibold py-3'
              onClick={handleAccept}
              disabled={isProcessing}
            >
              <CheckCircle className='h-5 w-5 mr-2' />
              {isProcessing ? 'Procesando...' : 'Aceptar Invitación'}
            </Button>
            <Button
              className='flex-1 font-semibold py-3'
              variant='secondary'
              onClick={handleReject}
              disabled={isProcessing}
            >
              <XCircle className='h-5 w-5 mr-2' />
              Rechazar
            </Button>
          </div>

          {/* Additional Info */}
          <div className='text-center pt-4 border-t-2 border-[var(--text-secondary)]/20'>
            <p className='text-xs text-[var(--text-secondary)] leading-relaxed'>
              Al aceptar esta invitación, tendrás acceso inmediato al proyecto y podrás comenzar a colaborar con el equipo.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
