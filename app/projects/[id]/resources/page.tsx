'use client';
import { useProjectStore } from '@/store/projectStore';
import { ResourcesView } from '@/components/dashboard/ResourcesView';

export default function ResourcesPage() {
  const { currentProject } = useProjectStore();

  if (!currentProject) {
    return null;
  }

  return (
    <>
      <main className="flex grow flex-col max-h-full overflow-hidden">
        <ResourcesView />
      </main>
    </>
  );
}
