'use client';

import React, { useState } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { Settings, Trash2, Save, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export function ProjectSettings() {
  const { currentProject } = useProjectStore();
  const [projectName, setProjectName] = useState(currentProject?.name || '');
  const [projectDescription, setProjectDescription] = useState(
    currentProject?.description || ''
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  if (!currentProject) {
    return null;
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await supabase
        .from('projects')
        .update({ name: projectName, description: projectDescription })
        .eq('id', currentProject.id);
    } finally {
      setIsSaving(false);
    }
  };

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
      <div className="max-w-4xl mx-auto w-full p-6 space-y-8">
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
              <textarea
                id="project-description"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--text-secondary)]/20 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent resize-none text-[var(--text-primary)]"
                placeholder="Describe brevemente tu proyecto..."
              />
            </div>

            {hasChanges && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] text-white rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
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
