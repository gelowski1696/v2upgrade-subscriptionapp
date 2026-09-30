import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialogComponent } from './confirm-dialog';

describe('ConfirmDialogComponent', () => {
  it('presents the affected record and defaults focus to the safe action', async () => {
    await TestBed.configureTestingModule({ imports: [ConfirmDialogComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.componentRef.setInput('title', 'Archive client?');
    fixture.componentRef.setInput('description', 'The client will leave active lists.');
    fixture.componentRef.setInput('subject', 'Demo Store');
    fixture.componentRef.setInput('confirmLabel', 'Archive client');
    fixture.componentRef.setInput('cancelLabel', 'Keep client active');
    fixture.detectChanges();
    await fixture.whenStable();

    const dialog = fixture.nativeElement.querySelector('[role="alertdialog"]') as HTMLElement;
    const cancel = fixture.nativeElement.querySelector(
      '[data-dialog-initial-focus]',
    ) as HTMLButtonElement;

    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.textContent).toContain('Demo Store');
    expect(document.activeElement).toBe(cancel);
  });

  it('emits the selected action and blocks interaction while busy', async () => {
    await TestBed.configureTestingModule({ imports: [ConfirmDialogComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    const component = fixture.componentInstance;
    const accepted = vi.fn();
    const dismissed = vi.fn();
    component.accepted.subscribe(accepted);
    component.dismissed.subscribe(dismissed);

    component.accept();
    component.dismiss();
    expect(accepted).toHaveBeenCalledOnce();
    expect(dismissed).toHaveBeenCalledOnce();

    fixture.componentRef.setInput('busy', true);
    component.accept();
    component.dismiss();
    expect(accepted).toHaveBeenCalledOnce();
    expect(dismissed).toHaveBeenCalledOnce();
  });
});
