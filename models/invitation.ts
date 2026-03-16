/**
 * Invitation Models
 * Tipos relacionados con invitaciones de miembros
 */

export type MemberRole = 'Admin' | 'Collaborator' | 'Viewer';
export type InviteType = 'email' | 'link';

export interface InviteFormData {
  inviteType: InviteType;
  email?: string;
  role: MemberRole;
}

export interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string | null;
  projectName?: string;
  currentMemberCount?: number;
  memberLimit?: number;
  isPremium?: boolean;
  planTier?: 'free' | 'starter' | 'pro' | 'enterprise';
  onSuccess?: () => void;
}
