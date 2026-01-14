import { useProjectStore } from '@/store/projectStore';

export default function useGemini() {
  const { currentProject } = useProjectStore();
  const generateTaskDescription = async ({ title_task, current_checklist }: { title_task: string; current_checklist?: unknown; }) => {
    try {
      const res = await fetch('/api/ia/task/description', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project: currentProject,
          title_task: title_task,
          current_checklist: current_checklist || [],
        }),

      });
      const data = await res.json();
      return data.message;
    } catch (error) {
      throw error;
    }
  };
  const generateSuggestedTasks = async ({ currentTasks }: { currentTasks: unknown; }) => {
    try {
      const res = await fetch('/api/ia/task/suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project: currentProject,
          currentTasks
        }),
      });
      const data = await res.json();
      return data.suggestions;
    } catch (error) {
      throw error;
    }
  };

  const generateChatSummary = async ({ messages, startDate, endDate, channelName }: { messages: unknown[]; startDate: string; endDate: string; channelName: string; }) => {
    try {
      const res = await fetch('/api/ia/chat/summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          startDate,
          endDate,
          channelName,
        }),
      });
      const data = await res.json();
      return data.summary;
    } catch (error) {
      throw error;
    }
  };

  return { generateTaskDescription, generateSuggestedTasks, generateChatSummary };
};