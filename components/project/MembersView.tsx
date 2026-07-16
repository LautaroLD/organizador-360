'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useProjectStore } from '@/store/projectStore';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { toast } from 'react-toastify';
import { Users, UserPlus, Settings, LayoutTemplate } from 'lucide-react';
import { MemberCard } from '@/components/members/MemberCard';
import { InviteMemberModal } from '@/components/members/InviteMemberModal';
import { ManageMemberModal } from '@/components/members/ManageMemberModal';
import { MemberTagsModal } from '@/components/members/MemberTagsModal';
import { ProjectTagsModal } from '@/components/members/ProjectTagsModal';
import { AuditLogPanel } from '@/components/project/AuditLogPanel';
import { Modal } from '@/components/ui/Modal';
import type { TagFormData, Member, ProjectTag, ProjectTemplateId, MemberOnboardingSummary } from '@/models';
import { PostgrestSingleResponse } from '@supabase/supabase-js';
import { useProjectPermissions } from '@/hooks/useProjectPermissions';
import {
  ONBOARDING_TASK_TITLE,
  computeOnboardingProgress,
  listProjectTemplates,
} from '@/lib/projectTemplates';
import clsx from 'clsx';

type InvitationValidationResponse = {
  canAdd: boolean;
  reason?: string;
  currentCount?: number;
  limit?: number | null;
  planTier?: 'free' | 'starter' | 'pro';
  isPremium?: boolean;
};

export const MembersView: React.FC = () => {
  const supabase = createClient();
  const router = useRouter();
  const { currentProject, setCurrentProject } = useProjectStore();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { canManageMembers: canManageByPerms, canInviteMembers, canViewAudit } =
    useProjectPermissions(user?.id);
  const canManageMembers =
    canManageByPerms ||
    currentProject?.userRole === 'Owner' ||
    currentProject?.userRole === 'Admin';

  const { data: isProTeamOps = false } = useQuery({
    queryKey: ['pro-team-ops', currentProject?.id],
    queryFn: async () => {
      if (!currentProject?.id) return false;
      const { data, error } = await supabase.rpc('can_use_project_analytics', {
        p_project_id: currentProject.id,
      });
      if (error) return false;
      return data === true;
    },
    enabled: !!currentProject?.id,
    staleTime: 60_000,
  });

  // State for modals
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isTagManagementOpen, setIsTagManagementOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<ProjectTemplateId | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedMemberForTags, setSelectedMemberForTags] = useState<Member | null>(null);

  // Fetch members with tags directamente desde Supabase (RLS permite visibilidad a todos los miembros)
  const { data: members, isLoading } = useQuery({
    queryKey: ['project-members', currentProject?.id],
    queryFn: async () => {
      if (!currentProject?.id) return [];

      const { data, error } = await supabase
        .from('project_members')
        .select(`
          id,
          user_id,
          role,
          joined_at,
          user:users (
            id,
            name,
            email
          ),
          tags:member_tags (
            id,
            tag_id,
            tag:project_tags (
              id,
              label,
              color
            )
          )
        `)
        .eq('project_id', currentProject.id)
        .order('joined_at', { ascending: true }) as PostgrestSingleResponse<Member[]>;

      if (error) throw error;
      return data;
    },
    enabled: !!currentProject?.id,
  });

  // Fetch project tags
  const { data: projectTags = [] } = useQuery({
    queryKey: ['project-tags', currentProject?.id],
    queryFn: async () => {
      if (!currentProject?.id) return [];

      const { data, error } = await supabase
        .from('project_tags')
        .select('*')
        .eq('project_id', currentProject.id)
        .order('label', { ascending: true });

      if (error) throw error;
      return data as ProjectTag[];
    },
    enabled: !!currentProject?.id,
  });

  const { data: memberValidation, refetch: refetchMemberValidation } = useQuery({
    queryKey: ['member-limit-validation', currentProject?.id],
    queryFn: async (): Promise<InvitationValidationResponse | null> => {
      if (!currentProject?.id || !(canManageMembers || canInviteMembers)) {
        return null;
      }

      const response = await fetch('/api/invitations/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: currentProject.id }),
      });

      if (!response.ok) {
        return null;
      }

      return response.json() as Promise<InvitationValidationResponse>;
    },
    enabled: !!currentProject?.id && (canManageMembers || canInviteMembers),
    staleTime: 30_000,
  });

  const {
    data: templateStatus,
    isSuccess: templateStatusReady,
  } = useQuery({
    queryKey: ['project-template-applied', currentProject?.id],
    queryFn: async () => {
      if (!currentProject?.id) {
        return { applied: false, templateId: null, templateName: null };
      }
      const response = await fetch(
        `/api/projects/${currentProject.id}/apply-template`,
      );
      if (!response.ok) {
        throw new Error('No se pudo consultar la plantilla del proyecto');
      }
      return response.json() as Promise<{
        applied: boolean;
        templateId: ProjectTemplateId | null;
        templateName: string | null;
      }>;
    },
    enabled: !!currentProject?.id && isProTeamOps,
    staleTime: 30_000,
  });

  const hasAppliedTemplate = templateStatus?.applied === true;
  const canShowApplyTemplate =
    canManageMembers &&
    isProTeamOps &&
    templateStatusReady &&
    !hasAppliedTemplate;

  const { data: onboardingByUserId = {} } = useQuery({
    queryKey: ['member-onboarding', currentProject?.id],
    queryFn: async () => {
      if (!currentProject?.id || !isProTeamOps) return {} as Record<string, MemberOnboardingSummary>;

      const { data: tasks, error } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          status,
          done_estimated_at,
          checklist:task_checklist_items(is_completed),
          assignments:task_assignments(user_id)
        `)
        .eq('project_id', currentProject.id)
        .eq('title', ONBOARDING_TASK_TITLE);

      if (error) throw error;

      const map: Record<string, MemberOnboardingSummary> = {};
      for (const task of tasks ?? []) {
        const checklist = (task.checklist ?? []) as Array<{ is_completed: boolean }>;
        const assignments = (task.assignments ?? []) as Array<{ user_id: string }>;
        for (const assignment of assignments) {
          map[assignment.user_id] = computeOnboardingProgress({
            userId: assignment.user_id,
            taskId: task.id,
            status: String(task.status),
            doneEstimatedAt: task.done_estimated_at ?? null,
            checklist,
          });
        }
      }
      return map;
    },
    enabled: !!currentProject?.id && isProTeamOps,
    staleTime: 30_000,
  });

  const applyTemplateMutation = useMutation({
    mutationFn: async (templateId: ProjectTemplateId) => {
      if (!currentProject?.id) throw new Error('Proyecto no seleccionado');
      const response = await fetch(
        `/api/projects/${currentProject.id}/apply-template`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateId }),
        },
      );
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        success?: boolean;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo aplicar la plantilla');
      }
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tags'] });
      queryClient.invalidateQueries({ queryKey: ['project-members'] });
      queryClient.invalidateQueries({ queryKey: ['member-onboarding'] });
      queryClient.invalidateQueries({ queryKey: ['project-template-applied'] });
      queryClient.invalidateQueries({ queryKey: ['project-audit'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      toast.success('Plantilla aplicada al proyecto');
      setIsTemplateModalOpen(false);
      setSelectedTemplateId(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al aplicar plantilla');
    },
  });

  const seedOnboardingMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!currentProject?.id) throw new Error('Proyecto no seleccionado');
      const response = await fetch(
        `/api/projects/${currentProject.id}/members/onboard`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        },
      );
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo iniciar el onboarding');
      }
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members'] });
      queryClient.invalidateQueries({ queryKey: ['member-onboarding'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Onboarding iniciado');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al iniciar onboarding');
    },
  });

  // Change role mutation
  const changeRoleMutation = useMutation({
    mutationFn: async ({ memberId, newRole }: { memberId: string; newRole: string; }) => {
      const { error } = await supabase
        .from('project_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;

      if (currentProject?.id) {
        await fetch(`/api/projects/${currentProject.id}/audit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'member.role_change',
            entityType: 'member',
            entityId: memberId,
            metadata: { new_role: newRole },
          }),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members'] });
      queryClient.invalidateQueries({ queryKey: ['project-audit'] });
      toast.success('Rol actualizado correctamente');
      setSelectedMember(null);
    },
    onError: (error) => {
      toast.error(error.message || 'Error al actualizar rol');
    },
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('project_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      if (currentProject?.id) {
        await fetch(`/api/projects/${currentProject.id}/audit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'member.remove',
            entityType: 'member',
            entityId: memberId,
          }),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members'] });
      queryClient.invalidateQueries({ queryKey: ['project-audit'] });
      toast.success('Miembro eliminado del proyecto');
      setSelectedMember(null);
    },
    onError: (error) => {
      toast.error(error.message || 'Error al eliminar miembro');
    },
  });

  // Create tag mutation
  const createTagMutation = useMutation({
    mutationFn: async (data: TagFormData) => {
      const { error } = await supabase.from('project_tags').insert({
        project_id: currentProject!.id,
        label: data.label,
        color: data.color,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tags'] });
      toast.success('Tag creado exitosamente');
    },
    onError: (error: { code: string; }) => {
      toast.error(
        error.code === '23505'
          ? 'Ya existe un tag con ese nombre en este proyecto'
          : 'Error al crear tag'
      );
    },
  });

  // Update tag mutation
  const updateTagMutation = useMutation({
    mutationFn: async ({ tagId, data }: { tagId: number; data: TagFormData; }) => {
      const { error } = await supabase
        .from('project_tags')
        .update({ label: data.label, color: data.color })
        .eq('id', tagId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tags'] });
      queryClient.invalidateQueries({ queryKey: ['project-members'] });
      toast.success('Tag actualizado exitosamente');
    },
    onError: (error) => {
      toast.error(error.message || 'Error al actualizar tag');
    },
  });

  // Delete tag mutation
  const deleteTagMutation = useMutation({
    mutationFn: async (tagId: number) => {
      const { error } = await supabase.from('project_tags').delete().eq('id', tagId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tags'] });
      queryClient.invalidateQueries({ queryKey: ['project-members'] });
      toast.success('Tag eliminado');
    },
    onError: (error) => {
      toast.error(error.message || 'Error al eliminar tag');
    },
  });

  // Assign tag mutation
  const assignTagMutation = useMutation({
    mutationFn: async ({ memberId, tagId }: { memberId: string; tagId: number; }) => {
      const { error } = await supabase.from('member_tags').insert({
        project_member_id: memberId,
        tag_id: tagId,
      });

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['project-members'] });

      // Actualizar el miembro seleccionado con los nuevos datos
      if (selectedMemberForTags) {
        const updatedMembers = queryClient.getQueryData<Member[]>(['project-members', currentProject?.id]);
        const updatedMember = updatedMembers?.find(m => m.id === selectedMemberForTags.id);
        if (updatedMember) {
          setSelectedMemberForTags(updatedMember);
        }
      }

      toast.success('Tag asignado');
    },
    onError: (error: { code: string; }) => {
      toast.error(
        error.code === '23505'
          ? 'Este tag ya está asignado al miembro'
          : 'Error al asignar tag'
      );
    },
  });

  // Remove tag mutation
  const removeTagMutation = useMutation({
    mutationFn: async ({ memberId, tagId }: { memberId: string; tagId: number; }) => {
      const { error } = await supabase
        .from('member_tags')
        .delete()
        .match({
          project_member_id: memberId,
          tag_id: tagId,
        });

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['project-members'] });

      // Actualizar el miembro seleccionado con los nuevos datos
      if (selectedMemberForTags) {
        const updatedMembers = queryClient.getQueryData<Member[]>(['project-members', currentProject?.id]);
        const updatedMember = updatedMembers?.find(m => m.id === selectedMemberForTags.id);
        if (updatedMember) {
          setSelectedMemberForTags(updatedMember);
        }
      }

      toast.success('Tag removido');
    },
    onError: (error) => {
      toast.error(error.message || 'Error al remover tag');
    },
  });

  const leaveProjectMutation = useMutation({
    mutationFn: async () => {
      if (!currentProject?.id || !user?.id) throw new Error('Proyecto o usuario no válidos');
      const { error } = await supabase
        .from('project_members')
        .delete()
        .match({ project_id: currentProject.id, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Has abandonado el proyecto');
      queryClient.invalidateQueries({ queryKey: ['project-members'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setCurrentProject(null);
      router.push('/dashboard');
    },
    onError: (error) => {
      toast.error(error.message || 'No se pudo abandonar el proyecto');
    },
  });

  const handleLeaveClick = () => {
    if (currentProject?.userRole === 'Owner') {
      toast.error('El Owner no puede abandonar el proyecto');
      return;
    }
    if (confirm('¿Seguro que quieres abandonar este proyecto?')) {
      leaveProjectMutation.mutate();
    }
  };

  const handleInviteClick = async () => {
    if (!currentProject?.id) return;

    try {
      const { data: result } = await refetchMemberValidation();

      if (!result) {
        toast.error('No se pudo validar el límite de miembros');
        return;
      }

      if (!result.canAdd) {
        toast.error(result.reason || 'No se puede agregar más miembros');
        return;
      }

      setIsInviteModalOpen(true);
    } catch (error) {
      console.error('Error validating invitation:', error);
      toast.error('Error al validar invitación');
    }
  };

  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-full p-12'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent-primary)] mx-auto mb-4'></div>
          <p className='text-[var(--text-secondary)]'>Cargando miembros...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='flex-1 overflow-y-auto'>
      <div className='p-4 md:p-6'>
        <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6'>
          <div>
            <h2 className='text-xl md:text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2'>
              <Users className='h-5 w-5 md:h-6 md:w-6' />
              Miembros del Proyecto
            </h2>
            <p className='text-sm md:text-base text-[var(--text-secondary)] mt-1'>
              { members?.length || 0 } miembro(s) en el equipo
              { memberValidation?.limit !== undefined && memberValidation?.limit !== null && (
                <span
                  className={ `ml-2 text-xs font-medium ${(memberValidation.planTier ?? 'free') === 'free'
                      ? 'text-orange-500'
                      : 'text-[var(--accent-primary)]'
                    }` }
                >
                  { `Plan ${(memberValidation.planTier ?? 'free').toUpperCase()}: máx. ${memberValidation.limit} miembros` }
                </span>
              ) }
            </p>
          </div>
          <div className='flex flex-col sm:flex-row gap-2 w-full sm:w-auto'>
            { canShowApplyTemplate && (
              <Button
                variant='secondary'
                onClick={ () => setIsTemplateModalOpen(true) }
                className='w-full sm:w-auto'
              >
                <LayoutTemplate className='h-4 w-4 mr-2' />
                Aplicar plantilla
              </Button>
            ) }
            { canManageMembers && (
              <Button
                variant='secondary'
                onClick={ () => setIsTagManagementOpen(true) }
                className='w-full sm:w-auto'
              >
                <Settings className='h-4 w-4 mr-2' />
                Gestionar Tags
              </Button>
            ) }
            { (canManageMembers || canInviteMembers) && (
              <Button
                onClick={ handleInviteClick }
                className='w-full sm:w-auto'
              >
                <UserPlus className='h-4 w-4 mr-2' />
                Invitar Miembro
              </Button>
            ) }
            { currentProject?.userRole !== 'Owner' && (
              <Button
                variant='danger'
                onClick={ handleLeaveClick }
                className='w-full sm:w-auto'
              >
                Abandonar Proyecto
              </Button>
            ) }
          </div>

        </div>

        {/* Members Grid */ }
        { members && members.length > 0 ? (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-6'>
            { members.map((member) => (
              <div key={ member.id } className='space-y-2'>
                <MemberCard
                  member={ member }
                  currentUserId={ user?.id }
                  canManage={ canManageMembers }
                  onManageClick={ setSelectedMember }
                  onManageTags={ setSelectedMemberForTags }
                  onboarding={ onboardingByUserId[member.user_id] ?? null }
                />
                { canManageMembers &&
                  isProTeamOps &&
                  member.role !== 'Owner' &&
                  !onboardingByUserId[member.user_id] && (
                    <Button
                      variant='ghost'
                      size='sm'
                      className='w-full text-xs'
                      disabled={ seedOnboardingMutation.isPending }
                      onClick={ () => seedOnboardingMutation.mutate(member.user_id) }
                    >
                      Iniciar onboarding 7 días
                    </Button>
                  ) }
              </div>
            )) }
          </div>
        ) : (
          <div className='text-center py-12 md:py-16'>
            <div className='bg-[var(--accent-primary)]/10 w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6'>
              <Users className='h-10 w-10 md:h-12 md:w-12 text-[var(--accent-primary)]' />
            </div>
            <h3 className='text-lg md:text-xl font-semibold text-[var(--text-primary)] mb-2'>
              No hay miembros aún
            </h3>
            <p className='text-sm md:text-base text-[var(--text-secondary)] mb-6 max-w-md mx-auto px-4'>
              Invita a colaboradores para comenzar a trabajar en equipo
            </p>
            { (canManageMembers || canInviteMembers) && (
              <Button onClick={ handleInviteClick } size='lg'>
                <UserPlus className='h-5 w-5 mr-2' />
                Invitar primer miembro
              </Button>
            ) }
          </div>
        ) }

        <AuditLogPanel
          projectId={ currentProject?.id ?? '' }
          enabled={
            !!currentProject?.id &&
            isProTeamOps &&
            (canViewAudit || canManageMembers)
          }
        />
      </div>

      {/* Modals */ }
      <InviteMemberModal
        isOpen={ isInviteModalOpen }
        onClose={ () => setIsInviteModalOpen(false) }
        projectId={ currentProject?.id ?? null }
        projectName={ currentProject?.name }
        currentMemberCount={ members?.length }
        memberLimit={ memberValidation?.limit ?? undefined }
        isPremium={ memberValidation?.isPremium ?? false }
        planTier={ memberValidation?.planTier ?? 'free' }
        onSuccess={ () => {
          queryClient.invalidateQueries({ queryKey: ['project-members'] });
          queryClient.invalidateQueries({ queryKey: ['project-audit'] });
        } }
      />

      <ManageMemberModal
        member={ selectedMember }
        onClose={ () => setSelectedMember(null) }
        onChangeRole={ (memberId, newRole) => changeRoleMutation.mutate({ memberId, newRole }) }
        onRemove={ (memberId) => removeMemberMutation.mutate(memberId) }
        isLoading={ changeRoleMutation.isPending || removeMemberMutation.isPending }
        projectId={ currentProject?.id }
        canEditPermissions={ canManageMembers && isProTeamOps }
      />

      <MemberTagsModal
        member={ selectedMemberForTags }
        projectTags={ projectTags }
        onClose={ () => setSelectedMemberForTags(null) }
        onAssignTag={ (memberId, tagId) => assignTagMutation.mutate({ memberId, tagId }) }
        onRemoveTag={ (memberId, tagId) => removeTagMutation.mutate({ memberId, tagId }) }
      />

      <ProjectTagsModal
        isOpen={ isTagManagementOpen }
        onClose={ () => setIsTagManagementOpen(false) }
        tags={ projectTags }
        onCreateTag={ (data) => createTagMutation.mutate(data) }
        onUpdateTag={ (tagId, data) => updateTagMutation.mutate({ tagId, data }) }
        onDeleteTag={ (tagId) => deleteTagMutation.mutate(tagId) }
        isLoading={
          createTagMutation.isPending ||
          updateTagMutation.isPending ||
          deleteTagMutation.isPending
        }
      />

      <Modal
        isOpen={ isTemplateModalOpen }
        onClose={ () => {
          setIsTemplateModalOpen(false);
          setSelectedTemplateId(null);
        } }
        title='Aplicar plantilla de equipo'
        size='lg'
      >
        <div className='space-y-4'>
          <p className='text-sm text-[var(--text-secondary)]'>
            Agrega canales, tags de rol y tareas iniciales según el tipo de equipo.
            Los miembros existentes reciben tags según su rol.
          </p>
          <div className='grid gap-2 sm:grid-cols-3'>
            { listProjectTemplates().map((template) => (
              <button
                key={ template.id }
                type='button'
                onClick={ () => setSelectedTemplateId(template.id) }
                className={ clsx(
                  'rounded-xl border p-3 text-left transition-colors',
                  selectedTemplateId === template.id
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                    : 'border-[var(--text-secondary)]/20 hover:border-[var(--accent-primary)]/40',
                ) }
              >
                <p className='text-sm font-medium text-[var(--text-primary)]'>
                  { template.name }
                </p>
                <p className='text-xs text-[var(--text-secondary)] mt-1 line-clamp-3'>
                  { template.description }
                </p>
              </button>
            )) }
          </div>
          <div className='flex justify-end gap-2 pt-2'>
            <Button
              variant='secondary'
              onClick={ () => {
                setIsTemplateModalOpen(false);
                setSelectedTemplateId(null);
              } }
            >
              Cancelar
            </Button>
            <Button
              disabled={ !selectedTemplateId || applyTemplateMutation.isPending }
              onClick={ () => {
                if (selectedTemplateId) {
                  applyTemplateMutation.mutate(selectedTemplateId);
                }
              } }
            >
              { applyTemplateMutation.isPending ? 'Aplicando...' : 'Aplicar plantilla' }
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
