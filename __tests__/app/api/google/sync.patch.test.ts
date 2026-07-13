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

const mockFrom = jest.fn((table: keyof DbState) => ({
  select: jest.fn(() => new SelectQuery(table)),
  update: jest.fn((payload: Row) => new UpdateQuery(table, payload)),
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

jest.mock('@/lib/googleCalendar', () => ({
  GoogleCalendarService: jest.fn(),
}));

describe('PATCH /api/google/sync (scopes recurrentes)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    dbState = {
      projects: [
        {
          id: 'project-1',
          owner_id: 'user-1',
        },
      ],
      project_members: [],
      google_calendar_tokens: [],
      events: [
        {
          id: 'event-1',
          project_id: 'project-1',
          title: 'Daily',
          description: 'Serie diaria',
          start_date: '2026-07-20T09:00:00',
          end_date: '2026-07-20T10:00:00',
          google_event_id: null,
          is_recurring: true,
          recurrence_rule: 'weekly',
          recurrence_days: ['monday'],
          recurrence_end_date: '2026-08-31',
          series_id: 'series-1',
          is_series_master: true,
          is_exception: false,
          original_start_date: '2026-07-20T09:00:00',
        },
        {
          id: 'event-2',
          project_id: 'project-1',
          title: 'Daily',
          description: 'Serie diaria',
          start_date: '2026-07-27T09:00:00',
          end_date: '2026-07-27T10:00:00',
          google_event_id: null,
          is_recurring: true,
          recurrence_rule: 'weekly',
          recurrence_days: ['monday'],
          recurrence_end_date: '2026-08-31',
          series_id: 'series-1',
          is_series_master: false,
          is_exception: false,
          original_start_date: '2026-07-27T09:00:00',
        },
        {
          id: 'event-3',
          project_id: 'project-1',
          title: 'Daily',
          description: 'Serie diaria',
          start_date: '2026-08-03T09:00:00',
          end_date: '2026-08-03T10:00:00',
          google_event_id: null,
          is_recurring: true,
          recurrence_rule: 'weekly',
          recurrence_days: ['monday'],
          recurrence_end_date: '2026-08-31',
          series_id: 'series-1',
          is_series_master: false,
          is_exception: false,
          original_start_date: '2026-08-03T09:00:00',
        },
      ],
    };
  });

  it('actualiza toda la serie con scope=all', async () => {
    const req = {
      json: async () => ({
        eventId: 'event-2',
        projectId: 'project-1',
        scope: 'all',
        applyToGoogle: false,
        changes: {
          title: 'Daily Updated',
          start_time: '11:00',
          end_time: '12:00',
        },
      }),
    } as unknown as NextRequest;

    const res = await PATCH(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.scope).toBe('all');
    expect(data.updatedEventIds).toHaveLength(3);

    const updatedTitles = dbState.events.map((event) => event.title);
    expect(updatedTitles.every((title) => title === 'Daily Updated')).toBe(
      true,
    );
    expect(
      dbState.events.every((event) =>
        String(event.start_date).includes('T11:00:00'),
      ),
    ).toBe(true);
    expect(
      dbState.events.every((event) => event.series_id === 'series-1'),
    ).toBe(true);

    const masters = dbState.events.filter(
      (event) => event.is_series_master === true,
    );
    expect(masters).toHaveLength(1);
  });

  it('divide la serie con scope=this_and_following', async () => {
    const req = {
      json: async () => ({
        eventId: 'event-2',
        projectId: 'project-1',
        scope: 'this_and_following',
        applyToGoogle: false,
        changes: {
          title: 'Split Series',
          start_time: '15:00',
          end_time: '16:00',
        },
      }),
    } as unknown as NextRequest;

    const res = await PATCH(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.scope).toBe('this_and_following');
    expect(data.updatedEventIds).toHaveLength(2);

    const originalPastEvent = dbState.events.find(
      (event) => event.id === 'event-1',
    );
    const moved1 = dbState.events.find((event) => event.id === 'event-2');
    const moved2 = dbState.events.find((event) => event.id === 'event-3');

    expect(originalPastEvent?.title).toBe('Daily');
    expect(originalPastEvent?.recurrence_end_date).toBe('2026-07-26');

    expect(moved1?.title).toBe('Split Series');
    expect(moved2?.title).toBe('Split Series');
    expect(String(moved1?.start_date)).toContain('T15:00:00');
    expect(String(moved2?.start_date)).toContain('T15:00:00');

    expect(moved1?.series_id).toBeTruthy();
    expect(moved2?.series_id).toBe(moved1?.series_id);
    expect(moved1?.series_id).not.toBe('series-1');

    const newSeriesMasters = dbState.events.filter(
      (event) =>
        event.series_id === moved1?.series_id &&
        event.is_series_master === true,
    );
    expect(newSeriesMasters).toHaveLength(1);
  });

  it('rechaza scope de serie para evento no recurrente', async () => {
    dbState.events = [
      {
        id: 'event-non-rec',
        project_id: 'project-1',
        title: 'One shot',
        description: null,
        start_date: '2026-07-22T09:00:00',
        end_date: '2026-07-22T10:00:00',
        google_event_id: null,
        is_recurring: false,
        recurrence_rule: null,
        recurrence_days: null,
        recurrence_end_date: null,
        series_id: null,
        is_series_master: false,
        is_exception: false,
        original_start_date: '2026-07-22T09:00:00',
      },
    ];

    const req = {
      json: async () => ({
        eventId: 'event-non-rec',
        projectId: 'project-1',
        scope: 'all',
        applyToGoogle: false,
        changes: {
          title: 'No permitido',
        },
      }),
    } as unknown as NextRequest;

    const res = await PATCH(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('serie recurrente');
  });
});
