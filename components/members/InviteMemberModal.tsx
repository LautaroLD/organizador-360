'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Mail, Clock } from 'lucide-react';
import type { InviteFormData, InviteMemberModalProps } from '@/models';

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  projectName,
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<InviteFormData>({
    defaultValues: {
      role: 'Developer',
    },
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title='Invitar Miembro al Proyecto'>
      <form onSubmit={handleSubmit(onSubmit)} className='space-y-4'>
        {projectName && (
          <div className='bg-[var(--bg-primary)] p-3 rounded-lg mb-4'>
            <p className='text-sm text-[var(--text-secondary)]'>
              Proyecto: <span className='font-semibold text-[var(--text-primary)]'>{projectName}</span>
            </p>
          </div>
        )}

        <div className='bg-[var(--accent-primary)]/5 border-2 border-[var(--accent-primary)]/30 rounded-lg p-3 mb-4'>
          <div className='flex items-start'>
            <Mail className='h-5 w-5 text-[var(--accent-primary)] mr-2 mt-0.5 flex-shrink-0' />
            <div>
              <p className='text-sm text-[var(--text-primary)] font-medium'>Invitación por Email</p>
              <p className='text-xs text-[var(--text-secondary)] mt-1'>
                Se enviará un correo de invitación. El usuario deberá aceptarla para unirse.
              </p>
            </div>
          </div>
        </div>

        <Input
          label='Email del Miembro'
          type='email'
          {...register('email', {
            required: 'El email es requerido',
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
              message: 'Email inválido',
            },
          })}
          error={errors.email?.message}
          placeholder='miembro@ejemplo.com'
          icon={<Mail className='h-4 w-4' />}
        />

        <div>
          <label className='block text-sm font-medium text-[var(--text-primary)] mb-2'>Rol</label>
          <select
            {...register('role')}
            className='flex w-full rounded-lg border border-[var(--text-secondary)]/30 bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]'
          >
            <option value='Developer'>Developer</option>
            <option value='Admin'>Admin</option>
            <option value='Viewer'>Viewer</option>
          </select>
        </div>

        <div className='bg-[var(--bg-primary)] p-3 rounded-lg space-y-2'>
          <p className='text-xs font-semibold text-[var(--text-primary)]'>Permisos por Rol:</p>
          <ul className='text-xs text-[var(--text-secondary)] space-y-1'>
            <li>
              <strong>Admin:</strong> Gestionar proyecto, invitar usuarios, crear canales
            </li>
            <li>
              <strong>Developer:</strong> Participar en chat, subir recursos, crear eventos
            </li>
            <li>
              <strong>Viewer:</strong> Solo ver contenido, sin permisos de edición
            </li>
          </ul>
        </div>

        <div className='bg-orange-500/5 border-2 border-orange-500/30 rounded-lg p-3'>
          <div className='flex items-start'>
            <Clock className='h-5 w-5 text-orange-500 mr-2 mt-0.5 flex-shrink-0' />
            <p className='text-xs text-[var(--text-primary)]'>
              La invitación expirará en 7 días si no es aceptada.
            </p>
          </div>
        </div>

        <div className='flex justify-end space-x-2 pt-4'>
          <Button type='button' variant='secondary' onClick={handleClose}>
            Cancelar
          </Button>
          <Button type='submit' disabled={isLoading}>
            {isLoading ? 'Enviando...' : 'Enviar Invitación'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
