import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateValue?: string | Date | null) {
  if (!dateValue) {
    return '-';
  }

  const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function debounceValue<T>(value: T, delay = 250) {
  return new Promise<T>((resolve) => {
    setTimeout(() => resolve(value), delay);
  });
}
