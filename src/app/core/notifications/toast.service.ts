import { Injectable, signal } from '@angular/core';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  title: string;
  message?: string;
  tone: ToastTone;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly messages = signal<ToastMessage[]>([]);
  private nextId = 1;

  show(title: string, tone: ToastTone = 'info', message?: string): void {
    const toast = { id: this.nextId++, title, message, tone };
    this.messages.update((messages) => [...messages, toast]);
    setTimeout(() => this.dismiss(toast.id), 3600);
  }

  dismiss(id: number): void {
    this.messages.update((messages) => messages.filter((message) => message.id !== id));
  }
}
