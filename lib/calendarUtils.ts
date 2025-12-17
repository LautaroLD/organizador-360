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

export const generateRecurringEvents = (data: EventFormData): GeneratedEvent[] => {
  if (!data.start_date || !data.start_time || !data.end_time) {
    return [];
  }

  const startTimeParts = data.start_time.split(':');
  const endTimeParts = data.end_time.split(':');
  const startMinutes = parseInt(startTimeParts[0]) * 60 + parseInt(startTimeParts[1]);
  const endMinutes = parseInt(endTimeParts[0]) * 60 + parseInt(endTimeParts[1]);
  const durationMinutes = endMinutes >= startMinutes ? endMinutes - startMinutes : (24 * 60) - startMinutes + endMinutes;

  if (data.recurrence_type === 'none') {
    const startDateTime = new Date(`${data.start_date}T${data.start_time}:00`);
    const endDateTime = new Date(startDateTime);
    endDateTime.setMinutes(endDateTime.getMinutes() + durationMinutes);

    return [{
      start: `${data.start_date}T${data.start_time}:00`,
      end: endDateTime.toISOString().slice(0, 19).replace('T', 'T'),
    }];
  }

  if (!data.selected_days || data.selected_days.length === 0) {
    return [];
  }

  const events: GeneratedEvent[] = [];
  const recurrenceEnd = new Date(data.recurrence_end_date || data.start_date);
  const current = new Date(data.start_date);
  const startTime = data.start_time;

  while (current <= recurrenceEnd) {
    const dayOfWeek = current.getDay();
    const dayIdMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayId = dayIdMap[dayOfWeek];

    if (dayId && data.selected_days?.includes(dayId)) {
      const eventDate = current.toISOString().split('T')[0];
      const startDateTime = new Date(`${eventDate}T${startTime}:00`);
      const endDateTime = new Date(startDateTime);
      endDateTime.setMinutes(endDateTime.getMinutes() + durationMinutes);

      events.push({
        start: `${eventDate}T${startTime}:00`,
        end: endDateTime.toISOString().slice(0, 19).replace('T', 'T'),
      });
    }

    current.setDate(current.getDate() + 1);
  }

  return events;
};
