import { HttpErrorResponse } from '@angular/common/http';
import type { ApiFailure } from '../models/api.models';

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof HttpErrorResponse)) return fallback;
  if (error.status === 0) return 'Cannot reach the subscription server.';

  const body = error.error as ApiFailure | undefined;
  const raw = body?.message;
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) return raw[0] ?? fallback;
  if (raw && typeof raw === 'object') {
    const nested = raw.message;
    if (typeof nested === 'string') return nested;
    if (Array.isArray(nested)) return nested[0] ?? fallback;
  }
  return fallback;
}
