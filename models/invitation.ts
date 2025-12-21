/**
 * Invitation Models
 * Tipos relacionados con invitaciones de miembros
 */

export type MemberRole = 'Admin' | 'Developer' | 'Viewer';

export interface InviteFormData {
  email: string;
  role: MemberRole;
}

export interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: InviteFormData) => void;
  isLoading: boolean;
  projectName?: string;
  currentMemberCount?: number;
  memberLimit?: number;
  isPremium?: boolean;
}
