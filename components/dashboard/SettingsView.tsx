'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { User, Mail, Shield, Palette, Star, ArrowRight, Lock, Edit2, Save, X } from 'lucide-react';
import { useThemeStore } from '@/store/themeStore';
import { toast } from 'react-toastify';

const MAX_NAME_LENGTH = 80;

export const SettingsView: React.FC = () => {
  const { user, logout, setUser } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  // Estados para editar nombre
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(user?.user_metadata?.full_name || '');
  const [isUpdatingName, setIsUpdatingName] = useState(false);

  // Estados para cambiar contraseña
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Mensajes reemplazados por toasts (react-toastify)

  const handleUpdateName = async () => {
    const trimmedName = newName.trim();

    if (!trimmedName) {
      toast.error('El nombre no puede estar vacío');
      return;
    }

    if (trimmedName.length > MAX_NAME_LENGTH) {
      toast.error(`El nombre debe tener máximo ${MAX_NAME_LENGTH} caracteres`);
      return;
    }

    setIsUpdatingName(true);

    try {
      const response = await fetch('/api/auth/update-name', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: trimmedName }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al actualizar el nombre');
      }

      // Actualizar el usuario en el store
      if (data.user) {
        setUser(data.user);
      }

      toast.success('Nombre actualizado exitosamente');
      setIsEditingName(false);
    } catch (error: unknown) {
      console.error('Error updating name:', error);
      const message = error instanceof Error ? error.message : 'Error al actualizar el nombre';
      toast.error(message);
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleCancelEditName = () => {
    setNewName(user?.user_metadata?.full_name || '');
    setIsEditingName(false);
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Todos los campos son requeridos');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setIsUpdatingPassword(true);

    try {
      const response = await fetch('/api/auth/update-password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al actualizar la contraseña');
      }

      toast.success('Contraseña actualizada exitosamente');
      setIsChangingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: unknown) {
      console.error('Error updating password:', error);
      const message = error instanceof Error ? error.message : 'Error al actualizar la contraseña';
      toast.error(message);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleCancelChangePassword = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setIsChangingPassword(false);
  };

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
            {/* Nombre */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Nombre
              </label>
              {isEditingName ? (
                <div className="space-y-2">
                  <Input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Tu nombre"
                    maxLength={MAX_NAME_LENGTH}
                    disabled={isUpdatingName}
                  />
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      onClick={handleUpdateName}
                      disabled={isUpdatingName}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      {isUpdatingName ? 'Guardando...' : 'Guardar'}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleCancelEditName}
                      disabled={isUpdatingName}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4 text-[var(--text-secondary)]" />
                    <p className="text-[var(--text-primary)]">
                      {user?.user_metadata?.full_name || 'Sin nombre'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setIsEditingName(true)}
                  >
                    <Edit2 className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                </div>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Email
              </label>
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-[var(--text-secondary)]" />
                <p className="text-[var(--text-primary)]">{user?.email}</p>
              </div>
            </div>

            {/* ID de Usuario */}
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

        {/* Cambiar Contraseña */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Lock className="h-5 w-5 mr-2" />
              Seguridad
            </CardTitle>
            <CardDescription>
              Actualiza tu contraseña
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isChangingPassword ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    Contraseña Actual
                  </label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Ingresa tu contraseña actual"
                    disabled={isUpdatingPassword}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    Nueva Contraseña
                  </label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Ingresa tu nueva contraseña (mín. 6 caracteres)"
                    disabled={isUpdatingPassword}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    Confirmar Nueva Contraseña
                  </label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirma tu nueva contraseña"
                    disabled={isUpdatingPassword}
                  />
                </div>
                <div className="flex space-x-2">
                  <Button
                    onClick={handleUpdatePassword}
                    disabled={isUpdatingPassword}
                  >
                    <Save className="h-4 w-4 mr-1" />
                    {isUpdatingPassword ? 'Actualizando...' : 'Actualizar Contraseña'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleCancelChangePassword}
                    disabled={isUpdatingPassword}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button onClick={() => setIsChangingPassword(true)}>
                <Lock className="h-4 w-4 mr-2" />
                Cambiar Contraseña
              </Button>
            )}
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
