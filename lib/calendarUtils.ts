interface EventFormData {
  title: string;
  description: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  recurrence_type: 'none' | 'weekly' | 'custom';
  selected_days?: string[];
  recurrence_end_date?: string;
}

interface GeneratedEvent {
  start: string;
  end: string;
}

// Helper para sumar días sin depender de Date
const addDays = (dateStr: string, days: number): string => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const newYear = date.getFullYear();
  const newMonth = String(date.getMonth() + 1).padStart(2, '0');
  const newDay = String(date.getDate()).padStart(2, '0');
  return `${newYear}-${newMonth}-${newDay}`;
};

// Helper para obtener día de la semana
const getDayOfWeek = (dateStr: string): number => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).getDay();
};

export const generateRecurringEvents = (data: EventFormData): GeneratedEvent[] => {
  if (!data.start_date || !data.start_time || !data.end_time) {
    return [];
  }

  const startHours = parseInt(data.start_time.split(':')[0]);
  const startMins = parseInt(data.start_time.split(':')[1]);
  const endHours = parseInt(data.end_time.split(':')[0]);
  const endMins = parseInt(data.end_time.split(':')[1]);

  // Calcular duración en minutos
  let durationMinutes = endHours * 60 + endMins - (startHours * 60 + startMins);
  if (durationMinutes < 0) {
    durationMinutes += 24 * 60; // Si cruza medianoche
  }

  if (data.recurrence_type === 'none') {
    // Evento único: usar hora exacta sin conversiones
    let endDate = data.start_date;
    const finalEndHours = endHours;
    const finalEndMins = endMins;

    // Si la hora final es menor que la inicial, es del día siguiente
    if (endHours * 60 + endMins < startHours * 60 + startMins) {
      endDate = addDays(data.start_date, 1);
    }

    return [{
      start: `${data.start_date}T${String(startHours).padStart(2, '0')}:${String(startMins).padStart(2, '0')}:00`,
      end: `${endDate}T${String(finalEndHours).padStart(2, '0')}:${String(finalEndMins).padStart(2, '0')}:00`,
    }];
  }

  if (!data.selected_days || data.selected_days.length === 0) {
    return [];
  }

  const events: GeneratedEvent[] = [];
  let current = data.start_date;
  const recurrenceEnd = data.recurrence_end_date || data.start_date;

  while (current <= recurrenceEnd) {
    const dayOfWeek = getDayOfWeek(current);
    const dayIdMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayId = dayIdMap[dayOfWeek];

    if (dayId && data.selected_days?.includes(dayId)) {
      events.push({
        start: `${current}T${String(startHours).padStart(2, '0')}:${String(startMins).padStart(2, '0')}:00`,
        end: `${current}T${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}:00`,
      });
    }

    current = addDays(current, 1);
  }

  return events;
};

