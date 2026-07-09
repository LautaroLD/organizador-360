'use client';

import React, { useEffect, useState } from 'react';
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
import { checkStorageLimit, getPlanLimits } from '@/lib/subscriptionUtils';
import { StorageIndicator } from './StorageIndicator';

type StoragePolicyResponse = {
  overLimit: boolean;
  plan: 'free' | 'starter' | 'pro';
  used: number;
  limit: number;
  graceDays: number;
  graceEndsAt: string | null;
  daysRemaining: number | null;
  autoDeleted: boolean;
};

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
  const { user } = useAuthStore();
  const { currentProject, setCurrentProject } = useProjectStore();
  const queryClient = useQueryClient();
  const normalizedRole = currentProject?.userRole?.toLowerCase();
  const isViewer = normalizedRole === 'viewer';

  const projectTier = currentProject?.plan_tier === 'starter' || currentProject?.plan_tier === 'pro'
    ? currentProject.plan_tier
    : (currentProject?.is_premium ? 'pro' : 'free');
  const projectLimits = getPlanLimits(projectTier ?? 'free');
  const canUseAI = projectTier === 'pro';

  const { data: storagePolicy } = useQuery({
    queryKey: ['resource-storage-policy', currentProject?.id, currentProject?.storage_used],
    queryFn: async (): Promise<StoragePolicyResponse> => {
      const response = await fetch('/api/resources/storage-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: currentProject!.id }),
      });

      if (!response.ok) {
        throw new Error('No se pudo validar la política de almacenamiento');
      }

      return response.json() as Promise<StoragePolicyResponse>;
    },
    enabled: !!currentProject?.id,
    staleTime: 30_000,
  });

  const isStorageOverLimit = Boolean(storagePolicy?.overLimit);
  const isResourceWriteLocked = !isViewer && isStorageOverLimit;

  useEffect(() => {
    if (!storagePolicy?.autoDeleted || !currentProject) return;

    const graceDaysLabel = storagePolicy.graceDays ?? 30;
    toast.info(
      `Se eliminaron automáticamente los recursos por exceder el límite durante más de ${graceDaysLabel} día(s).`,
    );
    queryClient.invalidateQueries({ queryKey: ['resources'] });
    setCurrentProject({
      ...currentProject,
      storage_used: 0,
      storage_over_limit_since: null,
    });
  }, [
    storagePolicy?.autoDeleted,
    storagePolicy?.graceDays,
    currentProject,
    queryClient,
    setCurrentProject,
  ]);

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
      if (isViewer) {
        throw new Error('No tienes permisos para agregar links');
      }
      if (isResourceWriteLocked) {
        throw new Error('Proyecto bloqueado por sobrecupo. Libera espacio o reactiva la suscripción.');
      }
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
      queryClient.invalidateQueries({ queryKey: ['resource-storage-policy'] });
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
      if (isViewer) {
        throw new Error('No tienes permisos para subir archivos');
      }
      if (isResourceWriteLocked) {
        throw new Error('Proyecto bloqueado por sobrecupo. Libera espacio o reactiva la suscripción.');
      }
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
      queryClient.invalidateQueries({ queryKey: ['resource-storage-policy'] });

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
      if (isViewer) {
        throw new Error('No tienes permisos para eliminar recursos');
      }
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
      queryClient.invalidateQueries({ queryKey: ['resource-storage-policy'] });

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
      if (isViewer) {
        throw new Error('No tienes permisos para eliminar recursos');
      }
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
      queryClient.invalidateQueries({ queryKey: ['resource-storage-policy'] });
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
    if (isViewer) {
      toast.error('Tu rol es Viewer: solo puedes visualizar recursos');
      return;
    }
    if (isResourceWriteLocked) {
      toast.error('Proyecto bloqueado por sobrecupo. Solo puedes descargar o eliminar recursos.');
      return;
    }
    setAnalyzingResource(resource);
    setIsAnalyzeModalOpen(true);
    setAnalysisSummary(null);
    setIsAnalyzing(true);

    try {
      const requestId = crypto.randomUUID();
      const response = await fetch('/api/ia/resources/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resourceId: resource.id, requestId }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 402) {
          throw new Error('No tienes créditos suficientes para analizar este archivo.');
        }

        if (response.status === 403) {
          throw new Error('Esta función está disponible solo para plan Pro.');
        }

        throw new Error(data.error || 'Error analyzing file');
      }

      setAnalysisSummary(data.summary);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error
        ? error.message
        : 'Error al analizar el archivo. Asegúrate de que es un formato soportado.');
      setAnalysisSummary('Hubo un error al intentar analizar este archivo.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleSelection = (resource: Resource, selected: boolean) => {
    if (isViewer) {
      return;
    }
    const newSelected = new Set(selectedResources);
    if (selected) {
      newSelected.add(resource.id);
    } else {
      newSelected.delete(resource.id);
    }
    setSelectedResources(newSelected);
  };

  const handleBulkDelete = () => {
    if (isViewer) {
      toast.error('Tu rol es Viewer: solo puedes visualizar recursos');
      return;
    }
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
        return <Link2 className={ iconClass } />;
      case 'documents':
        return <FileText className={ iconClass } />;
      case 'images':
        return <ImageIcon className={ iconClass } />;
      case 'videos':
        return <Video className={ iconClass } />;
      case 'others':
        return <FileArchive className={ iconClass } />;
      default:
        return <FolderOpen className={ iconClass } />;
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
              { resources?.length || 0 } recurso(s) disponible(s)
            </p>
            <div>
              <StorageIndicator
                used={ currentProject.storage_used || 0 }
                limit={ projectLimits.MAX_STORAGE_BYTES }
              />
              { isResourceWriteLocked && (
                <div className='mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200'>
                  <p className='font-semibold'>Proyecto excedido de almacenamiento</p>
                  <p className='mt-1'>
                    Solo están habilitadas las acciones de eliminar y descargar por archivo.
                    { storagePolicy?.daysRemaining !== null && storagePolicy?.daysRemaining !== undefined
                      ? ` Quedan ${storagePolicy.daysRemaining} día(s) para liberar espacio o reactivar la suscripción antes de la limpieza automática.`
                      : ' Debes liberar espacio o reactivar la suscripción antes de la limpieza automática.' }
                  </p>
                  { storagePolicy?.graceEndsAt && (
                    <p className='mt-1'>
                      Fecha límite: { new Date(storagePolicy.graceEndsAt).toLocaleDateString('es-ES') }.
                    </p>
                  ) }
                </div>
              ) }
              { isViewer && (
                <p className='mt-2 text-xs text-[var(--text-secondary)]'>Modo solo lectura: tu rol Viewer no puede crear, subir ni eliminar recursos.</p>
              ) }
            </div>
          </div>
          <div className='flex flex-col sm:flex-row gap-2 w-full sm:w-auto'>
            { !isViewer && selectionMode ? (
              <>
                <Button
                  onClick={ handleBulkDelete }
                  variant='danger'
                  className='w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white'
                  disabled={ selectedResources.size === 0 || bulkDeleteMutation.isPending }
                >
                  <Trash2 className='h-4 w-4 mr-2' />
                  Eliminar ({ selectedResources.size })
                </Button>
                <Button
                  onClick={ () => {
                    setSelectionMode(false);
                    setSelectedResources(new Set());
                  } }
                  variant='secondary'
                  className='w-full sm:w-auto'
                >
                  <XSquare className='h-4 w-4 mr-2' />
                  Cancelar
                </Button>
              </>
            ) : !isViewer ? (
              <>
                <Button
                  onClick={ () => setSelectionMode(true) }
                  variant='secondary'
                  className='w-full sm:w-auto'
                  disabled={ !resources || resources.length === 0 }
                >
                  <CheckSquare className='h-4 w-4 mr-2' />
                  Seleccionar
                </Button>
                { !isResourceWriteLocked && (
                  <>
                    <Button
                      onClick={ () => setIsLinkModalOpen(true) }
                      className='w-full sm:w-auto'
                    >
                      <Link2 className='h-4 w-4 mr-2' />
                      Agregar Link
                    </Button>
                    <Button
                      onClick={ () => setIsFileModalOpen(true) }
                      variant='secondary'
                      className='w-full sm:w-auto'
                    >
                      <Upload className='h-4 w-4 mr-2' />
                      Subir Archivo
                    </Button>
                  </>
                ) }
              </>
            ) : null }
          </div>
        </div>

        <ResourceTabs activeTab={ activeTab } onTabChange={ setActiveTab } counts={ counts } />

        { filteredResources && filteredResources.length > 0 ? (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-6'>
            { filteredResources.map((resource) => (
              <ResourceCard
                key={ resource.id }
                resource={ resource }
                onDelete={ (resource) => deleteResourceMutation.mutate(resource) }
                onAnalyze={ isResourceWriteLocked ? undefined : handleAnalyzeResource }
                isPremium={ canUseAI }
                canManage={ !isViewer }
                selectionMode={ selectionMode }
                selected={ selectedResources.has(resource.id) }
                onSelect={ toggleSelection }
              />
            )) }
          </div>
        ) : (
          <div className='text-center py-12 md:py-16'>
            <div className='bg-[var(--accent-primary)]/10 w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6'>
              { getEmptyStateIcon() }
            </div>
            <h3 className='text-lg md:text-xl font-semibold text-[var(--text-primary)] mb-2'>
              { getEmptyStateText() }
            </h3>
            <p className='text-sm md:text-base text-[var(--text-secondary)] mb-6 max-w-md mx-auto px-4'>
              { activeTab === 'all'
                ? 'Comienza agregando links o subiendo archivos al proyecto'
                : `${getEmptyStateText()} cargados en tu proyecto.` }
            </p>
            { !isViewer && !isResourceWriteLocked && (
              <div className='flex flex-col sm:flex-row items-center justify-center gap-2'>
                <Button onClick={ () => setIsLinkModalOpen(true) }>
                  <Plus className='h-4 w-4 mr-2' />
                  Agregar Link
                </Button>
                <Button onClick={ () => setIsFileModalOpen(true) } variant='secondary'>
                  <Upload className='h-4 w-4 mr-2' />
                  Subir Archivo
                </Button>
              </div>
            ) }
          </div>
        ) }
      </div>

      { !isViewer && (
        <AddLinkModal
          isOpen={ isLinkModalOpen }
          onClose={ () => setIsLinkModalOpen(false) }
          onSubmit={ (data) => createLinkMutation.mutate(data) }
          isLoading={ createLinkMutation.isPending }
        />
      ) }

      { !isViewer && (
        <UploadFileModal
          isOpen={ isFileModalOpen }
          onClose={ () => setIsFileModalOpen(false) }
          onUpload={ (file, customName) => uploadFileMutation.mutate({ file, customName }) }
          isLoading={ uploadFileMutation.isPending }
        />
      ) }

      <AnalyzeResourceModal
        isOpen={ isAnalyzeModalOpen }
        onClose={ () => setIsAnalyzeModalOpen(false) }
        isLoading={ isAnalyzing }
        summary={ analysisSummary }
        resourceTitle={ analyzingResource?.title || '' }
      />
    </div>
  );
};
