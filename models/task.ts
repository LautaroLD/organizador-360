import type { ProjectTag } from './tag';

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in-progress' | 'done';
  position: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
  assignments?: TaskAssignment[];
  checklist?: TaskChecklistItem[];
  tags?: TaskTagAssociation[];
  images?: TaskImage[];
}

export interface TaskImage {
  id: string;
  task_id: string;
  url: string;
  file_name: string;
  file_size?: number;
  uploaded_by?: string;
  created_at: string;
}

export interface TaskTagAssociation {
  id: number;
  tag_id: number;
  tag: ProjectTag;
}

export interface TaskChecklistItem {
  id: string;
  task_id: string;
  content: string;
  is_completed: boolean;
  position: number;
  created_at: string;
}

export interface TaskAssignment {
  task_id: string;
  user_id: string;
  created_at: string;
  user?: {
    id: string;
    email: string;
    name?: string;
    avatar_url?: string;
  };
}

export interface CreateTaskDTO {
  project_id: string;
  title: string;
  description?: string;
  status?: 'todo' | 'in-progress' | 'done';
  position?: number;
  assigned_to?: string[]; // Array of user IDs
  tags?: number[]; // Array of tag IDs
  checklist?: Array<{ content: string; is_completed: boolean; }>;
  images?: File[]; // Array of image files to upload
}

export interface UpdateTaskDTO {
  title?: string;
  description?: string;
  status?: 'todo' | 'in-progress' | 'done';
  position?: number;
  assigned_to?: string[]; // Array of user IDs to replace current assignments
  tags?: number[]; // Array of tag IDs to replace current tags
}
