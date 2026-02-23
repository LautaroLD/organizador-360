'use client';

import { useProjectStore } from '@/store/projectStore';
import { CheckinsView } from '@/components/project/CheckinsView';

export default function CheckinsPage() {
  const { currentProject } = useProjectStore();

  if (!currentProject) {
    return null;
  }

  return (
    <main className="flex grow flex-col max-h-full overflow-hidden">
      <CheckinsView />
    </main>
  );
}
