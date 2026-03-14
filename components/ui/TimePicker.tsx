'use client';

import * as React from 'react';
import { Clock3 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface TimePickerProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));

function splitTime(value?: string) {
  if (!value || !value.includes(':')) {
    return { hour: '09', minute: '00' };
  }

  const [hour, minute] = value.split(':');
  return {
    hour: hour?.padStart(2, '0') ?? '09',
    minute: minute?.padStart(2, '0') ?? '00',
  };
}

export function TimePicker({
  value,
  onChange,
  placeholder = 'Seleccionar hora',
  disabled,
  className,
}: TimePickerProps) {
  const { hour, minute } = splitTime(value);

  const updateHour = (nextHour: string) => {
    onChange?.(`${nextHour}:${minute}`);
  };

  const updateMinute = (nextMinute: string) => {
    onChange?.(`${hour}:${nextMinute}`);
  };

  return (
    <Popover>
      <PopoverTrigger
        className={'border-0 w-full p-0'}
        render={<Button variant='secondary' type='button' disabled={disabled} />}>
        <span
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-lg border border-[var(--text-secondary)] bg-[var(--bg-primary)] px-3 py-2 text-sm',
            value ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]',
            className
          )}
        >
          {value || placeholder}
          <Clock3 className='ml-2 h-4 w-4 opacity-70' />
        </span>
      </PopoverTrigger>
      <PopoverContent className='w-64 p-3'>
        <div className='grid grid-cols-2 gap-3'>
          <div>
            <label className='mb-1 block text-xs font-medium text-[var(--text-secondary)]'>Hora</label>
            <select
              className='flex h-10 w-full rounded-lg border border-[var(--text-secondary)] bg-[var(--bg-primary)] px-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]'
              value={hour}
              onChange={(event) => updateHour(event.target.value)}
            >
              {hours.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className='mb-1 block text-xs font-medium text-[var(--text-secondary)]'>Minuto</label>
            <select
              className='flex h-10 w-full rounded-lg border border-[var(--text-secondary)] bg-[var(--bg-primary)] px-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]'
              value={minute}
              onChange={(event) => updateMinute(event.target.value)}
            >
              {minutes.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
