'use client';

import React, { useMemo } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { TimeRangePicker } from '@/components/ui/TimeRangePicker';
import { CalendarCheck, CalendarDays, ChevronDown, Clock3, FileText, Repeat, Sparkles } from 'lucide-react';
import { UseFormRegister, UseFormSetValue, UseFormWatch, FieldErrors, UseFormHandleSubmit } from 'react-hook-form';
import { generateRecurringEvents } from '@/lib/calendarUtils';
import { parseDateValue } from '@/lib/utils';

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

const WEEKDAYS = [
  { id: 'monday', label: 'Lunes', short: 'L' },
  { id: 'tuesday', label: 'Martes', short: 'M' },
  { id: 'wednesday', label: 'Miércoles', short: 'X' },
  { id: 'thursday', label: 'Jueves', short: 'J' },
  { id: 'friday', label: 'Viernes', short: 'V' },
  { id: 'saturday', label: 'Sábado', short: 'S' },
  { id: 'sunday', label: 'Domingo', short: 'D' },
];

const toISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: EventFormData) => void;
  handleSubmit: UseFormHandleSubmit<EventFormData>;
  register: UseFormRegister<EventFormData>;
  errors: FieldErrors<EventFormData>;
  watch: UseFormWatch<EventFormData>;
  setValue: UseFormSetValue<EventFormData>;
  selectedDays: string[];
  setSelectedDays: (days: string[]) => void;
  showRecurrenceOptions: boolean;
  setShowRecurrenceOptions: (show: boolean) => void;
  isLoading: boolean;
}

export const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  handleSubmit,
  register,
  errors,
  watch,
  setValue,
  selectedDays,
  setSelectedDays,
  showRecurrenceOptions,
  setShowRecurrenceOptions,
  isLoading,
}) => {
  const recurrenceType = watch('recurrence_type');
  const startDate = watch('start_date');
  const startTime = watch('start_time');
  const endTime = watch('end_time');
  const recurrenceEndDate = watch('recurrence_end_date');

  const eventCount = useMemo(() => {
    if (recurrenceType === 'none' || selectedDays.length === 0 || !startDate || !startTime || !endTime) {
      return 0;
    }

    const generatedEvents = generateRecurringEvents({
      title: watch('title') || '',
      description: watch('description') || '',
      start_date: startDate,
      start_time: startTime,
      end_date: watch('end_date') || startDate,
      end_time: endTime,
      recurrence_type: recurrenceType,
      selected_days: selectedDays,
      recurrence_end_date: recurrenceEndDate,
    });

    return generatedEvents.length;
  }, [recurrenceType, selectedDays, startDate, startTime, endTime, watch, recurrenceEndDate]);

  const toggleDay = (dayId: string) => {
    if (selectedDays.includes(dayId)) {
      setSelectedDays(selectedDays.filter(d => d !== dayId));
    } else {
      setSelectedDays([...selectedDays, dayId]);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Crear Nuevo Evento" size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="rounded-xl border border-[var(--accent-primary)]/20 bg-[var(--accent-primary)]/5 p-3">
          <p className="flex items-center gap-2 text-xs font-medium text-[var(--accent-primary)]">
            <Sparkles className="h-3.5 w-3.5" />
            Completa fecha, hora y recurrencia para crear uno o varios eventos de una vez.
          </p>
        </div>

        <Input
          label="Título del Evento"
          {...register('title', { required: 'El título es requerido' })}
          error={errors.title?.message}
          placeholder="Reunión de equipo"
        />

        <div>
          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
            <FileText className="h-4 w-4 text-[var(--text-secondary)]" />
            Descripción
          </label>
          <textarea
            {...register('description')}
            className="flex min-h-[96px] w-full resize-none rounded-xl border border-[var(--text-secondary)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
            rows={4}
            placeholder="Describe el evento..."
          />
        </div>

        <div className="space-y-4 rounded-xl border border-[var(--text-secondary)]/20 bg-[var(--bg-secondary)]/60 p-4">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <CalendarDays className="h-4 w-4 text-[var(--accent-primary)]" />
            Fecha y Hora
          </h4>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">Fecha del evento</label>
            <input type="hidden" {...register('start_date', { required: 'La fecha es requerida' })} />
            <DatePicker
              value={parseDateValue(startDate) ?? undefined}
              onChange={(date) => setValue('start_date', date ? toISODate(date) : '', { shouldValidate: true })}
              minDate={new Date()}
              placeholder="Seleccionar fecha"
            />
            {errors.start_date?.message && <p className="mt-1 text-sm text-red-500">{errors.start_date.message}</p>}
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--text-secondary)]/15" />
            <span className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              <Clock3 className="h-3 w-3" />
              Horario
            </span>
            <div className="h-px flex-1 bg-[var(--text-secondary)]/15" />
          </div>

          <input type="hidden" {...register('start_time', { required: 'La hora de inicio es requerida' })} />
          <input type="hidden" {...register('end_time', { required: 'La hora de fin es requerida' })} />
          <TimeRangePicker
            startValue={startTime}
            endValue={endTime}
            onStartChange={(time) => setValue('start_time', time, { shouldValidate: true })}
            onEndChange={(time) => setValue('end_time', time, { shouldValidate: true })}
            startError={errors.start_time?.message}
            endError={errors.end_time?.message}
            className='grid grid-cols-2 gap-3'
          />
          <p className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <Clock3 className="h-3 w-3 shrink-0" />
            Usa bloques de tiempo realistas para mejorar recordatorios y evitar conflictos de agenda.
          </p>
        </div>

        <div className="space-y-4 rounded-xl border border-[var(--text-secondary)]/20 bg-[var(--bg-secondary)]/60 p-4">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <Repeat className="h-4 w-4 text-[var(--accent-primary)]" />
            Repetición del Evento
          </h4>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">
              Frecuencia
            </label>
            <div className="relative">
              <select
                {...register('recurrence_type')}
                onChange={(e) => {
                  setValue('recurrence_type', e.target.value as 'none' | 'weekly' | 'custom');
                  setShowRecurrenceOptions(e.target.value !== 'none');
                  if (e.target.value === 'none') {
                    setSelectedDays([]);
                  }
                }}
                className="flex h-10 w-full appearance-none rounded-lg border border-[var(--text-secondary)]/30 bg-[var(--bg-primary)] px-3 py-2 pr-9 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              >
                <option value="none">No repetir</option>
                <option value="weekly">Semanalmente (selecciona días)</option>
                <option value="custom">Personalizado</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
            </div>
          </div>

          {showRecurrenceOptions && recurrenceType === 'weekly' && (
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">Días de repetición</p>

              <div className="grid grid-cols-7 gap-2">
                {WEEKDAYS.map((day) => (
                  <button
                    key={day.id}
                    type="button"
                    title={day.label}
                    onClick={() => toggleDay(day.id)}
                    aria-pressed={selectedDays.includes(day.id)}
                    className={`
                      h-9 rounded-lg text-xs font-semibold transition-all
                      ${selectedDays.includes(day.id)
                        ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] shadow-sm ring-2 ring-[var(--accent-primary)]/30'
                        : 'border border-[var(--text-secondary)]/30 bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]'
                      }
                    `}
                  >
                    {day.short}
                  </button>
                ))}
              </div>

              {selectedDays.length === 0 && (
                <p className="text-xs text-red-500">Selecciona al menos un día</p>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">Repetir hasta</label>
                <input type="hidden" {...register('recurrence_end_date')} />
                <DatePicker
                  value={parseDateValue(recurrenceEndDate || '') ?? undefined}
                  onChange={(date) => setValue('recurrence_end_date', date ? toISODate(date) : '')}
                  minDate={parseDateValue(startDate || '') ?? new Date()}
                  placeholder="Fecha final de repeticion"
                />
              </div>
            </div>
          )}

          {showRecurrenceOptions && recurrenceType === 'custom' && (
            <div className="rounded-lg border border-dashed border-[var(--text-secondary)]/25 bg-[var(--bg-primary)]/50 p-3 text-center">
              <p className="text-sm text-[var(--text-secondary)]">Funcionalidad personalizada disponible próximamente</p>
            </div>
          )}
        </div>

        {recurrenceType !== 'none' && selectedDays.length > 0 && startDate && startTime && endTime && (
          <div className="rounded-xl border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/8 p-4">
            <div className="mb-2 flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-[var(--accent-primary)]" />
              <p className="text-sm font-semibold text-[var(--accent-primary)]">
                Se crearán {eventCount} evento{eventCount !== 1 ? 's' : ''}
              </p>
            </div>
            <p className="mb-2 text-xs text-[var(--text-secondary)]">
              Del {startDate}{recurrenceEndDate ? ` al ${recurrenceEndDate}` : ''} · {selectedDays.length} día{selectedDays.length !== 1 ? 's' : ''} por semana
            </p>
            <div className="flex flex-wrap gap-1">
              {selectedDays.map(dayId => {
                const day = WEEKDAYS.find(d => d.id === dayId);
                return day ? (
                  <span key={dayId} className="rounded-full bg-[var(--accent-primary)]/15 px-2 py-0.5 text-xs font-medium text-[var(--accent-primary)]">
                    {day.label}
                  </span>
                ) : null;
              })}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-[var(--text-secondary)]/20">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isLoading || (recurrenceType === 'weekly' && selectedDays.length === 0)}
          >
            {isLoading ? 'Creando...' : 'Crear Evento(s)'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
