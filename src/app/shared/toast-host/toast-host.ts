import { Component } from '@angular/core';
import { LucideCheckCircle2, LucideCircleAlert, LucideInfo, LucideX } from '@lucide/angular';
import { ToastService } from '../../core/notifications/toast.service';

@Component({
  selector: 'app-toast-host',
  imports: [LucideCheckCircle2, LucideCircleAlert, LucideInfo, LucideX],
  templateUrl: './toast-host.html',
})
export class ToastHost {
  constructor(readonly toasts: ToastService) {}
}
