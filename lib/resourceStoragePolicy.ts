import { supabaseAdmin } from '@/lib/supabase/admin';

const STORAGE_LIMITS_BYTES = {
  free: 100 * 1024 * 1024,
  starter: 1024 * 1024 * 1024,
  pro: 5 * 1024 * 1024 * 1024,
} as const;

const GRACE_DAYS = 60;
const GRACE_MS = GRACE_DAYS * 24 * 60 * 60 * 1000;

type PlanTier = 'free' | 'starter' | 'pro';

type ProjectStorageRow = {
  id: string;
  owner_id: string;
  storage_used: number | null;
  storage_over_limit_since: string | null;
};

export type StoragePolicyResult = {
  overLimit: boolean;
  plan: PlanTier;
  used: number;
  limit: number;
  graceDays: number;
  graceEndsAt: string | null;
  daysRemaining: number | null;
  autoDeleted: boolean;
};

function normalizeTier(value?: string | null): PlanTier {
  if (value === 'starter' || value === 'pro') {
    return value;
  }
  return 'free';
}

function parseResourcePath(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    const marker = '/storage/v1/object/public/resources/';
    const markerIndex = parsedUrl.pathname.indexOf(marker);

    if (markerIndex === -1) return null;

    const relativePath = parsedUrl.pathname.slice(markerIndex + marker.length);
    return decodeURIComponent(relativePath);
  } catch {
    return null;
  }
}

async function resolveOwnerPlan(ownerId: string): Promise<PlanTier> {
  const { data: tierData, error: tierError } = await supabaseAdmin.rpc(
    'get_user_plan',
    {
      p_user_id: ownerId,
    },
  );

  if (tierError) {
    throw new Error('No se pudo resolver el plan del owner');
  }

  return normalizeTier(
    typeof tierData === 'string' ? tierData.toLowerCase() : null,
  );
}

async function fetchProjectStorageRow(
  projectId: string,
): Promise<ProjectStorageRow> {
  const { data: project, error: projectError } = await supabaseAdmin
    .from('projects')
    .select('id, owner_id, storage_used, storage_over_limit_since')
    .eq('id', projectId)
    .single();

  if (projectError || !project) {
    throw new Error('Proyecto no encontrado');
  }

  return project as ProjectStorageRow;
}

export async function enforceProjectStoragePolicy(
  projectId: string,
): Promise<StoragePolicyResult> {
  const project = await fetchProjectStorageRow(projectId);
  const plan = await resolveOwnerPlan(project.owner_id);

  const limit = STORAGE_LIMITS_BYTES[plan];
  const used = Number(project.storage_used ?? 0);
  const overLimit = used > limit;

  const now = new Date();
  const existingOverLimitSince = project.storage_over_limit_since
    ? new Date(project.storage_over_limit_since)
    : null;

  if (!overLimit) {
    if (project.storage_over_limit_since) {
      await supabaseAdmin
        .from('projects')
        .update({ storage_over_limit_since: null })
        .eq('id', project.id);
    }

    return {
      overLimit: false,
      plan,
      used,
      limit,
      graceDays: GRACE_DAYS,
      graceEndsAt: null,
      daysRemaining: null,
      autoDeleted: false,
    };
  }

  const effectiveSince =
    existingOverLimitSince && !Number.isNaN(existingOverLimitSince.getTime())
      ? existingOverLimitSince
      : now;

  if (!existingOverLimitSince || Number.isNaN(effectiveSince.getTime())) {
    await supabaseAdmin
      .from('projects')
      .update({ storage_over_limit_since: now.toISOString() })
      .eq('id', project.id);
  }

  const graceEndsAt = new Date(effectiveSince.getTime() + GRACE_MS);
  const expired = graceEndsAt.getTime() <= now.getTime();

  if (!expired) {
    const daysRemaining = Math.max(
      0,
      Math.ceil(
        (graceEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
      ),
    );

    return {
      overLimit: true,
      plan,
      used,
      limit,
      graceDays: GRACE_DAYS,
      graceEndsAt: graceEndsAt.toISOString(),
      daysRemaining,
      autoDeleted: false,
    };
  }

  const { data: projectResources, error: resourcesError } = await supabaseAdmin
    .from('resources')
    .select('id, type, url')
    .eq('project_id', project.id);

  if (resourcesError) {
    throw new Error('No se pudieron obtener recursos para limpieza');
  }

  const resources = projectResources ?? [];
  const filePaths = resources
    .filter((item) => item.type === 'file')
    .map((item) => parseResourcePath(item.url))
    .filter((path): path is string => Boolean(path));

  if (filePaths.length > 0) {
    await supabaseAdmin.storage.from('resources').remove(filePaths);
  }

  const resourceIds = resources.map((item) => item.id);

  if (resourceIds.length > 0) {
    await supabaseAdmin.from('resources').delete().in('id', resourceIds);
  }

  await supabaseAdmin
    .from('projects')
    .update({ storage_used: 0, storage_over_limit_since: null })
    .eq('id', project.id);

  return {
    overLimit: false,
    plan,
    used: 0,
    limit,
    graceDays: GRACE_DAYS,
    graceEndsAt: null,
    daysRemaining: 0,
    autoDeleted: true,
  };
}
