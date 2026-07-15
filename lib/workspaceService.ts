import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildTeamHealthSnapshot,
  isTaskOverdue,
  toISODateLocal,
} from '@/lib/teamHealth';
import { canAddMemberToProject } from '@/lib/subscriptionUtils';
import { isMissingWorkspaceRelation } from '@/lib/workspaceAccess';
import type {
  Workspace,
  WorkspaceBundle,
  WorkspaceHomeEvent,
  WorkspaceHomeSnapshot,
  WorkspaceHomeTask,
  WorkspaceMember,
  WorkspaceProject,
  WorkspaceProjectRisk,
} from '@/models/workspace';

type OwnedProjectRow = {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  owner_id: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function asRelation<T>(value: unknown): T | null {
  return unwrapRelation(value as T | T[] | null | undefined);
}

function mapMemberRow(row: Record<string, unknown>): WorkspaceMember {
  const user = unwrapRelation(row.user as WorkspaceMember['user'] | WorkspaceMember['user'][]);
  return {
    id: String(row.id),
    workspace_id: String(row.workspace_id),
    user_id: (row.user_id as string | null) ?? null,
    email: String(row.email),
    display_name: (row.display_name as string | null) ?? null,
    org_role: (row.org_role as string | null) ?? null,
    skills: Array.isArray(row.skills) ? (row.skills as string[]) : [],
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    user,
  };
}

function mapProjectRow(row: Record<string, unknown>): WorkspaceProject {
  const project = unwrapRelation(
    row.project as WorkspaceProject['project'] | WorkspaceProject['project'][],
  );
  return {
    id: String(row.id),
    workspace_id: String(row.workspace_id),
    project_id: String(row.project_id),
    added_at: String(row.added_at),
    project,
  };
}

async function listOwnedProjects(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, description, enabled, owner_id')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error listing owned projects:', error);
    return [] as OwnedProjectRow[];
  }

  return (data ?? []) as OwnedProjectRow[];
}

async function seedWorkspace(
  supabase: SupabaseClient,
  workspace: Workspace,
  owner: { id: string; email?: string | null; name?: string | null },
) {
  const ownedProjects = await listOwnedProjects(supabase, owner.id);
  const projectIds = ownedProjects.map((p) => p.id);

  if (projectIds.length > 0) {
    const { data: existingLinks } = await supabase
      .from('workspace_projects')
      .select('project_id')
      .eq('workspace_id', workspace.id);

    const linked = new Set((existingLinks ?? []).map((r) => r.project_id));
    const toInsert = projectIds
      .filter((id) => !linked.has(id))
      .map((project_id) => ({
        workspace_id: workspace.id,
        project_id,
      }));

    if (toInsert.length > 0) {
      const { error } = await supabase.from('workspace_projects').insert(toInsert);
      if (error) console.error('Error seeding workspace projects:', error);
    }
  }

  const ownerEmail = owner.email ? normalizeEmail(owner.email) : null;
  if (ownerEmail) {
    const { data: existingOwner } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspace.id)
      .ilike('email', ownerEmail)
      .maybeSingle();

    if (!existingOwner) {
      await supabase.from('workspace_members').insert({
        workspace_id: workspace.id,
        user_id: owner.id,
        email: ownerEmail,
        display_name: owner.name ?? null,
        org_role: 'Owner',
        skills: [],
      });
    }
  }

  if (projectIds.length === 0) return;

  await seedDirectoryFromProjects(supabase, workspace.id, projectIds, owner.email);
}

/** Add project members into the workspace directory (idempotent). */
export async function seedDirectoryFromProjects(
  supabase: SupabaseClient,
  workspaceId: string,
  projectIds: string[],
  ownerEmail?: string | null,
) {
  if (projectIds.length === 0) return;

  const { data: projectMembers } = await supabase
    .from('project_members')
    .select(
      `
      user_id,
      role,
      user:users(id, name, email)
    `,
    )
    .in('project_id', projectIds);

  const ownerNorm = ownerEmail ? normalizeEmail(ownerEmail) : null;
  const byEmail = new Map<
    string,
    { userId: string; email: string; name: string | null; orgRole: string | null }
  >();

  for (const row of projectMembers ?? []) {
    const user = asRelation<{ id: string; name: string; email: string }>(row.user);
    if (!user?.email) continue;
    const email = normalizeEmail(user.email);
    if (ownerNorm && email === ownerNorm) continue;
    if (byEmail.has(email)) continue;
    byEmail.set(email, {
      userId: user.id,
      email,
      name: user.name ?? null,
      orgRole: row.role ?? null,
    });
  }

  if (byEmail.size === 0) return;

  const { data: existingMembers } = await supabase
    .from('workspace_members')
    .select('email')
    .eq('workspace_id', workspaceId);

  const existingEmails = new Set(
    (existingMembers ?? []).map((m) => normalizeEmail(String(m.email))),
  );

  const inserts = [...byEmail.values()]
    .filter((m) => !existingEmails.has(m.email))
    .map((m) => ({
      workspace_id: workspaceId,
      user_id: m.userId,
      email: m.email,
      display_name: m.name,
      org_role: m.orgRole,
      skills: [] as string[],
    }));

  if (inserts.length > 0) {
    const { error } = await supabase.from('workspace_members').insert(inserts);
    if (error) console.error('Error seeding directory from projects:', error);
  }
}

export async function getOrCreateWorkspaceBundle(
  supabase: SupabaseClient,
  user: { id: string; email?: string | null; user_metadata?: { name?: string } },
): Promise<
  | { ok: true; bundle: WorkspaceBundle; missingSchema: false }
  | { ok: false; missingSchema: true; error: string }
  | { ok: false; missingSchema: false; error: string }
> {
  const { data: existing, error: loadError } = await supabase
    .from('workspaces')
    .select('*')
    .eq('owner_id', user.id)
    .maybeSingle();

  if (loadError && isMissingWorkspaceRelation(loadError)) {
    return {
      ok: false,
      missingSchema: true,
      error:
        'Falta aplicar la migración de workspaces en Supabase (supabase/migrations/20260715210000_workspaces.sql).',
    };
  }

  if (loadError) {
    console.error('Error loading workspace:', loadError);
    return { ok: false, missingSchema: false, error: 'No se pudo cargar el workspace' };
  }

  let workspace = existing as Workspace | null;

  if (!workspace) {
    const { data: created, error: createError } = await supabase
      .from('workspaces')
      .insert({
        name: 'Mi equipo',
        description: 'Directorio y vista multi-proyecto de tu equipo',
        owner_id: user.id,
      })
      .select('*')
      .single();

    if (createError || !created) {
      if (createError && isMissingWorkspaceRelation(createError)) {
        return {
          ok: false,
          missingSchema: true,
          error:
            'Falta aplicar la migración de workspaces en Supabase (supabase/migrations/20260715210000_workspaces.sql).',
        };
      }
      console.error('Error creating workspace:', createError);
      return { ok: false, missingSchema: false, error: 'No se pudo crear el workspace' };
    }

    workspace = created as Workspace;
    await seedWorkspace(supabase, workspace, {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name ?? null,
    });
  }

  const [membersRes, projectsRes] = await Promise.all([
    supabase
      .from('workspace_members')
      .select(
        `
        *,
        user:users(id, name, email, avatar_url)
      `,
      )
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('workspace_projects')
      .select(
        `
        *,
        project:projects(id, name, description, enabled, owner_id)
      `,
      )
      .eq('workspace_id', workspace.id)
      .order('added_at', { ascending: false }),
  ]);

  if (membersRes.error || projectsRes.error) {
    console.error('Error loading workspace children:', membersRes.error || projectsRes.error);
    return { ok: false, missingSchema: false, error: 'No se pudo cargar el directorio' };
  }

  const members = (membersRes.data ?? []).map((row) => mapMemberRow(row as Record<string, unknown>));
  const projects = (projectsRes.data ?? []).map((row) =>
    mapProjectRow(row as Record<string, unknown>),
  );

  const linkedProjectIds = projects.map((p) => p.project_id);
  const activeByUser = new Map<string, string[]>();

  if (linkedProjectIds.length > 0) {
    const userIds = members.map((m) => m.user_id).filter(Boolean) as string[];
    if (userIds.length > 0) {
      const { data: memberships } = await supabase
        .from('project_members')
        .select('user_id, project_id')
        .in('project_id', linkedProjectIds)
        .in('user_id', userIds);

      for (const row of memberships ?? []) {
        const list = activeByUser.get(row.user_id) ?? [];
        list.push(row.project_id);
        activeByUser.set(row.user_id, list);
      }
    }
  }

  const membersWithProjects = members.map((m) => ({
    ...m,
    activeProjectIds: m.user_id ? activeByUser.get(m.user_id) ?? [] : [],
  }));

  return {
    ok: true,
    missingSchema: false,
    bundle: {
      workspace,
      members: membersWithProjects,
      projects,
      isPro: true,
    },
  };
}

export async function buildWorkspaceHomeSnapshot(
  supabase: SupabaseClient,
  workspaceId: string,
  currentUserId: string,
): Promise<WorkspaceHomeSnapshot> {
  const { data: links } = await supabase
    .from('workspace_projects')
    .select(
      `
      project_id,
      project:projects(id, name, enabled)
    `,
    )
    .eq('workspace_id', workspaceId);

  const projects = (links ?? [])
    .map((row) => asRelation<{ id: string; name: string; enabled: boolean }>(row.project))
    .filter((p): p is { id: string; name: string; enabled: boolean } => !!p && p.enabled !== false);

  const projectIds = projects.map((p) => p.id);
  const projectNameById = new Map(projects.map((p) => [p.id, p.name]));

  const { count: memberCount } = await supabase
    .from('workspace_members')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);

  if (projectIds.length === 0) {
    return {
      myOpenTasks: [],
      teamOpenTasks: [],
      upcomingEvents: [],
      risks: [],
      stats: {
        linkedProjects: 0,
        directoryMembers: memberCount ?? 0,
        myOpenCount: 0,
        teamOpenCount: 0,
        overdueCount: 0,
        riskCount: 0,
      },
    };
  }

  const now = new Date();
  const todayDate = toISODateLocal(now);
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndIso = weekEnd.toISOString();
  const nowIso = now.toISOString();

  const [tasksRes, eventsRes, membersRes, checkinsRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, title, status, priority, done_estimated_at, project_id, created_at, done_at')
      .in('project_id', projectIds)
      .neq('status', 'done'),
    supabase
      .from('events')
      .select('id, title, start_date, end_date, project_id, is_cancelled')
      .in('project_id', projectIds)
      .gte('start_date', nowIso)
      .lte('start_date', weekEndIso)
      .eq('is_cancelled', false)
      .order('start_date', { ascending: true })
      .limit(40),
    supabase
      .from('project_members')
      .select(
        `
        project_id,
        user_id,
        role,
        user:users(id, name)
      `,
      )
      .in('project_id', projectIds),
    supabase
      .from('project_checkins')
      .select('project_id, user_id, checkin_date, blockers')
      .in('project_id', projectIds)
      .gte('checkin_date', toISODateLocal(new Date(now.getTime() - 7 * 86400000))),
  ]);

  const openTasks = tasksRes.data ?? [];
  const openTaskIds = openTasks.map((t) => t.id);

  let assignments: Array<{ task_id: string; user_id: string }> = [];
  if (openTaskIds.length > 0) {
    const { data } = await supabase
      .from('task_assignments')
      .select('task_id, user_id')
      .in('task_id', openTaskIds);
    assignments = data ?? [];
  }

  const assigneesByTask = new Map<string, string[]>();
  for (const a of assignments) {
    const list = assigneesByTask.get(a.task_id) ?? [];
    list.push(a.user_id);
    assigneesByTask.set(a.task_id, list);
  }

  const mapTask = (task: (typeof openTasks)[number]): WorkspaceHomeTask => {
    const assigneeIds = assigneesByTask.get(task.id) ?? [];
    return {
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority ?? null,
      done_estimated_at: task.done_estimated_at ?? null,
      project_id: task.project_id,
      project_name: projectNameById.get(task.project_id) ?? 'Proyecto',
      is_overdue: isTaskOverdue(
        {
          id: task.id,
          title: task.title,
          status: task.status,
          done_estimated_at: task.done_estimated_at,
          done_at: task.done_at,
          created_at: task.created_at,
        },
        now.getTime(),
      ),
      assignee_ids: assigneeIds,
    };
  };

  const mappedTasks = openTasks.map(mapTask);
  const myOpenTasks = mappedTasks.filter((t) => t.assignee_ids.includes(currentUserId));
  const teamOpenTasks = mappedTasks
    .filter((t) => !t.assignee_ids.includes(currentUserId))
    .slice(0, 40);

  const upcomingEvents: WorkspaceHomeEvent[] = (eventsRes.data ?? []).map((event) => ({
    id: event.id,
    title: event.title,
    start_date: event.start_date,
    end_date: event.end_date,
    project_id: event.project_id,
    project_name: projectNameById.get(event.project_id) ?? 'Proyecto',
  }));

  const risks: WorkspaceProjectRisk[] = [];

  for (const project of projects) {
    const projectMembers = (membersRes.data ?? [])
      .filter((m) => m.project_id === project.id)
      .map((m) => {
        const user = asRelation<{ id: string; name: string }>(m.user);
        return {
          user_id: m.user_id,
          role: m.role,
          name: user?.name ?? 'Miembro',
        };
      });

    const projectTasks = openTasks.filter((t) => t.project_id === project.id);
    const projectAssignments = assignments.filter((a) =>
      projectTasks.some((t) => t.id === a.task_id),
    );
    const projectCheckins = (checkinsRes.data ?? [])
      .filter((c) => c.project_id === project.id)
      .map((c) => ({
        user_id: c.user_id,
        checkin_date: c.checkin_date,
        blockers: c.blockers ?? null,
      }));

    const snapshot = buildTeamHealthSnapshot({
      members: projectMembers,
      tasks: projectTasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        done_estimated_at: t.done_estimated_at,
        done_at: t.done_at,
        created_at: t.created_at,
      })),
      assignments: projectAssignments,
      checkins: projectCheckins,
      todayDate,
      nowMs: now.getTime(),
    });

    const openCount = projectTasks.length;
    const overdueCount = projectTasks.filter((t) =>
      isTaskOverdue(
        {
          id: t.id,
          title: t.title,
          status: t.status,
          done_estimated_at: t.done_estimated_at,
        },
        now.getTime(),
      ),
    ).length;

    if (openCount === 0 && projectMembers.length > 1) {
      risks.push({
        projectId: project.id,
        projectName: project.name,
        severity: 'info',
        title: 'Baja actividad',
        detail: 'No hay tareas abiertas en este proyecto.',
      });
    }

    if (
      snapshot.checkinCompliance.complianceWeekRate !== null &&
      snapshot.checkinCompliance.complianceWeekRate < 50
    ) {
      risks.push({
        projectId: project.id,
        projectName: project.name,
        severity: 'warning',
        title: 'Check-ins flojos',
        detail: `Cumplimiento semanal ${snapshot.checkinCompliance.complianceWeekRate}% (${snapshot.checkinCompliance.missedThisWeek.length} sin check-in).`,
      });
    }

    const overloaded = snapshot.workload.filter((w) => w.overdue >= 3 || w.open >= 10);
    for (const person of overloaded) {
      risks.push({
        projectId: project.id,
        projectName: project.name,
        severity: person.overdue >= 5 ? 'danger' : 'warning',
        title: 'Sobrecarga',
        detail: `${person.name}: ${person.open} abiertas, ${person.overdue} vencidas.`,
      });
    }

    if (overdueCount >= 5) {
      risks.push({
        projectId: project.id,
        projectName: project.name,
        severity: 'danger',
        title: 'Muchas tareas vencidas',
        detail: `${overdueCount} tareas vencidas en el proyecto.`,
      });
    }

    for (const alert of snapshot.alerts.slice(0, 2)) {
      risks.push({
        projectId: project.id,
        projectName: project.name,
        severity: alert.severity,
        title: alert.title,
        detail: alert.detail,
      });
    }
  }

  const overdueCount = mappedTasks.filter((t) => t.is_overdue).length;

  return {
    myOpenTasks: myOpenTasks.slice(0, 30),
    teamOpenTasks,
    upcomingEvents,
    risks: risks.slice(0, 30),
    stats: {
      linkedProjects: projects.length,
      directoryMembers: memberCount ?? 0,
      myOpenCount: myOpenTasks.length,
      teamOpenCount: mappedTasks.length,
      overdueCount,
      riskCount: risks.length,
    },
  };
}

export async function assignWorkspaceMemberToProjects(params: {
  supabase: SupabaseClient;
  workspaceId: string;
  ownerId: string;
  member: WorkspaceMember;
  projectIds: string[];
  role: 'Admin' | 'Collaborator' | 'Viewer';
}): Promise<{
  assigned: string[];
  skipped: Array<{ projectId: string; reason: string }>;
  invited: string[];
}> {
  const { supabase, workspaceId, ownerId, member, projectIds, role } = params;
  const assigned: string[] = [];
  const invited: string[] = [];
  const skipped: Array<{ projectId: string; reason: string }> = [];

  const { data: links } = await supabase
    .from('workspace_projects')
    .select('project_id')
    .eq('workspace_id', workspaceId)
    .in('project_id', projectIds);

  const linkedSet = new Set((links ?? []).map((l) => l.project_id));

  for (const projectId of projectIds) {
    if (!linkedSet.has(projectId)) {
      skipped.push({ projectId, reason: 'El proyecto no está vinculado al workspace' });
      continue;
    }

    const { data: project } = await supabase
      .from('projects')
      .select('id, owner_id')
      .eq('id', projectId)
      .maybeSingle();

    if (!project || project.owner_id !== ownerId) {
      skipped.push({ projectId, reason: 'Solo puedes asignar a proyectos que posees' });
      continue;
    }

    if (!member.user_id) {
      skipped.push({
        projectId,
        reason:
          'Esta persona aún no tiene cuenta vinculada. Invítala al proyecto desde Miembros.',
      });
      continue;
    }

    const { data: existing } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', member.user_id)
      .maybeSingle();

    if (existing) {
      skipped.push({ projectId, reason: 'Ya es miembro del proyecto' });
      continue;
    }

    const limitCheck = await canAddMemberToProject(supabase, projectId, ownerId);
    if (!limitCheck.canAdd) {
      skipped.push({
        projectId,
        reason: limitCheck.reason ?? 'Límite de miembros alcanzado',
      });
      continue;
    }

    const { error } = await supabase.from('project_members').insert({
      project_id: projectId,
      user_id: member.user_id,
      role,
    });

    if (error) {
      skipped.push({ projectId, reason: error.message || 'No se pudo agregar' });
      continue;
    }

    assigned.push(projectId);
  }

  return { assigned, skipped, invited };
}
