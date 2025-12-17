'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { LinkFormData, AddLinkModalProps } from '@/models';

export const AddLinkModal: React.FC<AddLinkModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<LinkFormData>();

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title='Agregar Link'>
      <form onSubmit={handleSubmit(onSubmit)} className='space-y-4'>
        <Input
          label='Título'
          {...register('title', { required: 'El título es requerido' })}
          error={errors.title?.message}
          placeholder='Repositorio GitHub'
        />
        <Input
          label='URL'
          type='url'
          {...register('url', {
            required: 'La URL es requerida',
            pattern: {
              value: /^https?:\/\/.+/,
              message: 'URL inválida',
            },
          })}
          error={errors.url?.message}
          placeholder='https://github.com/...'
        />
        <div className='flex justify-end space-x-2 pt-4'>
          <Button type='button' variant='secondary' onClick={handleClose}>
            Cancelar
          </Button>
          <Button type='submit' disabled={isLoading}>
            {isLoading ? 'Agregando...' : 'Agregar Link'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
