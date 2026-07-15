/**
 * Member Models
 * Tipos relacionados con miembros del proyecto y sus tags
 */

export interface MemberTag {
  id: number;
  label: string;
  color: string;
}

export interface MemberTagAssociation {
  id: number;
  tag_id: number;
  tag: MemberTag;
}

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Member {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  user: User | null;
  tags?: MemberTagAssociation[];
}

export interface MemberOnboardingSummary {
  percent: number;
  completedItems: number;
  totalItems: number;
  isOverdue: boolean;
  dueAt: string | null;
  taskId: string;
}

export interface MemberCardProps {
  member: Member;
  currentUserId?: string;
  canManage: boolean;
  onManageClick: (member: Member) => void;
  onManageTags: (member: Member) => void;
  onboarding?: MemberOnboardingSummary | null;
}

export interface ManageMemberModalProps {
  member: Member | null;
  onClose: () => void;
  onChangeRole: (memberId: string, newRole: string) => void;
  onRemove: (memberId: string, memberName: string) => void;
  isLoading: boolean;
  projectId?: string | null;
  canEditPermissions?: boolean;
}
