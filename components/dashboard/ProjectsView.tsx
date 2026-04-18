'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'react-toastify';
import {
  Plus,
  FolderKanban,
  UserPlus,
  Users,
  Lock,
  LockOpen,
  Sparkles,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { ProjectFormData, Project } from '@/models';
import { InviteMemberModal } from '@/components/members/InviteMemberModal';
import { StorageIndicator } from './StorageIndicator';
import { getPlanLimits, getUserPlanTier } from '@/lib/subscriptionUtils';
import { MessageContent } from '@/components/ui/MessageContent';
import clsx from 'clsx';

export const ProjectsView: React.FC = () => {
  const supabase = createClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [selectedProjectForInvite, setSelectedProjectForInvite] =
    useState<Project | null>(null);
  const [isActiveModalOpen, setIsActiveModalOpen] = useState(false);
  const [selectedProjectForActive, setSelectedProjectForActive] =
    useState<Project | null>(null);
  const { user } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    control,
  } = useForm<ProjectFormData>();

  const [descriptionTab, setDescriptionTab] = useState<'richtext' | 'preview'>('richtext');
  const descriptionValue = useWatch({ control, name: 'description' }) || '';

  // Fetch projects
  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects', user?.id],
    queryFn: async () => {
      const { data: memberData } = await supabase
        .from('project_members')
        .select('project_id, role')
        .eq('user_id', user?.id);

      const projectIds = memberData?.map((m) => m.project_id) || [];

      if (projectIds.length === 0) return [];

      const { data } = await supabase
        .from('projects')
        .select('*, members:project_members(*)')
        .in('id', projectIds)
        .order('created_at', { ascending: false });

      // Add role information to each project
      const projectsWithRoles = data?.map(project => {
        const member = memberData?.find(m => m.project_id === project.id);
        return {
          ...project,
          userRole: member?.role || 'Member'
        };
      });

      return projectsWithRoles || [];
    },
    enabled: !!user?.id,
  });

  // Check plan tier
  const { data: planTier } = useQuery({
    queryKey: ['plan-tier', user?.id],
    queryFn: async () => {
      if (!user?.id) return 'free';
      return getUserPlanTier(supabase, user.id);
    },
    enabled: !!user?.id,
  });

  // Calculate disabled projects count
  const disabledProjectsCount = projects?.filter(p => !p.enabled && p.userRole === 'Owner').length || 0;
  const currentTier = planTier ?? 'free';
  const currentLimits = getPlanLimits(currentTier);

  const getProjectTier = (project: Project) => {
    const tier = (project as Project & { plan_tier?: string; }).plan_tier;
    if (tier === 'starter' || tier === 'pro') {
      return tier;
    }
    return project.is_premium ? 'pro' : 'free';
  };

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      // 1. OBTENER ESTADO DE SUSCRIPCIÓN Y CONTEO ACTUAL
      // Consultamos los proyectos habilitados del usuario y su estado premium en paralelo
      const [projectsCountRes, tierRes] = await Promise.all([
        supabase
          .from('projects')
          .select('*', { count: 'exact', head: true })
          .eq('owner_id', user!.id)
          .eq('enabled', true), // Solo contar proyectos habilitados
        getUserPlanTier(supabase, user!.id)
      ]);

      // Validar errores en las queries
      if (projectsCountRes.error) {
        throw new Error(`Error al verificar proyectos: ${projectsCountRes.error.message}`);
      }
      const tier = tierRes ?? 'free';
      const enabledProjects = projectsCountRes.count || 0;

      // 2. LÓGICA DE NEGOCIO: Límite de proyectos habilitados según plan
      const maxProjects = getPlanLimits(tier).MAX_PROJECTS;
      if (maxProjects !== null && enabledProjects >= maxProjects) {
        throw new Error(`Has alcanzado el límite de ${maxProjects} proyectos habilitados. Actualiza tu plan o desactiva proyectos para crear más.`);
      }

      // 3. PROCESO DE CREACIÓN (Tu código anterior corregido)
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: data.name,
          description: data.description,
          owner_id: user!.id,
        })
        .select('id')
        .single();

      if (projectError) throw projectError;

      // Insert member only - channel is created by trigger automatically
      const memberRes = await supabase.from('project_members').insert({
        project_id: project.id,
        user_id: user!.id,
        role: 'Owner',
      });

      if (memberRes.error) throw memberRes.error;

      return project;
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Proyecto creado exitosamente');
      setIsModalOpen(false);
      reset();
      // Navegar al proyecto recién creado
      router.push(`/projects/${project.id}`);
    },
    onError: (error) => {
      toast.error(error.message || 'Error al crear proyecto');
    },
  });

  const onSubmit = (data: ProjectFormData) => {
    createProjectMutation.mutate(data);
  };

  const handleInviteClick = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedProjectForInvite(project);
    setIsInviteModalOpen(true);
  };
  const handleActiveClick = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedProjectForActive(project);
    setIsActiveModalOpen(true);
  };

  const selectProject = (projectId: string) => {
    router.push(`/projects/${projectId}`);
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'Owner':
        return 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30';
      case 'Admin':
        return 'bg-blue-500/15 text-blue-500 border border-blue-500/30';
      case 'Collaborator':
        return 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30';
      default:
        return 'bg-[var(--text-secondary)]/10 text-[var(--text-secondary)] border border-[var(--text-secondary)]/20';
    }
  };

  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-full p-12'>
        <div className='text-center'>
          <div className='relative mx-auto mb-5 w-14 h-14'>
            <div className='absolute inset-0 rounded-full border-4 border-[var(--accent-primary)]/20'></div>
            <div className='absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-[var(--accent-primary)]'></div>
          </div>
          <p className='text-[var(--text-secondary)] text-sm font-medium'>Cargando proyectos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Alert for disabled projects */}
      {disabledProjectsCount > 0 && (
        <div className='relative overflow-hidden rounded-xl border border-amber-500/30 bg-amber-500/5 p-4'>
          <div className='absolute inset-y-0 left-0 w-1 rounded-l-xl bg-amber-500' />
          <div className='flex items-start gap-3 pl-2'>
            <div className='mt-0.5 flex-shrink-0 rounded-lg bg-amber-500/15 p-1.5'>
              <AlertTriangle className='h-4 w-4 text-amber-500' />
            </div>
            <div className='flex-1 min-w-0'>
              <h3 className='font-semibold text-amber-600 dark:text-amber-400 text-sm mb-0.5'>
                {disabledProjectsCount} proyecto{disabledProjectsCount > 1 ? 's' : ''} deshabilitado{disabledProjectsCount > 1 ? 's' : ''}
              </h3>
              <p className='text-xs text-amber-600/80 dark:text-amber-400/80'>
                {currentLimits.MAX_PROJECTS === null
                  ? 'Tu plan permite proyectos ilimitados.'
                  : `Tu plan ${currentTier.toUpperCase()} permite hasta ${currentLimits.MAX_PROJECTS} proyectos habilitados.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <div className='hidden sm:flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20'>
            <FolderKanban className='h-5 w-5 text-[var(--accent-primary)]' />
          </div>
          <div>
            <h2 className='text-2xl font-bold text-[var(--text-primary)] leading-tight'>
              Tus Proyectos
            </h2>
            <p className='text-sm text-[var(--text-secondary)]'>
              {projects?.length
                ? `${projects.length} proyecto${projects.length !== 1 ? 's' : ''} disponible${projects.length !== 1 ? 's' : ''}`
                : 'Sin proyectos aún'}
            </p>
          </div>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className='gap-2 shadow-sm'>
          <Plus className='h-4 w-4' />
          <span className='hidden sm:inline'>Nuevo Proyecto</span>
          <span className='sm:hidden'>Nuevo</span>
        </Button>
      </div>

      {projects && projects.length > 0 ? (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5'>
          {projects.map((project) => (
            <div
              key={project.id}
              className={clsx(
                'group relative flex flex-col rounded-2xl border transition-all duration-200 overflow-hidden',
                project.enabled
                  ? 'cursor-pointer border-[var(--text-secondary)]/15 bg-[var(--bg-secondary)] hover:border-[var(--accent-primary)]/50 hover:shadow-xl hover:shadow-[var(--accent-primary)]/5 hover:-translate-y-0.5'
                  : 'cursor-not-allowed opacity-60 border-[var(--text-secondary)]/10 bg-[var(--bg-secondary)]'
              )}
              onClick={() => project.enabled && selectProject(project.id)}
            >
              {/* Top accent bar */}
              <div className={clsx(
                'h-1 w-full transition-all duration-200',
                project.enabled
                  ? 'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-primary)]/50 group-hover:from-[var(--accent-primary)] group-hover:to-[var(--accent-primary)]'
                  : 'bg-[var(--text-secondary)]/20'
              )} />

              <div className='flex flex-col flex-1 p-5 gap-4'>
                {/* Card header row */}
                <div className='flex items-start justify-between gap-3'>
                  <div className={clsx(
                    'flex items-center justify-center w-11 h-11 rounded-xl flex-shrink-0 transition-colors duration-200',
                    project.enabled
                      ? 'bg-[var(--accent-primary)]/10 group-hover:bg-[var(--accent-primary)]/20'
                      : 'bg-[var(--text-secondary)]/10'
                  )}>
                    <FolderKanban className={clsx(
                      'h-5 w-5 transition-colors',
                      project.enabled ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'
                    )} />
                  </div>
                  <div className='flex flex-col items-end gap-1.5 min-w-0'>
                    <span className={clsx('text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap', getRoleBadgeStyle(project.userRole))}>
                      {project.userRole}
                    </span>
                    <div className='flex items-center gap-1.5 text-xs text-[var(--text-secondary)]'>
                      <span className={clsx(
                        'inline-flex items-center gap-1',
                        project.enabled ? 'text-emerald-500' : 'text-[var(--text-secondary)]'
                      )}>
                        <span className={clsx(
                          'inline-block w-1.5 h-1.5 rounded-full',
                          project.enabled ? 'bg-emerald-500' : 'bg-[var(--text-secondary)]/50'
                        )} />
                        {project.enabled ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Project name + description */}
                <div className='flex-1'>
                  <div className='flex items-center justify-between gap-2 mb-1.5'>
                    <h3 className='font-semibold text-[var(--text-primary)] text-base leading-snug line-clamp-1'>
                      {project.name}
                    </h3>
                    {project.enabled && (
                      <ChevronRight className='h-4 w-4 text-[var(--text-secondary)] flex-shrink-0 -translate-x-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200' />
                    )}
                  </div>
                  <div className='text-sm text-[var(--text-secondary)] line-clamp-2 leading-relaxed min-h-[2.5rem]'>
                    {project.description ? (
                      <MessageContent content={project.description} />
                    ) : (
                      <span className='italic opacity-60'>Sin descripción</span>
                    )}
                  </div>
                </div>

                {/* Metadata row */}
                <div className='flex items-center justify-between text-xs text-[var(--text-secondary)] pt-1 border-t border-[var(--text-secondary)]/10'>
                  <div className='flex items-center gap-1'>
                    <Users className='h-3.5 w-3.5' />
                    <span>{project.members.length} miembro{project.members.length !== 1 ? 's' : ''}</span>
                  </div>
                  <span>{formatDate(project.created_at)}</span>
                </div>

                {/* Storage */}
                <StorageIndicator
                  used={project.storage_used || 0}
                  limit={getPlanLimits(getProjectTier(project)).MAX_STORAGE_BYTES}
                />

                {/* Action buttons */}
                <div className='flex gap-2 pt-1'>
                  {project.userRole === 'Owner' && (
                    <Button
                      variant='ghost'
                      size='sm'
                      className='flex-1 text-xs h-8 bg-[var(--bg-primary)] border border-[var(--text-secondary)]/15 hover:border-[var(--text-secondary)]/30'
                      onClick={(e) => handleActiveClick(project, e)}
                    >
                      {project.enabled ? (
                        <><Lock className='h-3.5 w-3.5 mr-1.5' />Desactivar</>
                      ) : (
                        <><LockOpen className='h-3.5 w-3.5 mr-1.5' />Activar</>
                      )}
                    </Button>
                  )}
                  {(project.userRole === 'Owner' || project.userRole === 'Admin') && (
                    <Button
                      size='sm'
                      className='flex-1 text-xs h-8'
                      disabled={!project.enabled}
                      onClick={(e) => project.enabled && handleInviteClick(project, e)}
                    >
                      <UserPlus className='h-3.5 w-3.5 mr-1.5' />
                      Invitar
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* New project card */}
          <button
            onClick={() => setIsModalOpen(true)}
            className='group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--text-secondary)]/20 bg-transparent p-8 text-[var(--text-secondary)] transition-all duration-200 hover:border-[var(--accent-primary)]/50 hover:bg-[var(--accent-primary)]/5 hover:text-[var(--accent-primary)] min-h-[220px]'
          >
            <div className='mb-3 flex h-12 w-12 items-center justify-center rounded-xl border-2 border-dashed border-current/30 transition-transform duration-200 group-hover:scale-110'>
              <Plus className='h-6 w-6' />
            </div>
            <span className='text-sm font-medium'>Nuevo proyecto</span>
          </button>
        </div>
      ) : (
        <div className='flex flex-col items-center justify-center py-20 text-center'>
          <div className='relative mb-6'>
            <div className='absolute inset-0 rounded-full bg-[var(--accent-primary)]/5 blur-2xl scale-150' />
            <div className='relative flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--accent-primary)]/15 to-[var(--accent-primary)]/5 border border-[var(--accent-primary)]/20'>
              <FolderKanban className='h-11 w-11 text-[var(--accent-primary)]' />
              <Sparkles className='absolute -top-2 -right-2 h-5 w-5 text-[var(--accent-primary)] opacity-70' />
            </div>
          </div>
          <h3 className='text-xl font-semibold text-[var(--text-primary)] mb-2'>
            Sin proyectos todavía
          </h3>
          <p className='text-[var(--text-secondary)] text-sm mb-7 max-w-xs leading-relaxed'>
            Crea tu primer proyecto para comenzar a colaborar con tu equipo y gestionar tareas.
          </p>
          <Button onClick={() => setIsModalOpen(true)} size='lg' className='gap-2 shadow-md'>
            <Plus className='h-5 w-5' />
            Crear primer proyecto
          </Button>
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        size='xl'
        onClose={() => setIsModalOpen(false)}
        title='Crear Nuevo Proyecto'
      >
        <form onSubmit={handleSubmit(onSubmit)} className='space-y-4'>
          <Input
            label='Nombre del Proyecto'
            {...register('name', { required: 'El nombre es requerido' })}
            error={errors.name?.message}
            placeholder='Mi Proyecto Awesome'
          />
          <div>
            <label className='block text-sm font-medium text-[var(--text-primary)] mb-1'>
              <p>Descripción</p>
              <p className='text-sm text-[var(--text-secondary)]'>
                Sugerimos una descripción detallada y clara, esta información será utilizada por los modelos de IA para entender mejor el contexto de tu proyecto.
              </p>
            </label>
            <div className='flex gap-1 p-1 bg-[var(--bg-primary)] border border-[var(--text-secondary)]/20 rounded-lg mb-3 text-xs'>
              {(['richtext', 'preview'] as const).map((tab) => (
                <button
                  key={tab}
                  type='button'
                  onClick={() => setDescriptionTab(tab)}
                  className={`flex-1 py-1.5 px-2 rounded-md font-medium transition-colors ${descriptionTab === tab
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                >
                  {tab === 'richtext' ? 'Editar' : 'Vista previa'}
                </button>
              ))}
            </div>
            {descriptionTab === 'richtext' ? (
              <RichTextEditor
                rows={15}
                value={descriptionValue}
                onChange={(value) => setValue('description', value)}
                placeholder='Describe tu proyecto...'
              />
            ) : (
              <div className='rounded-lg border border-[var(--text-secondary)]/20 bg-[var(--bg-primary)] p-3 min-h-[10rem]'>
                {descriptionValue.trim().length > 0
                  ? <MessageContent content={descriptionValue} />
                  : <span className='text-[var(--text-secondary)] italic text-sm'>Sin contenido</span>}
              </div>
            )}
          </div>
          <div className='flex justify-end space-x-2 pt-4'>
            <Button
              type='button'
              variant='secondary'
              onClick={() => setIsModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type='submit' disabled={createProjectMutation.isPending}>
              {createProjectMutation.isPending
                ? 'Creando...'
                : 'Crear Proyecto'}
            </Button>
          </div>
        </form>
      </Modal>

      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => {
          setIsInviteModalOpen(false);
          setSelectedProjectForInvite(null);
        }}
        projectId={selectedProjectForInvite?.id ?? null}
        projectName={selectedProjectForInvite?.name}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['projects'] })}
      />

      <Modal isOpen={isActiveModalOpen} onClose={() => {
        setIsActiveModalOpen(false);
        setSelectedProjectForActive(null);
      }} title={selectedProjectForActive?.enabled ? 'Desactivar Proyecto' : 'Activar Proyecto'}>
        <div className='space-y-4'>
          <p>¿Estás seguro que deseas {selectedProjectForActive?.enabled ? 'desactivar' : 'activar'} el proyecto <strong>{selectedProjectForActive?.name}</strong>?</p>
          <div className='flex justify-end space-x-2 pt-4'>
            <Button
              type='button'
              variant='secondary'
              onClick={() => {
                setIsActiveModalOpen(false);
                setSelectedProjectForActive(null);
              }}
            >
              Cancelar
            </Button>
            <Button type='button' onClick={async () => {
              if (!selectedProjectForActive) return;

              try {
                const { error } = await supabase
                  .from('projects')
                  .update({ enabled: !selectedProjectForActive.enabled })
                  .eq('id', selectedProjectForActive.id);

                if (error) {
                  // Check if it's the limit error (ERRCODE P0002)
                  if (error.code === 'P0002') {
                    toast.error('Límite de proyectos habilitados alcanzado. Revisa tu plan para aumentar el límite o desactiva proyectos.', {
                      autoClose: 5000
                    });
                  } else {
                    toast.error('Error al actualizar el estado del proyecto');
                  }
                  return;
                }

                toast.success(`Proyecto ${selectedProjectForActive.enabled ? 'desactivado' : 'activado'} exitosamente`);
                queryClient.invalidateQueries({ queryKey: ['projects'] });
                setIsActiveModalOpen(false);
                setSelectedProjectForActive(null);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
              } catch (err: any) {
                console.error('Error toggling project:', err);
                toast.error(err.message || 'Error al actualizar el estado del proyecto');
              }
            }}>
              {selectedProjectForActive?.enabled ? 'Desactivar' : 'Activar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
