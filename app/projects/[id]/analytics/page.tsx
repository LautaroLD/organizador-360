'use client';

import { AnalyticsView } from '@/components/project/AnalyticsView';
import { useProjectStore } from '@/store/projectStore';

export default function AnalyticsPage() {
  const { currentProject } = useProjectStore();

  if (!currentProject) {
    return null;
  }

  return (
    <>
      <main className="flex grow flex-col max-h-full overflow-hidden">
        <AnalyticsView />
      </main>
    </>
  );
}
