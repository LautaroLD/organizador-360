import { useProjectStore } from '@/store/projectStore';
import { toast } from 'react-toastify';

export default function useGemini() {
  const { currentProject } = useProjectStore();

  const handlePremiumError = (error: unknown) => {
    if (error instanceof Response) {
      if (error.status === 403) {
        toast.error('Esta función está disponible solo para el plan Pro. ¡Actualiza tu plan!');
        return;
      }

      if (error.status === 402) {
        toast.error('No tienes créditos suficientes para usar esta función de IA.');
        return;
      }
    }

    throw error;
  };

  const generateTaskDescription = async ({ title_task, current_checklist }: { title_task: string; current_checklist?: unknown; }) => {
    try {
      const requestId = crypto.randomUUID();
      const res = await fetch('/api/ia/task/description', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project: currentProject,
          title_task: title_task,
          current_checklist: current_checklist || [],
          requestId,
        }),

      });

      if (res.status === 403) {
        toast.error('Esta función está disponible solo para el plan Pro. ¡Actualiza tu plan!');
        return null;
      }

      if (res.status === 402) {
        toast.error('No tienes créditos suficientes para usar esta función de IA.');
        return null;
      }

      if (!res.ok) {
        throw new Error('Error al generar descripción');
      }

      const data = await res.json();
      return data.message;
    } catch (error) {
      handlePremiumError(error);
      throw error;
    }
  };

  const generateSuggestedTasks = async ({ currentTasks }: { currentTasks: unknown; }) => {
    try {
      const requestId = crypto.randomUUID();
      const res = await fetch('/api/ia/task/suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project: currentProject,
          currentTasks,
          requestId,
        }),
      });

      if (res.status === 403) {
        toast.error('Esta función está disponible solo para el plan Pro. ¡Actualiza tu plan!');
        return null;
      }

      if (res.status === 402) {
        toast.error('No tienes créditos suficientes para usar esta función de IA.');
        return null;
      }

      if (!res.ok) {
        throw new Error('Error al generar sugerencias');
      }

      const data = await res.json();
      return data.suggestions;
    } catch (error) {
      handlePremiumError(error);
      throw error;
    }
  };

  const generateChatSummary = async ({
    messages,
    startDate,
    endDate,
    startDateLocal,
    endDateLocal,
    rangeHours,
    userTimeZone,
    userLocale,
    channelName,
  }: {
    messages: unknown[];
    startDate: string;
    endDate: string;
    startDateLocal?: string;
    endDateLocal?: string;
    rangeHours: number;
    userTimeZone?: string;
    userLocale?: string;
    channelName: string;
  }) => {
    try {
      const requestId = crypto.randomUUID();
      const res = await fetch('/api/ia/chat/summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          startDate,
          endDate,
          startDateLocal,
          endDateLocal,
          rangeHours,
          userTimeZone,
          userLocale,
          channelName,
          requestId,
        }),
      });

      if (res.status === 403) {
        toast.error('Esta función está disponible solo para el plan Pro. ¡Actualiza tu plan!');
        return null;
      }

      if (res.status === 402) {
        toast.error('No tienes créditos suficientes para usar esta función de IA.');
        return null;
      }

      if (!res.ok) {
        throw new Error('Error al generar resumen');
      }

      const data = await res.json();
      return data.summary;
    } catch (error) {
      handlePremiumError(error);
      throw error;
    }
  };

  return { generateTaskDescription, generateSuggestedTasks, generateChatSummary };
};