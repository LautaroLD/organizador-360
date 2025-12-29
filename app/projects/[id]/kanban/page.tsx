'use client';

import { useParams } from 'next/navigation';
import { KanbanBoard } from '@/components/project/kanban/KanbanBoard';

export default function KanbanPage() {
  const params = useParams();
  const projectId = params?.id as string;

  return (
    <main className="flex grow overflow-hidden">
      <KanbanBoard projectId={projectId} />
    </main>
  );
}
