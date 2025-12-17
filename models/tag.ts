/**
 * Tag Models
 * Tipos relacionados con tags de proyecto y formularios de tags
 */

import type { MemberTag } from './member';

export interface ProjectTag {
  id: number;
  project_id: string;
  label: string;
  color: string;
}

export interface TagFormData {
  label: string;
  color: string;
}

export interface ProjectTagsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tags: ProjectTag[];
  onCreateTag: (data: TagFormData) => void;
  onUpdateTag: (tagId: number, data: TagFormData) => void;
  onDeleteTag: (tagId: number, tagLabel: string) => void;
  isLoading: boolean;
}

export interface MemberTagsModalMember {
  id: string;
  user: {
    name: string;
  };
  tags?: Array<{
    tag: MemberTag;
  }>;
}

export interface MemberTagsModalProps {
  member: MemberTagsModalMember | null;
  projectTags: ProjectTag[];
  onClose: () => void;
  onAssignTag: (memberId: string, tagId: number) => void;
  onRemoveTag: (memberId: string, tagId: number) => void;
}
