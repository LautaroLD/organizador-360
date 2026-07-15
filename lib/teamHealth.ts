import { parseDateValue } from '@/lib/utils';

export type TeamHealthTask = {
  id: string;
  title: string;
  status: string;
  done_at?: string | null;
  done_estimated_at?: string | null;
  created_at?: string;
};

export type TeamHealthAssignment = {
  task_id: string;
  user_id: string;
};

export type TeamHealthMember = {
  user_id: string;
  role: string;
  name: string;
};

export type TeamHealthCheckin = {
  user_id: string;
  checkin_date: string;
  blockers: string | null;
};

export type TeamHealthTaskTag = {
  task_id: string;
  label: string;
};

export type WorkloadByMember = {
  userId: string;
  name: string;
  role: string;
  open: number;
  inProgress: number;
  overdue: number;
  done: number;
  total: number;
};

export type CheckinCompliance = {
  todayDate: string;
  weekStartDate: string;
  weekEndDate: string;
  submittedToday: string[];
  missedToday: Array<{ userId: string; name: string }>;
  submittedThisWeek: string[];
  missedThisWeek: Array<{ userId: string; name: string }>;
  complianceTodayRate: number | null;
  complianceWeekRate: number | null;
};

export type RecurringBlocker = {
  userId: string;
  name: string;
  count: number;
  latest: string;
  samples: string[];
};

export type ThroughputPoint = {
  key: string;
  label: string;
  doneCount: number;
  onTimeCount: number;
  lateCount: number;
  onTimeRate: number | null;
};

export type TeamHealthAlert = {
  id: string;
  severity: 'warning' | 'danger' | 'info';
  title: string;
  detail: string;
};

export type TeamHealthSnapshot = {
  checkinCompliance: CheckinCompliance;
  workload: WorkloadByMember[];
  recurringBlockers: RecurringBlocker[];
  throughputByMember: ThroughputPoint[];
  throughputByTag: ThroughputPoint[];
  alerts: TeamHealthAlert[];
};

const getStartOfLocalDayMs = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0).getTime();

const getEndOfLocalDayMs = (date: Date) =>
  new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  ).getTime();

export const toISODateLocal = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const addDaysLocal = (isoDate: string, days: number) => {
  const parsed = parseDateValue(isoDate);
  if (!parsed) return isoDate;
  parsed.setDate(parsed.getDate() + days);
  return toISODateLocal(parsed);
};

export const isTaskOverdue = (task: TeamHealthTask, nowMs = Date.now()) => {
  if (task.status === 'done') return false;
  if (!task.done_estimated_at) return false;
  const estimatedAt = parseDateValue(task.done_estimated_at);
  return estimatedAt ? getEndOfLocalDayMs(estimatedAt) < nowMs : false;
};

const isOnTimeDone = (task: TeamHealthTask) => {
  if (task.status !== 'done' || !task.done_estimated_at || !task.done_at) {
    return null;
  }
  const estimatedAt = parseDateValue(task.done_estimated_at);
  const doneAt = parseDateValue(task.done_at);
  if (!estimatedAt || !doneAt) return null;
  return getStartOfLocalDayMs(doneAt) <= getStartOfLocalDayMs(estimatedAt);
};

const eligibleMembers = (members: TeamHealthMember[]) =>
  members.filter((m) => m.role.toLowerCase() !== 'viewer');

export function computeCheckinCompliance(params: {
  members: TeamHealthMember[];
  checkins: TeamHealthCheckin[];
  todayDate: string;
  lookbackDays?: number;
}): CheckinCompliance {
  const lookbackDays = params.lookbackDays ?? 7;
  const weekStartDate = addDaysLocal(params.todayDate, -(lookbackDays - 1));
  const weekEndDate = params.todayDate;
  const members = eligibleMembers(params.members);

  const submittedTodaySet = new Set(
    params.checkins
      .filter((c) => c.checkin_date === params.todayDate)
      .map((c) => c.user_id),
  );

  const weekDates = new Set<string>();
  for (let i = 0; i < lookbackDays; i += 1) {
    weekDates.add(addDaysLocal(weekStartDate, i));
  }

  const submittedThisWeekSet = new Set(
    params.checkins
      .filter((c) => weekDates.has(c.checkin_date))
      .map((c) => c.user_id),
  );

  const missedToday = members
    .filter((m) => !submittedTodaySet.has(m.user_id))
    .map((m) => ({ userId: m.user_id, name: m.name }));

  const missedThisWeek = members
    .filter((m) => !submittedThisWeekSet.has(m.user_id))
    .map((m) => ({ userId: m.user_id, name: m.name }));

  const complianceTodayRate =
    members.length > 0
      ? Math.round(((members.length - missedToday.length) / members.length) * 100)
      : null;

  const complianceWeekRate =
    members.length > 0
      ? Math.round(
          ((members.length - missedThisWeek.length) / members.length) * 100,
        )
      : null;

  return {
    todayDate: params.todayDate,
    weekStartDate,
    weekEndDate,
    submittedToday: [...submittedTodaySet],
    missedToday,
    submittedThisWeek: [...submittedThisWeekSet],
    missedThisWeek,
    complianceTodayRate,
    complianceWeekRate,
  };
}

export function computeWorkloadByMember(params: {
  members: TeamHealthMember[];
  tasks: TeamHealthTask[];
  assignments: TeamHealthAssignment[];
  nowMs?: number;
}): WorkloadByMember[] {
  const nowMs = params.nowMs ?? Date.now();
  const taskById = new Map(params.tasks.map((t) => [t.id, t]));
  const tasksByUser = new Map<string, TeamHealthTask[]>();

  params.assignments.forEach((a) => {
    const task = taskById.get(a.task_id);
    if (!task) return;
    const list = tasksByUser.get(a.user_id) ?? [];
    list.push(task);
    tasksByUser.set(a.user_id, list);
  });

  return params.members.map((member) => {
    const memberTasks = tasksByUser.get(member.user_id) ?? [];
    const open = memberTasks.filter(
      (t) => t.status === 'todo' || t.status === 'in-progress',
    ).length;
    const inProgress = memberTasks.filter((t) => t.status === 'in-progress').length;
    const overdue = memberTasks.filter((t) => isTaskOverdue(t, nowMs)).length;
    const done = memberTasks.filter((t) => t.status === 'done').length;

    return {
      userId: member.user_id,
      name: member.name,
      role: member.role,
      open,
      inProgress,
      overdue,
      done,
      total: memberTasks.length,
    };
  });
}

export function computeRecurringBlockers(params: {
  members: TeamHealthMember[];
  checkins: TeamHealthCheckin[];
  minOccurrences?: number;
}): RecurringBlocker[] {
  const minOccurrences = params.minOccurrences ?? 2;
  const nameById = new Map(params.members.map((m) => [m.user_id, m.name]));
  const byUser = new Map<
    string,
    { count: number; latest: string; samples: string[] }
  >();

  params.checkins.forEach((checkin) => {
    const text = checkin.blockers?.trim();
    if (!text) return;
    const current = byUser.get(checkin.user_id) ?? {
      count: 0,
      latest: checkin.checkin_date,
      samples: [],
    };
    current.count += 1;
    if (checkin.checkin_date >= current.latest) {
      current.latest = checkin.checkin_date;
    }
    if (current.samples.length < 3 && !current.samples.includes(text)) {
      current.samples.push(text);
    }
    byUser.set(checkin.user_id, current);
  });

  return [...byUser.entries()]
    .filter(([, value]) => value.count >= minOccurrences)
    .map(([userId, value]) => ({
      userId,
      name: nameById.get(userId) || 'Sin nombre',
      count: value.count,
      latest: value.latest,
      samples: value.samples,
    }))
    .sort((a, b) => b.count - a.count);
}

function buildThroughputPoint(
  key: string,
  label: string,
  tasks: TeamHealthTask[],
): ThroughputPoint {
  const doneTasks = tasks.filter((t) => t.status === 'done');
  let onTimeCount = 0;
  let lateCount = 0;

  doneTasks.forEach((task) => {
    const onTime = isOnTimeDone(task);
    if (onTime === true) onTimeCount += 1;
    if (onTime === false) lateCount += 1;
  });

  const rated = onTimeCount + lateCount;
  return {
    key,
    label,
    doneCount: doneTasks.length,
    onTimeCount,
    lateCount,
    onTimeRate: rated > 0 ? Math.round((onTimeCount / rated) * 100) : null,
  };
}

export function computeThroughputByMember(params: {
  members: TeamHealthMember[];
  tasks: TeamHealthTask[];
  assignments: TeamHealthAssignment[];
}): ThroughputPoint[] {
  const taskById = new Map(params.tasks.map((t) => [t.id, t]));
  const tasksByUser = new Map<string, TeamHealthTask[]>();

  params.assignments.forEach((a) => {
    const task = taskById.get(a.task_id);
    if (!task) return;
    const list = tasksByUser.get(a.user_id) ?? [];
    list.push(task);
    tasksByUser.set(a.user_id, list);
  });

  return params.members
    .map((member) =>
      buildThroughputPoint(
        member.user_id,
        member.name,
        tasksByUser.get(member.user_id) ?? [],
      ),
    )
    .filter((point) => point.doneCount > 0)
    .sort((a, b) => b.doneCount - a.doneCount);
}

export function computeThroughputByTag(params: {
  tasks: TeamHealthTask[];
  taskTags: TeamHealthTaskTag[];
}): ThroughputPoint[] {
  const taskById = new Map(params.tasks.map((t) => [t.id, t]));
  const tasksByTag = new Map<string, TeamHealthTask[]>();

  params.taskTags.forEach((tag) => {
    const task = taskById.get(tag.task_id);
    if (!task || !tag.label.trim()) return;
    const list = tasksByTag.get(tag.label) ?? [];
    list.push(task);
    tasksByTag.set(tag.label, list);
  });

  return [...tasksByTag.entries()]
    .map(([label, tasks]) => buildThroughputPoint(label, label, tasks))
    .filter((point) => point.doneCount > 0)
    .sort((a, b) => b.doneCount - a.doneCount);
}

export function buildTeamHealthAlerts(params: {
  checkinCompliance: CheckinCompliance;
  workload: WorkloadByMember[];
  recurringBlockers: RecurringBlocker[];
  throughputByMember: ThroughputPoint[];
}): TeamHealthAlert[] {
  const alerts: TeamHealthAlert[] = [];

  if (params.checkinCompliance.missedToday.length > 0) {
    alerts.push({
      id: 'checkin-missed-today',
      severity: 'warning',
      title: 'Check-ins pendientes hoy',
      detail: `${params.checkinCompliance.missedToday
        .map((m) => m.name)
        .join(', ')} no completaron el check-in de hoy.`,
    });
  }

  if (params.checkinCompliance.missedThisWeek.length > 0) {
    alerts.push({
      id: 'checkin-missed-week',
      severity: 'danger',
      title: 'Sin check-ins esta semana',
      detail: `${params.checkinCompliance.missedThisWeek
        .map((m) => m.name)
        .join(', ')} no registraron ningún check-in en los últimos 7 días.`,
    });
  }

  params.workload
    .filter((w) => w.overdue >= 3)
    .forEach((w) => {
      alerts.push({
        id: `overdue-${w.userId}`,
        severity: 'danger',
        title: `Sobrecarga / vencidas: ${w.name}`,
        detail: `${w.name} tiene ${w.overdue} tareas vencidas y ${w.open} abiertas.`,
      });
    });

  params.workload
    .filter((w) => w.open >= 10 && w.overdue < 3)
    .forEach((w) => {
      alerts.push({
        id: `open-load-${w.userId}`,
        severity: 'warning',
        title: `Carga alta: ${w.name}`,
        detail: `${w.name} tiene ${w.open} tareas abiertas (${w.inProgress} en progreso).`,
      });
    });

  params.recurringBlockers.forEach((blocker) => {
    alerts.push({
      id: `blocker-${blocker.userId}`,
      severity: 'warning',
      title: `Blockers recurrentes: ${blocker.name}`,
      detail: `${blocker.count} check-ins con blockers. Último: "${blocker.samples[0] ?? '—'}"`,
    });
  });

  params.throughputByMember
    .filter((p) => p.onTimeRate !== null && p.onTimeRate < 60 && p.doneCount >= 3)
    .forEach((p) => {
      alerts.push({
        id: `ontime-${p.key}`,
        severity: 'danger',
        title: `Entrega fuera de plazo: ${p.label}`,
        detail: `${p.label} entrega a tiempo el ${p.onTimeRate}% (${p.lateCount} con retraso de ${p.doneCount} cerradas con estimación).`,
      });
    });

  return alerts;
}

export function buildTeamHealthSnapshot(params: {
  members: TeamHealthMember[];
  tasks: TeamHealthTask[];
  assignments: TeamHealthAssignment[];
  checkins: TeamHealthCheckin[];
  taskTags?: TeamHealthTaskTag[];
  todayDate: string;
  nowMs?: number;
}): TeamHealthSnapshot {
  const checkinCompliance = computeCheckinCompliance({
    members: params.members,
    checkins: params.checkins,
    todayDate: params.todayDate,
  });

  const workload = computeWorkloadByMember({
    members: params.members,
    tasks: params.tasks,
    assignments: params.assignments,
    nowMs: params.nowMs,
  });

  const recurringBlockers = computeRecurringBlockers({
    members: params.members,
    checkins: params.checkins,
  });

  const throughputByMember = computeThroughputByMember({
    members: params.members,
    tasks: params.tasks,
    assignments: params.assignments,
  });

  const throughputByTag = computeThroughputByTag({
    tasks: params.tasks,
    taskTags: params.taskTags ?? [],
  });

  const alerts = buildTeamHealthAlerts({
    checkinCompliance,
    workload,
    recurringBlockers,
    throughputByMember,
  });

  return {
    checkinCompliance,
    workload,
    recurringBlockers,
    throughputByMember,
    throughputByTag,
    alerts,
  };
}
