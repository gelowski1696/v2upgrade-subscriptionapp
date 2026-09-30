import {
  AfterViewInit,
  Directive,
  ElementRef,
  EventEmitter,
  HostListener,
  OnDestroy,
  Output,
} from '@angular/core';

@Directive({
  selector: '[appDialogFocus]',
})
export class DialogFocusDirective implements AfterViewInit, OnDestroy {
  @Output() readonly dialogEscape = new EventEmitter<void>();
  private readonly returnFocusTo =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;

  constructor(private readonly element: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    queueMicrotask(() => {
      const initial =
        this.element.nativeElement.querySelector<HTMLElement>('[data-dialog-initial-focus]') ??
        this.focusableElements()[0];
      initial?.focus();
    });
  }

  ngOnDestroy(): void {
    this.returnFocusTo?.focus();
  }

  @HostListener('keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.dialogEscape.emit();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = this.focusableElements();
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private focusableElements(): HTMLElement[] {
    return Array.from(
      this.element.nativeElement.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => element.offsetParent !== null);
  }
}
