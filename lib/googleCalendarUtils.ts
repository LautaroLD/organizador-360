// Utilidades para formatear eventos (sin dependencias de Node.js)
// Este archivo puede usarse tanto en cliente como en servidor

export interface GoogleCalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  recurrence?: string[];
}

// Formatear evento de la app para Google Calendar
export function formatEventForGoogle(appEvent: any): GoogleCalendarEvent {
  // Validar y formatear las fechas
  const startDate = appEvent.start_date;
  const startTime = appEvent.start_time || '00:00';
  const endDate = appEvent.end_date || appEvent.start_date;
  const endTime = appEvent.end_time || '23:59';
  const eventTimeZone = appEvent.timeZone || appEvent.time_zone || 'UTC';
  
  // Asegurar formato correcto HH:MM
  const formattedStartTime = startTime.length === 5 ? startTime : `${startTime}:00`.slice(0, 5);
  const formattedEndTime = endTime.length === 5 ? endTime : `${endTime}:00`.slice(0, 5);
  
  const startDateTimeStr = `${startDate}T${formattedStartTime}:00`;
  const endDateTimeStr = `${endDate}T${formattedEndTime}:00`;
  
  // Validar formato básico (sin conversión UTC)
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(startDateTimeStr)) {
    throw new Error(`Invalid time format: start=${startDateTimeStr}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(endDateTimeStr)) {
    throw new Error(`Invalid time format: end=${endDateTimeStr}`);
  }

  const googleEvent: GoogleCalendarEvent = {
    summary: appEvent.title,
    description: appEvent.description || '',
    start: {
      dateTime: startDateTimeStr,
      timeZone: eventTimeZone,
    },
    end: {
      dateTime: endDateTimeStr,
      timeZone: eventTimeZone,
    },
  };

  // Agregar recurrencia si existe
  if (appEvent.is_recurring && appEvent.recurrence_rule) {
    const rrule = convertToRRule(appEvent.recurrence_rule, appEvent.selected_days, appEvent.recurrence_end_date, eventTimeZone);
    if (rrule) {
      googleEvent.recurrence = [rrule];
    }
  }

  return googleEvent;
}

// Convertir regla de recurrencia a formato RFC 5545
function convertToRRule(recurrenceType: string, selectedDays?: string[], recurrenceEndDate?: string, timeZone: string = 'UTC'): string | null {
  if (recurrenceType === 'weekly' && selectedDays && selectedDays.length > 0) {
    const daysMap: Record<string, string> = {
      monday: 'MO',
      tuesday: 'TU',
      wednesday: 'WE',
      thursday: 'TH',
      friday: 'FR',
      saturday: 'SA',
      sunday: 'SU',
    };

    const days = selectedDays.map(day => daysMap[day]).filter(Boolean).join(',');
    let rrule = `RRULE:FREQ=WEEKLY;BYDAY=${days}`;

    if (recurrenceEndDate) {
      try {
        const until = getEndOfDayUtc(recurrenceEndDate, timeZone);
        rrule += `;UNTIL=${until}`;
      } catch (e) {
        // Fallback simple si falla Intl o la zona horaria
        console.error('Error calculating UNTIL date:', e);
        const date = new Date(recurrenceEndDate);
        date.setHours(23, 59, 59, 999);
        const until = date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        rrule += `;UNTIL=${until}`;
      }
    }

    return rrule;
  }
  return null;
}

// Calcular el final del día en UTC respetando la zona horaria
function getEndOfDayUtc(dateStr: string, timeZone: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  
  // Intentamos encontrar el instante UTC que corresponde a las 23:59:59 en la zona horaria local
  // Empezamos asumiendo que la hora local es igual a UTC
  let guess = new Date(Date.UTC(year, month - 1, day, 23, 59, 59));
  
  // Iteramos para ajustar el offset (generalmente 1 o 2 iteraciones son suficientes)
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
      hour12: false
    }).formatToParts(guess);
    
    const getPart = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0');
    
    const localYear = getPart('year');
    const localMonth = getPart('month') - 1;
    const localDay = getPart('day');
    let localHour = getPart('hour');
    if (localHour === 24) localHour = 0; // Fix para algunos navegadores/entornos
    const localMinute = getPart('minute');
    const localSecond = getPart('second');
    
    const guessLocalAsUtc = Date.UTC(localYear, localMonth, localDay, localHour, localMinute, localSecond);
    const targetLocalAsUtc = Date.UTC(year, month - 1, day, 23, 59, 59);
    
    const diff = targetLocalAsUtc - guessLocalAsUtc;
    
    if (Math.abs(diff) < 1000) break; // Diferencia menor a 1 segundo
    
    guess = new Date(guess.getTime() + diff);
  }
  
  return guess.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}
