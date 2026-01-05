'use client';

import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Trash2 } from 'lucide-react';
import type { ManageMemberModalProps } from '@/models';

export const ManageMemberModal: React.FC<ManageMemberModalProps> = ({
  member,
  onClose,
  onChangeRole,
  onRemove,
  isLoading,
}) => {
  if (!member) return null;

  return (
    <Modal isOpen={!!member} onClose={onClose} title={`Gestionar: ${member.user.name}`}>
      <div className='space-y-4'>
        <div className='bg-[var(--bg-primary)] p-3 rounded-lg'>
          <p className='text-sm text-[var(--text-secondary)]'>
            Email: <span className='text-[var(--text-primary)]'>{member.user.email}</span>
          </p>
          <p className='text-sm text-[var(--text-secondary)] mt-1'>
            Rol actual:{' '}
            <span className='text-[var(--text-primary)] font-semibold'>{member.role}</span>
          </p>
        </div>

        <div className='space-y-2'>
          <p className='text-sm font-medium text-[var(--text-primary)]'>Cambiar Rol:</p>
          <div className='grid grid-cols-3 gap-2'>
            {['Admin', 'Collaborator', 'Viewer'].map((role) => (
              <Button
                key={role}
                variant={member.role === role ? 'primary' : 'secondary'}
                size='sm'
                onClick={() => onChangeRole(member.id, role)}
                disabled={isLoading}
              >
                {role}
              </Button>
            ))}
          </div>
        </div>

        <div className='pt-4 border-t border-[var(--text-secondary)]/20'>
          <Button
            variant='danger'
            className='w-full'
            onClick={() => {
              if (confirm(`¿Estás seguro de eliminar a ${member.user.name} del proyecto?`)) {
                onRemove(member.id, member.user.name);
              }
            }}
            disabled={isLoading}
          >
            <Trash2 className='h-4 w-4 mr-2' />
            Eliminar del Proyecto
          </Button>
        </div>
      </div>
    </Modal>
  );
};
