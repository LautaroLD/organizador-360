/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { PATCH } from '@/app/api/google/sync/route';

type Row = Record<string, unknown>;

type Filter = {
  type: 'eq' | 'lt' | 'in';
  column: string;
  value: unknown;
};

type DbState = {
  projects: Row[];
  project_members: Row[];
  events: Row[];
  google_calendar_tokens: Row[];
};

let dbState: DbState;

const applyFilters = (rows: Row[], filters: Filter[]) => {
  return rows.filter((row) =>
    filters.every((filter) => {
      const rowValue = row[filter.column];
      if (filter.type === 'eq') return rowValue === filter.value;
      if (filter.type === 'lt') {
        if (typeof rowValue !== 'string' || typeof filter.value !== 'string') {
          return false;
        }
        return rowValue < filter.value;
      }
      if (filter.type === 'in') {
        if (!Array.isArray(filter.value)) return false;
        return filter.value.includes(rowValue);
      }
      return false;
    }),
  );
};

class SelectQuery {
  private table: keyof DbState;
  private filters: Filter[] = [];
  private orderBy: { column: string; ascending: boolean } | null = null;

  constructor(table: keyof DbState) {
    this.table = table;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ type: 'eq', column, value });
    return this;
  }

  lt(column: string, value: unknown) {
    this.filters.push({ type: 'lt', column, value });
    return this;
  }

  in(column: string, value: unknown[]) {
    this.filters.push({ type: 'in', column, value });
    const rows = this.resolveRows();
    return Promise.resolve({ data: rows, error: null });
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: opts?.ascending !== false };
    const rows = this.resolveRows();
    return Promise.resolve({ data: rows, error: null });
  }

  limit(_count: number) {
    return this;
  }

  maybeSingle() {
    const rows = this.resolveRows();
    return Promise.resolve({ data: rows[0] || null, error: null });
  }

  single() {
    const rows = this.resolveRows();
    return Promise.resolve({ data: rows[0] || null, error: null });
  }

  private resolveRows() {
    let rows = applyFilters(dbState[this.table], this.filters);
    if (this.orderBy) {
      rows = [...rows].sort((a, b) => {
        const av = String(a[this.orderBy!.column] || '');
        const bv = String(b[this.orderBy!.column] || '');
        return this.orderBy!.ascending
          ? av.localeCompare(bv)
          : bv.localeCompare(av);
      });
    }
    return rows.map((row) => ({ ...row }));
  }
}

class UpdateQuery {
  private table: keyof DbState;
  private payload: Row;
  private filters: Filter[] = [];

  constructor(table: keyof DbState, payload: Row) {
    this.table = table;
    this.payload = payload;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ type: 'eq', column, value });
    return this;
  }

  lt(column: string, value: unknown) {
    this.filters.push({ type: 'lt', column, value });
    return this;
  }

  in(column: string, value: unknown[]) {
    this.filters.push({ type: 'in', column, value });
    return this;
  }

  select() {
    return this;
  }

  single() {
    const updated = this.apply();
    return Promise.resolve({ data: updated[0] || null, error: null });
  }

  then<TResult1 = { data: null; error: null }, TResult2 = never>(
    onfulfilled?:
      | ((value: {
          data: null;
          error: null;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    this.apply();
    return Promise.resolve({ data: null, error: null }).then(
      onfulfilled,
      onrejected,
    );
  }

  private apply() {
    const rows = dbState[this.table];
    const matches = applyFilters(rows, this.filters);

    const updated: Row[] = [];
    for (const match of matches) {
      const index = rows.findIndex((row) => row.id === match.id);
      if (index >= 0) {
        rows[index] = {
          ...rows[index],
          ...this.payload,
        };
        updated.push({ ...rows[index] });
      }
    }

    return updated;
  }
}

class InsertQuery {
  private table: keyof DbState;
  private payload: Row | Row[];

  constructor(table: keyof DbState, payload: Row | Row[]) {
    this.table = table;
    this.payload = payload;
  }

  select() {
    return this;
  }

  single() {
    const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
    const inserted = rows.map((row) => {
      const withId = {
        id: (row.id as string) || `gen-${Math.random().toString(36).slice(2, 8)}`,
        ...row,
      };
      dbState[this.table].push(withId);
      return { ...withId };
    });
    return Promise.resolve({ data: inserted[0] || null, error: null });
  }
}

class DeleteQuery {
  private table: keyof DbState;
  private filters: Filter[] = [];

  constructor(table: keyof DbState) {
    this.table = table;
  }

  in(column: string, value: unknown[]) {
    this.filters.push({ type: 'in', column, value });
    const matches = applyFilters(dbState[this.table], this.filters);
    dbState[this.table] = dbState[this.table].filter(
      (row) => !matches.some((m) => m.id === row.id),
    );
    return Promise.resolve({ data: null, error: null });
  }

  eq(column: string, value: unknown) {
    this.filters.push({ type: 'eq', column, value });
    return this;
  }
}

const mockFrom = jest.fn((table: keyof DbState) => ({
  select: jest.fn(() => new SelectQuery(table)),
  update: jest.fn((payload: Row) => new UpdateQuery(table, payload)),
  insert: jest.fn((payload: Row | Row[]) => new InsertQuery(table, payload)),
  delete: jest.fn(() => new DeleteQuery(table)),
}));

jest.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...(args as [keyof DbState])),
  },
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: {
      getSession: async () => ({
        data: {
          session: null,
        },
      }),
      getUser: async () => ({
        data: {
          user: { id: 'user-1' },
        },
        error: null,
      }),
    },
  })),
}));

jest.mock('@/lib/subscriptionUtils', () => ({
  canUseAIFeatures: jest.fn(async () => true),
}));

const mockGoogleService = {
  createEvent: jest.fn(),
  updateEvent: jest.fn(),
  getEvent: jest.fn(),
  listEventInstances: jest.fn(),
  patchEvent: jest.fn(),
  findEventByPrivateProperty: jest.fn(),
  getEvents: jest.fn(),
  deleteEvent: jest.fn(),
  verifyTokens: jest.fn(),
};

jest.mock('@/lib/googleCalendar', () => ({
  GoogleCalendarService: jest.fn().mockImplementation(() => mockGoogleService),
}));

describe('PATCH /api/google/sync (Option 3: 1 master + excepciones)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGoogleService.createEvent.mockResolvedValue({ id: 'gcal-new-1' });
    mockGoogleService.updateEvent.mockResolvedValue({ id: 'gcal-master-1' });
    mockGoogleService.getEvent.mockResolvedValue({
      id: 'gcal-master-1',
      start: { timeZone: 'UTC' },
      recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20260831T235959Z'],
    });
    mockGoogleService.listEventInstances.mockResolvedValue([
      {
        id: 'gcal-master-1_20260727T090000Z',
        originalStartTime: { dateTime: '2026-07-27T09:00:00Z' },
        start: { dateTime: '2026-07-27T09:00:00Z', timeZone: 'UTC' },
      },
    ]);
    mockGoogleService.patchEvent.mockResolvedValue({
      id: 'gcal-master-1_20260727T090000Z',
    });
    mockGoogleService.findEventByPrivateProperty.mockResolvedValue(null);

    dbState = {
      projects: [{ id: 'project-1', owner_id: 'user-1' }],
      project_members: [],
      google_calendar_tokens: [],
      events: [
        {
          id: 'event-master',
          project_id: 'project-1',
          title: 'Daily',
          description: 'Serie',
          start_date: '2026-07-20T09:00:00',
          end_date: '2026-07-20T10:00:00',
          google_event_id: 'gcal-master-1',
          is_recurring: true,
          recurrence_rule: 'weekly',
          recurrence_days: ['monday'],
          recurrence_end_date: '2026-08-31',
          series_id: 'event-master',
          is_series_master: true,
          is_exception: false,
          is_cancelled: false,
          original_start_date: '2026-07-20T09:00:00',
          created_by: 'user-1',
        },
      ],
    };
  });

  it('scope=all actualiza solo el master', async () => {
    const req = {
      json: async () => ({
        eventId: 'event-master::2026-07-27',
        projectId: 'project-1',
        scope: 'all',
        occurrenceStart: '2026-07-27T09:00:00',
        applyToGoogle: false,
        changes: {
          title: 'Daily Updated',
          start_date: '2026-07-27',
          start_time: '11:00',
          end_date: '2026-07-27',
          end_time: '12:00',
        },
      }),
    } as unknown as NextRequest;

    const res = await PATCH(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.updatedEventIds).toEqual(['event-master']);

    const master = dbState.events.find((e) => e.id === 'event-master');
    expect(master?.title).toBe('Daily Updated');
    // Ancla del master conserva su fecha; solo cambia la hora
    expect(String(master?.start_date)).toBe('2026-07-20T11:00:00');
    expect(dbState.events).toHaveLength(1);
  });

  it('scope=single crea una fila excepción', async () => {
    const req = {
      json: async () => ({
        eventId: 'event-master::2026-07-27',
        projectId: 'project-1',
        scope: 'single',
        occurrenceStart: '2026-07-27T09:00:00',
        applyToGoogle: false,
        changes: {
          title: 'Solo este',
          start_date: '2026-07-27',
          start_time: '09:00',
          end_date: '2026-07-27',
          end_time: '10:00',
        },
      }),
    } as unknown as NextRequest;

    const res = await PATCH(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);

    const exceptions = dbState.events.filter((e) => e.is_exception);
    expect(exceptions).toHaveLength(1);
    expect(exceptions[0]?.title).toBe('Solo este');
    expect(exceptions[0]?.original_start_date).toBe('2026-07-27T09:00:00');

    const master = dbState.events.find((e) => e.id === 'event-master');
    expect(master?.title).toBe('Daily');
  });

  it('scope=this_and_following responde 400', async () => {
    const req = {
      json: async () => ({
        eventId: 'event-master::2026-07-27',
        projectId: 'project-1',
        scope: 'this_and_following',
        occurrenceStart: '2026-07-27T09:00:00',
        applyToGoogle: false,
        changes: {
          title: 'Desde aquí',
          start_date: '2026-07-27',
          start_time: '15:00',
          end_date: '2026-07-27',
          end_time: '16:00',
        },
      }),
    } as unknown as NextRequest;

    const res = await PATCH(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/scope/i);

    // No debe haber truncado ni creado serie nueva
    const masters = dbState.events.filter(
      (e) => e.is_series_master && !e.is_exception,
    );
    expect(masters).toHaveLength(1);
    expect(masters[0]?.title).toBe('Daily');
    expect(masters[0]?.recurrence_end_date).toBe('2026-08-31');
  });

  it('scope=single con Google parchea instancia sin tocar start/end si no cambió la hora', async () => {
    dbState.google_calendar_tokens = [
      {
        user_id: 'user-1',
        access_token: 'access',
        refresh_token: 'refresh',
        token_type: 'Bearer',
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
      },
    ];

    const req = {
      json: async () => ({
        eventId: 'event-master::2026-07-27',
        projectId: 'project-1',
        scope: 'single',
        occurrenceStart: '2026-07-27T09:00:00',
        applyToGoogle: true,
        changes: {
          title: 'Solo este',
          start_date: '2026-07-27',
          start_time: '09:00',
          end_date: '2026-07-27',
          end_time: '10:00',
          time_zone: 'UTC',
        },
      }),
    } as unknown as NextRequest;

    const res = await PATCH(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.google.updated).toBe(1);
    expect(mockGoogleService.createEvent).not.toHaveBeenCalled();
    expect(mockGoogleService.patchEvent).toHaveBeenCalled();
    expect(mockGoogleService.patchEvent.mock.calls[0][1].start).toBeUndefined();
    expect(mockGoogleService.patchEvent.mock.calls[0][1].summary).toBe(
      'Solo este',
    );
  });
});
