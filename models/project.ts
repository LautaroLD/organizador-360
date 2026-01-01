/**
 * Project Models
 * Tipos relacionados con proyectos
 */

export interface Project {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
  is_premium?: boolean;
  userRole?: string;
  storage_used?: number;
}

export interface ProjectFormData {
  name: string;
  description: string;
}

export interface ProjectStore {
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;
}
export interface Channel {
  id: string
  project_id: string
  name: string
  description: string
  created_by: string
  created_at: string
  updated_at: string
}
export interface Message {
  id: string
  channel_id: string
  user_id: string
  content: string
  created_at: string
  updated_at?: string
  is_pinned?: boolean
  is_deleted?: boolean
  user?: {
    name: string
    email: string
    id: string
  }
}