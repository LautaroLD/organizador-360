'use client';

import React from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { User, Mail, Shield, Palette, Star, ArrowRight } from 'lucide-react';
import { useThemeStore } from '@/store/themeStore';

export const SettingsView: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  const handleDeleteAccount = async () => {
    if (!confirm('¿Estás seguro de que deseas eliminar tu cuenta? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const response = await fetch('/api/auth/delete-account', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Error al eliminar la cuenta');
      }

      // Cerrar sesión y redirigir
      logout();
      window.location.href = '/';
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Hubo un error al intentar eliminar tu cuenta. Por favor, inténtalo de nuevo.');
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Configuración</h2>
        <p className="text-[var(--text-secondary)]">
          Administra tu cuenta y preferencias
        </p>
      </div>

      <div className="space-y-6">
        {/* Subscription */}
        <Card className="border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/5">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Star className="h-5 w-5 mr-2 text-[var(--accent-primary)]" />
              Plan y Suscripción
            </CardTitle>
            <CardDescription>
              Gestiona tu plan y acceso a funciones premium
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Actualiza a Pro para desbloquear proyectos ilimitados, miembros ilimitados y más.
            </p>
            <Link href="/settings/subscription">
              <Button className="w-full">
                Ver Planes
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* User Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="h-5 w-5 mr-2" />
              Perfil de Usuario
            </CardTitle>
            <CardDescription>
              Información básica de tu cuenta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Email
              </label>
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-[var(--text-secondary)]" />
                <p className="text-[var(--text-primary)]">{user?.email}</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                ID de Usuario
              </label>
              <div className="flex items-center space-x-2">
                <Shield className="h-4 w-4 text-[var(--text-secondary)]" />
                <p className="text-[var(--text-primary)] text-xs font-mono">{user?.id}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Palette className="h-5 w-5 mr-2" />
              Apariencia
            </CardTitle>
            <CardDescription>
              Personaliza el tema de la aplicación
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[var(--text-primary)] font-medium">Tema Actual</p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {theme === 'light' ? 'Modo Claro' : 'Modo Oscuro'}
                </p>
              </div>
              <Button onClick={toggleTheme}>
                Cambiar a {theme === 'light' ? 'Oscuro' : 'Claro'}
              </Button>
            </div>
          </CardContent>
        </Card>
        {/* Delete Account */}
        <Card className='border-red-500'>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="h-5 w-5 mr-2 text-red-500" />
              Eliminar Cuenta
            </CardTitle>
            <CardDescription>
              Elimina tu cuenta permanentemente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='w-full flex'>
              <Button variant="danger" className='ml-auto' onClick={handleDeleteAccount}>
                Eliminar Cuenta
              </Button>
            </div>
          </CardContent>
        </Card>
        {/* About */}
        <Card>
          <CardHeader>
            <CardTitle>Acerca de DevCore</CardTitle>
            <CardDescription>
              Información sobre la aplicación
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-[var(--text-secondary)]">
              <p><strong>Versión:</strong> 1.0.0</p>
              <p><strong>Última actualización:</strong> Noviembre 2024</p>
              <p className="pt-2 border-t border-[var(--text-secondary)]">
                DevCore es una plataforma de colaboración todo-en-uno diseñada específicamente
                para equipos de desarrollo.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div >
  );
};
