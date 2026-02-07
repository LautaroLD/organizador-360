import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function parseDateValue(value: string | Date) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const dateOnlyMatch = value.match(/^\d{4}-\d{2}-\d{2}$/);
  if (dateOnlyMatch) {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatLocalDate(value: string | Date) {
  const date = parseDateValue(value);
  if (!date) return 'Fecha invalida';
  return date.toLocaleDateString('es-AR');
}

export function formatTime(date: string | Date) {
  return new Date(date).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateTime(date: string | Date) {
  return `${formatDate(date)} ${formatTime(date)}`;
}
