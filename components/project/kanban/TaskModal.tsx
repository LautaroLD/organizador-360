'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Task, CreateTaskDTO, UpdateTaskDTO } from '@/models';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateTaskDTO | UpdateTaskDTO) => void;
  onDelete?: () => void;
  initialData?: Task | null;
  projectId: string;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onDelete,
  initialData,
  projectId,
}) => {
  const { register, handleSubmit, reset, setValue, watch } = useForm<CreateTaskDTO>({
    defaultValues: {
      title: '',
      description: '',
      status: 'todo',
      assigned_to: [],
    },
  });

  const supabase = createClient();

  // Fetch project members for assignment
  const { data: members } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_members')
        .select(`
          user_id,
          user:users (
            id,
            name,
            email
          )
        `)
        .eq('project_id', projectId);

      if (error) throw error;
      return data;
    },
    enabled: isOpen,
  });

  useEffect(() => {
    if (initialData) {
      setValue('title', initialData.title);
      setValue('description', initialData.description || '');
      setValue('status', initialData.status);
      setValue('assigned_to', initialData.assignments?.map(a => a.user_id) || []);
    } else {
      reset({
        title: '',
        description: '',
        status: 'todo',
        assigned_to: [],
      });
    }
  }, [initialData, isOpen, reset, setValue]);

  const assignedTo = watch('assigned_to') || [];

  const toggleAssignment = (userId: string) => {
    const current = assignedTo;
    if (current.includes(userId)) {
      setValue('assigned_to', current.filter(id => id !== userId));
    } else {
      setValue('assigned_to', [...current, userId]);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? 'Editar Tarea' : 'Nueva Tarea'}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
            Título
          </label>
          <Input
            {...register('title', { required: true })}
            placeholder="Título de la tarea"
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
            Descripción
          </label>
          <textarea
            {...register('description')}
            placeholder="Descripción detallada..."
            className="w-full p-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] min-h-[100px]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
            Estado
          </label>
          <select
            {...register('status')}
            className="w-full p-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
          >
            <option value="todo">Por hacer</option>
            <option value="in-progress">En progreso</option>
            <option value="done">Completado</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            Asignar a
          </label>
          <div className="flex flex-wrap gap-2">
            {members?.map((member: any) => (
              <button
                key={member.user_id}
                type="button"
                onClick={() => toggleAssignment(member.user_id)}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm transition-colors ${assignedTo.includes(member.user_id)
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                  }`}
              >
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">
                  {member.user?.name?.[0] || '?'}
                </div>
                <span>{member.user?.name || member.user?.email}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-between pt-4">
          {initialData && onDelete ? (
            <Button
              type="button"
              variant="danger"
              onClick={onDelete}
            >
              Eliminar
            </Button>
          ) : (
            <div></div>
          )}
          <div className="flex space-x-3">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">
              {initialData ? 'Guardar Cambios' : 'Crear Tarea'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
