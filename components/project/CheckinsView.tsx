'use client';

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useProjectStore } from '@/store/projectStore';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { formatDateTime, formatLocalDate } from '@/lib/utils';
import { toast } from 'react-toastify';
import { AlertTriangle, CheckSquare, Clock, Filter, Save } from 'lucide-react';
import type { ProjectCheckin, UpsertCheckinDTO } from '@/models';

type CheckinFilter = 'all' | 'blockers' | 'mine';
type DateScope = 'date' | 'all';

interface ProjectMemberUserRow {
  user_id: string;
  user: { name: string | null; email: string | null; } | { name: string | null; email: string | null; }[] | null;
}

const toISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const CheckinsView: React.FC = () => {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { currentProject } = useProjectStore();
  const { user } = useAuthStore();

  const todayDate = toISODate(new Date());
  const [listDate, setListDate] = useState<string>(todayDate);
  const [dateScope, setDateScope] = useState<DateScope>('date');
  const [filter, setFilter] = useState<CheckinFilter>('all');

  const [yesterday, setYesterday] = useState('');
  const [today, setToday] = useState('');
  const [blockers, setBlockers] = useState('');

  const { data: myTodayCheckin } = useQuery({
    queryKey: ['project-checkins-me-today', currentProject?.id, user?.id, todayDate],
    queryFn: async () => {
      if (!currentProject?.id || !user?.id) return null;

      const { data, error } = await supabase
        .from('project_checkins')
        .select('id,project_id,user_id,checkin_date,yesterday,today,blockers,created_at,updated_at,user:users(name,email)')
        .eq('project_id', currentProject.id)
        .eq('user_id', user.id)
        .eq('checkin_date', todayDate)
        .maybeSingle();

      if (error) throw error;
      return (data as unknown as ProjectCheckin) ?? null;
    },
    enabled: !!currentProject?.id && !!user?.id,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const { data: projectMembers = [] } = useQuery({
    queryKey: ['project-checkins-members', currentProject?.id],
    queryFn: async () => {
      if (!currentProject?.id) return [];

      const { data, error } = await supabase
        .from('project_members')
        .select('user_id,user:users(name,email)')
        .eq('project_id', currentProject.id);

      if (error) throw error;
      return (data ?? []) as unknown as ProjectMemberUserRow[];
    },
    enabled: !!currentProject?.id,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const { data: checkins = [], isLoading } = useQuery({
    queryKey: ['project-checkins', currentProject?.id, dateScope, listDate],
    queryFn: async () => {
      if (!currentProject?.id) return [];

      let query = supabase
        .from('project_checkins')
        .select('id,project_id,user_id,checkin_date,yesterday,today,blockers,created_at,updated_at,user:users(name,email)')
        .eq('project_id', currentProject.id);

      if (dateScope === 'date') {
        query = query.eq('checkin_date', listDate);
      }

      const { data, error } = await query.order('updated_at', { ascending: false });

      if (error) throw error;

      return (data ?? []) as unknown as ProjectCheckin[];
    },
    enabled: !!currentProject?.id,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const memberNameByUserId = useMemo(() => {
    const map = new Map<string, string>();

    projectMembers.forEach((member) => {
      const rawUser = Array.isArray(member.user) ? member.user[0] : member.user;
      const displayName = rawUser?.name || rawUser?.email;
      if (displayName) {
        map.set(member.user_id, displayName);
      }
    });

    return map;
  }, [projectMembers]);

  const myCheckinInListDate = useMemo(
    () => checkins.find((entry) => entry.user_id === user?.id) ?? null,
    [checkins, user?.id]
  );

  React.useEffect(() => {
    if (!myTodayCheckin) {
      setYesterday('');
      setToday('');
      setBlockers('');
      return;
    }

    setYesterday(myTodayCheckin.yesterday ?? '');
    setToday(myTodayCheckin.today ?? '');
    setBlockers(myTodayCheckin.blockers ?? '');
  }, [myTodayCheckin]);

  const upsertMutation = useMutation({
    mutationFn: async (payload: UpsertCheckinDTO) => {
      const { error } = await supabase.from('project_checkins').upsert(payload, {
        onConflict: 'project_id,user_id,checkin_date',
      });

      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['project-checkins', currentProject?.id] }),
        queryClient.invalidateQueries({ queryKey: ['project-checkins-me-today', currentProject?.id, user?.id, todayDate] }),
        queryClient.invalidateQueries({ queryKey: ['project-checkins-members', currentProject?.id] }),
      ]);

      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['project-checkins', currentProject?.id], type: 'active' }),
        queryClient.refetchQueries({ queryKey: ['project-checkins-me-today', currentProject?.id, user?.id, todayDate], type: 'active' }),
        queryClient.refetchQueries({ queryKey: ['project-checkins-members', currentProject?.id], type: 'active' }),
      ]);

      toast.success('Check-in guardado');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'No se pudo guardar el check-in');
    },
  });

  const handleSave = () => {
    if (!currentProject?.id || !user?.id) {
      toast.error('No se pudo identificar el proyecto o usuario');
      return;
    }

    if (!yesterday.trim() && !today.trim() && !blockers.trim()) {
      toast.error('Completa al menos un campo del check-in');
      return;
    }

    upsertMutation.mutate({
      project_id: currentProject.id,
      user_id: user.id,
      checkin_date: todayDate,
      yesterday: yesterday.trim(),
      today: today.trim(),
      blockers: blockers.trim(),
    });
  };

  const filteredCheckins = checkins.filter((entry) => {
    if (filter === 'mine') return entry.user_id === user?.id;
    if (filter === 'blockers') return Boolean(entry.blockers?.trim());
    return true;
  });

  const blockersCount = checkins.filter((entry) => Boolean(entry.blockers?.trim())).length;
  const hasTodayCheckin = Boolean(myTodayCheckin);

  if (!currentProject) return null;

  return (
    <main className="flex grow flex-col max-h-full overflow-y-auto p-4 md:p-6 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            Check-in diario
          </CardTitle>
          <CardDescription>
            Registra ayer, hoy y bloqueos en menos de 2 minutos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasTodayCheckin ? (
            <div className="rounded-lg border border-[var(--accent-success)]/50 bg-[var(--accent-success)]/10 p-3 text-sm text-[var(--accent-success)]">
              Ya completaste tu check-in de hoy. Puedes modificarlo si hubo cambios.
            </div>
          ) : (
            <div className="rounded-lg border border-[var(--accent-warning)]/50 bg-[var(--accent-warning)]/10 p-3 text-sm text-[var(--accent-warning)]">
              Aún no completaste tu check-in de hoy.
            </div>
          )}

          <div className="rounded-lg border border-[var(--text-secondary)]/30 bg-[var(--bg-secondary)] p-3 max-w-sm">
            <p className="text-xs text-[var(--text-secondary)]">Fecha fija del check-in</p>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{formatLocalDate(todayDate)}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <label className="space-y-2">
              <span className="text-sm font-medium text-[var(--text-primary)]">Ayer</span>
              <textarea
                value={yesterday}
                onChange={(e) => setYesterday(e.target.value)}
                placeholder="¿Qué avanzaste ayer?"
                className="w-full min-h-28 rounded-lg border border-[var(--text-secondary)] bg-[var(--bg-primary)] p-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-[var(--text-primary)]">Hoy</span>
              <textarea
                value={today}
                onChange={(e) => setToday(e.target.value)}
                placeholder="¿Qué vas a hacer hoy?"
                className="w-full min-h-28 rounded-lg border border-[var(--text-secondary)] bg-[var(--bg-primary)] p-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-[var(--text-primary)]">Bloqueos</span>
              <textarea
                value={blockers}
                onChange={(e) => setBlockers(e.target.value)}
                placeholder="¿Qué te está bloqueando?"
                className="w-full min-h-28 rounded-lg border border-[var(--text-secondary)] bg-[var(--bg-primary)] p-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              />
            </label>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-[var(--text-secondary)]">
              Recordatorio recomendado: completar el check-in al iniciar la jornada.
            </p>
            <Button
              type="button"
              onClick={handleSave}
              disabled={upsertMutation.isPending}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {upsertMutation.isPending ? 'Guardando...' : hasTodayCheckin ? 'Modificar check-in' : 'Guardar check-in'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {dateScope === 'all' ? 'Todos los check-ins' : `Check-ins del día ${formatLocalDate(listDate)}`}
          </CardTitle>
          <CardDescription className="flex items-center gap-3 flex-wrap">
            <span>{checkins.length} enviados</span>
            <span className="inline-flex items-center gap-1 text-[var(--accent-warning)]">
              <AlertTriangle className="h-4 w-4" />
              {blockersCount} con bloqueo
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={dateScope === 'date' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setDateScope('date')}
            >
              Por fecha
            </Button>
            <Button
              variant={dateScope === 'all' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setDateScope('all')}
            >
              Todas las fechas
            </Button>
          </div>

          {dateScope === 'date' && (
            <div className="max-w-xs">
              <Input
                type="date"
                label="Filtrar por fecha"
                value={listDate}
                onChange={(e) => setListDate(e.target.value)}
              />
            </div>
          )}

          {dateScope === 'all' && (
            <p className="text-xs text-[var(--text-secondary)]">
              Mostrando check-ins de todas las fechas.
            </p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-[var(--text-secondary)]" />
            <Button
              variant={filter === 'all' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              Todos
            </Button>
            <Button
              variant={filter === 'blockers' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setFilter('blockers')}
            >
              Solo bloqueos
            </Button>
            <Button
              variant={filter === 'mine' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setFilter('mine')}
            >
              Solo yo
            </Button>
          </div>

          {filter === 'mine' && !myCheckinInListDate && (
            <p className="text-xs text-[var(--text-secondary)]">
              {dateScope === 'all'
                ? 'No tienes check-ins cargados.'
                : 'No tienes check-in cargado para la fecha seleccionada.'}
            </p>
          )}

          {isLoading ? (
            <p className="text-sm text-[var(--text-secondary)]">Cargando check-ins...</p>
          ) : filteredCheckins.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">No hay check-ins para este filtro.</p>
          ) : (
            <div className="space-y-3">
              {filteredCheckins.map((entry) => {
                const displayName = entry.user?.name;
                const hasBlockers = Boolean(entry.blockers?.trim());

                return (
                  <div
                    key={entry.id}
                    className="rounded-lg border border-[var(--text-secondary)]/20 bg-[var(--bg-secondary)] p-4"
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <p className="font-medium text-[var(--text-primary)]">{displayName}</p>
                      <div className="flex items-center gap-2">
                        {hasBlockers && (
                          <span className="text-xs px-2 py-1 rounded-full bg-[var(--accent-warning)]/20 text-[var(--accent-warning)]">
                            Bloqueado
                          </span>
                        )}
                        <span className="text-xs text-[var(--text-secondary)]">
                          {formatDateTime(entry.updated_at)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      <div className='bg-[var(--bg-primary)] p-3 rounded-lg'>
                        <p className="font-semibold text-[var(--text-primary)] mb-1">Ayer</p>
                        <p className="text-[var(--text-secondary)] whitespace-pre-wrap">
                          {entry.yesterday?.trim() || '—'}
                        </p>
                      </div>
                      <div className='bg-[var(--bg-primary)] p-3 rounded-lg'>
                        <p className="font-semibold text-[var(--text-primary)] mb-1">Hoy</p>
                        <p className="text-[var(--text-secondary)] whitespace-pre-wrap">
                          {entry.today?.trim() || '—'}
                        </p>
                      </div>
                      <div className='bg-[var(--bg-primary)] p-3 rounded-lg'>
                        <p className="font-semibold text-[var(--text-primary)] mb-1">Bloqueos</p>
                        <p className="text-[var(--text-secondary)] whitespace-pre-wrap">
                          {entry.blockers?.trim() || 'Sin bloqueos'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
};
