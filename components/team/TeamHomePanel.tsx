'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  FolderKanban,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import type {
  WorkspaceHomeSnapshot,
  WorkspaceHomeTask,
  WorkspaceProjectRisk,
} from '@/models/workspace';
import clsx from 'clsx';

function formatEventWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('es-AR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

const severityStyle = (severity: 'warning' | 'danger' | 'info') => {
  const color =
    severity === 'danger'
      ? 'var(--accent-danger)'
      : severity === 'warning'
        ? 'var(--accent-warning)'
        : 'var(--text-secondary)';
  return {
    color,
    borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
    backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
  };
};

type ProjectTaskGroup = {
  projectId: string;
  projectName: string;
  tasks: WorkspaceHomeTask[];
  overdueCount: number;
};

function groupTasksByProject(tasks: WorkspaceHomeTask[]): ProjectTaskGroup[] {
  const map = new Map<string, ProjectTaskGroup>();

  for (const task of tasks) {
    const existing = map.get(task.project_id);
    if (existing) {
      existing.tasks.push(task);
      if (task.is_overdue) existing.overdueCount += 1;
      continue;
    }
    map.set(task.project_id, {
      projectId: task.project_id,
      projectName: task.project_name,
      tasks: [task],
      overdueCount: task.is_overdue ? 1 : 0,
    });
  }

  return [...map.values()].sort((a, b) => {
    if (b.overdueCount !== a.overdueCount) return b.overdueCount - a.overdueCount;
    if (b.tasks.length !== a.tasks.length) return b.tasks.length - a.tasks.length;
    return a.projectName.localeCompare(b.projectName, 'es');
  });
}

function TaskRow({
  task,
  showUnassigned,
}: {
  task: WorkspaceHomeTask;
  showUnassigned?: boolean;
}) {
  return (
    <Link
      href={`/projects/${task.project_id}/kanban`}
      className="block rounded-md border border-[var(--text-secondary)]/20 px-3 py-2 hover:bg-[var(--bg-primary)] transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-[var(--text-primary)]">{task.title}</p>
        {task.is_overdue && (
          <span className="shrink-0 text-xs text-[var(--accent-danger)]">Vencida</span>
        )}
      </div>
      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
        {task.status}
        {showUnassigned && task.assignee_ids.length === 0 ? ' · sin asignar' : ''}
      </p>
    </Link>
  );
}

function ProjectTasksAccordion({
  tasks,
  emptyMessage,
  showUnassigned,
}: {
  tasks: WorkspaceHomeTask[];
  emptyMessage: string;
  showUnassigned?: boolean;
}) {
  const groups = useMemo(() => groupTasksByProject(tasks), [tasks]);

  // Projects with overdue tasks start open; otherwise first project.
  const [openIds, setOpenIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    const withOverdue = groups.filter((g) => g.overdueCount > 0);
    if (withOverdue.length > 0) {
      withOverdue.forEach((g) => initial.add(g.projectId));
    } else if (groups[0]) {
      initial.add(groups[0].projectId);
    }
    return initial;
  });

  const toggle = (projectId: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  if (tasks.length === 0) {
    return <p className="text-sm text-[var(--text-secondary)]">{emptyMessage}</p>;
  }

  return (
    <div className="min-h-0 max-h-[28rem] space-y-2 overflow-y-auto overscroll-contain pr-1">
      {groups.map((group) => {
        const isOpen = openIds.has(group.projectId);
        return (
          <div
            key={group.projectId}
            className="rounded-md border border-[var(--text-secondary)]/20 overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggle(group.projectId)}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-[var(--bg-primary)] transition-colors"
              aria-expanded={isOpen}
            >
              <ChevronDown
                className={clsx(
                  'h-4 w-4 shrink-0 text-[var(--text-secondary)] transition-transform',
                  isOpen ? 'rotate-0' : '-rotate-90',
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                  {group.projectName}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs text-[var(--text-secondary)]">
                {group.overdueCount > 0 && (
                  <span className="text-[var(--accent-danger)]">
                    {group.overdueCount} vencida{group.overdueCount === 1 ? '' : 's'}
                  </span>
                )}
                <span className="rounded-md bg-[var(--bg-primary)] px-1.5 py-0.5">
                  {group.tasks.length}
                </span>
              </div>
            </button>

            {isOpen && (
              <div className="max-h-56 space-y-1.5 overflow-y-auto border-t border-[var(--text-secondary)]/15 px-2 py-2">
                {group.tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    showUnassigned={showUnassigned}
                  />
                ))}
                <Link
                  href={`/projects/${group.projectId}/kanban`}
                  className="block px-1 pt-1 text-xs text-[var(--accent-primary)] hover:underline"
                >
                  Ver kanban del proyecto
                </Link>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

type ProjectRiskGroup = {
  projectId: string;
  projectName: string;
  risks: WorkspaceProjectRisk[];
  dangerCount: number;
};

function groupRisksByProject(risks: WorkspaceProjectRisk[]): ProjectRiskGroup[] {
  const map = new Map<string, ProjectRiskGroup>();

  for (const risk of risks) {
    const existing = map.get(risk.projectId);
    if (existing) {
      existing.risks.push(risk);
      if (risk.severity === 'danger') existing.dangerCount += 1;
      continue;
    }
    map.set(risk.projectId, {
      projectId: risk.projectId,
      projectName: risk.projectName,
      risks: [risk],
      dangerCount: risk.severity === 'danger' ? 1 : 0,
    });
  }

  return [...map.values()].sort((a, b) => {
    if (b.dangerCount !== a.dangerCount) return b.dangerCount - a.dangerCount;
    if (b.risks.length !== a.risks.length) return b.risks.length - a.risks.length;
    return a.projectName.localeCompare(b.projectName, 'es');
  });
}

function ProjectRisksAccordion({ risks }: { risks: WorkspaceProjectRisk[] }) {
  const groups = useMemo(() => groupRisksByProject(risks), [risks]);
  const [openIds, setOpenIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    const withDanger = groups.filter((g) => g.dangerCount > 0);
    if (withDanger.length > 0) {
      withDanger.forEach((g) => initial.add(g.projectId));
    } else if (groups[0]) {
      initial.add(groups[0].projectId);
    }
    return initial;
  });

  const toggle = (projectId: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  if (risks.length === 0) {
    return (
      <p className="text-sm text-[var(--text-secondary)]">
        Sin riesgos destacados. El equipo se ve estable.
      </p>
    );
  }

  return (
    <div className="min-h-0 max-h-[28rem] space-y-2 overflow-y-auto overscroll-contain pr-1">
      {groups.map((group) => {
        const isOpen = openIds.has(group.projectId);
        return (
          <div
            key={group.projectId}
            className="rounded-md border border-[var(--text-secondary)]/20 overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggle(group.projectId)}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-[var(--bg-primary)] transition-colors"
              aria-expanded={isOpen}
            >
              <ChevronDown
                className={clsx(
                  'h-4 w-4 shrink-0 text-[var(--text-secondary)] transition-transform',
                  isOpen ? 'rotate-0' : '-rotate-90',
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                  {group.projectName}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs text-[var(--text-secondary)]">
                {group.dangerCount > 0 && (
                  <span className="text-[var(--accent-danger)]">
                    {group.dangerCount} crítico{group.dangerCount === 1 ? '' : 's'}
                  </span>
                )}
                <span className="rounded-md bg-[var(--bg-primary)] px-1.5 py-0.5">
                  {group.risks.length}
                </span>
              </div>
            </button>

            {isOpen && (
              <div className="max-h-56 space-y-1.5 overflow-y-auto border-t border-[var(--text-secondary)]/15 px-2 py-2">
                {group.risks.map((risk, index) => (
                  <Link
                    key={`${risk.projectId}-${risk.title}-${index}`}
                    href={`/projects/${risk.projectId}/analytics`}
                    className="block rounded-md border px-3 py-2 transition-colors hover:opacity-90"
                    style={severityStyle(risk.severity)}
                  >
                    <p className="text-sm font-medium">{risk.title}</p>
                    <p className="text-xs opacity-90 mt-0.5">{risk.detail}</p>
                  </Link>
                ))}
                <Link
                  href={`/projects/${group.projectId}/analytics`}
                  className="block px-1 pt-1 text-xs text-[var(--accent-primary)] hover:underline"
                >
                  Ver analytics del proyecto
                </Link>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

type Props = {
  home: WorkspaceHomeSnapshot | undefined;
  isLoading: boolean;
};

export function TeamHomePanel({ home, isLoading }: Props) {
  if (isLoading) {
    return (
      <p className="text-sm text-[var(--text-secondary)]">Cargando mando de control…</p>
    );
  }

  if (!home) {
    return (
      <p className="text-sm text-[var(--text-secondary)]">
        No se pudo cargar la vista del equipo.
      </p>
    );
  }

  const { stats, myOpenTasks, teamOpenTasks, upcomingEvents, risks } = home;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'Proyectos vinculados',
            value: stats.linkedProjects,
            icon: <FolderKanban className="h-4 w-4" />,
          },
          {
            label: 'Personas en directorio',
            value: stats.directoryMembers,
            icon: <Users className="h-4 w-4" />,
          },
          {
            label: 'Mis tareas abiertas',
            value: stats.myOpenCount,
            icon: <CheckSquare className="h-4 w-4" />,
          },
          {
            label: 'Riesgos',
            value: stats.riskCount,
            icon: <AlertTriangle className="h-4 w-4" />,
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-md bg-[var(--bg-primary)] p-2 text-[var(--text-secondary)]">
                {stat.icon}
              </div>
              <div>
                <p className="text-2xl font-semibold text-[var(--text-primary)]">
                  {stat.value}
                </p>
                <p className="text-xs text-[var(--text-secondary)]">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Mis tareas</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectTasksAccordion
              key={`mine-${myOpenTasks.length}`}
              tasks={myOpenTasks}
              emptyMessage="No tienes tareas abiertas asignadas en los proyectos del equipo."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Tareas del equipo</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectTasksAccordion
              key={`team-${teamOpenTasks.length}`}
              tasks={teamOpenTasks}
              emptyMessage="No hay otras tareas abiertas en el workspace."
              showUnassigned
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="min-h-0 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Calendario del equipo (7 días)
            </CardTitle>
          </CardHeader>
          <CardContent className="min-h-0">
            <div className="min-h-0 max-h-[28rem] space-y-2 overflow-y-auto overscroll-contain pr-1">
              {upcomingEvents.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">
                  Sin eventos próximos en los proyectos vinculados.
                </p>
              ) : (
                upcomingEvents.map((event) => (
                  <Link
                    key={event.id}
                    href={`/projects/${event.project_id}/calendar`}
                    className="block rounded-md border border-[var(--text-secondary)]/20 px-3 py-2 hover:bg-[var(--bg-primary)] transition-colors"
                  >
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {event.title}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {event.project_name} · {formatEventWhen(event.start_date)}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="min-h-0 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Riesgos
            </CardTitle>
          </CardHeader>
          <CardContent className="min-h-0">
            <ProjectRisksAccordion
              key={`risks-${risks.length}`}
              risks={risks}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
