'use client';
import { useProjectStore } from '@/store/projectStore';
import { CalendarView } from '@/components/dashboard/CalendarView';

export default function CalendarPage() {
  const { currentProject } = useProjectStore();

  if (!currentProject) {
    return null;
  }

  return (
    <>
      <main className="flex grow flex-col max-h-full overflow-hidden">
        <CalendarView />
      </main>
    </>
  );
}
