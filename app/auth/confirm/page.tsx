'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Mail, CheckCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-toastify';

export default function ConfirmPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isResending, setIsResending] = useState(false);

  // Obtener el email de los parámetros de la URL si está disponible
  const email = searchParams?.get('email');

  const handleResendEmail = async () => {
    if (!email) {
      toast.error('No se pudo determinar el email');
      return;
    }

    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });

      if (error) throw error;

      toast.success('Email de confirmación reenviado');
    } catch (error) {
      console.error('Error reenviar email:', error);
      toast.error('Error al reenviar el email, inténtalo de nuevo después de 1 minuto');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg-primary)]">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md bg-[var(--bg-secondary)] border border-[var(--text-secondary)]/20">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-[var(--accent-primary)]/10 rounded-full flex items-center justify-center">
            <Mail className="w-8 h-8 text-[var(--accent-primary)]" />
          </div>

          <CardTitle className="text-2xl text-[var(--text-primary)]">
            Revisa tu Email
          </CardTitle>

          <CardDescription className="text-[var(--text-secondary)] mt-2">
            Te hemos enviado un correo de confirmación
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Mensaje principal */}
          <div className="space-y-3 text-center">
            <div className="flex items-start gap-3 p-4 bg-[var(--accent-primary)]/5 rounded-lg border border-[var(--accent-primary)]/20">
              <CheckCircle className="w-5 h-5 text-[var(--accent-primary)] flex-shrink-0 mt-0.5" />
              <div className="text-left">
                <p className="text-sm text-[var(--text-primary)] font-medium mb-1">
                  ¡Cuenta creada exitosamente!
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {email ? (
                    <>
                      Hemos enviado un email de confirmación a{' '}
                      <span className="font-medium text-[var(--text-primary)]">{email}</span>
                    </>
                  ) : (
                    'Hemos enviado un email de confirmación a tu correo'
                  )}
                </p>
              </div>
            </div>

            <div className="text-left space-y-2 p-4 bg-[var(--bg-tertiary)] rounded-lg">
              <p className="text-sm text-[var(--text-primary)] font-medium">
                Próximos pasos:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-sm text-[var(--text-secondary)]">
                <li>Abre tu bandeja de entrada</li>
                <li>Busca el email de confirmación</li>
                <li>Haz clic en el enlace de verificación</li>
                <li>Inicia sesión en tu cuenta</li>
              </ol>
            </div>

            <div className="text-xs text-[var(--text-secondary)] p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p>
                💡 <span className="font-medium">Consejo:</span> Si no ves el email, revisa tu carpeta de spam o correo no deseado
              </p>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="space-y-3">
            {email && (
              <Button
                onClick={handleResendEmail}
                disabled={isResending}
                variant="secondary"
                className="w-full"
              >
                {isResending ? 'Reenviando...' : 'Reenviar Email'}
              </Button>
            )}

            <Button
              onClick={() => router.push('/auth')}
              variant="ghost"
              className="w-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al Inicio de Sesión
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
