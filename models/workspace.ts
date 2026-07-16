/**
 * Workspace / Team Directory models (PRO)
 */

export type Workspace = {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
};

export type WorkspaceMember = {
  id: string;
  workspace_id: string;
  user_id: string | null;
  email: string;
  display_name: string | null;
  org_role: string | null;
  skills: string[];
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar_url?: string | null;
  } | null;
  /** Project IDs within the workspace where this person is already a member */
  activeProjectIds?: string[];
};

export type WorkspaceProject = {
  id: string;
  workspace_id: string;
  project_id: string;
  added_at: string;
  project?: {
    id: string;
    name: string;
    description: string | null;
    enabled: boolean;
    owner_id: string;
  } | null;
};

export type CreateWorkspaceMemberDTO = {
  email: string;
  displayName?: string | null;
  orgRole?: string | null;
  skills?: string[];
  userId?: string | null;
};

export type UpdateWorkspaceMemberDTO = {
  displayName?: string | null;
  orgRole?: string | null;
  skills?: string[];
};

export type AssignMemberToProjectsDTO = {
  projectIds: string[];
  role?: 'Admin' | 'Collaborator' | 'Viewer';
};

export type WorkspaceHomeTask = {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  done_estimated_at: string | null;
  project_id: string;
  project_name: string;
  is_overdue: boolean;
  assignee_ids: string[];
};

export type WorkspaceHomeEvent = {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  project_id: string;
  project_name: string;
};

export type WorkspaceProjectRisk = {
  projectId: string;
  projectName: string;
  severity: 'warning' | 'danger' | 'info';
  title: string;
  detail: string;
};

export type WorkspaceHomeSnapshot = {
  myOpenTasks: WorkspaceHomeTask[];
  teamOpenTasks: WorkspaceHomeTask[];
  upcomingEvents: WorkspaceHomeEvent[];
  risks: WorkspaceProjectRisk[];
  stats: {
    linkedProjects: number;
    directoryMembers: number;
    myOpenCount: number;
    teamOpenCount: number;
    overdueCount: number;
    riskCount: number;
  };
};

export type WorkspaceBundle = {
  workspace: Workspace;
  members: WorkspaceMember[];
  projects: WorkspaceProject[];
  isPro: boolean;
};
