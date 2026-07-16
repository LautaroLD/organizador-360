import {
  buildCsvFiles,
  escapeCsvValue,
  parseExportDatasets,
  pickExportDatasets,
  rowsToCsv,
  sanitizeFilenamePart,
  type ProjectExportPayload,
} from '@/lib/exportProjectData';
import {
  buildTeamHealthSnapshot,
  computeCheckinCompliance,
  computeRecurringBlockers,
  computeWorkloadByMember,
  isTaskOverdue,
} from '@/lib/teamHealth';

describe('teamHealth', () => {
  const members = [
    { user_id: 'u1', role: 'Owner', name: 'Ana' },
    { user_id: 'u2', role: 'Collaborator', name: 'Luis' },
    { user_id: 'u3', role: 'Viewer', name: 'Solo Lectura' },
  ];

  it('detecta check-ins faltantes hoy y esta semana (ignora viewers)', () => {
    const compliance = computeCheckinCompliance({
      members,
      todayDate: '2026-07-15',
      checkins: [
        { user_id: 'u1', checkin_date: '2026-07-15', blockers: null },
        { user_id: 'u2', checkin_date: '2026-07-10', blockers: 'API caída' },
      ],
    });

    expect(compliance.missedToday.map((m) => m.userId)).toEqual(['u2']);
    expect(compliance.missedThisWeek.map((m) => m.userId)).toEqual([]);
    expect(compliance.complianceTodayRate).toBe(50);
    expect(compliance.complianceWeekRate).toBe(100);
  });

  it('calcula carga abierta / vencida / en progreso', () => {
    const now = new Date(2026, 6, 15, 12, 0, 0).getTime();
    const tasks = [
      {
        id: 't1',
        title: 'A',
        status: 'todo',
        done_estimated_at: '2026-07-10',
      },
      {
        id: 't2',
        title: 'B',
        status: 'in-progress',
        done_estimated_at: '2026-07-20',
      },
      {
        id: 't3',
        title: 'C',
        status: 'done',
        done_at: '2026-07-12',
        done_estimated_at: '2026-07-11',
      },
    ];

    expect(isTaskOverdue(tasks[0], now)).toBe(true);
    expect(isTaskOverdue(tasks[1], now)).toBe(false);

    const workload = computeWorkloadByMember({
      members,
      tasks,
      assignments: [
        { task_id: 't1', user_id: 'u1' },
        { task_id: 't2', user_id: 'u1' },
        { task_id: 't3', user_id: 'u2' },
      ],
      nowMs: now,
    });

    const ana = workload.find((w) => w.userId === 'u1');
    expect(ana).toMatchObject({
      open: 2,
      inProgress: 1,
      overdue: 1,
      done: 0,
      total: 2,
    });
  });

  it('detecta blockers recurrentes y arma alertas', () => {
    const snapshot = buildTeamHealthSnapshot({
      members,
      todayDate: '2026-07-15',
      tasks: [
        {
          id: 't1',
          title: 'Late',
          status: 'done',
          done_at: '2026-07-14',
          done_estimated_at: '2026-07-10',
        },
        {
          id: 't2',
          title: 'Late 2',
          status: 'done',
          done_at: '2026-07-14',
          done_estimated_at: '2026-07-10',
        },
        {
          id: 't3',
          title: 'Late 3',
          status: 'done',
          done_at: '2026-07-14',
          done_estimated_at: '2026-07-10',
        },
      ],
      assignments: [
        { task_id: 't1', user_id: 'u2' },
        { task_id: 't2', user_id: 'u2' },
        { task_id: 't3', user_id: 'u2' },
      ],
      checkins: [
        { user_id: 'u2', checkin_date: '2026-07-13', blockers: 'Esperando diseño' },
        { user_id: 'u2', checkin_date: '2026-07-14', blockers: 'Esperando diseño' },
        { user_id: 'u1', checkin_date: '2026-07-15', blockers: null },
      ],
      taskTags: [{ task_id: 't1', label: 'Backend' }],
    });

    const blockers = computeRecurringBlockers({
      members,
      checkins: [
        { user_id: 'u2', checkin_date: '2026-07-13', blockers: 'Esperando diseño' },
        { user_id: 'u2', checkin_date: '2026-07-14', blockers: 'Esperando diseño' },
      ],
    });

    expect(blockers[0]).toMatchObject({ userId: 'u2', count: 2 });
    expect(snapshot.alerts.some((a) => a.id === 'blocker-u2')).toBe(true);
    expect(snapshot.alerts.some((a) => a.id === 'checkin-missed-today')).toBe(true);
    expect(snapshot.throughputByMember[0]?.onTimeRate).toBe(0);
    expect(snapshot.throughputByTag[0]?.label).toBe('Backend');
  });
});

describe('exportProjectData', () => {
  const payload: ProjectExportPayload = {
    exportedAt: '2026-07-15T12:00:00.000Z',
    project: { id: 'p1', name: 'Demo', description: null },
    tasks: [{ id: 't1', title: 'Task, with comma', status: 'todo' }],
    members: [{ user_id: 'u1', name: 'Ana', role: 'Owner' }],
    checkins: [{ user_id: 'u1', checkin_date: '2026-07-15', blockers: null }],
    events: [{ id: 'e1', title: 'Standup' }],
    analytics: { progress_pct: 40, workload_by_member: [{ name: 'Ana', open: 2 }] },
    okrs: {
      objectives: [{ id: 'o1', title: 'Grow' }],
      keyResults: [{ id: 'kr1', title: 'MRR', progress_pct: 50 }],
      epics: [{ id: 'ep1', title: 'Billing' }],
    },
    resources: [{ id: 'r1', title: 'Spec.pdf', url: 'https://example.com/spec.pdf' }],
  };

  it('escapa CSV correctamente', () => {
    expect(escapeCsvValue('hola')).toBe('hola');
    expect(escapeCsvValue('a,b')).toBe('"a,b"');
    expect(escapeCsvValue('say "hi"')).toBe('"say ""hi"""');
  });

  it('parsea datasets y arma CSV/JSON parcial', () => {
    expect(parseExportDatasets(null)).toContain('tasks');
    expect(parseExportDatasets('tasks,members')).toEqual(['tasks', 'members']);
    expect(parseExportDatasets('nope')).toContain('checkins');

    const picked = pickExportDatasets(payload, ['tasks', 'analytics']);
    expect(picked).toHaveProperty('tasks');
    expect(picked).toHaveProperty('analytics');
    expect(picked).not.toHaveProperty('events');

    const csv = rowsToCsv(payload.tasks);
    expect(csv.split('\n')[0]).toContain('id');
    expect(csv).toContain('"Task, with comma"');

    const files = buildCsvFiles(payload, ['okrs', 'analytics']);
    expect(files['okr_objectives.csv']).toContain('Grow');
    expect(files['analytics.csv']).toContain('progress_pct');
    expect(sanitizeFilenamePart('Mi Proyecto!')).toBe('mi-proyecto');
  });
});
