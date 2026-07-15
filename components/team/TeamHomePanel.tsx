'use client';

import React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CalendarDays,
  CheckSquare,
  FolderKanban,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import type { WorkspaceHomeSnapshot } from '@/models/workspace';

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
          <CardContent className="space-y-2">
            {myOpenTasks.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">
                No tienes tareas abiertas asignadas en los proyectos del equipo.
              </p>
            ) : (
              myOpenTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/projects/${task.project_id}/kanban`}
                  className="block rounded-md border border-[var(--text-secondary)]/20 px-3 py-2 hover:bg-[var(--bg-primary)] transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {task.title}
                    </p>
                    {task.is_overdue && (
                      <span className="shrink-0 text-xs text-[var(--accent-danger)]">
                        Vencida
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {task.project_name} · {task.status}
                  </p>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Tareas del equipo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {teamOpenTasks.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">
                No hay otras tareas abiertas en el workspace.
              </p>
            ) : (
              teamOpenTasks.slice(0, 12).map((task) => (
                <Link
                  key={task.id}
                  href={`/projects/${task.project_id}/kanban`}
                  className="block rounded-md border border-[var(--text-secondary)]/20 px-3 py-2 hover:bg-[var(--bg-primary)] transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {task.title}
                    </p>
                    {task.is_overdue && (
                      <span className="shrink-0 text-xs text-[var(--accent-danger)]">
                        Vencida
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {task.project_name} · {task.status}
                    {task.assignee_ids.length === 0 ? ' · sin asignar' : ''}
                  </p>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Calendario del equipo (7 días)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Riesgos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {risks.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">
                Sin riesgos destacados. El equipo se ve estable.
              </p>
            ) : (
              risks.map((risk, index) => (
                <Link
                  key={`${risk.projectId}-${risk.title}-${index}`}
                  href={`/projects/${risk.projectId}/analytics`}
                  className="block rounded-md border px-3 py-2 transition-colors hover:opacity-90"
                  style={severityStyle(risk.severity)}
                >
                  <p className="text-sm font-medium">{risk.title}</p>
                  <p className="text-xs opacity-90 mt-0.5">
                    {risk.projectName} · {risk.detail}
                  </p>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
