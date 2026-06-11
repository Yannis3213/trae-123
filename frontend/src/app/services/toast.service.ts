import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Toast {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private toastSubject = new BehaviorSubject<Toast[]>([]);
  toasts$ = this.toastSubject.asObservable();
  private idCounter = 0;

  private push(type: Toast['type'], message: string, duration = 3000) {
    const toast: Toast = { id: ++this.idCounter, type, message, duration };
    const current = this.toastSubject.value;
    this.toastSubject.next([...current, toast]);
    if (duration > 0) {
      setTimeout(() => this.remove(toast.id), duration);
    }
  }

  success(m: string, d?: number) { this.push('success', m, d); }
  error(m: string, d?: number) { this.push('error', m, d); }
  warning(m: string, d?: number) { this.push('warning', m, d); }
  info(m: string, d?: number) { this.push('info', m, d); }

  remove(id: number) {
    const current = this.toastSubject.value.filter(t => t.id !== id);
    this.toastSubject.next(current);
  }
}
