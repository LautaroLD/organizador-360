'use client';

import React, { useState } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { Settings, Trash2, Save, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '../ui/Button';
import { useMutation } from '@tanstack/react-query';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { MessageContent } from '@/components/ui/MessageContent';

export function ProjectSettings() {
  const supabase = createClient();
  const { currentProject } = useProjectStore();
  const [projectName, setProjectName] = useState(currentProject?.name || '');
  const [projectDescription, setProjectDescription] = useState(
    currentProject?.description || ''
  );
  const [useRichTextDescription, setUseRichTextDescription] = useState(false);
  const [showDescriptionPreview, setShowDescriptionPreview] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const handleSave = useMutation({
    mutationFn: async () => {
      try {
        await supabase
          .from('projects')
          .update({ name: projectName, description: projectDescription })
          .eq('id', currentProject?.id);
      }
      catch (error) {
        console.error('Error updating project:', error);
      }
    },
    onSuccess: () => {
      if (currentProject) {
        useProjectStore.getState().setCurrentProject({
          ...currentProject,
          name: projectName,
          description: projectDescription,
        });
      }
    }
  });
  if (!currentProject) {
    return null;
  }



  const handleDelete = async () => {
    if (showDeleteConfirm) {
      await supabase.from('projects').delete().eq('id', currentProject.id);
      window.location.href = '/dashboard';
    } else {
      setShowDeleteConfirm(true);
    }
  };

  const hasChanges =
    projectName !== currentProject.name ||
    projectDescription !== (currentProject.description || '');

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className=" w-full p-6 space-y-8">
        {/* Información General */}
        <section className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--text-secondary)]/20 overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--text-secondary)]/20 bg-[var(--bg-primary)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Información General
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label
                htmlFor="project-name"
                className="block text-sm font-medium text-[var(--text-primary)] mb-2"
              >
                Nombre del Proyecto
              </label>
              <input
                id="project-name"
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--text-secondary)]/20 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent text-[var(--text-primary)]"
                placeholder="Ej: Mi Proyecto"
              />
            </div>

            <div>
              <label
                htmlFor="project-description"
                className="block text-sm font-medium text-[var(--text-primary)] mb-2"
              >
                Descripción
              </label>
              <div className="flex flex-col gap-2 text-xs text-[var(--text-secondary)] mb-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={useRichTextDescription}
                    onChange={(event) => setUseRichTextDescription(event.target.checked)}
                  />
                  Usar rich text
                </label>
                {useRichTextDescription && (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showDescriptionPreview}
                      onChange={(event) => setShowDescriptionPreview(event.target.checked)}
                    />
                    Ver preview
                  </label>
                )}
              </div>
              {useRichTextDescription ? (
                <RichTextEditor
                  rows={20}
                  value={projectDescription}
                  onChange={(value) => setProjectDescription(value)}
                  placeholder="Describe brevemente tu proyecto..."
                />
              ) : (
                <textarea
                  id="project-description"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  rows={15}
                  className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--text-secondary)]/20 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent resize-none text-[var(--text-primary)]"
                  placeholder="Describe brevemente tu proyecto..."
                />
              )}
              {useRichTextDescription && showDescriptionPreview && projectDescription.trim().length > 0 && (
                <div className="mt-3 rounded-lg border border-[var(--text-secondary)]/20 bg-[var(--bg-primary)] p-3">
                  <p className="text-xs text-[var(--text-secondary)] mb-2">Preview</p>
                  <MessageContent content={projectDescription} />
                </div>
              )}
            </div>

            {hasChanges && (
              <Button
                onClick={() => handleSave.mutate()}
                disabled={handleSave.isPending}
              >
                <Save className="w-4 h-4 mr-2" />
                {handleSave.isPending ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            )}
          </div>
        </section>

        {/* Estadísticas del Proyecto */}
        <section className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--text-secondary)]/20 overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--text-secondary)]/20 bg-[var(--bg-primary)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Estadísticas
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-[var(--bg-primary)] rounded-lg p-4 border border-[var(--text-secondary)]/10">
                <div className="text-sm text-[var(--text-secondary)] mb-1">
                  Fecha de Creación
                </div>
                <div className="text-lg font-semibold text-[var(--text-primary)]">
                  {new Date(currentProject.created_at).toLocaleDateString(
                    'es-ES',
                    {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    }
                  )}
                </div>
              </div>

              <div className="bg-[var(--bg-primary)] rounded-lg p-4 border border-[var(--text-secondary)]/10">
                <div className="text-sm text-[var(--text-secondary)] mb-1">
                  Última Modificación
                </div>
                <div className="text-lg font-semibold text-[var(--text-primary)]">
                  {new Date(currentProject.updated_at).toLocaleDateString(
                    'es-ES',
                    {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    }
                  )}
                </div>
              </div>

              <div className="bg-[var(--bg-primary)] rounded-lg p-4 border border-[var(--text-secondary)]/10">
                <div className="text-sm text-[var(--text-secondary)] mb-1">ID del Proyecto</div>
                <div className="text-sm font-mono text-[var(--text-primary)] truncate">
                  {currentProject.id}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Zona de Peligro */}
        <section className="bg-[var(--bg-secondary)] rounded-lg border border-red-500/30 overflow-hidden">
          <div className="px-6 py-4 border-b border-red-500/30 bg-red-500/10">
            <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Zona de Peligro
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <h3 className="font-medium text-[var(--text-primary)] mb-2">
                Eliminar Proyecto
              </h3>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                Una vez eliminado, no podrás recuperar este proyecto. Esta
                acción es permanente.
              </p>
              {showDeleteConfirm ? (
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    Confirmar Eliminación
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--text-secondary)]/20 rounded-md hover:bg-[var(--text-secondary)]/10 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar Proyecto
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
