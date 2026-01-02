import { cn, formatDate, formatTime, formatDateTime } from '@/lib/utils';

describe('Utility Functions', () => {
  describe('cn (className merger)', () => {
    it('merges class names correctly', () => {
      const result = cn('text-red-500', 'bg-blue-500');
      expect(result).toContain('text-red-500');
      expect(result).toContain('bg-blue-500');
    });

    it('handles conditional classes', () => {
      const result = cn('base-class', true && 'conditional-class', false && 'hidden-class');
      expect(result).toContain('base-class');
      expect(result).toContain('conditional-class');
      expect(result).not.toContain('hidden-class');
    });

    it('handles undefined and null', () => {
      const result = cn('class', undefined, null);
      expect(result).toContain('class');
    });
  });

  describe('formatDate', () => {
    it('formats date correctly in Spanish', () => {
      const date = new Date('2024-01-15T10:30:00');
      const formatted = formatDate(date);
      
      expect(formatted).toContain('2024');
      expect(formatted).toContain('ene'); // Spanish abbreviation
    });

    it('handles string dates', () => {
      const formatted = formatDate('2024-01-15');
      expect(formatted).toBeTruthy();
      expect(typeof formatted).toBe('string');
    });

    it('formats current date', () => {
      const now = new Date();
      const formatted = formatDate(now);
      expect(formatted).toBeTruthy();
    });
  });

  describe('formatTime', () => {
    it('formats time correctly', () => {
      const date = new Date('2024-01-15T14:30:00');
      const formatted = formatTime(date);
      
      expect(formatted).toMatch(/\d{2}:\d{2}/);
    });

    it('uses 24-hour format', () => {
      const date = new Date('2024-01-15T14:30:00');
      const formatted = formatTime(date);
      
      // Should show 14:30 not 2:30 PM
      expect(formatted).toContain('14');
    });
  });

  describe('formatDateTime', () => {
    it('combines date and time', () => {
      const date = new Date('2024-01-15T14:30:00');
      const formatted = formatDateTime(date);
      
      expect(formatted).toContain('2024');
      expect(formatted).toMatch(/\d{2}:\d{2}/);
    });

    it('returns a string', () => {
      const formatted = formatDateTime(new Date());
      expect(typeof formatted).toBe('string');
    });
  });
});
