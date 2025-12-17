'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import type { TagFormData, ProjectTag, ProjectTagsModalProps } from '@/models';

const PRESET_COLORS = [
  { name: 'Rojo', value: '#EF4444' },
  { name: 'Naranja', value: '#F97316' },
  { name: 'Amarillo', value: '#EAB308' },
  { name: 'Verde', value: '#22C55E' },
  { name: 'Turquesa', value: '#14B8A6' },
  { name: 'Azul', value: '#3B82F6' },
  { name: 'Índigo', value: '#6366F1' },
  { name: 'Púrpura', value: '#A855F7' },
  { name: 'Rosa', value: '#EC4899' },
  { name: 'Gris', value: '#6B7280' },
];

export const ProjectTagsModal: React.FC<ProjectTagsModalProps> = ({
  isOpen,
  onClose,
  tags,
  onCreateTag,
  onUpdateTag,
  onDeleteTag,
  isLoading,
}) => {
  const [editingTag, setEditingTag] = useState<ProjectTag | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<TagFormData>({
    defaultValues: {
      color: PRESET_COLORS[0].value,
    },
  });

  const selectedColor = watch('color');

  const handleCreateOrUpdate = (data: TagFormData) => {
    if (editingTag) {
      onUpdateTag(editingTag.id, data);
      setEditingTag(null);
    } else {
      onCreateTag(data);
    }
    reset({ color: PRESET_COLORS[0].value });
  };

  const handleEdit = (tag: ProjectTag) => {
    setEditingTag(tag);
    setValue('label', tag.label);
    setValue('color', tag.color);
  };

  const handleCancelEdit = () => {
    setEditingTag(null);
    reset({ color: PRESET_COLORS[0].value });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title='Gestionar Tags del Proyecto'>
      <div className='space-y-4'>
        {/* Create/Edit Tag Form */}
        <div className='bg-[var(--bg-primary)] p-4 rounded-lg border-2 border-[var(--accent-primary)]/30'>
          <h3 className='text-sm font-semibold text-[var(--text-primary)] mb-3'>
            {editingTag ? 'Editar Tag' : 'Crear Nuevo Tag'}
          </h3>
          <form onSubmit={handleSubmit(handleCreateOrUpdate)} className='space-y-3'>
            <Input
              label='Nombre del Tag'
              {...register('label', { required: 'El nombre es requerido' })}
              error={errors.label?.message}
              placeholder='Frontend, Senior, Bug Hunter...'
            />

            <div>
              <label className='block text-sm font-medium text-[var(--text-primary)] mb-2'>
                Color
              </label>
              <div className='flex gap-2 mb-2 flex-wrap'>
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type='button'
                    onClick={() => setValue('color', color.value)}
                    className={`w-8 h-8 rounded-full transition-transform ${
                      selectedColor === color.value
                        ? 'ring-2 ring-[var(--accent-primary)] ring-offset-2 ring-offset-[var(--bg-primary)] scale-110'
                        : ''
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
              <input
                type='color'
                {...register('color')}
                className='w-full h-10 rounded-lg border border-[var(--text-secondary)]/30 cursor-pointer'
              />
            </div>

            <div className='flex justify-end space-x-2'>
              {editingTag && (
                <Button type='button' variant='secondary' onClick={handleCancelEdit}>
                  Cancelar
                </Button>
              )}
              <Button type='submit' disabled={isLoading}>
                {isLoading ? 'Guardando...' : editingTag ? 'Actualizar Tag' : 'Crear Tag'}
              </Button>
            </div>
          </form>
        </div>

        {/* Existing Tags */}
        <div>
          <h3 className='text-sm font-semibold text-[var(--text-primary)] mb-3'>
            Tags Existentes ({tags.length})
          </h3>
          {tags.length > 0 ? (
            <div className='space-y-2'>
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className='flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--text-secondary)]/20'
                >
                  <div className='flex items-center gap-3'>
                    <div
                      className='w-6 h-6 rounded-full'
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className='text-sm font-medium text-[var(--text-primary)]'>
                      {tag.label}
                    </span>
                  </div>
                  <div className='flex items-center gap-1'>
                    <button
                      onClick={() => handleEdit(tag)}
                      className='p-1.5 rounded hover:bg-[var(--bg-primary)] transition-colors'
                      title='Editar tag'
                    >
                      <Edit2 className='h-4 w-4 text-[var(--text-secondary)]' />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`¿Eliminar el tag "${tag.label}"? Se removerá de todos los miembros.`)) {
                          onDeleteTag(tag.id, tag.label);
                        }
                      }}
                      className='p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-red-500 transition-colors'
                      title='Eliminar tag'
                    >
                      <Trash2 className='h-4 w-4' />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className='text-sm text-[var(--text-secondary)] text-center py-4'>
              No hay tags creados aún. Crea tu primer tag arriba.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
};
