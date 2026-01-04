'use client';

import React, { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Task, CreateTaskDTO, UpdateTaskDTO, TaskImage } from '@/models';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

import { CheckSquare, Plus, Trash2, ImageIcon, X } from 'lucide-react';

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
  onAddImage?: (data: { taskId: string; file: File; }) => void;
  onDeleteImage?: (data: { imageId: string; imageUrl: string; }) => void;
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
  onAddImage,
  onDeleteImage,
}) => {
  const [newChecklistItem, setNewChecklistItem] = React.useState('');
  const [localChecklist, setLocalChecklist] = React.useState<Array<{ content: string; is_completed: boolean; tempId: string; }>>([]);
  const [localImages, setLocalImages] = React.useState<Array<{ file: File; preview: string; tempId: string; }>>([]);
  const [isUploadingImage, setIsUploadingImage] = React.useState(false);
  const [fullscreenImage, setFullscreenImage] = React.useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, reset, setValue, watch } = useForm<CreateTaskDTO>({
    defaultValues: {
      title: '',
      description: '',
      status: 'todo',
      assigned_to: [],
      tags: [],
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

  // Fetch project tags
  const { data: projectTags } = useQuery({
    queryKey: ['project-tags', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_tags')
        .select('*')
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
      setValue('tags', initialData.tags?.map(t => t.tag_id) || []);
      setLocalChecklist([]);
      setLocalImages([]);
    } else {
      reset({
        title: '',
        description: '',
        status: 'todo',
        assigned_to: [],
        tags: [],
      });
      setLocalChecklist([]);
      setLocalImages([]);
    }
    setNewChecklistItem('');
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
    if (newChecklistItem.trim()) {
      if (initialData && onAddChecklistItem) {
        // Si estamos editando, agregar directamente a la DB
        onAddChecklistItem({ taskId: initialData.id, content: newChecklistItem });
      } else {
        // Si estamos creando, agregar al estado local
        setLocalChecklist([...localChecklist, {
          content: newChecklistItem,
          is_completed: false,
          tempId: Date.now().toString()
        }]);
      }
      setNewChecklistItem('');
    }
  };

  const handleToggleLocalChecklistItem = (tempId: string) => {
    setLocalChecklist(localChecklist.map(item =>
      item.tempId === tempId ? { ...item, is_completed: !item.is_completed } : item
    ));
  };

  const handleDeleteLocalChecklistItem = (tempId: string) => {
    setLocalChecklist(localChecklist.filter(item => item.tempId !== tempId));
  };

  // Image handling functions
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido.');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no debe superar los 5MB.');
      return;
    }

    if (initialData && onAddImage) {
      // If editing, upload directly
      setIsUploadingImage(true);
      try {
        onAddImage({ taskId: initialData.id, file });
      } finally {
        setIsUploadingImage(false);
      }
    } else {
      // If creating, add to local state
      const preview = URL.createObjectURL(file);
      setLocalImages([...localImages, {
        file,
        preview,
        tempId: Date.now().toString()
      }]);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteLocalImage = (tempId: string) => {
    const image = localImages.find(img => img.tempId === tempId);
    if (image) {
      URL.revokeObjectURL(image.preview);
    }
    setLocalImages(localImages.filter(img => img.tempId !== tempId));
  };

  const handleFormSubmit = (data: CreateTaskDTO | UpdateTaskDTO) => {
    if (!initialData) {
      // Si estamos creando
      const createData: CreateTaskDTO = {
        ...data as CreateTaskDTO,
        checklist: localChecklist.length > 0 ? localChecklist.map(({ content, is_completed }) => ({ content, is_completed })) : undefined,
        images: localImages.length > 0 ? localImages.map(img => img.file) : undefined,
      };
      onSubmit(createData);
    } else {
      onSubmit(data);
    }
  };

  return (
    <Modal size='xl' isOpen={isOpen} onClose={onClose} title={initialData ? 'Editar Tarea' : 'Nueva Tarea'}>
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
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
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            Checklist
          </label>

          <div className="space-y-2 mb-3">
            {initialData ? (
              // Mostrar checklist de la DB si estamos editando
              initialData.checklist?.sort((a, b) => a.created_at.localeCompare(b.created_at)).map((item) => (
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
              ))
            ) : (
              // Mostrar checklist local si estamos creando
              localChecklist.map((item) => (
                <div key={item.tempId} className="flex items-center gap-2 group">
                  <button
                    type="button"
                    onClick={() => handleToggleLocalChecklistItem(item.tempId)}
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
                    onClick={() => handleDeleteLocalChecklistItem(item.tempId)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
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
            Tags
          </label>
          <div className="flex flex-wrap gap-2">
            {projectTags?.map((tag) => {

              const isSelected = (watch('tags') || []).includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => {

                    const current = watch('tags') || [];
                    if (isSelected) {
                      setValue('tags', current.filter(id => id !== tag.id));
                    } else {
                      setValue('tags', [...current, tag.id]);
                    }
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${isSelected
                    ? 'border-transparent text-white shadow-sm'
                    : 'bg-transparent border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]'
                    }`}
                  style={{
                    backgroundColor: isSelected ? tag.color : 'transparent',
                    borderColor: isSelected ? 'transparent' : undefined
                  }}
                >
                  {tag.label}
                </button>
              );
            })}
            {(!projectTags || projectTags.length === 0) && (
              <p className="text-xs text-[var(--text-secondary)]">
                No hay tags disponibles en este proyecto.
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            Imágenes
          </label>

          {/* Display existing images (when editing) */}
          {initialData?.images && initialData.images.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              {initialData.images.map((image) => (
                <div key={image.id} className="relative group">
                  <img
                    src={image.url}
                    alt={image.file_name}
                    className="w-full h-20 object-cover rounded-md border border-[var(--border-color)] cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setFullscreenImage(image.url)}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteImage?.({ imageId: image.id, imageUrl: image.url });
                    }}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Display local images (when creating) */}
          {!initialData && localImages.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              {localImages.map((image) => (
                <div key={image.tempId} className="relative group">
                  <img
                    src={image.preview}
                    alt={image.file.name}
                    className="w-full h-20 object-cover rounded-md border border-[var(--border-color)] cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setFullscreenImage(image.preview)}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteLocalImage(image.tempId);
                    }}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Upload button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingImage}
            className="w-full border border-dashed border-[var(--border-color)] hover:border-[var(--accent-primary)]"
          >
            <ImageIcon className="w-4 h-4 mr-2" />
            {isUploadingImage ? 'Subiendo...' : 'Agregar imagen'}
          </Button>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            Asignar a
          </label>
          <div className="flex flex-wrap gap-2">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
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

      {/* Fullscreen Image Viewer */}
      {fullscreenImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
          onClick={() => setFullscreenImage(null)}
        >
          <button
            type="button"
            onClick={() => setFullscreenImage(null)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
          >
            <X className="w-8 h-8" />
          </button>
          <img
            src={fullscreenImage}
            alt="Vista completa"
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </Modal>
  );
};
