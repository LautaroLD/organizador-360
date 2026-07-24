'use client';

import { useParams } from 'next/navigation';
import { KanbanBoard } from '@/components/project/kanban/KanbanBoard';

export default function KanbanPage() {
  const params = useParams();
  const projectId = params?.id as string;

  return (
    <main className="flex flex-1 min-h-0 flex-col overflow-hidden">
      <KanbanBoard projectId={projectId} />
    </main>
  );
}
