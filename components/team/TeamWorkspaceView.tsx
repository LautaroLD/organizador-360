'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  LayoutDashboard,
  Lock,
  Network,
  Users,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TeamHomePanel } from '@/components/team/TeamHomePanel';
import { TeamDirectoryPanel } from '@/components/team/TeamDirectoryPanel';
import { TeamProjectsPanel } from '@/components/team/TeamProjectsPanel';
import type { WorkspaceBundle, WorkspaceHomeSnapshot } from '@/models/workspace';
import clsx from 'clsx';

type TabId = 'home' | 'directory' | 'projects';

const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: 'home', label: 'Team Home', icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: 'directory', label: 'Directorio', icon: <Users className="h-4 w-4" /> },
  { id: 'projects', label: 'Proyectos', icon: <Network className="h-4 w-4" /> },
];

export function TeamWorkspaceView() {
  const [tab, setTab] = useState<TabId>('home');

  const {
    data: bundle,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['workspace'],
    queryFn: async (): Promise<WorkspaceBundle> => {
      const res = await fetch('/api/workspaces');
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(body.error || 'No se pudo cargar el workspace') as Error & {
          code?: string;
          status?: number;
        };
        err.code = body.code;
        err.status = res.status;
        throw err;
      }
      return body as WorkspaceBundle;
    },
    staleTime: 30_000,
    retry: false,
  });

  const { data: home, isLoading: homeLoading } = useQuery({
    queryKey: ['workspace-home', bundle?.workspace.id],
    queryFn: async (): Promise<WorkspaceHomeSnapshot> => {
      const res = await fetch(`/api/workspaces/${bundle!.workspace.id}/home`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'No se pudo cargar Team Home');
      return body.home as WorkspaceHomeSnapshot;
    },
    enabled: !!bundle?.workspace.id && tab === 'home',
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <p className="text-sm text-[var(--text-secondary)]">Cargando workspace…</p>
    );
  }

  const err = error as (Error & { code?: string; status?: number }) | null;

  if (err?.status === 403 || err?.code === 'pro_required') {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
          <div className="rounded-md bg-[var(--bg-primary)] p-3 text-[var(--text-secondary)]">
            <Lock className="h-6 w-6" />
          </div>
          <div className="flex-1 space-y-1">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Workspace PRO
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              El directorio de equipo y la vista multi-proyecto están exclusivos del plan
              PRO.
            </p>
          </div>
          <Link href="/settings/subscription">
            <Button>Ver planes</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (err?.code === 'schema_missing') {
    return (
      <Card>
        <CardContent className="flex gap-3 p-6">
          <AlertTriangle className="h-5 w-5 shrink-0 text-[var(--accent-warning)]" />
          <div className="space-y-2">
            <p className="text-sm font-medium text-[var(--text-primary)]">
              Falta aplicar la migración de workspaces
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              Ejecutá{' '}
              <code className="text-xs">supabase/migrations/20260715210000_workspaces.sql</code>{' '}
              en el SQL editor de Supabase (o <code className="text-xs">supabase db push</code>) y
              volvé a intentar.
            </p>
            <Button size="sm" variant="secondary" onClick={() => refetch()}>
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !bundle) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          <p className="text-sm text-[var(--accent-danger)]">
            {(error as Error | null)?.message || 'Error al cargar el workspace'}
          </p>
          <Button size="sm" variant="secondary" onClick={() => refetch()}>
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">
          {bundle.workspace.name}
        </h1>
        {bundle.workspace.description && (
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {bundle.workspace.description}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-[var(--text-secondary)]/20 pb-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={clsx(
              'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
              tab === item.id
                ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]',
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'home' && <TeamHomePanel home={home} isLoading={homeLoading} />}
      {tab === 'directory' && <TeamDirectoryPanel bundle={bundle} />}
      {tab === 'projects' && <TeamProjectsPanel bundle={bundle} />}
    </div>
  );
}
