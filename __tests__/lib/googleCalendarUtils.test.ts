/**
 * @jest-environment node
 */

import {
  applyUntilToRecurrence,
  formatEventForGoogle,
} from '@/lib/googleCalendarUtils';

describe('googleCalendarUtils recurrence helpers', () => {
  it('omits RRULE when formatting as exception', () => {
    const event = formatEventForGoogle(
      {
        title: 'Standup',
        start_date: '2026-07-27',
        start_time: '09:00',
        end_date: '2026-07-27',
        end_time: '10:00',
        is_recurring: true,
        recurrence_rule: 'weekly',
        selected_days: ['monday'],
        recurrence_end_date: '2026-08-31',
        time_zone: 'UTC',
      },
      { asException: true },
    );

    expect(event.recurrence).toBeUndefined();
    expect(event.summary).toBe('Standup');
  });

  it('includes RRULE for recurring masters', () => {
    const event = formatEventForGoogle({
      title: 'Standup',
      start_date: '2026-07-20',
      start_time: '09:00',
      end_date: '2026-07-20',
      end_time: '10:00',
      is_recurring: true,
      recurrence_rule: 'weekly',
      selected_days: ['monday'],
      recurrence_end_date: '2026-08-31',
      time_zone: 'UTC',
    });

    expect(event.recurrence?.[0]).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO');
    expect(event.recurrence?.[0]).toContain('UNTIL=');
  });

  it('replaces UNTIL/COUNT when truncating a series', () => {
    const next = applyUntilToRecurrence(
      ['RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=10'],
      '2026-07-26',
      'UTC',
    );

    expect(next).toHaveLength(1);
    expect(next[0]).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO');
    expect(next[0]).not.toContain('COUNT=');
    expect(next[0]).toMatch(/UNTIL=20260726T235959Z/);
  });
});
