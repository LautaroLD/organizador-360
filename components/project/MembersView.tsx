'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useProjectStore } from '@/store/projectStore';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { toast } from 'react-toastify';
import { Users, UserPlus, Settings, Crown } from 'lucide-react';
import { MemberCard } from '@/components/members/MemberCard';
import { InviteMemberModal } from '@/components/members/InviteMemberModal';
import { ManageMemberModal } from '@/components/members/ManageMemberModal';
import { MemberTagsModal } from '@/components/members/MemberTagsModal';
import { ProjectTagsModal } from '@/components/members/ProjectTagsModal';
import type { InviteFormData, TagFormData, Member, ProjectTag } from '@/models';
import { PostgrestSingleResponse } from '@supabase/supabase-js';

export const MembersView: React.FC = () => {
  const supabase = createClient();
  const router = useRouter();
  const { currentProject, setCurrentProject } = useProjectStore();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  // State for modals
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isTagManagementOpen, setIsTagManagementOpen] = useState(false);
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

  // Check subscription limits
  const { data: subscriptionInfo } = useQuery({
    queryKey: ['subscription-limits', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase.rpc('is_premium_user', {
        p_user_id: user.id,
      });

      if (error) {
        console.error('Error checking premium status:', error);
        return { isPremium: false };
      }

      return { isPremium: data as boolean };
    },
    enabled: !!user?.id,
  });

  // Invite user mutation
  const inviteUserMutation = useMutation({
    mutationFn: async (data: InviteFormData) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) throw new Error('No estás autenticado');

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-invitation`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projectId: currentProject?.id,
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
      queryClient.invalidateQueries({ queryKey: ['project-members'] });
      toast.success(
        data.isNewUser
          ? '¡Invitación enviada! El usuario deberá crear una cuenta primero.'
          : '¡Invitación enviada! El usuario recibirá un email para aceptarla.'
      );
      setIsInviteModalOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Error al enviar invitación');
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members'] });
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members'] });
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

  const canManageMembers =
    currentProject?.userRole === 'Owner' || currentProject?.userRole === 'Admin';

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
      const response = await fetch('/api/invitations/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: currentProject.id }),
      });

      const result = await response.json();

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
              {members?.length || 0} miembro(s) en el equipo
              {!currentProject?.is_premium && (
                <span className='ml-2 text-xs text-orange-500 font-medium'>
                  (Plan FREE: máx. 10 miembros)
                </span>
              )}
              {currentProject?.is_premium && (
                <span className='ml-2 text-xs text-[var(--accent-primary)] font-medium inline-flex items-center gap-1'>
                  <Crown className='h-3 w-3' /> PRO - máx. 20 miembros
                </span>
              )}
            </p>
          </div>
          <div className='flex flex-col sm:flex-row gap-2 w-full sm:w-auto'>
            {canManageMembers && (
              <Button
                variant='secondary'
                onClick={() => setIsTagManagementOpen(true)}
                className='w-full sm:w-auto'
              >
                <Settings className='h-4 w-4 mr-2' />
                Gestionar Tags
              </Button>
            )}
            {canManageMembers && (
              <Button
                onClick={handleInviteClick}
                className='w-full sm:w-auto'
              >
                <UserPlus className='h-4 w-4 mr-2' />
                Invitar Miembro
              </Button>
            )}
            {currentProject?.userRole !== 'Owner' && (
              <Button
                variant='danger'
                onClick={handleLeaveClick}
                className='w-full sm:w-auto'
              >
                Abandonar Proyecto
              </Button>
            )}
          </div>

        </div>

        {/* Members Grid */}
        {members && members.length > 0 ? (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-6'>
            {members.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                currentUserId={user?.id}
                canManage={canManageMembers}
                onManageClick={setSelectedMember}
                onManageTags={setSelectedMemberForTags}
              />
            ))}
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
            {canManageMembers && (
              <Button onClick={handleInviteClick} size='lg'>
                <UserPlus className='h-5 w-5 mr-2' />
                Invitar primer miembro
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onSubmit={(data) => inviteUserMutation.mutate(data)}
        isLoading={inviteUserMutation.isPending}
        projectName={currentProject?.name}
        currentMemberCount={members?.length}
        memberLimit={!subscriptionInfo?.isPremium ? 10 : undefined}
        isPremium={subscriptionInfo?.isPremium}
      />

      <ManageMemberModal
        member={selectedMember}
        onClose={() => setSelectedMember(null)}
        onChangeRole={(memberId, newRole) => changeRoleMutation.mutate({ memberId, newRole })}
        onRemove={(memberId) => removeMemberMutation.mutate(memberId)}
        isLoading={changeRoleMutation.isPending || removeMemberMutation.isPending}
      />

      <MemberTagsModal
        member={selectedMemberForTags}
        projectTags={projectTags}
        onClose={() => setSelectedMemberForTags(null)}
        onAssignTag={(memberId, tagId) => assignTagMutation.mutate({ memberId, tagId })}
        onRemoveTag={(memberId, tagId) => removeTagMutation.mutate({ memberId, tagId })}
      />

      <ProjectTagsModal
        isOpen={isTagManagementOpen}
        onClose={() => setIsTagManagementOpen(false)}
        tags={projectTags}
        onCreateTag={(data) => createTagMutation.mutate(data)}
        onUpdateTag={(tagId, data) => updateTagMutation.mutate({ tagId, data })}
        onDeleteTag={(tagId) => deleteTagMutation.mutate(tagId)}
        isLoading={
          createTagMutation.isPending ||
          updateTagMutation.isPending ||
          deleteTagMutation.isPending
        }
      />
    </div>
  );
};
