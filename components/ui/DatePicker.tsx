'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface DatePickerProps {
  value?: Date;
  onChange?: (date?: Date) => void;
  placeholder?: string;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Seleccionar fecha',
  disabled,
  minDate,
  maxDate,
  className,
}: DatePickerProps) {
  const disabledDays: React.ComponentProps<typeof Calendar>['disabled'] =
    minDate || maxDate
      ? [
        ...(minDate ? [{ before: minDate }] : []),
        ...(maxDate ? [{ after: maxDate }] : []),
      ]
      : undefined;

  return (
    <Popover>
      <PopoverTrigger className={'border-0 w-full p-0'} render={<Button variant='secondary' type='button' disabled={disabled} />}>
        <span
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-lg border border-[var(--text-secondary)] bg-[var(--bg-primary)] px-3 py-2 text-sm',
            value ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]',
            className
          )}
        >
          {value ? format(value, 'PPP', { locale: es }) : placeholder}
          <CalendarIcon className='ml-2 h-4 w-4 opacity-70' />
        </span>
      </PopoverTrigger>
      <PopoverContent className='w-auto p-0'>
        <Calendar
          mode='single'
          selected={value}
          onSelect={onChange}
          initialFocus
          disabled={disabledDays}
          locale={es}
        />
      </PopoverContent>
    </Popover>
  );
}
