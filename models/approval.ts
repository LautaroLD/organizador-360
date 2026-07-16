export type ApprovalEntityType = 'task' | 'resource';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'blocked';

export interface ApprovalRequest {
  id: string;
  project_id: string;
  entity_type: ApprovalEntityType;
  entity_id: string;
  requester_id: string;
  reviewer_id: string;
  status: ApprovalStatus;
  request_note?: string | null;
  resolution_note?: string | null;
  created_at: string;
  resolved_at?: string | null;
  resolved_by?: string | null;
  project?: {
    name?: string | null;
  } | null;
  requester?: {
    id?: string;
    name?: string | null;
    email?: string | null;
  } | null;
  reviewer?: {
    id?: string;
    name?: string | null;
    email?: string | null;
  } | null;
  entity_title?: string | null;
}

export interface CreateApprovalDTO {
  projectId: string;
  entityType: ApprovalEntityType;
  entityId: string;
  reviewerId: string;
  requestNote?: string;
}

export interface ResolveApprovalDTO {
  status: Exclude<ApprovalStatus, 'pending'>;
  resolutionNote?: string;
}
