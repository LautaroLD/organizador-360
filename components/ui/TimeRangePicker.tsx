'use client';

import * as React from 'react';
import { TimePicker } from '@/components/ui/TimePicker';

interface TimeRangePickerProps {
  startValue?: string;
  endValue?: string;
  onStartChange?: (value: string) => void;
  onEndChange?: (value: string) => void;
  startLabel?: string;
  endLabel?: string;
  startError?: string;
  endError?: string;
  className?: string;
}

export function TimeRangePicker({
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  startLabel = 'Hora Inicio',
  endLabel = 'Hora Fin',
  startError,
  endError,
  className,
}: TimeRangePickerProps) {
  return (
    <div className={className ?? 'grid grid-cols-2 gap-3'}>
      <div>
        <label className='mb-1 block text-sm font-medium text-[var(--text-primary)]'>{startLabel}</label>
        <TimePicker
          value={startValue}
          onChange={onStartChange}
          placeholder='Seleccionar hora'
        />
        {startError ? <p className='mt-1 text-sm text-red-500'>{startError}</p> : null}
      </div>

      <div>
        <label className='mb-1 block text-sm font-medium text-[var(--text-primary)]'>{endLabel}</label>
        <TimePicker
          value={endValue}
          onChange={onEndChange}
          placeholder='Seleccionar hora'
        />
        {endError ? <p className='mt-1 text-sm text-red-500'>{endError}</p> : null}
      </div>
    </div>
  );
}
