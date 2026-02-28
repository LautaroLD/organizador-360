export interface ProjectCheckin {
  id: string;
  project_id: string;
  user_id: string;
  checkin_date: string;
  yesterday: string | null;
  today: string | null;
  blockers: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    name: string | null;
    email: string | null;
  } | null;
}

export interface UpsertCheckinDTO {
  project_id: string;
  user_id: string;
  checkin_date: string;
  yesterday: string;
  today: string;
  blockers?: string;
}
