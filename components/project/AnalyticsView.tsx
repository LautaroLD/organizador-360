'use client';

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useProjectStore } from '@/store/projectStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  HeartPulse,
  Lock,
  Sparkles,
  Users,
} from 'lucide-react';
import { MessageContent } from '@/components/ui/MessageContent';
import { formatLocalDate, parseDateValue } from '@/lib/utils';
import {
  addDaysLocal,
  buildTeamHealthSnapshot,
  toISODateLocal,
} from '@/lib/teamHealth';
import { RoadmapPhase } from '@/models';
import Link from 'next/link';
import { toast } from 'react-toastify';
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

const INITIAL_NOW_MS = Date.now();

const getToneStyles = (tone: 'success' | 'warning' | 'danger' | 'neutral'): React.CSSProperties => {
  const toneMap = {
    success: 'var(--accent-success)',
    warning: 'var(--accent-warning)',
    danger: 'var(--accent-danger)',
    neutral: 'var(--text-secondary)',
  } as const;

  const color = toneMap[tone];

  return {
    color,
    borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
    backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
  };
};

const getOnTimeTone = (rate: number | null): 'success' | 'warning' | 'danger' | 'neutral' => {
  if (rate === null) return 'neutral';
  if (rate >= 80) return 'success';
  if (rate >= 60) return 'warning';
  return 'danger';
};

const getStartOfLocalDayMs = (date: Date) => new Date(
  date.getFullYear(),
  date.getMonth(),
  date.getDate(),
  0,
  0,
  0,
  0,
).getTime();

const getEndOfLocalDayMs = (date: Date) => new Date(
  date.getFullYear(),
  date.getMonth(),
  date.getDate(),
  23,
  59,
  59,
  999,
).getTime();

const getCalendarDayDeltaMs = (estimatedAt: Date, doneAt: Date) => {
  return getStartOfLocalDayMs(doneAt) - getStartOfLocalDayMs(estimatedAt);
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
  phase_roadmap_id?: number | null;
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

interface CheckinRow {
  user_id: string;
  checkin_date: string;
  blockers: string | null;
}

interface TaskTagRow {
  task_id: string;
  tag:
    | { label: string | null }
    | { label: string | null }[]
    | null;
}

type RoadmapPhaseRow = Pick<RoadmapPhase, 'id' | 'name' | 'init_at' | 'end_at' | 'description'>;

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export const AnalyticsView: React.FC = () => {
  const supabase = createClient();
  const { currentProject } = useProjectStore();
  const [memberTaskFilter, setMemberTaskFilter] = useState<'all' | 'todo' | 'in-progress' | 'done' | 'overdue'>('all');
  const [memberTaskSort, setMemberTaskSort] = useState<'estimated' | 'status' | 'title'>('estimated');
  const [showExplanation, setShowExplanation] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const normalizedRole = currentProject?.userRole?.toLowerCase();
  const canManage = normalizedRole === 'owner' || normalizedRole === 'admin';
  const todayDate = toISODateLocal(new Date());
  const weekStartDate = addDaysLocal(todayDate, -6);
  const { data: canAccessAnalytics = false, isLoading: accessLoading } = useQuery({
    queryKey: ['analytics-access', currentProject?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('can_use_project_analytics', {
        p_project_id: currentProject!.id,
      });

      if (error) {
        console.error('Error checking analytics access:', error);
        return false;
      }

      return Boolean(data);
    },
    enabled: !!currentProject?.id && canManage,
    staleTime: 60000,
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['analytics-tasks', currentProject?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('id,title,status,created_at,updated_at,done_at,done_estimated_at,priority,phase_roadmap_id')
        .eq('project_id', currentProject!.id);
      if (error) throw error;
      return data as TaskRow[];
    },
    enabled: !!currentProject?.id && canAccessAnalytics && canManage,
  });

  const { data: roadmapPhases = [] } = useQuery({
    queryKey: ['analytics-roadmap-phases', currentProject?.id],
    queryFn: async () => {
      const { data: roadmap, error: roadmapError } = await supabase
        .from('roadmap')
        .select('id')
        .eq('project_id', currentProject!.id)
        .maybeSingle();

      if (roadmapError) throw roadmapError;
      if (!roadmap) return [] as RoadmapPhaseRow[];

      const { data, error } = await supabase
        .from('phase_roadmap')
        .select('id, name, init_at, end_at, description')
        .eq('roadmap_id', roadmap.id)
        .order('id');

      if (error) throw error;
      return (data || []) as RoadmapPhaseRow[];
    },
    enabled: !!currentProject?.id && canAccessAnalytics && canManage,
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
    enabled: !!currentProject?.id && canAccessAnalytics && canManage,
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
    enabled: !!currentProject?.id && taskIds.length > 0 && canAccessAnalytics && canManage,
  });

  const { data: checkins = [] } = useQuery({
    queryKey: ['analytics-checkins', currentProject?.id, weekStartDate, todayDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_checkins')
        .select('user_id,checkin_date,blockers')
        .eq('project_id', currentProject!.id)
        .gte('checkin_date', weekStartDate)
        .lte('checkin_date', todayDate);
      if (error) throw error;
      return (data ?? []) as CheckinRow[];
    },
    enabled: !!currentProject?.id && canAccessAnalytics && canManage,
  });

  const { data: taskTags = [] } = useQuery({
    queryKey: ['analytics-task-tags', currentProject?.id, taskIds.length],
    queryFn: async () => {
      if (taskIds.length === 0) return [];
      const { data, error } = await supabase
        .from('task_tags')
        .select('task_id,tag:project_tags(label)')
        .in('task_id', taskIds);
      if (error) throw error;
      return (data ?? []) as unknown as TaskTagRow[];
    },
    enabled: !!currentProject?.id && taskIds.length > 0 && canAccessAnalytics && canManage,
  });

  const { data: aiInsights, refetch: refetchInsights, isFetching: aiLoading } = useQuery({
    queryKey: ['analytics-ai', currentProject?.id],
    queryFn: async () => {
      const phaseSummary = roadmapPhases.map((phase) => {
        const phaseTasks = tasks.filter((task) => task.phase_roadmap_id === phase.id);
        const doneCount = phaseTasks.filter((task) => task.status === 'done').length;
        const inProgressCount = phaseTasks.filter((task) => task.status === 'in-progress').length;
        const todoCount = phaseTasks.filter((task) => task.status === 'todo').length;
        const totalCount = phaseTasks.length;
        const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
        return {
          id: phase.id,
          name: phase.name,
          total: totalCount,
          done: doneCount,
          inProgress: inProgressCount,
          todo: todoCount,
          progress,
        };
      });

      const res = await fetch('/api/ia/project/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: currentProject?.id,
          phaseSummary,
          requestId: crypto.randomUUID(),
        }),
      });

      if (res.status === 402) {
        toast.error('No tienes créditos suficientes para generar insights.');
        throw new Error('No tienes créditos suficientes para generar insights.');
      }

      if (res.status === 403) {
        toast.error('Esta función está disponible solo para plan Pro.');
        throw new Error('Esta función está disponible solo para plan Pro.');
      }

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
        return getCalendarDayDeltaMs(estimatedAt, doneAt);
      })
      .filter((v): v is number => v !== null);

    const avgEstimateDeltaMs = estimatedDoneDeltas.length
      ? estimatedDoneDeltas.reduce((a, b) => a + b, 0) / estimatedDoneDeltas.length
      : null;

    const onTimeCount = estimatedDoneDeltas.filter((v) => v <= 0).length;
    const lateCount = estimatedDoneDeltas.filter((v) => v > 0).length;
    const onTimeRate = estimatedDoneDeltas.length
      ? Math.round((onTimeCount / estimatedDoneDeltas.length) * 100)
      : null;
    const estimateComparisons = tasks
      .filter((t) => t.done_estimated_at && t.done_at)
      .map((t) => ({
        id: t.id,
        title: t.title,
        done_estimated_at: t.done_estimated_at as string,
        done_at: t.done_at as string,
      }));

    const unassigned = total - new Set(assignments.map((a) => a.task_id)).size;

    const phaseBreakdown = roadmapPhases.map((phase) => {
      const phaseTasks = tasks.filter((task) => task.phase_roadmap_id === phase.id);
      const doneCount = phaseTasks.filter((task) => task.status === 'done').length;
      const inProgressCount = phaseTasks.filter((task) => task.status === 'in-progress').length;
      const todoCount = phaseTasks.filter((task) => task.status === 'todo').length;
      const totalCount = phaseTasks.length;
      const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
      return {
        id: phase.id,
        name: phase.name,
        total: totalCount,
        done: doneCount,
        inProgress: inProgressCount,
        todo: todoCount,
        progress,
      };
    });

    const unassignedCount = tasks.filter((task) => !task.phase_roadmap_id).length;

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
      onTimeRate,
      estimateComparisons,
      estimatedDoneCount: estimatedDoneDeltas.length,
      phaseBreakdown,
      phaseUnassigned: unassignedCount,
    };
  }, [assignments, roadmapPhases, tasks]);

  const teamHealth = useMemo(() => {
    const healthMembers = members.map((m) => {
      const rawUser = m.user;
      return {
        user_id: m.user_id,
        role: m.role,
        name: rawUser?.name || rawUser?.email || 'Sin nombre',
      };
    });

    const healthTaskTags = taskTags.flatMap((row) => {
      const rawTag = Array.isArray(row.tag) ? row.tag[0] : row.tag;
      const label = rawTag?.label?.trim();
      return label ? [{ task_id: row.task_id, label }] : [];
    });

    return buildTeamHealthSnapshot({
      members: healthMembers,
      tasks,
      assignments,
      checkins,
      taskTags: healthTaskTags,
      todayDate,
      nowMs: INITIAL_NOW_MS,
    });
  }, [assignments, checkins, members, taskTags, tasks, todayDate]);

  const handleExport = async (format: 'json' | 'csv') => {
    if (!currentProject?.id || exporting) return;
    setExporting(true);
    setShowExportMenu(false);

    try {
      const res = await fetch(
        `/api/projects/${currentProject.id}/export?format=${format}&datasets=all`,
      );

      if (res.status === 403) {
        toast.error('La exportación está disponible solo para Owner/Admin en plan Pro.');
        return;
      }

      if (!res.ok) {
        toast.error('No se pudo exportar los datos del proyecto.');
        return;
      }

      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/);
      const fallbackName =
        format === 'csv'
          ? `${currentProject.name || 'proyecto'}-export-csv.json`
          : `${currentProject.name || 'proyecto'}-export.json`;
      const filename = match?.[1] || fallbackName;

      if (format === 'csv') {
        const contentType = res.headers.get('Content-Type') || '';
        if (contentType.includes('text/csv')) {
          const text = await res.text();
          downloadBlob(new Blob([text], { type: 'text/csv;charset=utf-8' }), filename);
        } else {
          const payload = await res.json() as {
            files?: Record<string, string>;
          };
          if (payload.files && Object.keys(payload.files).length > 0) {
            Object.entries(payload.files).forEach(([fileName, content]) => {
              downloadBlob(
                new Blob([content], { type: 'text/csv;charset=utf-8' }),
                fileName,
              );
            });
          } else {
            downloadBlob(
              new Blob([JSON.stringify(payload, null, 2)], {
                type: 'application/json;charset=utf-8',
              }),
              filename,
            );
          }
        }
      } else {
        const text = await res.text();
        downloadBlob(new Blob([text], { type: 'application/json;charset=utf-8' }), filename);
      }

      toast.success('Exportación lista');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Error al exportar datos');
    } finally {
      setExporting(false);
    }
  };

  const isOverdue = (task: TaskRow) => {
    if (task.status === 'done') return false;
    if (!task.done_estimated_at) return false;
    const estimatedAt = parseDateValue(task.done_estimated_at);
    return estimatedAt ? getEndOfLocalDayMs(estimatedAt) < INITIAL_NOW_MS : false;
  };

  const getSortDateValue = (task: TaskRow) => {
    const rawDate = task.status === 'done' ? task.done_at : task.done_estimated_at;
    if (!rawDate) return Number.POSITIVE_INFINITY;
    const parsed = parseDateValue(rawDate);
    return parsed ? parsed.getTime() : Number.POSITIVE_INFINITY;
  };

  if (!currentProject) return null;

  if (canManage && accessLoading) {
    return (
      <div className='flex items-center justify-center h-full p-12'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent-primary)] mx-auto mb-4'></div>
          <p className='text-[var(--text-secondary)]'>Validando acceso a analíticas...</p>
        </div>
      </div>
    );
  }

  if (!canAccessAnalytics && canManage) {
    return (
      <main className="flex grow flex-col max-h-full overflow-y-auto">
        <div className="flex-1 flex flex-col justify-center items-center p-6">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4">Analíticas disponibles solo en Pro</h2>
          <Lock size={ 48 } className=" text-[var(--text-secondary)] mb-4" />
          <p className="text-[var(--text-secondary)] mb-6 text-center">Actualiza el plan para acceder a métricas avanzadas del proyecto.</p>
          <Link className='bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] px-2 py-1 rounded-lg font-semibold' href="/settings/subscription">
            Ver planes
          </Link>
        </div>
      </main>
    );
  }

  if (!canManage) {
    return (
      <main className="flex grow flex-col max-h-full overflow-y-auto">
        <div className="flex-1 gap-4 flex flex-col justify-center items-center p-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] ">Acceso restringido</h2>
          <Lock size={ 48 } className=" text-[var(--text-secondary)] " />
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

  const donePct = analytics.total > 0 ? (analytics.done / analytics.total) * 100 : 0;
  const inProgressPct = analytics.total > 0 ? (analytics.inProgress / analytics.total) * 100 : 0;
  const todoPct = analytics.total > 0 ? (analytics.todo / analytics.total) * 100 : 0;
  const onTimeTone = getOnTimeTone(analytics.onTimeRate);

  return (
    <main className="flex grow flex-col max-h-full overflow-y-auto">
      <div className="p-6 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <HeartPulse className="h-6 w-6 text-[var(--accent-primary)]" />
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">Salud del equipo</h1>
              <p className="text-sm text-[var(--text-secondary)]">
                Check-ins, carga de trabajo, alertas y métricas del proyecto
              </p>
            </div>
          </div>
          <div className="relative">
            <Button
              variant="secondary"
              onClick={ () => setShowExportMenu((open) => !open) }
              disabled={ exporting }
            >
              <Download className="h-4 w-4 mr-1" />
              { exporting ? 'Exportando...' : 'Exportar datos' }
            </Button>
            { showExportMenu && (
              <div className="absolute right-0 mt-2 z-20 min-w-[180px] rounded-lg border border-[var(--text-secondary)]/20 bg-[var(--bg-primary)] shadow-lg p-1">
                <button
                  type="button"
                  className="w-full text-left text-sm px-3 py-2 rounded-md hover:bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                  onClick={ () => handleExport('json') }
                >
                  JSON completo
                </button>
                <button
                  type="button"
                  className="w-full text-left text-sm px-3 py-2 rounded-md hover:bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                  onClick={ () => handleExport('csv') }
                >
                  CSV (datasets)
                </button>
              </div>
            ) }
          </div>
        </div>

        <Card>
          <CardHeader
            className="cursor-pointer hover:bg-[var(--bg-secondary)]/50 transition-colors"
            onClick={ () => setShowExplanation(!showExplanation) }
          >
            <CardTitle className="text-base flex items-center justify-between">
              <span>¿Cómo funciona el panel de salud?</span>
              { showExplanation ? (
                <ChevronUp className="h-4 w-4 text-[var(--text-secondary)]" />
              ) : (
                <ChevronDown className="h-4 w-4 text-[var(--text-secondary)]" />
              ) }
            </CardTitle>
          </CardHeader>
          { showExplanation && (
            <CardContent className="text-sm text-[var(--text-secondary)] space-y-3">
              <p>
                Este panel combina analíticas del proyecto con señales de liderazgo de equipo:
              </p>
              <ul className="list-disc list-inside space-y-1.5 ml-2">
                <li><strong className="text-[var(--text-primary)]">Cumplimiento de check-ins:</strong> quién faltó hoy y esta semana.</li>
                <li><strong className="text-[var(--text-primary)]">Carga por persona:</strong> abiertas, en progreso y vencidas.</li>
                <li><strong className="text-[var(--text-primary)]">Alertas accionables:</strong> blockers recurrentes, sobrecarga y entregas fuera de plazo.</li>
                <li><strong className="text-[var(--text-primary)]">Throughput / on-time:</strong> ritmo de cierre por persona y por tag.</li>
                <li><strong className="text-[var(--text-primary)]">Exportación:</strong> descarga JSON o CSV de tareas, miembros, check-ins, eventos, OKRs y analytics.</li>
              </ul>
            </CardContent>
          ) }
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Check-ins hoy</CardTitle>
              <CardDescription>Cumplimiento del día</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-[var(--text-primary)]">
                { teamHealth.checkinCompliance.complianceTodayRate === null
                  ? 'Sin datos'
                  : `${teamHealth.checkinCompliance.complianceTodayRate}%` }
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                { teamHealth.checkinCompliance.missedToday.length === 0
                  ? 'Todos los miembros activos completaron el check-in'
                  : `Faltan: ${teamHealth.checkinCompliance.missedToday.map((m) => m.name).join(', ')}` }
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Check-ins semana</CardTitle>
              <CardDescription>Últimos 7 días</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-[var(--text-primary)]">
                { teamHealth.checkinCompliance.complianceWeekRate === null
                  ? 'Sin datos'
                  : `${teamHealth.checkinCompliance.complianceWeekRate}%` }
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                { teamHealth.checkinCompliance.missedThisWeek.length === 0
                  ? 'Nadie quedó sin check-in esta semana'
                  : `Sin check-in: ${teamHealth.checkinCompliance.missedThisWeek.map((m) => m.name).join(', ')}` }
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Alertas</CardTitle>
              <CardDescription>Señales accionables</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-[var(--text-primary)]">{ teamHealth.alerts.length }</p>
              <p className="text-xs text-[var(--text-secondary)]">
                { teamHealth.alerts.length === 0
                  ? 'Sin alertas activas'
                  : `${teamHealth.alerts.filter((a) => a.severity === 'danger').length} críticas` }
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Avance</CardTitle>
              <CardDescription>Progreso general del proyecto</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-[var(--text-primary)]">{ analytics.progress }%</p>
              <p className="text-xs text-[var(--text-secondary)]">{ analytics.done } completadas / { analytics.total } tareas</p>
              <div className="mt-3 h-2 rounded-full bg-[var(--bg-primary)] overflow-hidden">
                <div className="h-full bg-[var(--accent-primary)] transition-all" style={ { width: `${analytics.progress}%` } } />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Alertas del equipo</CardTitle>
            <CardDescription>Blockers recurrentes, sobrecarga y riesgos de entrega</CardDescription>
          </CardHeader>
          <CardContent>
            { teamHealth.alerts.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">No hay alertas activas. El equipo se ve estable.</p>
            ) : (
              <div className="space-y-2">
                { teamHealth.alerts.map((alert) => (
                  <div
                    key={ alert.id }
                    className="rounded-lg border p-3"
                    style={ getToneStyles(alert.severity === 'info' ? 'neutral' : alert.severity) }
                  >
                    <p className="text-sm font-semibold">{ alert.title }</p>
                    <p className="text-xs mt-1 opacity-90">{ alert.detail }</p>
                  </div>
                )) }
              </div>
            ) }
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Carga de trabajo por miembro</CardTitle>
            <CardDescription>Abiertas, en progreso y vencidas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              { teamHealth.workload.map((row) => (
                <div key={ row.userId } className="bg-[var(--bg-secondary)] border border-[var(--text-secondary)]/20 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{ row.name }</p>
                      <p className="text-xs text-[var(--text-secondary)]">{ row.role }</p>
                    </div>
                    <span className="text-sm font-semibold text-[var(--accent-primary)]">{ row.total }</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-[var(--text-secondary)]">
                    <div>
                      Abiertas
                      <p className="text-[var(--text-primary)] font-semibold">{ row.open }</p>
                    </div>
                    <div>
                      En progreso
                      <p className="text-[var(--text-primary)] font-semibold">{ row.inProgress }</p>
                    </div>
                    <div>
                      Vencidas
                      <p className="font-semibold" style={ { color: row.overdue > 0 ? 'var(--accent-danger)' : 'var(--text-primary)' } }>
                        { row.overdue }
                      </p>
                    </div>
                  </div>
                </div>
              )) }
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Throughput por persona</CardTitle>
              <CardDescription>Cierres y % en plazo</CardDescription>
            </CardHeader>
            <CardContent>
              { teamHealth.throughputByMember.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">Aún no hay tareas cerradas asignadas.</p>
              ) : (
                <div className="space-y-2">
                  { teamHealth.throughputByMember.map((point) => (
                    <div key={ point.key } className="flex items-center justify-between gap-3 bg-[var(--bg-secondary)] border border-[var(--text-secondary)]/20 rounded-lg p-3">
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">{ point.label }</p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          { point.doneCount } cerradas · { point.onTimeCount } en plazo · { point.lateCount } tarde
                        </p>
                      </div>
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full border"
                        style={ getToneStyles(getOnTimeTone(point.onTimeRate)) }
                      >
                        { point.onTimeRate === null ? 'Sin est.' : `${point.onTimeRate}%` }
                      </span>
                    </div>
                  )) }
                </div>
              ) }
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Throughput por tag</CardTitle>
              <CardDescription>Rendimiento por etiqueta de tarea</CardDescription>
            </CardHeader>
            <CardContent>
              { teamHealth.throughputByTag.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">No hay tags en tareas cerradas.</p>
              ) : (
                <div className="space-y-2">
                  { teamHealth.throughputByTag.map((point) => (
                    <div key={ point.key } className="flex items-center justify-between gap-3 bg-[var(--bg-secondary)] border border-[var(--text-secondary)]/20 rounded-lg p-3">
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">{ point.label }</p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          { point.doneCount } cerradas · { point.onTimeCount } en plazo · { point.lateCount } tarde
                        </p>
                      </div>
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full border"
                        style={ getToneStyles(getOnTimeTone(point.onTimeRate)) }
                      >
                        { point.onTimeRate === null ? 'Sin est.' : `${point.onTimeRate}%` }
                      </span>
                    </div>
                  )) }
                </div>
              ) }
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Entrega en plazo</CardTitle>
              <CardDescription>Calidad de estimación y cumplimiento</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-[var(--text-primary)]">
                { analytics.onTimeRate === null ? 'Sin datos' : `${analytics.onTimeRate}%` }
              </p>
              <p className="text-xs text-[var(--text-secondary)] mb-3">
                { analytics.estimatedDoneCount
                  ? `${analytics.onTimeCount} en plazo / ${analytics.lateCount} con retraso`
                  : 'No hay tareas cerradas con fecha estimada' }
              </p>
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold border"
                style={ getToneStyles(onTimeTone) }
              >
                { analytics.onTimeRate === null
                  ? 'Sin referencia'
                  : analytics.onTimeRate >= 80
                    ? 'Saludable'
                    : analytics.onTimeRate >= 60
                      ? 'A vigilar'
                      : 'Riesgo alto' }
              </span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4" /> Tiempo de cierre</CardTitle>
              <CardDescription>Promedio y mediana de finalización</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold text-[var(--text-primary)]">
                Promedio: { analytics.avgDurationMs === null ? 'Sin datos' : formatDuration(analytics.avgDurationMs) }
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                Mediana: { analytics.medianDurationMs === null ? 'Sin datos' : formatDuration(analytics.medianDurationMs) }
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                Desvio estimado: { analytics.avgEstimateDeltaMs === null ? 'Sin datos' : formatDelta(analytics.avgEstimateDeltaMs) }
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                En plazo: { analytics.estimatedDoneCount ? `${analytics.onTimeCount}/${analytics.estimatedDoneCount}` : 'Sin datos' }
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Estado</CardTitle>
              <CardDescription>Distribución por estado</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-[var(--text-secondary)] space-y-1">
              <div className="h-2 rounded-full bg-[var(--bg-primary)] overflow-hidden mb-3">
                <div className="h-full flex">
                  <div className="bg-[var(--accent-primary)]" style={ { width: `${todoPct}%` } } />
                  <div className="bg-[var(--accent-warning)]" style={ { width: `${inProgressPct}%` } } />
                  <div className="bg-[var(--accent-success)]" style={ { width: `${donePct}%` } } />
                </div>
              </div>
              <div>Por hacer: <span className="text-[var(--text-primary)] font-medium">{ analytics.todo }</span></div>
              <div>En progreso: <span className="text-[var(--text-primary)] font-medium">{ analytics.inProgress }</span></div>
              <div>Completadas: <span className="text-[var(--text-primary)] font-medium">{ analytics.done }</span></div>
              <div>Sin asignar: <span className="text-[var(--text-primary)] font-medium">{ analytics.unassigned }</span></div>
            </CardContent>
          </Card>
        </div>

        { analytics.phaseBreakdown.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Estado por fase</CardTitle>
              <CardDescription>Detalle de avance por etapa del roadmap</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                { analytics.phaseBreakdown.map((phase) => (
                  <div key={ phase.id } className="bg-[var(--bg-secondary)] border border-[var(--text-secondary)]/20 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-[var(--text-primary)]">{ phase.name }</p>
                      <span className="text-xs text-[var(--text-secondary)]">{ phase.progress }%</span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--bg-primary)] overflow-hidden">
                      <div
                        className="h-full bg-[var(--accent-primary)] transition-all"
                        style={ { width: `${phase.progress}%` } }
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-[var(--text-secondary)]">
                      <span>Hechas: { phase.done }</span>
                      <span>En progreso: { phase.inProgress }</span>
                      <span>Pendientes: { phase.todo }</span>
                    </div>
                  </div>
                )) }
              </div>
              { analytics.phaseUnassigned > 0 && (
                <p className="mt-3 text-xs text-[var(--text-secondary)]">
                  Tareas sin fase: { analytics.phaseUnassigned }
                </p>
              ) }
            </CardContent>
          </Card>
        ) }

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4" /> Cierre estimado vs real</CardTitle>
            <CardDescription>Comparacion para tareas completadas</CardDescription>
          </CardHeader>
          <CardContent>
            { analytics.estimateComparisons.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">Sin datos para comparar.</p>
            ) : (
              <div className="space-y-2">
                { analytics.estimateComparisons.map((task) => {
                  const estimatedAt = formatLocalDate(task.done_estimated_at);
                  const doneAt = formatLocalDate(task.done_at);
                  const estimatedAtDate = parseDateValue(task.done_estimated_at);
                  const doneAtDate = parseDateValue(task.done_at);
                  const deltaMs = estimatedAtDate && doneAtDate
                    ? getCalendarDayDeltaMs(estimatedAtDate, doneAtDate)
                    : 0;
                  const isLate = deltaMs > 0;
                  return (
                    <div key={ task.id } className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 bg-[var(--bg-secondary)] border border-[var(--text-secondary)]/20 rounded-lg p-3">
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">{ task.title }</p>
                        <p className="text-xs text-[var(--text-secondary)]">Estimado: { estimatedAt } | Real: { doneAt }</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                          style={ getToneStyles(isLate ? 'danger' : 'success') }
                        >
                          { isLate ? 'Retraso' : 'En plazo' }
                        </span>
                        <span className="text-xs font-semibold text-[var(--accent-primary)]">Delta: { formatDelta(deltaMs) }</span>
                      </div>
                    </div>
                  );
                }) }
              </div>
            ) }
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
                  value={ memberTaskFilter }
                  onChange={ (event) => setMemberTaskFilter(event.target.value as typeof memberTaskFilter) }
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
                  value={ memberTaskSort }
                  onChange={ (event) => setMemberTaskSort(event.target.value as typeof memberTaskSort) }
                >
                  <option value="estimated">Fecha estimada</option>
                  <option value="status">Estado</option>
                  <option value="title">Titulo</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              { members.map((m) => {
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
                  <div key={ m.user_id } className="bg-[var(--bg-secondary)] border border-[var(--text-secondary)]/20 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">{ name }</p>
                        <p className="text-xs text-[var(--text-secondary)]">{ m.role }</p>
                      </div>
                      <span className="text-sm font-semibold text-[var(--accent-primary)]">{ count }</span>
                    </div>
                    <div className="mt-2 space-y-2">
                      { sortedTasks.length === 0 ? (
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
                            <div key={ task.id } className="text-xs text-[var(--text-secondary)] border-t border-[var(--text-secondary)]/10 pt-2">
                              <p className="text-sm text-[var(--text-primary)]">{ task.title }</p>
                              <p>
                                Estado: { task.status }
                                { overdue && (
                                  <span
                                    className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                                    style={ getToneStyles('danger') }
                                  >
                                    Vencida
                                  </span>
                                ) }
                              </p>
                              { task.status === 'done'
                                ? <p>Cerrado: { doneText }</p>
                                : <p>Cierre estimado: { estimatedText }</p> }
                            </div>
                          );
                        })
                      ) }
                    </div>
                  </div>
                );
              }) }
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
              <Button variant="secondary" onClick={ () => refetchInsights() } disabled={ aiLoading }>
                { aiLoading
                  ? 'Generando...'
                  : (aiInsights?.summary ? 'Actualizar insights' : 'Generar insights') }
              </Button>
            </div>
            <div className="text-sm text-[var(--text-secondary)]">
              { aiInsights?.summary ? (
                <MessageContent content={ aiInsights.summary } />
              ) : (
                'Genera un resumen para ver recomendaciones.'
              ) }
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};
