import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  buildCsvFiles,
  parseExportDatasets,
  pickExportDatasets,
  sanitizeFilenamePart,
  type ProjectExportPayload,
} from '@/lib/exportProjectData';
import {
  buildTeamHealthSnapshot,
  toISODateLocal,
} from '@/lib/teamHealth';

function unwrapUser(
  user:
    | { name: string | null; email: string | null }
    | { name: string | null; email: string | null }[]
    | null
    | undefined,
) {
  if (!user) return null;
  return Array.isArray(user) ? user[0] ?? null : user;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: projectId } = await context.params;
    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { data: member, error: memberError } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single();

    if (memberError || !member) {
      return NextResponse.json(
        { error: 'No tienes acceso a este proyecto' },
        { status: 403 },
      );
    }

    const normalizedRole = String(member.role ?? '').toLowerCase();
    if (normalizedRole !== 'owner' && normalizedRole !== 'admin') {
      return NextResponse.json(
        { error: 'Solo Owner o Admin pueden exportar datos' },
        { status: 403 },
      );
    }

    const { data: canExport, error: analyticsError } = await supabase.rpc(
      'can_use_project_analytics',
      { p_project_id: projectId },
    );

    if (analyticsError) {
      console.error('Error checking export access:', analyticsError);
    }

    if (canExport !== true) {
      return NextResponse.json(
        { error: 'La exportación de datos está disponible solo para plan Pro' },
        { status: 403 },
      );
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id,name,description')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Proyecto no encontrado' },
        { status: 404 },
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const format = (searchParams.get('format') || 'json').toLowerCase();
    const datasets = parseExportDatasets(searchParams.get('datasets'));

    const [
      tasksRes,
      membersRes,
      checkinsRes,
      eventsRes,
      objectivesRes,
      keyResultsRes,
      epicsRes,
      resourcesRes,
    ] = await Promise.all([
      supabase
        .from('tasks')
        .select(
          'id,title,description,status,priority,created_at,updated_at,done_at,done_estimated_at,phase_roadmap_id,epic_id,key_result_id',
        )
        .eq('project_id', projectId),
      supabase
        .from('project_members')
        .select(
          'user_id,role,joined_at,user:users(name,email),tags:member_tags(tag:project_tags(label,color))',
        )
        .eq('project_id', projectId),
      supabase
        .from('project_checkins')
        .select(
          'id,user_id,checkin_date,yesterday,today,blockers,created_at,updated_at,user:users(name,email)',
        )
        .eq('project_id', projectId)
        .order('checkin_date', { ascending: false }),
      supabase
        .from('events')
        .select(
          'id,title,description,start_date,end_date,created_by,is_recurring,recurrence_rule,series_id,google_event_id,is_cancelled,created_at',
        )
        .eq('project_id', projectId)
        .order('start_date', { ascending: true }),
      supabase
        .from('okr_objectives')
        .select('id,title,description,status,cycle,start_date,end_date,created_at')
        .eq('project_id', projectId),
      supabase
        .from('okr_key_results')
        .select(
          'id,objective_id,title,target_value,current_value,unit,tracking_mode,created_at',
        )
        .eq('project_id', projectId),
      supabase
        .from('epics')
        .select(
          'id,objective_id,key_result_id,title,status,color,created_at',
        )
        .eq('project_id', projectId),
      supabase
        .from('resources')
        .select('id,title,type,url,size,uploaded_by,created_at')
        .eq('project_id', projectId),
    ]);

    const tasks = tasksRes.data ?? [];
    const taskIds = tasks.map((t) => t.id);

    const { data: assignments } =
      taskIds.length > 0
        ? await supabase
            .from('task_assignments')
            .select('task_id,user_id,user:users(name,email)')
            .in('task_id', taskIds)
        : { data: [] as Array<{ task_id: string; user_id: string; user: unknown }> };

    const { data: taskTags } =
      taskIds.length > 0
        ? await supabase
            .from('task_tags')
            .select('task_id,tag:project_tags(label)')
            .in('task_id', taskIds)
        : { data: [] as Array<{ task_id: string; tag: unknown }> };

    const assigneesByTask = new Map<string, string[]>();
    (assignments ?? []).forEach((a) => {
      const rawUser = unwrapUser(
        a.user as
          | { name: string | null; email: string | null }
          | { name: string | null; email: string | null }[]
          | null,
      );
      const label = rawUser?.name || rawUser?.email || a.user_id;
      const list = assigneesByTask.get(a.task_id) ?? [];
      list.push(label);
      assigneesByTask.set(a.task_id, list);
    });

    const tagsByTask = new Map<string, string[]>();
    (taskTags ?? []).forEach((row) => {
      const rawTag = Array.isArray(row.tag) ? row.tag[0] : row.tag;
      const label =
        rawTag && typeof rawTag === 'object' && 'label' in rawTag
          ? String((rawTag as { label: string | null }).label ?? '')
          : '';
      if (!label) return;
      const list = tagsByTask.get(row.task_id) ?? [];
      list.push(label);
      tagsByTask.set(row.task_id, list);
    });

    const taskRows = tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      created_at: task.created_at,
      updated_at: task.updated_at,
      done_at: task.done_at,
      done_estimated_at: task.done_estimated_at,
      phase_roadmap_id: task.phase_roadmap_id,
      epic_id: task.epic_id,
      key_result_id: task.key_result_id,
      assignees: (assigneesByTask.get(task.id) ?? []).join('; '),
      tags: (tagsByTask.get(task.id) ?? []).join('; '),
    }));

    const memberRows = (membersRes.data ?? []).map((m) => {
      const rawUser = unwrapUser(
        m.user as
          | { name: string | null; email: string | null }
          | { name: string | null; email: string | null }[]
          | null,
      );
      const tags = ((m.tags as Array<{ tag: unknown }> | null) ?? [])
        .map((entry) => {
          const rawTag = Array.isArray(entry.tag) ? entry.tag[0] : entry.tag;
          return rawTag && typeof rawTag === 'object' && 'label' in rawTag
            ? String((rawTag as { label: string | null }).label ?? '')
            : '';
        })
        .filter(Boolean)
        .join('; ');

      return {
        user_id: m.user_id,
        name: rawUser?.name ?? null,
        email: rawUser?.email ?? null,
        role: m.role,
        tags,
        joined_at: m.joined_at,
      };
    });

    const checkinRows = (checkinsRes.data ?? []).map((c) => {
      const rawUser = unwrapUser(
        c.user as
          | { name: string | null; email: string | null }
          | { name: string | null; email: string | null }[]
          | null,
      );
      return {
        id: c.id,
        user_id: c.user_id,
        name: rawUser?.name ?? null,
        email: rawUser?.email ?? null,
        checkin_date: c.checkin_date,
        yesterday: c.yesterday,
        today: c.today,
        blockers: c.blockers,
        created_at: c.created_at,
        updated_at: c.updated_at,
      };
    });

    const eventRows = (eventsRes.data ?? []).map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      start_date: event.start_date,
      end_date: event.end_date,
      created_by: event.created_by,
      is_recurring: event.is_recurring,
      recurrence_rule: event.recurrence_rule,
      series_id: event.series_id,
      google_event_id: event.google_event_id,
      is_cancelled: event.is_cancelled,
      created_at: event.created_at,
    }));

    const keyResults = keyResultsRes.data ?? [];
    const okrKeyResultRows = keyResults.map((kr) => {
      const progress =
        kr.target_value > 0
          ? Math.round((kr.current_value / kr.target_value) * 100)
          : 0;
      return {
        id: kr.id,
        objective_id: kr.objective_id,
        title: kr.title,
        target_value: kr.target_value,
        current_value: kr.current_value,
        unit: kr.unit,
        tracking_mode: kr.tracking_mode,
        progress_pct: progress,
        created_at: kr.created_at,
      };
    });

    const healthMembers = memberRows.map((m) => ({
      user_id: m.user_id,
      role: String(m.role ?? ''),
      name: String(m.name || m.email || 'Sin nombre'),
    }));

    const healthSnapshot = buildTeamHealthSnapshot({
      members: healthMembers,
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        done_at: t.done_at,
        done_estimated_at: t.done_estimated_at,
        created_at: t.created_at,
      })),
      assignments: (assignments ?? []).map((a) => ({
        task_id: a.task_id,
        user_id: a.user_id,
      })),
      checkins: (checkinsRes.data ?? []).map((c) => ({
        user_id: c.user_id,
        checkin_date: c.checkin_date,
        blockers: c.blockers,
      })),
      taskTags: (taskTags ?? []).flatMap((row) => {
        const rawTag = Array.isArray(row.tag) ? row.tag[0] : row.tag;
        const label =
          rawTag && typeof rawTag === 'object' && 'label' in rawTag
            ? String((rawTag as { label: string | null }).label ?? '')
            : '';
        return label ? [{ task_id: row.task_id, label }] : [];
      }),
      todayDate: toISODateLocal(new Date()),
    });

    const total = tasks.length;
    const done = tasks.filter((t) => t.status === 'done').length;
    const inProgress = tasks.filter((t) => t.status === 'in-progress').length;
    const todo = tasks.filter((t) => t.status === 'todo').length;

    const analytics = {
      total_tasks: total,
      done_tasks: done,
      in_progress_tasks: inProgress,
      todo_tasks: todo,
      progress_pct: total > 0 ? Math.round((done / total) * 100) : 0,
      checkin_compliance_today: healthSnapshot.checkinCompliance.complianceTodayRate,
      checkin_compliance_week: healthSnapshot.checkinCompliance.complianceWeekRate,
      missed_checkins_today: healthSnapshot.checkinCompliance.missedToday.map(
        (m) => m.name,
      ),
      missed_checkins_week: healthSnapshot.checkinCompliance.missedThisWeek.map(
        (m) => m.name,
      ),
      workload_by_member: healthSnapshot.workload,
      recurring_blockers: healthSnapshot.recurringBlockers,
      throughput_by_member: healthSnapshot.throughputByMember,
      throughput_by_tag: healthSnapshot.throughputByTag,
      alerts: healthSnapshot.alerts,
      okr_progress: okrKeyResultRows.map((kr) => ({
        id: kr.id,
        title: kr.title,
        progress_pct: kr.progress_pct,
        current_value: kr.current_value,
        target_value: kr.target_value,
      })),
    };

    const payload: ProjectExportPayload = {
      exportedAt: new Date().toISOString(),
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
      },
      tasks: taskRows,
      members: memberRows,
      checkins: checkinRows,
      events: eventRows,
      analytics,
      okrs: {
        objectives: objectivesRes.data ?? [],
        keyResults: okrKeyResultRows,
        epics: epicsRes.data ?? [],
      },
      resources: (resourcesRes.data ?? []).map((resource) => ({
        id: resource.id,
        title: resource.title,
        type: resource.type,
        url: resource.url,
        size: resource.size,
        uploaded_by: resource.uploaded_by,
        created_at: resource.created_at,
      })),
    };

    const fileBase = sanitizeFilenamePart(project.name);

    if (format === 'csv') {
      const files = buildCsvFiles(payload, datasets);
      const entries = Object.entries(files);

      if (entries.length === 1) {
        const [filename, content] = entries[0];
        return new NextResponse(content, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${fileBase}-${filename}"`,
          },
        });
      }

      return NextResponse.json(
        {
          exportedAt: payload.exportedAt,
          project: payload.project,
          files,
        },
        {
          headers: {
            'Content-Disposition': `attachment; filename="${fileBase}-export-csv.json"`,
          },
        },
      );
    }

    const body = pickExportDatasets(payload, datasets);
    return new NextResponse(JSON.stringify(body, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileBase}-export.json"`,
      },
    });
  } catch (error) {
    console.error('Error exporting project data:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
