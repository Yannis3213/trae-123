import { createSignal, onCleanup } from 'solid-js';
import type { DueStatus, PlanStatus } from '@/types';
import { DueStatusLabel, PlanStatusLabel } from '@/types';

export function dueStatusTagClass(status: DueStatus): string {
  switch (status) {
    case 'normal':
      return 'tag tag-green';
    case 'approaching':
      return 'tag tag-orange';
    case 'overdue':
      return 'tag tag-red';
  }
}

export function planStatusTagClass(status: PlanStatus): string {
  switch (status) {
    case 'pending_confirm':
      return 'tag tag-blue';
    case 'confirmed':
      return 'tag tag-green';
    case 'exception':
      return 'tag tag-red';
    case 'pending_review':
      return 'tag tag-orange';
    case 'reviewed':
      return 'tag tag-blue';
    case 'archived':
      return 'tag tag-gray';
  }
}

export function statusTag(status: PlanStatus): string {
  return PlanStatusLabel[status];
}

export function dueStatusTag(status: DueStatus): string {
  return DueStatusLabel[status];
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function formatDateOnly(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export interface ToastProps {
  type: 'success' | 'error' | 'info';
  message: string;
}

let toastTimer: number | null = null;

export function useToast() {
  const [toast, setToast] = createSignal<ToastProps | null>(null);

  const show = (type: ToastProps['type'], message: string) => {
    if (toastTimer) window.clearTimeout(toastTimer);
    setToast({ type, message });
    toastTimer = window.setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  onCleanup(() => {
    if (toastTimer) window.clearTimeout(toastTimer);
  });

  return { toast, show };
}
