'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
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
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { ProjectFormData, InviteFormData, Project } from '@/models';

export const ProjectsView: React.FC = () => {
  const supabase = createClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [selectedProjectForInvite, setSelectedProjectForInvite] =
    useState<Project | null>(null);
  const { user } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ProjectFormData>();

  const {
    register: registerInvite,
    handleSubmit: handleSubmitInvite,
    formState: { errors: inviteErrors },
    reset: resetInvite,
  } = useForm<InviteFormData>({
    defaultValues: {
      role: 'Developer',
    },
  });

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

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      // 1. OBTENER ESTADO DE SUSCRIPCIÓN Y CONTEO ACTUAL
      // Consultamos los proyectos del usuario y su estado premium en paralelo
      const [projectsCountRes, subscriptionRes] = await Promise.all([
        supabase
          .from('projects')
          .select('*', { count: 'exact', head: true })
          .eq('owner_id', user!.id),
        supabase
          .from('subscriptions')
          .select('status,cancel_at_period_end,current_period_end,canceled_at')
          .eq('user_id', user!.id)
          .maybeSingle()
      ]);

      // Validar errores en las queries
      if (projectsCountRes.error) {
        throw new Error(`Error al verificar proyectos: ${projectsCountRes.error.message}`);
      }
      if (subscriptionRes.error && subscriptionRes.error.code !== 'PGRST116') {
        // PGRST116 = no rows returned, es esperado para nuevos usuarios
        throw new Error(`Error al verificar suscripción: ${subscriptionRes.error.message}`);
      }

      const sub = subscriptionRes.data;
      const now = new Date();
      const currentPeriodEnd = sub?.current_period_end ? new Date(sub.current_period_end) : null;
      const isPremium = !!sub && (
        (['active', 'trialing', 'past_due'].includes(sub.status ?? '') &&
          (
            sub.cancel_at_period_end !== true ||
            (currentPeriodEnd && now < currentPeriodEnd)
          ))
      );
      const currentProjects = projectsCountRes.count || 0;

      // 2. LÓGICA DE NEGOCIO: Límite de 3 proyectos para usuarios gratuitos
      if (!isPremium && currentProjects >= 3) {
        throw new Error('Has alcanzado el límite de 3 proyectos. Actualiza a Pro para crear proyectos ilimitados.');
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

      // Inserciones en paralelo para optimizar tiempo
      const [memberRes, channelRes] = await Promise.all([
        supabase.from('project_members').insert({
          project_id: project.id,
          user_id: user!.id,
          role: 'Owner',
        }),
        supabase.from('channels').insert({
          project_id: project.id,
          name: 'general',
          description: 'Canal general del proyecto',
          created_by: user!.id,
        })
      ]);

      if (memberRes.error) throw memberRes.error;
      if (channelRes.error) throw channelRes.error;

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
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No estás autenticado');
      }

      // Call Edge Function to send invitation email
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-invitation`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projectId: selectedProjectForInvite?.id,
            inviteeEmail: data.email,
            role: data.role,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error al enviar invitación');
      }

      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      if (data.isNewUser) {
        toast.success('¡Invitación enviada! El usuario deberá crear una cuenta primero.', {
          autoClose: 5000
        });
      } else {
        toast.success('¡Invitación enviada! El usuario recibirá un email para aceptarla.');
      }
      setIsInviteModalOpen(false);
      setSelectedProjectForInvite(null);
      resetInvite();
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
    setIsInviteModalOpen(true);
  };

  const selectProject = (projectId: string) => {
    router.push(`/projects/${projectId}`);
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
    <div className='p-6'>
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
              className='cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] group'
              onClick={() => selectProject(project.id)}
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
                    <span className='text-xs text-[var(--text-secondary)]'>
                      {formatDate(project.created_at)}
                    </span>
                  </div>
                </div>
                <CardTitle className='mt-3 flex items-center justify-between'>
                  {project.name}
                  <ArrowRight className='h-5 w-5 text-[var(--text-secondary)] group-hover:text-[var(--accent-primary)] transition-colors group-hover:translate-x-1 transition-transform' />
                </CardTitle>
                <CardDescription className='line-clamp-2'>
                  {project.description || 'Sin descripción'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className='flex items-center justify-between text-sm text-[var(--text-secondary)] mb-3'>
                  <div className='flex items-center'>
                    <Users className='h-4 w-4 mr-1' />
                    {project.members.length} Colaboradores
                  </div>
                </div>
                {(project.userRole === 'Owner' || project.userRole === 'Admin') && (
                  <Button
                    variant='secondary'
                    size='sm'
                    className='w-full'
                    onClick={(e) => handleInviteClick(project, e)}
                  >
                    <UserPlus className='h-4 w-4 mr-2' />
                    Invitar Colaborador
                  </Button>
                )}
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
              Descripción
            </label>
            <textarea
              {...register('description')}
              className='flex w-full rounded-lg border border-[var(--text-secondary)]/30 bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] resize-none'
              rows={4}
              placeholder='Describe tu proyecto...'
            />
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

          <div className='bg-[var(--accent-primary)]/5 border-2 border-[var(--accent-primary)]/30 rounded-lg p-3 mb-4'>
            <div className='flex items-start'>
              <Mail className='h-5 w-5 text-[var(--accent-primary)] mr-2 mt-0.5 flex-shrink-0' />
              <div>
                <p className='text-sm text-[var(--text-primary)] font-medium'>
                  Invitación por Email
                </p>
                <p className='text-xs text-[var(--text-secondary)] mt-1'>
                  Se enviará un correo de invitación. El usuario deberá aceptarla para unirse al proyecto.
                </p>
              </div>
            </div>
          </div>

          <Input
            label='Email del Colaborador'
            type='email'
            {...registerInvite('email', {
              required: 'El email es requerido',
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: 'Email inválido',
              },
            })}
            error={inviteErrors.email?.message}
            placeholder='colaborador@ejemplo.com'
            icon={<Mail className='h-4 w-4' />}
          />

          <div>
            <label className='block text-sm font-medium text-[var(--text-primary)] mb-2'>
              Rol
            </label>
            <select
              {...registerInvite('role')}
              className='flex w-full rounded-lg border border-[var(--text-secondary)]/30 bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]'
            >
              <option value='Developer'>Developer</option>
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
                <strong>Developer:</strong> Participar en chat, subir recursos,
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
    </div>
  );
};
