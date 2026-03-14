'use client';

import * as React from 'react';
import { DatePicker } from '@/components/ui/DatePicker';

interface DateRangePickerProps {
  startValue?: Date;
  endValue?: Date;
  onStartChange?: (date?: Date) => void;
  onEndChange?: (date?: Date) => void;
  startLabel?: string;
  endLabel?: string;
  startPlaceholder?: string;
  endPlaceholder?: string;
  className?: string;
}

export function DateRangePicker({
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  startLabel = 'Desde',
  endLabel = 'Hasta',
  startPlaceholder = 'Fecha inicio',
  endPlaceholder = 'Fecha fin',
  className,
}: DateRangePickerProps) {
  return (
    <div className={className ?? 'flex gap-4'}>
      <div className='flex-1'>
        <label className='mb-1 block text-sm font-medium text-[var(--text-secondary)]'>
          {startLabel}
        </label>
        <DatePicker
          value={startValue}
          onChange={onStartChange}
          placeholder={startPlaceholder}
          className='w-full'
        />
      </div>

      <div className='flex-1'>
        <label className='mb-1 block text-sm font-medium text-[var(--text-secondary)]'>
          {endLabel}
        </label>
        <DatePicker
          value={endValue}
          onChange={onEndChange}
          minDate={startValue}
          placeholder={endPlaceholder}
          className='w-full'
        />
      </div>
    </div>
  );
}
