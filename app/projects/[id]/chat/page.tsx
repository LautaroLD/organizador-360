'use client';
import { useProjectStore } from '@/store/projectStore';
import { ChatView } from '@/components/dashboard/ChatView';


export default function ChatPage() {
  const { currentProject } = useProjectStore();

  if (!currentProject) {
    return null;
  }

  return (
    <>
      <main className="flex grow flex-col max-h-full overflow-hidden">
        <ChatView />
      </main>
    </>
  );
}
