'use client';
import { useProjectStore } from '@/store/projectStore';
import { MembersView } from '@/components/project/MembersView';

export default function MembersPage() {
  const { currentProject } = useProjectStore();

  if (!currentProject) {
    return null;
  }

  return (
    <>
      <main className="flex grow flex-col max-h-full overflow-hidden">
        <MembersView />
      </main>
    </>
  );
}
