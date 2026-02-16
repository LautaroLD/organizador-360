'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import {
  Plus,
  FolderKanban,
  UserPlus,
  Mail,
  Clock,
  ArrowRight,
  Users,
  Lock,
  LockOpen,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { ProjectFormData, InviteFormData, Project } from '@/models';
import { StorageIndicator } from './StorageIndicator';
import { getPlanLimits, getUserPlanTier } from '@/lib/subscriptionUtils';
import { MessageContent } from '@/components/ui/MessageContent';

export const ProjectsView: React.FC = () => {
  const supabase = createClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [selectedProjectForInvite, setSelectedProjectForInvite] =
    useState<Project | null>(null);
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);
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
    watch,
  } = useForm<ProjectFormData>();

  const {
    register: registerInvite,
    handleSubmit: handleSubmitInvite,
    formState: { errors: inviteErrors },
    reset: resetInvite,
    watch: watchInvite,
  } = useForm<InviteFormData>({
    defaultValues: {
      role: 'Collaborator',
      inviteType: 'email',
    },
  });

  const inviteType = watchInvite('inviteType');
  const [useRichTextDescription, setUseRichTextDescription] = useState(false);
  const [showDescriptionPreview, setShowDescriptionPreview] = useState(false);
  const descriptionValue = watch('description') || '';

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
    if (tier === 'starter' || tier === 'pro' || tier === 'enterprise') {
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

  // Invite user mutation - Now sends email
  const inviteUserMutation = useMutation({
    mutationFn: async (data: InviteFormData) => {
      if (!selectedProjectForInvite?.id) {
        throw new Error('Proyecto no seleccionado');
      }

      const resolvedInviteType = data.inviteType ?? 'email';
      const resolvedRole = data.role ?? 'Collaborator';

      const response = await fetch('/api/invitations/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: selectedProjectForInvite.id,
          inviteeEmail: resolvedInviteType === 'email' ? data.email : null,
          role: resolvedRole,
          inviteType: resolvedInviteType,
        }),
      });

      const result = await response.json().catch(() => null) as {
        success?: boolean;
        error?: string;
        message?: string;
        invitationUrl?: string;
        isNewUser?: boolean;
      };

      if (!response.ok) {
        throw new Error(
          result?.error ||
          result?.message ||
          `Error al enviar invitación (${response.status})`
        );
      }

      if (!result?.success) {
        throw new Error(result?.error || 'Error al enviar invitación');
      }

      return result;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      if (variables.inviteType === 'link') {
        setGeneratedInviteLink(data.invitationUrl ?? null);
        toast.success('Enlace de invitación generado');
      } else {
        if (data.isNewUser) {
          toast.success('¡Invitación enviada! El usuario deberá crear una cuenta primero.', {
            autoClose: 5000
          });
        } else {
          toast.success('¡Invitación enviada! El usuario recibirá un email para aceptarla.');
        }
        setIsInviteModalOpen(false);
        setSelectedProjectForInvite(null);
        setGeneratedInviteLink(null);
        resetInvite();
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Error al enviar invitación');
    },
  });

  const onInviteSubmit = (data: InviteFormData) => {
    inviteUserMutation.mutate(data);
  };

  const handleInviteClick = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedProjectForInvite(project);
    setGeneratedInviteLink(null);
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

  const handleCopyInviteLink = async () => {
    if (!generatedInviteLink) return;
    try {
      await navigator.clipboard.writeText(generatedInviteLink);
      toast.success('Enlace copiado al portapapeles');
    } catch (error) {
      console.error('Error copying invitation link:', error);
      toast.error('No se pudo copiar el enlace');
    }
  };

  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-full p-12'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent-primary)] mx-auto mb-4'></div>
          <p className='text-[var(--text-secondary)]'>Cargando proyectos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Alert for disabled projects */}
      {disabledProjectsCount > 0 && (
        <div className=' bg-[var(--bg-secondary)] border border-[var(--accent-warning)] rounded-lg p-4'>
          <div className='flex items-start gap-3'>
            <Lock className='h-5 w-5 text-[var(--accent-warning)]  flex-shrink-0 mt-0.5' />
            <div className='flex-1'>
              <h3 className='font-semibold text-[var(--accent-warning)] mb-1'>
                Proyectos Deshabilitados
              </h3>
              <p className='text-sm text-[var(--accent-warning)] mb-2'>
                {currentLimits.MAX_PROJECTS === null
                  ? 'Tu plan permite proyectos ilimitados.'
                  : `Tu plan ${currentTier.toUpperCase()} permite hasta ${currentLimits.MAX_PROJECTS} proyectos habilitados simultáneamente.`}
              </p>
              <div className='flex gap-2 flex-wrap'>
                <p className='text-xs text-[var(--accent-warning)]  self-center'>
                  Para habilitar un proyecto, primero desactiva otro o actualiza tu plan.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className='flex items-center justify-between mb-6'>
        <div>
          <h2 className='text-2xl font-bold text-[var(--text-primary)]'>
            Tus Proyectos
          </h2>
          <p className='text-[var(--text-secondary)]'>
            {projects?.length || 0} proyecto(s) disponible(s)
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className='h-4 w-4 mr-2' />
          Nuevo Proyecto
        </Button>
      </div>

      {projects && projects.length > 0 ? (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
          {projects.map((project) => (
            <Card
              key={project.id}
              className={`${!project.enabled ? 'cursor-not-allowed opacity-80 border-0' : 'cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] group border-[var(--accent-primary)]'} `}
              onClick={() => project.enabled && selectProject(project.id)}
            >
              <CardHeader>
                <div className='flex items-start justify-between'>
                  <div className='bg-[var(--accent-primary)]/10 p-3 rounded-lg'>
                    <FolderKanban className='h-8 w-8 text-[var(--accent-primary)]' />
                  </div>
                  <div className='flex flex-col items-end gap-1'>
                    <span className='text-xs px-2 py-1 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] font-medium'>
                      {project.userRole}
                    </span>
                    <span className='text-xs text-[var(--text-secondary)] flex gap-2'>
                      <p className={`text-[${project.enabled ? 'var(--accent-primary)' : 'var(--text-secondary)'}]`}>
                        {project.enabled ? 'Activo' : 'Inactivo'}
                      </p>
                      |
                      <p>
                        {formatDate(project.created_at)}
                      </p>
                    </span>
                  </div>
                </div>
                <CardTitle className='mt-3 flex items-center justify-between'>
                  {project.name}
                  <ArrowRight className='h-5 w-5 text-[var(--text-secondary)] group-hover:text-[var(--accent-primary)] transition-colors group-hover:translate-x-1 transition-transform' />
                </CardTitle>
                <CardDescription className='line-clamp-2'>
                  {project.description ? (
                    <MessageContent content={project.description} />
                  ) : (
                    'Sin descripción'
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className='mb-4'>
                  <StorageIndicator
                    used={project.storage_used || 0}
                    limit={getPlanLimits(getProjectTier(project)).MAX_STORAGE_BYTES}
                  />
                </div>
                <div className='flex items-center justify-between text-sm text-[var(--text-secondary)] mb-3'>
                  <div className='flex items-center'>
                    <Users className='h-4 w-4 mr-1' />
                    {project.members.length} Colaboradores
                  </div>
                </div>
                <div className='flex gap-2'>
                  {project.userRole === 'Owner' && (
                    <Button
                      variant='ghost'
                      size='sm'
                      className='w-full'
                      onClick={(e) => handleActiveClick(project, e)}
                    >
                      {project.enabled ? <>
                        <Lock className='h-4 w-4 mr-2' />
                        Desactivar
                      </> : <>
                        <LockOpen className='h-4 w-4 mr-2' />
                        Activar
                      </>} Proyecto
                    </Button>
                  )}
                  {(project.userRole === 'Owner' || project.userRole === 'Admin') && (
                    <Button
                      variant='secondary'
                      size='sm'
                      className='w-full'
                      disabled={!project.enabled}
                      onClick={(e) => project.enabled && handleInviteClick(project, e)}
                    >
                      <UserPlus className='h-4 w-4 mr-2' />
                      Invitar Colaborador
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className='text-center py-16'>
          <div className='bg-[var(--accent-primary)]/10 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6'>
            <FolderKanban className='h-12 w-12 text-[var(--accent-primary)]' />
          </div>
          <h3 className='text-xl font-semibold text-[var(--text-primary)] mb-2'>
            No tienes proyectos aún
          </h3>
          <p className='text-[var(--text-secondary)] mb-6 max-w-md mx-auto'>
            Crea tu primer proyecto para comenzar a colaborar con tu equipo
          </p>
          <Button onClick={() => setIsModalOpen(true)} size='lg'>
            <Plus className='h-5 w-5 mr-2' />
            Crear tu primer proyecto
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
            <div className='flex flex-col gap-2 text-xs text-[var(--text-secondary)] mb-2'>
              <label className='flex items-center gap-2'>
                <input
                  type='checkbox'
                  checked={useRichTextDescription}
                  onChange={(event) => setUseRichTextDescription(event.target.checked)}
                />
                Usar rich text
              </label>
              {useRichTextDescription && (
                <label className='flex items-center gap-2'>
                  <input
                    type='checkbox'
                    checked={showDescriptionPreview}
                    onChange={(event) => setShowDescriptionPreview(event.target.checked)}
                  />
                  Ver preview
                </label>
              )}
            </div>
            {useRichTextDescription ? (
              <RichTextEditor
                rows={15}
                value={descriptionValue}
                onChange={(value) => setValue('description', value)}
                placeholder='Describe tu proyecto...'
              />
            ) : (
              <textarea
                {...register('description')}
                className='flex w-full rounded-lg border border-[var(--text-secondary)]/30 bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] resize-none'
                rows={10}
                placeholder='Describe tu proyecto...'
              />
            )}
            {useRichTextDescription && showDescriptionPreview && descriptionValue.trim().length > 0 && (
              <div className='mt-3 rounded-lg border border-[var(--text-secondary)]/20 bg-[var(--bg-primary)] p-3'>
                <p className='text-xs text-[var(--text-secondary)] mb-2'>Preview</p>
                <MessageContent content={descriptionValue} />
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

      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => {
          setIsInviteModalOpen(false);
          setSelectedProjectForInvite(null);
          setGeneratedInviteLink(null);
          resetInvite();
        }}
        title='Invitar Colaborador'
      >
        <form
          onSubmit={handleSubmitInvite(onInviteSubmit)}
          className='space-y-4'
        >
          <div className='bg-[var(--bg-primary)] p-3 rounded-lg mb-4'>
            <p className='text-sm text-[var(--text-secondary)]'>
              Proyecto:{' '}
              <span className='font-semibold text-[var(--text-primary)]'>
                {selectedProjectForInvite?.name}
              </span>
            </p>
          </div>

          <div className='bg-[var(--bg-primary)] p-3 rounded-lg mb-4'>
            <p className='text-xs text-[var(--text-secondary)]'>Método de invitación</p>
            <div className='mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2'>
              <label className='flex items-center gap-2 rounded-lg border border-[var(--text-secondary)]/30 bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)]'>
                <input type='radio' value='email' {...registerInvite('inviteType')} />
                Email
              </label>
              <label className='flex items-center gap-2 rounded-lg border border-[var(--text-secondary)]/30 bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)]'>
                <input type='radio' value='link' {...registerInvite('inviteType')} />
                Enlace
              </label>
            </div>
          </div>

          <div className='bg-[var(--accent-primary)]/5 border-2 border-[var(--accent-primary)]/30 rounded-lg p-3 mb-4'>
            <div className='flex items-start'>
              <Mail className='h-5 w-5 text-[var(--accent-primary)] mr-2 mt-0.5 flex-shrink-0' />
              <div>
                <p className='text-sm text-[var(--text-primary)] font-medium'>
                  {inviteType === 'link' ? 'Invitación por Enlace' : 'Invitación por Email'}
                </p>
                <p className='text-xs text-[var(--text-secondary)] mt-1'>
                  {inviteType === 'link'
                    ? 'Se generará un enlace para compartir. Cualquier usuario con el enlace podrá unirse.'
                    : 'Se enviará un correo de invitación. El usuario deberá aceptarla para unirse al proyecto.'}
                </p>
              </div>
            </div>
          </div>

          {inviteType === 'email' && (
            <Input
              label='Email del Colaborador'
              type='email'
              {...registerInvite('email', {
                validate: (value) => {
                  if (inviteType !== 'email') return true;
                  if (!value) return 'El email es requerido';
                  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value)
                    ? true
                    : 'Email inválido';
                },
              })}
              error={inviteErrors.email?.message}
              placeholder='colaborador@ejemplo.com'
              icon={<Mail className='h-4 w-4' />}
            />
          )}

          {inviteType === 'link' && generatedInviteLink && (
            <div className='bg-[var(--bg-primary)] p-3 rounded-lg border border-[var(--text-secondary)]/20'>
              <p className='text-xs text-[var(--text-secondary)] mb-2'>Enlace generado</p>
              <div className='flex flex-col sm:flex-row gap-2'>
                <Input
                  label=''
                  value={generatedInviteLink}
                  readOnly
                  onChange={() => { }}
                />
                <Button type='button' variant='secondary' onClick={handleCopyInviteLink}>
                  Copiar
                </Button>
              </div>
            </div>
          )}

          <div>
            <label className='block text-sm font-medium text-[var(--text-primary)] mb-2'>
              Rol
            </label>
            <select
              {...registerInvite('role')}
              className='flex w-full rounded-lg border border-[var(--text-secondary)]/30 bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]'
            >
              <option value='Collaborator'>Collaborator</option>
              <option value='Admin'>Admin</option>
              <option value='Viewer'>Viewer</option>
            </select>
          </div>

          <div className='bg-[var(--bg-primary)] p-3 rounded-lg space-y-2'>
            <p className='text-xs font-semibold text-[var(--text-primary)]'>
              Permisos por Rol:
            </p>
            <ul className='text-xs text-[var(--text-secondary)] space-y-1'>
              <li>
                <strong>Admin:</strong> Gestionar proyecto, invitar usuarios,
                crear canales
              </li>
              <li>
                <strong>Collaborator:</strong> Participar en chat, subir recursos,
                crear eventos
              </li>
              <li>
                <strong>Viewer:</strong> Solo ver contenido, sin permisos de
                edición
              </li>
            </ul>
          </div>

          <div className='bg-orange-500/5 border-2 border-orange-500/30 rounded-lg p-3'>
            <div className='flex items-start'>
              <Clock className='h-5 w-5 text-orange-500 mr-2 mt-0.5 flex-shrink-0' />
              <p className='text-xs text-[var(--text-primary)]'>
                La invitación expirará en 7 días si no es aceptada.
              </p>
            </div>
          </div>

          <div className='flex justify-end space-x-2 pt-4'>
            <Button
              type='button'
              variant='secondary'
              onClick={() => {
                setIsInviteModalOpen(false);
                setSelectedProjectForInvite(null);
                setGeneratedInviteLink(null);
                resetInvite();
              }}
            >
              Cancelar
            </Button>
            <Button type='submit' disabled={inviteUserMutation.isPending}>
              {inviteUserMutation.isPending
                ? 'Enviando...'
                : 'Enviar Invitación'}
            </Button>
          </div>
        </form>
      </Modal>
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
