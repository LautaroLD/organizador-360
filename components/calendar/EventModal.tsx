'use client';

import React, { useMemo } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Repeat } from 'lucide-react';
import { UseFormRegister, UseFormSetValue, UseFormWatch, FieldErrors, UseFormHandleSubmit } from 'react-hook-form';
import { generateRecurringEvents } from '@/lib/calendarUtils';

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
        <Input
          label="Título del Evento"
          {...register('title', { required: 'El título es requerido' })}
          error={errors.title?.message}
          placeholder="Reunión de equipo"
        />

        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
            Descripción
          </label>
          <textarea
            {...register('description')}
            className="flex w-full rounded-lg border border-[var(--text-secondary)]/30 bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] resize-none"
            rows={3}
            placeholder="Describe el evento..."
          />
        </div>

        <div className="space-y-4 p-4 bg-[var(--bg-secondary)]/50 rounded-lg border border-[var(--text-secondary)]/20">
          <h4 className="font-medium text-[var(--text-primary)] text-sm">Fecha y Hora</h4>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Fecha"
              type="date"
              {...register('start_date', { required: 'La fecha es requerida' })}
              error={errors.start_date?.message}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Hora Inicio"
              type="time"
              {...register('start_time', { required: 'La hora de inicio es requerida' })}
              error={errors.start_time?.message}
            />
            <Input
              label="Hora Fin"
              type="time"
              {...register('end_time', { required: 'La hora de fin es requerida' })}
              error={errors.end_time?.message}
            />
          </div>
        </div>

        <div className="space-y-4 p-4 bg-[var(--bg-secondary)]/50 rounded-lg border border-[var(--text-secondary)]/20">
          <h4 className="font-medium text-[var(--text-primary)] text-sm flex items-center gap-2">
            <Repeat className="h-4 w-4" />
            Repetición del Evento
          </h4>

          <div>
            <select
              {...register('recurrence_type')}
              onChange={(e) => {
                setValue('recurrence_type', e.target.value as 'none' | 'weekly' | 'custom');
                setShowRecurrenceOptions(e.target.value !== 'none');
                if (e.target.value === 'none') {
                  setSelectedDays([]);
                }
              }}
              className="flex h-10 w-full rounded-lg border border-[var(--text-secondary)]/30 bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
            >
              <option value="none">No repetir</option>
              <option value="weekly">Semanalmente (selecciona días)</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>

          {showRecurrenceOptions && recurrenceType === 'weekly' && (
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-secondary)]">Selecciona los días en que se repite:</p>

              <div className="grid grid-cols-7 gap-2">
                {WEEKDAYS.map((day) => (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => toggleDay(day.id)}
                    className={`
                      h-10 rounded-lg text-xs font-medium transition-all
                      ${selectedDays.includes(day.id)
                        ? 'bg-[var(--accent-primary)] text-white'
                        : 'bg-[var(--bg-primary)] border border-[var(--text-secondary)]/30 text-[var(--text-primary)] hover:border-[var(--accent-primary)]'
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

              <Input
                label="Hasta (fecha final)"
                type="date"
                {...register('recurrence_end_date')}
                min={startDate || new Date().toISOString().split('T')[0]}
                placeholder="Fecha final de repetición"
              />
            </div>
          )}

          {showRecurrenceOptions && recurrenceType === 'custom' && (
            <div className="p-3 bg-[var(--bg-primary)]/50 rounded text-sm text-[var(--text-secondary)]">
              <p>Funcionalidad personalizada disponible próximamente</p>
            </div>
          )}
        </div>

        {recurrenceType !== 'none' && selectedDays.length > 0 && startDate && startTime && endTime && (
          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-xs font-medium text-blue-600 mb-2">
              📅 Se crearán {eventCount} evento(s)
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              Desde {startDate} hasta {recurrenceEndDate || startDate}
            </p>
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
