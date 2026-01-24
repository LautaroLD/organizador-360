'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useProjectStore } from '@/store/projectStore';
import { Button } from '@/components/ui/Button';
import { toast } from 'react-toastify';
import { Link2, Upload, FolderOpen, FileText, ImageIcon, Video, FileArchive, Plus, Trash2, CheckSquare, XSquare } from 'lucide-react';
import { ResourceCard } from '@/components/resources/ResourceCard';
import { ResourceTabs } from '@/components/resources/ResourceTabs';
import { AddLinkModal } from '@/components/resources/AddLinkModal';
import { UploadFileModal } from '@/components/resources/UploadFileModal';
import { AnalyzeResourceModal } from '@/components/resources/AnalyzeResourceModal';
import type { LinkFormData, ResourceTab, Resource } from '@/models';
import { checkStorageLimit, SUBSCRIPTION_LIMITS, checkIsPremiumUser } from '@/lib/subscriptionUtils';
import { StorageIndicator } from './StorageIndicator';

const getFileCategory = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico'].includes(ext)) {
    return 'images';
  }

  if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'].includes(ext)) {
    return 'videos';
  }

  if (['pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp'].includes(ext)) {
    return 'documents';
  }

  return 'others';
};

export const ResourcesView: React.FC = () => {
  const supabase = createClient();
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isFileModalOpen, setIsFileModalOpen] = useState(false);

  // Estados para Análisis IA
  const [isAnalyzeModalOpen, setIsAnalyzeModalOpen] = useState(false);
  const [analyzingResource, setAnalyzingResource] = useState<Resource | null>(null);
  const [analysisSummary, setAnalysisSummary] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [activeTab, setActiveTab] = useState<ResourceTab>('all');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedResources, setSelectedResources] = useState<Set<string>>(new Set());
  const [isPremium, setIsPremium] = useState(false);
  const { user } = useAuthStore();
  const { currentProject, setCurrentProject } = useProjectStore();
  const queryClient = useQueryClient();

  // Verificar si el usuario es premium
  React.useEffect(() => {
    const checkPremium = async () => {
      if (user?.id) {
        const premium = await checkIsPremiumUser(supabase, user.id);
        setIsPremium(premium);
      }
    };
    checkPremium();
  }, [user, supabase]);

  // Fetch resources
  const { data: resources, isLoading } = useQuery({
    queryKey: ['resources', currentProject?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('resources')
        .select(`
          *,
          uploader:users(name, email)
        `)
        .eq('project_id', currentProject!.id)
        .order('created_at', { ascending: false });
      return (data || []) as Resource[];
    },
    enabled: !!currentProject?.id,
  });

  // Filter resources by tab
  const filteredResources = resources?.filter((resource) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'links') return resource.type === 'link';

    if (resource.type === 'file') {
      const category = getFileCategory(resource.title);
      return category === activeTab;
    }

    return false;
  });

  // Count resources by type
  const counts = {
    all: resources?.length || 0,
    links: resources?.filter((r) => r.type === 'link').length || 0,
    documents:
      resources?.filter((r) => r.type === 'file' && getFileCategory(r.title) === 'documents')
        .length || 0,
    images:
      resources?.filter((r) => r.type === 'file' && getFileCategory(r.title) === 'images').length ||
      0,
    videos:
      resources?.filter((r) => r.type === 'file' && getFileCategory(r.title) === 'videos').length ||
      0,
    others:
      resources?.filter((r) => r.type === 'file' && getFileCategory(r.title) === 'others').length ||
      0,
  };

  // Create link mutation
  const createLinkMutation = useMutation({
    mutationFn: async (data: LinkFormData) => {
      const { error } = await supabase.from('resources').insert({
        project_id: currentProject!.id,
        title: data.title,
        type: 'link',
        url: data.url,
        uploaded_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      toast.success('Link agregado exitosamente');
      setIsLinkModalOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Error al agregar link');
    },
  });

  // Upload file mutation
  const uploadFileMutation = useMutation({
    mutationFn: async ({ file, customName }: { file: File; customName?: string; }) => {
      // Check storage limit
      const { canAdd, reason } = await checkStorageLimit(supabase, currentProject!.id, file.size);
      if (!canAdd) {
        throw new Error(reason || 'No hay suficiente espacio de almacenamiento');
      }

      function sanitizeFileName(fileName: string): string {
        return fileName
          .normalize("NFD")                     // elimina acentos
          .replace(/[\u0300-\u036f]/g, "")      // quita diacríticos
          .replace(/[^a-zA-Z0-9._-]/g, "_")     // reemplaza caracteres no permitidos por "_"
          .replace(/\s+/g, "_")                 // reemplaza espacios por "_"
          .toLowerCase();                       // opcional: todo en minúsculas
      }

      // Use custom name if provided, otherwise use original file name
      const displayName = customName || file.name;
      // Uso en tu caso:
      const safeName = sanitizeFileName(displayName);
      const fileName = `${currentProject!.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from('resources').upload(fileName, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('resources').getPublicUrl(fileName);

      const { error: insertError } = await supabase.from('resources').insert({
        project_id: currentProject!.id,
        title: displayName,
        type: 'file',
        url: publicUrl,
        uploaded_by: user!.id,
        size: file.size,
      });

      if (insertError) throw insertError;

      // Increment storage used
      await supabase.rpc('increment_project_storage', {
        p_project_id: currentProject!.id,
        p_bytes: file.size
      });

      return file.size;
    },
    onSuccess: (fileSize) => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });

      // Update local state for immediate feedback
      if (currentProject) {
        setCurrentProject({
          ...currentProject,
          storage_used: (currentProject.storage_used || 0) + fileSize
        });
      }

      toast.success('Archivo subido exitosamente');
      setIsFileModalOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Error al subir archivo');
    },
  });

  // Delete resource mutation
  const deleteResourceMutation = useMutation({
    mutationFn: async (resource: Resource) => {
      let fileSize = resource.size || 0;

      if (resource.type === 'file') {
        const urlParts = resource.url.split('/');
        const fileName = urlParts[urlParts.length - 1];
        const projectId = urlParts[urlParts.length - 2];

        // If size is not stored (legacy files), try to fetch metadata
        if (fileSize === 0) {
          try {
            // Decode filename in case it's URL encoded
            const decodedFileName = decodeURIComponent(fileName);
            // List files in the project folder
            const { data: fileList } = await supabase.storage.from('resources').list(projectId);

            if (fileList) {
              const foundFile = fileList.find(f => f.name === decodedFileName || f.name === fileName);
              if (foundFile) {
                fileSize = foundFile.metadata?.size || 0;
              }
            }
          } catch (err) {
            console.error("Error fetching file metadata for deletion:", err);
          }
        }

        await supabase.storage.from('resources').remove([`${projectId}/${fileName}`]);
      }

      const { error } = await supabase.from('resources').delete().eq('id', resource.id);

      if (error) throw error;

      if (fileSize > 0) {
        await supabase.rpc('decrement_project_storage', {
          p_project_id: currentProject!.id,
          p_bytes: fileSize
        });
      }

      return fileSize;
    },
    onSuccess: (fileSize) => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });

      if (currentProject && fileSize > 0) {
        setCurrentProject({
          ...currentProject,
          storage_used: Math.max(0, (currentProject.storage_used || 0) - fileSize)
        });
      }

      toast.success('Recurso eliminado');
    },
    onError: (error) => {
      toast.error(error.message || 'Error al eliminar recurso');
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (resourcesToDelete: Resource[]) => {
      let totalSize = 0;
      const filePathsToDelete: string[] = [];
      const idsToDelete: string[] = [];

      for (const resource of resourcesToDelete) {
        idsToDelete.push(resource.id);

        if (resource.type === 'file') {
          let fileSize = resource.size || 0;
          const urlParts = resource.url.split('/');
          const fileName = urlParts[urlParts.length - 1];
          const projectId = urlParts[urlParts.length - 2];

          filePathsToDelete.push(`${projectId}/${fileName}`);

          // If size is not stored, try to fetch (best effort)
          if (fileSize === 0) {
            try {
              const decodedFileName = decodeURIComponent(fileName);
              const { data: fileList } = await supabase.storage.from('resources').list(projectId);
              if (fileList) {
                const foundFile = fileList.find(f => f.name === decodedFileName || f.name === fileName);
                if (foundFile) {
                  fileSize = foundFile.metadata?.size || 0;
                }
              }
            } catch (e) { console.error(e); }
          }
          totalSize += fileSize;
        }
      }

      // Delete files from storage
      if (filePathsToDelete.length > 0) {
        await supabase.storage.from('resources').remove(filePathsToDelete);
      }

      // Delete records from DB
      const { error } = await supabase.from('resources').delete().in('id', idsToDelete);
      if (error) throw error;

      // Decrement storage
      if (totalSize > 0) {
        await supabase.rpc('decrement_project_storage', {
          p_project_id: currentProject!.id,
          p_bytes: totalSize
        });
      }

      return totalSize;
    },
    onSuccess: (totalSize) => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      setSelectedResources(new Set());
      setSelectionMode(false);

      if (currentProject && totalSize > 0) {
        setCurrentProject({
          ...currentProject,
          storage_used: Math.max(0, (currentProject.storage_used || 0) - totalSize)
        });
      }

      toast.success('Recursos eliminados');
    },
    onError: (error) => {
      toast.error(error.message || 'Error al eliminar recursos');
    }
  });

  // Analyze Resource Function
  const handleAnalyzeResource = async (resource: Resource) => {
    setAnalyzingResource(resource);
    setIsAnalyzeModalOpen(true);
    setAnalysisSummary(null);
    setIsAnalyzing(true);

    try {
      const response = await fetch('/api/ia/resources/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resourceId: resource.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error analyzing file');
      }

      setAnalysisSummary(data.summary);
    } catch (error) {
      console.error(error);
      toast.error('Error al analizar el archivo. Asegúrate de que es un formato soportado.');
      setAnalysisSummary('Hubo un error al intentar analizar este archivo.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleSelection = (resource: Resource, selected: boolean) => {
    const newSelected = new Set(selectedResources);
    if (selected) {
      newSelected.add(resource.id);
    } else {
      newSelected.delete(resource.id);
    }
    setSelectedResources(newSelected);
  };

  const handleBulkDelete = () => {
    if (!resources) return;
    const resourcesToDelete = resources.filter(r => selectedResources.has(r.id));
    if (confirm(`¿Estás seguro de eliminar ${resourcesToDelete.length} recursos?`)) {
      bulkDeleteMutation.mutate(resourcesToDelete);
    }
  };

  const getEmptyStateIcon = () => {
    const iconClass = 'h-12 w-12 text-[var(--accent-primary)]';
    switch (activeTab) {
      case 'links':
        return <Link2 className={iconClass} />;
      case 'documents':
        return <FileText className={iconClass} />;
      case 'images':
        return <ImageIcon className={iconClass} />;
      case 'videos':
        return <Video className={iconClass} />;
      case 'others':
        return <FileArchive className={iconClass} />;
      default:
        return <FolderOpen className={iconClass} />;
    }
  };

  const getEmptyStateText = () => {
    if (activeTab === 'all') return 'No hay recursos aún';
    const tabNames: Record<ResourceTab, string> = {
      all: 'recursos',
      links: 'links',
      documents: 'documentos',
      images: 'imágenes',
      videos: 'videos',
      others: 'otros archivos',
    };
    return `No hay ${tabNames[activeTab]}`;
  };

  if (!currentProject) {
    return (
      <div className='flex items-center justify-center h-full p-12'>
        <p className='text-[var(--text-secondary)]'>Selecciona un proyecto primero</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-full p-12'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent-primary)] mx-auto mb-4'></div>
          <p className='text-[var(--text-secondary)]'>Cargando recursos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='flex-1 overflow-y-auto'>
      <div className='p-4 md:p-6'>
        <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6'>
          <div>
            <h2 className='text-xl md:text-2xl font-bold text-[var(--text-primary)]'>Recursos del Proyecto</h2>
            <p className='text-sm md:text-base text-[var(--text-secondary)] mb-2'>
              {resources?.length || 0} recurso(s) disponible(s)
            </p>
            <div>
              <StorageIndicator
                used={currentProject.storage_used || 0}
                limit={currentProject.is_premium ? SUBSCRIPTION_LIMITS.PRO.MAX_STORAGE_BYTES : SUBSCRIPTION_LIMITS.FREE.MAX_STORAGE_BYTES}
              />
            </div>
          </div>
          <div className='flex flex-col sm:flex-row gap-2 w-full sm:w-auto'>
            {selectionMode ? (
              <>
                <Button
                  onClick={handleBulkDelete}
                  variant='danger'
                  className='w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white'
                  disabled={selectedResources.size === 0 || bulkDeleteMutation.isPending}
                >
                  <Trash2 className='h-4 w-4 mr-2' />
                  Eliminar ({selectedResources.size})
                </Button>
                <Button
                  onClick={() => {
                    setSelectionMode(false);
                    setSelectedResources(new Set());
                  }}
                  variant='secondary'
                  className='w-full sm:w-auto'
                >
                  <XSquare className='h-4 w-4 mr-2' />
                  Cancelar
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={() => setSelectionMode(true)}
                  variant='secondary'
                  className='w-full sm:w-auto'
                  disabled={!resources || resources.length === 0}
                >
                  <CheckSquare className='h-4 w-4 mr-2' />
                  Seleccionar
                </Button>
                <Button
                  onClick={() => setIsLinkModalOpen(true)}
                  className='w-full sm:w-auto'
                >
                  <Link2 className='h-4 w-4 mr-2' />
                  Agregar Link
                </Button>
                <Button
                  onClick={() => setIsFileModalOpen(true)}
                  variant='secondary'
                  className='w-full sm:w-auto'
                >
                  <Upload className='h-4 w-4 mr-2' />
                  Subir Archivo
                </Button>
              </>
            )}
          </div>
        </div>

        <ResourceTabs activeTab={activeTab} onTabChange={setActiveTab} counts={counts} />

        {filteredResources && filteredResources.length > 0 ? (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-6'>
            {filteredResources.map((resource) => (
              <ResourceCard
                key={resource.id}
                resource={resource}
                onDelete={(resource) => deleteResourceMutation.mutate(resource)}
                onAnalyze={handleAnalyzeResource}
                isPremium={isPremium}
                selectionMode={selectionMode}
                selected={selectedResources.has(resource.id)}
                onSelect={toggleSelection}
              />
            ))}
          </div>
        ) : (
          <div className='text-center py-12 md:py-16'>
            <div className='bg-[var(--accent-primary)]/10 w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6'>
              {getEmptyStateIcon()}
            </div>
            <h3 className='text-lg md:text-xl font-semibold text-[var(--text-primary)] mb-2'>
              {getEmptyStateText()}
            </h3>
            <p className='text-sm md:text-base text-[var(--text-secondary)] mb-6 max-w-md mx-auto px-4'>
              {activeTab === 'all'
                ? 'Comienza agregando links o subiendo archivos al proyecto'
                : `${getEmptyStateText()} cargados en tu proyecto.`}
            </p>
            <div className='flex flex-col sm:flex-row items-center justify-center gap-2'>
              <Button onClick={() => setIsLinkModalOpen(true)}>
                <Plus className='h-4 w-4 mr-2' />
                Agregar Link
              </Button>
              <Button onClick={() => setIsFileModalOpen(true)} variant='secondary'>
                <Upload className='h-4 w-4 mr-2' />
                Subir Archivo
              </Button>
            </div>
          </div>
        )}
      </div>

      <AddLinkModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        onSubmit={(data) => createLinkMutation.mutate(data)}
        isLoading={createLinkMutation.isPending}
      />

      <UploadFileModal
        isOpen={isFileModalOpen}
        onClose={() => setIsFileModalOpen(false)}
        onUpload={(file, customName) => uploadFileMutation.mutate({ file, customName })}
        isLoading={uploadFileMutation.isPending}
      />

      <AnalyzeResourceModal
        isOpen={isAnalyzeModalOpen}
        onClose={() => setIsAnalyzeModalOpen(false)}
        isLoading={isAnalyzing}
        summary={analysisSummary}
        resourceTitle={analyzingResource?.title || ''}
      />
    </div>
  );
};
