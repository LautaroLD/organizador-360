import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { enforceProjectStoragePolicy } from '@/lib/resourceStoragePolicy';

function isAuthorized(req: Request): boolean {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) return false;

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;

  const providedSecret = authHeader.slice('Bearer '.length).trim();
  return providedSecret === expectedSecret;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: projects, error } = await supabaseAdmin
      .from('projects')
      .select('id')
      .gt('storage_used', 0);

    if (error) {
      return NextResponse.json(
        {
          error:
            'No se pudo listar proyectos para validacion de almacenamiento',
        },
        { status: 500 },
      );
    }

    const projectIds = (projects ?? []).map((project) => project.id);

    const summary = {
      checked: 0,
      overLimit: 0,
      autoDeleted: 0,
      errors: 0,
      errorProjects: [] as string[],
    };

    for (const projectId of projectIds) {
      try {
        const result = await enforceProjectStoragePolicy(projectId);

        summary.checked += 1;
        if (result.overLimit) {
          summary.overLimit += 1;
        }
        if (result.autoDeleted) {
          summary.autoDeleted += 1;
        }
      } catch (projectError) {
        console.error(
          'Error enforcing storage policy for project:',
          projectId,
          projectError,
        );
        summary.checked += 1;
        summary.errors += 1;
        summary.errorProjects.push(projectId);
      }
    }

    return NextResponse.json({
      success: true,
      ...summary,
    });
  } catch (error) {
    console.error('Error running resource storage policy cron:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
