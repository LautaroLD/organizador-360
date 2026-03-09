export type OkrCycle = 'quarterly' | 'half-year' | 'yearly' | 'custom';
export type OkrStatus = 'draft' | 'active' | 'completed' | 'archived';
export type OkrKeyResultTrackingMode = 'manual' | 'auto_from_epics' | 'auto_from_tasks';

export interface OkrObjective {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  owner_id: string | null;
  cycle: OkrCycle;
  start_date: string | null;
  end_date: string | null;
  status: OkrStatus;
  created_at: string;
  updated_at: string;
}

export interface OkrKeyResult {
  id: string;
  objective_id: string;
  project_id: string;
  title: string;
  description: string | null;
  metric_name: string | null;
  start_value: number;
  target_value: number;
  current_value: number;
  unit: string | null;
  tracking_mode: OkrKeyResultTrackingMode;
  created_at: string;
  updated_at: string;
}

export interface Epic {
  id: string;
  project_id: string;
  objective_id: string;
  key_result_id: string | null;
  title: string;
  description: string | null;
  status: 'todo' | 'in-progress' | 'done';
  color: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateObjectiveDTO {
  project_id: string;
  title: string;
  description?: string | null;
  cycle?: OkrCycle;
  start_date?: string | null;
  end_date?: string | null;
  status?: OkrStatus;
}

export interface CreateKeyResultDTO {
  objective_id: string;
  project_id: string;
  title: string;
  description?: string | null;
  metric_name?: string | null;
  start_value?: number;
  target_value: number;
  current_value?: number;
  unit?: string | null;
  tracking_mode?: OkrKeyResultTrackingMode;
}

export interface CreateEpicDTO {
  project_id: string;
  objective_id: string;
  key_result_id?: string | null;
  title: string;
  description?: string | null;
  status?: 'todo' | 'in-progress' | 'done';
  color?: string;
}
