import { Component, EventEmitter, Input, Output } from '@angular/core';
import { LucideTriangleAlert } from '@lucide/angular';
import { DialogFocusDirective } from '../dialog-focus.directive';

export type ConfirmationTone = 'danger' | 'warning';

@Component({
  selector: 'app-confirm-dialog',
  imports: [LucideTriangleAlert, DialogFocusDirective],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.css',
})
export class ConfirmDialogComponent {
  @Input({ required: true }) title = '';
  @Input({ required: true }) description = '';
  @Input() eyebrow = 'Confirm action';
  @Input() subject = '';
  @Input() subjectMeta = '';
  @Input() subjectValue = '';
  @Input() confirmLabel = 'Confirm';
  @Input() cancelLabel = 'Go back';
  @Input() workingLabel = 'Working…';
  @Input() tone: ConfirmationTone = 'danger';
  @Input() busy = false;
  @Input() confirmDisabled = false;

  @Output() readonly accepted = new EventEmitter<void>();
  @Output() readonly dismissed = new EventEmitter<void>();

  dismiss(): void {
    if (!this.busy) this.dismissed.emit();
  }

  accept(): void {
    if (!this.busy && !this.confirmDisabled) this.accepted.emit();
  }
}
