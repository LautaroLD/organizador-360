'use client';

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useProjectStore } from '@/store/projectStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { BarChart3, CheckCircle2, Clock, Lock, Sparkles, Users } from 'lucide-react';
import { MessageContent } from '@/components/ui/MessageContent';
const formatDuration = (ms: number) => {
  if (!ms || ms <= 0) return '0m';
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
};

interface TaskRow {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  done_at?: string | null;
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
        .select('id,status,created_at,updated_at,done_at,priority')
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
  console.log(members);

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
    enabled: !!currentProject?.id && isEnterprise && canManage,
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

    const medianDurationMs = completedDurations.length
      ? [...completedDurations].sort((a, b) => a - b)[Math.floor(completedDurations.length / 2)]
      : null;

    const tasksByMember: Record<string, number> = {};
    assignments.forEach((a) => {
      tasksByMember[a.user_id] = (tasksByMember[a.user_id] || 0) + 1;
    });

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
      unassigned,
    };
  }, [tasks, assignments]);

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
            <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Tareas por miembro</CardTitle>
            <CardDescription>Asignaciones actuales del equipo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {members.map((m) => {
                const memberUser = m.user;
                const name = memberUser?.name || memberUser?.email || 'Sin nombre';
                const count = analytics.tasksByMember[m.user_id] || 0;
                return (
                  <div key={m.user_id} className="flex items-center justify-between bg-[var(--bg-secondary)] border border-[var(--text-secondary)]/20 rounded-lg p-3">
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{name}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{m.role}</p>
                    </div>
                    <span className="text-sm font-semibold text-[var(--accent-primary)]">{count}</span>
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
                {aiLoading ? 'Generando...' : 'Actualizar insights'}
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
