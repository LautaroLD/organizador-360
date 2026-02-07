'use client';

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useProjectStore } from '@/store/projectStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { BarChart3, CheckCircle2, Clock, Lock, Sparkles, Users } from 'lucide-react';
import { MessageContent } from '@/components/ui/MessageContent';
import { formatLocalDate, parseDateValue } from '@/lib/utils';
const formatDuration = (ms: number) => {
  if (!ms || ms <= 0) return '0m';
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
};

const formatDelta = (ms: number) => {
  if (!ms || ms === 0) return '0m';
  const sign = ms < 0 ? '-' : '+';
  return `${sign}${formatDuration(Math.abs(ms))}`;
};

const getMedian = (values: number[]) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
};


interface TaskRow {
  id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
  done_at?: string | null;
  done_estimated_at?: string | null;
  priority: string | null;
}

interface AssignmentRow {
  task_id: string;
  user_id: string;
  user?: { name: string | null; email: string | null; } | null;
}

interface MemberRow {
  user_id: string;
  role: string;
  user?: { name: string | null; email: string | null; } | null;
}

export const AnalyticsView: React.FC = () => {
  const supabase = createClient();
  const { currentProject } = useProjectStore();
  const [memberTaskFilter, setMemberTaskFilter] = useState<'all' | 'todo' | 'in-progress' | 'done' | 'overdue'>('all');
  const [memberTaskSort, setMemberTaskSort] = useState<'estimated' | 'status' | 'title'>('estimated');

  const projectTier = currentProject?.plan_tier === 'enterprise'
    ? 'enterprise'
    : (currentProject?.plan_tier === 'pro' || currentProject?.plan_tier === 'starter' ? currentProject?.plan_tier : (currentProject?.is_premium ? 'pro' : 'free'));
  const isEnterprise = projectTier === 'enterprise';
  const canManage = currentProject?.userRole === 'Owner' || currentProject?.userRole === 'Admin';

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['analytics-tasks', currentProject?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('id,title,status,created_at,updated_at,done_at,done_estimated_at,priority')
        .eq('project_id', currentProject!.id);
      if (error) throw error;
      return data as TaskRow[];
    },
    enabled: !!currentProject?.id && isEnterprise && canManage,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['analytics-members', currentProject?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_members')
        .select('user_id, role, user:users(name,email)')
        .eq('project_id', currentProject!.id);
      if (error) throw error;
      return (data ?? []) as unknown as MemberRow[];
    },
    enabled: !!currentProject?.id && isEnterprise && canManage,
  });
  const taskIds = tasks.map((t) => t.id);
  const { data: assignments = [] } = useQuery({
    queryKey: ['analytics-assignments', currentProject?.id, taskIds.length],
    queryFn: async () => {
      if (taskIds.length === 0) return [];
      const { data, error } = await supabase
        .from('task_assignments')
        .select('task_id,user_id,user:users(name,email)')
        .in('task_id', taskIds);
      if (error) throw error;
      return (data ?? []) as unknown as AssignmentRow[];
    },
    enabled: !!currentProject?.id && taskIds.length > 0 && isEnterprise && canManage,
  });

  const { data: aiInsights, refetch: refetchInsights, isFetching: aiLoading } = useQuery({
    queryKey: ['analytics-ai', currentProject?.id],
    queryFn: async () => {
      const res = await fetch('/api/ia/project/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: currentProject?.id }),
      });
      if (!res.ok) throw new Error('Error al generar insights');
      return res.json() as Promise<{ summary: string; }>;
    },
    enabled: false,
    staleTime: 300000,
  });

  const analytics = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === 'done').length;
    const inProgress = tasks.filter((t) => t.status === 'in-progress').length;
    const todo = tasks.filter((t) => t.status === 'todo').length;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;

    const completedDurations = tasks
      .filter((t) => t.status === 'done')
      .map((t) => {
        const created = new Date(t.created_at).getTime();
        const doneAt = t.done_at ? new Date(t.done_at).getTime() : NaN;
        if (Number.isNaN(created) || Number.isNaN(doneAt)) return null;
        if (doneAt <= created) return null;
        return doneAt - created;
      })
      .filter((v): v is number => v !== null);

    const avgDurationMs = completedDurations.length
      ? completedDurations.reduce((a, b) => a + b, 0) / completedDurations.length
      : null;

    const medianDurationMs = getMedian(completedDurations);

    const tasksByMember: Record<string, number> = {};
    const tasksByMemberDetails: Record<string, TaskRow[]> = {};
    const taskById = new Map(tasks.map((t) => [t.id, t]));

    assignments.forEach((a) => {
      tasksByMember[a.user_id] = (tasksByMember[a.user_id] || 0) + 1;
      const task = taskById.get(a.task_id);
      if (!task) return;
      if (!tasksByMemberDetails[a.user_id]) {
        tasksByMemberDetails[a.user_id] = [];
      }
      tasksByMemberDetails[a.user_id].push(task);
    });

    const estimatedDoneDeltas = tasks
      .filter((t) => t.status === 'done' && t.done_estimated_at && t.done_at)
      .map((t) => {
        const estimatedAt = parseDateValue(t.done_estimated_at as string);
        const doneAt = parseDateValue(t.done_at as string);
        if (!estimatedAt || !doneAt) return null;
        return doneAt.getTime() - estimatedAt.getTime();
      })
      .filter((v): v is number => v !== null);

    const avgEstimateDeltaMs = estimatedDoneDeltas.length
      ? estimatedDoneDeltas.reduce((a, b) => a + b, 0) / estimatedDoneDeltas.length
      : null;

    const onTimeCount = estimatedDoneDeltas.filter((v) => v <= 0).length;
    const lateCount = estimatedDoneDeltas.filter((v) => v > 0).length;
    const estimateComparisons = tasks
      .filter((t) => t.done_estimated_at && t.done_at)
      .map((t) => ({
        id: t.id,
        title: t.title,
        done_estimated_at: t.done_estimated_at as string,
        done_at: t.done_at as string,
      }));

    const unassigned = total - new Set(assignments.map((a) => a.task_id)).size;

    return {
      total,
      done,
      inProgress,
      todo,
      progress,
      avgDurationMs,
      medianDurationMs,
      tasksByMember,
      tasksByMemberDetails,
      unassigned,
      avgEstimateDeltaMs,
      onTimeCount,
      lateCount,
      estimateComparisons,
      estimatedDoneCount: estimatedDoneDeltas.length,
    };
  }, [tasks, assignments]);

  const isOverdue = (task: TaskRow) => {
    if (task.status === 'done') return false;
    if (!task.done_estimated_at) return false;
    const estimatedAt = parseDateValue(task.done_estimated_at);
    return estimatedAt ? estimatedAt.getTime() < Date.now() : false;
  };

  const getSortDateValue = (task: TaskRow) => {
    const rawDate = task.status === 'done' ? task.done_at : task.done_estimated_at;
    if (!rawDate) return Number.POSITIVE_INFINITY;
    const parsed = parseDateValue(rawDate);
    return parsed ? parsed.getTime() : Number.POSITIVE_INFINITY;
  };

  if (!currentProject) return null;

  if (!isEnterprise) {
    return (
      <main className="flex grow flex-col max-h-full overflow-y-auto">
        <div className="flex-1 flex flex-col justify-center items-center p-6">
          <Lock className="h-10 w-10 text-[var(--text-secondary)] mb-3" />
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Analíticas disponibles solo en Enterprise</h2>
          <p className="text-[var(--text-secondary)] mb-4 text-center">Actualiza el plan para acceder a métricas avanzadas del proyecto.</p>
          <Button variant="secondary" onClick={() => window.location.href = '/settings/subscription'}>Ver planes</Button>
        </div>
      </main>
    );
  }

  if (!canManage) {
    return (
      <main className="flex grow flex-col max-h-full overflow-y-auto">
        <div className="flex-1 flex flex-col justify-center items-center p-6">
          <Lock className="h-10 w-10 text-[var(--text-secondary)] mb-3" />
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Acceso restringido</h2>
          <p className="text-[var(--text-secondary)] text-center">Solo Owner o Admin pueden ver analíticas del proyecto.</p>
        </div>
      </main>
    );
  }

  if (tasksLoading) {
    return (
      <div className='flex items-center justify-center h-full p-12'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent-primary)] mx-auto mb-4'></div>
          <p className='text-[var(--text-secondary)]'>Cargando analíticas...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="flex grow flex-col max-h-full overflow-y-auto">
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-[var(--accent-primary)]" />
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Analíticas del Proyecto</h1>
            <p className="text-sm text-[var(--text-secondary)]">Vista avanzada del progreso y productividad</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Avance</CardTitle>
              <CardDescription>Progreso general del proyecto</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-[var(--text-primary)]">{analytics.progress}%</p>
              <p className="text-xs text-[var(--text-secondary)]">{analytics.done} completadas / {analytics.total} tareas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4" /> Tiempo de cierre</CardTitle>
              <CardDescription>Promedio y mediana de finalización</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold text-[var(--text-primary)]">
                Promedio: {analytics.avgDurationMs === null ? 'Sin datos' : formatDuration(analytics.avgDurationMs)}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                Mediana: {analytics.medianDurationMs === null ? 'Sin datos' : formatDuration(analytics.medianDurationMs)}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                Desvio estimado: {analytics.avgEstimateDeltaMs === null ? 'Sin datos' : formatDelta(analytics.avgEstimateDeltaMs)}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                En plazo: {analytics.estimatedDoneCount ? `${analytics.onTimeCount}/${analytics.estimatedDoneCount}` : 'Sin datos'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Estado</CardTitle>
              <CardDescription>Distribución por estado</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-[var(--text-secondary)] space-y-1">
              <div>Por hacer: <span className="text-[var(--text-primary)] font-medium">{analytics.todo}</span></div>
              <div>En progreso: <span className="text-[var(--text-primary)] font-medium">{analytics.inProgress}</span></div>
              <div>Completadas: <span className="text-[var(--text-primary)] font-medium">{analytics.done}</span></div>
              <div>Sin asignar: <span className="text-[var(--text-primary)] font-medium">{analytics.unassigned}</span></div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4" /> Cierre estimado vs real</CardTitle>
            <CardDescription>Comparacion para tareas completadas</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.estimateComparisons.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">Sin datos para comparar.</p>
            ) : (
              <div className="space-y-2">
                {analytics.estimateComparisons.map((task) => {
                  const estimatedAt = formatLocalDate(task.done_estimated_at);
                  const doneAt = formatLocalDate(task.done_at);
                  const estimatedAtDate = parseDateValue(task.done_estimated_at);
                  const doneAtDate = parseDateValue(task.done_at);
                  const deltaMs = estimatedAtDate && doneAtDate
                    ? doneAtDate.getTime() - estimatedAtDate.getTime()
                    : 0;
                  const isLate = deltaMs > 0;
                  return (
                    <div key={task.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 bg-[var(--bg-secondary)] border border-[var(--text-secondary)]/20 rounded-lg p-3">
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">{task.title}</p>
                        <p className="text-xs text-[var(--text-secondary)]">Estimado: {estimatedAt} | Real: {doneAt}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isLate ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {isLate ? 'Retraso' : 'En plazo'}
                        </span>
                        <span className="text-xs font-semibold text-[var(--accent-primary)]">Delta: {formatDelta(deltaMs)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Tareas por miembro</CardTitle>
            <CardDescription>Asignaciones actuales del equipo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
              <div className="flex items-center gap-2">
                <label className="text-xs text-[var(--text-secondary)]">Filtro</label>
                <select
                  className="text-xs bg-[var(--bg-secondary)] border border-[var(--text-secondary)]/20 rounded-md px-2 py-1 text-[var(--text-primary)]"
                  value={memberTaskFilter}
                  onChange={(event) => setMemberTaskFilter(event.target.value as typeof memberTaskFilter)}
                >
                  <option value="all">Todas</option>
                  <option value="todo">Por hacer</option>
                  <option value="in-progress">En progreso</option>
                  <option value="done">Completadas</option>
                  <option value="overdue">Vencidas</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-[var(--text-secondary)]">Orden</label>
                <select
                  className="text-xs bg-[var(--bg-secondary)] border border-[var(--text-secondary)]/20 rounded-md px-2 py-1 text-[var(--text-primary)]"
                  value={memberTaskSort}
                  onChange={(event) => setMemberTaskSort(event.target.value as typeof memberTaskSort)}
                >
                  <option value="estimated">Fecha estimada</option>
                  <option value="status">Estado</option>
                  <option value="title">Titulo</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {members.map((m) => {
                const memberUser = m.user;
                const name = memberUser?.name || memberUser?.email || 'Sin nombre';
                const count = analytics.tasksByMember[m.user_id] || 0;
                const memberTasks = analytics.tasksByMemberDetails[m.user_id] || [];
                const filteredTasks = memberTasks.filter((task) => {
                  if (memberTaskFilter === 'all') return true;
                  if (memberTaskFilter === 'overdue') return isOverdue(task);
                  return task.status === memberTaskFilter;
                });
                const sortedTasks = [...filteredTasks].sort((a, b) => {
                  if (memberTaskSort === 'title') return a.title.localeCompare(b.title);
                  if (memberTaskSort === 'status') {
                    const order: Record<string, number> = { todo: 0, 'in-progress': 1, done: 2 };
                    return (order[a.status] ?? 99) - (order[b.status] ?? 99);
                  }
                  return getSortDateValue(a) - getSortDateValue(b);
                });
                return (
                  <div key={m.user_id} className="bg-[var(--bg-secondary)] border border-[var(--text-secondary)]/20 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">{name}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{m.role}</p>
                      </div>
                      <span className="text-sm font-semibold text-[var(--accent-primary)]">{count}</span>
                    </div>
                    <div className="mt-2 space-y-2">
                      {sortedTasks.length === 0 ? (
                        <p className="text-xs text-[var(--text-secondary)]">Sin tareas asignadas.</p>
                      ) : (
                        sortedTasks.map((task) => {
                          const estimatedText = task.done_estimated_at
                            ? formatLocalDate(task.done_estimated_at)
                            : 'Sin fecha';
                          const doneText = task.done_at
                            ? formatLocalDate(task.done_at)
                            : 'Sin fecha';
                          const overdue = isOverdue(task);
                          return (
                            <div key={task.id} className="text-xs text-[var(--text-secondary)] border-t border-[var(--text-secondary)]/10 pt-2">
                              <p className="text-sm text-[var(--text-primary)]">{task.title}</p>
                              <p>
                                Estado: {task.status}
                                {overdue && <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Vencida</span>}
                              </p>
                              {task.status === 'done'
                                ? <p>Cerrado: {doneText}</p>
                                : <p>Cierre estimado: {estimatedText}</p>}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Insights de IA</CardTitle>
            <CardDescription>Estado actual y recomendaciones</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-3">
              <Button variant="secondary" onClick={() => refetchInsights()} disabled={aiLoading}>
                {aiLoading
                  ? 'Generando...'
                  : (aiInsights?.summary ? 'Actualizar insights' : 'Generar insights')}
              </Button>
            </div>
            <div className="text-sm text-[var(--text-secondary)]">
              {aiInsights?.summary ? (
                <MessageContent content={aiInsights.summary} />
              ) : (
                'Genera un resumen para ver recomendaciones.'
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};
