export type EventEditScope = 'single' | 'all' | 'this_and_following';

export interface EventEditableFields {
  title?: string;
  description?: string;
  start_date?: string;
  start_time?: string;
  end_date?: string;
  end_time?: string;
  recurrence_rule?: 'none' | 'weekly' | 'custom' | null;
  recurrence_days?: string[];
  recurrence_end_date?: string | null;
  is_recurring?: boolean;
  time_zone?: string;
}

export interface EditCalendarEventRequest {
  eventId: string;
  projectId: string;
  scope: EventEditScope;
  applyToGoogle?: boolean;
  checkDuplicateInGoogle?: boolean;
  changes: EventEditableFields;
}

export interface EditCalendarEventResult {
  success: boolean;
  scope: EventEditScope;
  updatedEventIds: string[];
  affectedSeriesId?: string | null;
  google?: {
    attempted: boolean;
    updated: number;
    linked: number;
    created: number;
    errors: number;
  };
  message?: string;
}
