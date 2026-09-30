import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';
import { SessionStore } from './session.store';

export const superAdminGuard: CanActivateFn = () => {
  const session = inject(SessionStore);
  return session.hasAnyRole('SUPER_ADMIN') ? true : inject(Router).createUrlTree(['/dashboard']);
};
