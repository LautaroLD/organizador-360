import {
  expandSeriesOccurrences,
  materializeEventsForUI,
  generateRecurringEvents,
} from '@/lib/calendarUtils';
import type { CalendarEventRow } from '@/types/calendarOccurrence';

const master: CalendarEventRow = {
  id: 'm1',
  project_id: 'p1',
  created_by: 'u1',
  title: 'Standup',
  description: '',
  start_date: '2026-07-20T09:00:00',
  end_date: '2026-07-20T10:00:00',
  google_event_id: 'g1',
  is_recurring: true,
  recurrence_rule: 'weekly',
  recurrence_days: ['monday'],
  recurrence_end_date: '2026-08-03',
  series_id: 'm1',
  is_series_master: true,
  is_exception: false,
  is_cancelled: false,
  original_start_date: '2026-07-20T09:00:00',
};

describe('calendarUtils Option 3 expansion', () => {
  it('generateRecurringEvents produces weekly slots', () => {
    const slots = generateRecurringEvents({
      title: 'x',
      description: '',
      start_date: '2026-07-20',
      start_time: '09:00',
      end_date: '2026-07-20',
      end_time: '10:00',
      recurrence_type: 'weekly',
      selected_days: ['monday'],
      recurrence_end_date: '2026-08-03',
    });
    expect(slots.map((s) => s.start.split('T')[0])).toEqual([
      '2026-07-20',
      '2026-07-27',
      '2026-08-03',
    ]);
  });

  it('expandSeriesOccurrences creates virtual ids', () => {
    const occurrences = expandSeriesOccurrences(master, []);
    expect(occurrences).toHaveLength(3);
    expect(occurrences[1]?.is_virtual).toBe(true);
    expect(occurrences[1]?.id).toBe('m1::2026-07-27');
    expect(occurrences[1]?.source_event_id).toBe('m1');
  });

  it('applies exception override and skips cancelled', () => {
    const exception: CalendarEventRow = {
      ...master,
      id: 'ex1',
      is_series_master: false,
      is_exception: true,
      title: 'Moved',
      start_date: '2026-07-27T11:00:00',
      end_date: '2026-07-27T12:00:00',
      original_start_date: '2026-07-27T09:00:00',
      google_event_id: null,
    };
    const cancelled: CalendarEventRow = {
      ...exception,
      id: 'ex2',
      title: 'Cancelled',
      original_start_date: '2026-08-03T09:00:00',
      start_date: '2026-08-03T09:00:00',
      is_cancelled: true,
    };

    const occurrences = expandSeriesOccurrences(master, [exception, cancelled]);
    expect(occurrences).toHaveLength(2);
    expect(occurrences.find((o) => o.id === 'ex1')?.title).toBe('Moved');
    expect(occurrences.some((o) => o.start_date.startsWith('2026-08-03'))).toBe(
      false,
    );
  });

  it('materializeEventsForUI expands option-3 masters', () => {
    const list = materializeEventsForUI([master]);
    expect(list).toHaveLength(3);
  });
});
