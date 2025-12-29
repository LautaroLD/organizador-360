'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Task, CreateTaskDTO, UpdateTaskDTO } from '@/models';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

import { CheckSquare, Plus, Trash2 } from 'lucide-react';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateTaskDTO | UpdateTaskDTO) => void;
  onDelete?: () => void;
  initialData?: Task | null;
  projectId: string;
  onAddChecklistItem?: (data: { taskId: string; content: string; }) => void;
  onUpdateChecklistItem?: (data: { id: string; is_completed: boolean; }) => void;
  onDeleteChecklistItem?: (id: string) => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onDelete,
  initialData,
  projectId,
  onAddChecklistItem,
  onUpdateChecklistItem,
  onDeleteChecklistItem,
}) => {
  const [newChecklistItem, setNewChecklistItem] = React.useState('');
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

  const handleAddChecklistItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (newChecklistItem.trim() && initialData && onAddChecklistItem) {
      onAddChecklistItem({ taskId: initialData.id, content: newChecklistItem });
      setNewChecklistItem('');
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

        {initialData && (
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Checklist
            </label>

            <div className="space-y-2 mb-3">
              {initialData.checklist?.sort((a, b) => a.created_at.localeCompare(b.created_at)).map((item) => (
                <div key={item.id} className="flex items-center gap-2 group">
                  <button
                    type="button"
                    onClick={() => onUpdateChecklistItem?.({ id: item.id, is_completed: !item.is_completed })}
                    className={`flex-none w-5 h-5 rounded border flex items-center justify-center transition-colors ${item.is_completed
                      ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)] text-white'
                      : 'border-[var(--text-secondary)] hover:border-[var(--accent-primary)]'
                      }`}
                  >
                    {item.is_completed && <CheckSquare className="w-3 h-3" />}
                  </button>
                  <span className={`flex-1 text-sm ${item.is_completed ? 'text-[var(--text-secondary)] line-through' : 'text-[var(--text-primary)]'}`}>
                    {item.content}
                  </span>
                  <Button
                    type='button'
                    variant='danger'
                    size='sm'
                    onClick={() => onDeleteChecklistItem?.(item.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                value={newChecklistItem}
                onChange={(e) => setNewChecklistItem(e.target.value)}
                placeholder="Añadir item..."
                className="flex-1 h-9 text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddChecklistItem(e);
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                onClick={handleAddChecklistItem}
                disabled={!newChecklistItem.trim()}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

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
