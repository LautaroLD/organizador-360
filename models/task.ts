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
}

export interface UpdateTaskDTO {
  title?: string;
  description?: string;
  status?: 'todo' | 'in-progress' | 'done';
  position?: number;
  assigned_to?: string[]; // Array of user IDs to replace current assignments
}
