'use client';

import { PlanningView } from '@/components/project/PlanningView';
import { useProjectStore } from '@/store/projectStore';

export default function PlanningPage() {
  const { currentProject } = useProjectStore();

  if (!currentProject) {
    return null;
  }

  return (
    <main className='flex grow flex-col max-h-full overflow-hidden'>
      <PlanningView />
    </main>
  );
}
