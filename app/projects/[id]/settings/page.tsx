'use client';
import { useProjectStore } from '@/store/projectStore';
import { ProjectSettings } from '@/components/project/ProjectSettings';

export default function ProjectSettingsPage() {
  const { currentProject } = useProjectStore();

  if (!currentProject) {
    return null;
  }

  return (
    <>
      <main className="flex grow flex-col max-h-full overflow-hidden">
        <ProjectSettings />
      </main>
    </>
  );
}
