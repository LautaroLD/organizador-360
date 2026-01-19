import { useState } from 'react';
import { useProjectStore } from '@/store/projectStore';

export function useAgent() {
  const { currentProject } = useProjectStore();
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);

  const askAgent = async (message: string, history?: { role: 'user' | 'assistant'; content: string; }[]) => {
    if (!currentProject?.id) return;

    setLoading(true);
    try {
      const res = await fetch('/api/ia/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history,
          projectId: currentProject.id
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setResponse(data.response);
      return data.response;
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { askAgent, loading, response };
}
