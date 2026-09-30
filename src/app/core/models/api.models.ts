export interface ApiPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR' | 'VIEWER';

export interface AuthenticatedUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: AuthenticatedUser;
}

export type ClientStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export interface ClientRecord {
  id: string;
  code: string;
  businessName: string;
  ownerName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  status: ClientStatus;
  createdAt: string;
  updatedAt: string;
}

export type PlanStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type BillingInterval = 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL' | 'CUSTOM';

export interface PlanVersionRecord {
  id: string;
  planId: string;
  version: number;
  billingInterval: BillingInterval;
  amount: string;
  currency: string;
  trialDays: number;
  graceDays: number;
  maxDevices: number;
  features: Record<string, unknown>;
  publishedAt: string | null;
  createdAt: string;
}

export interface PlanRecord {
  id: string;
  code: string;
  name: string;
  status: PlanStatus;
  versions: PlanVersionRecord[];
  createdAt: string;
  updatedAt: string;
}

export type SubscriptionStatus =
  'DRAFT' | 'TRIAL' | 'ACTIVE' | 'GRACE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED';

export interface SubscriptionRecord {
  id: string;
  clientId: string;
  planVersionId: string;
  status: SubscriptionStatus;
  startsAt: string;
  renewsAt: string | null;
  expiresAt: string | null;
  amount: string;
  currency: string;
  billingInterval: BillingInterval;
  maxDevices: number;
  entitlements: Record<string, unknown>;
  notes: string | null;
  device: {
    id: string;
    installationId: string;
    label: string | null;
    platform: string;
    status: 'ACTIVE' | 'REVOKED';
    lastSeenAt: string | null;
  } | null;
  client: { id: string; code: string; businessName: string };
  planVersion: {
    id: string;
    version: number;
    plan: { id: string; code: string; name: string };
  };
}

export interface ApiFailure {
  statusCode?: number;
  code?: string;
  message?: string | string[] | { message?: string | string[] };
}

export interface WebAnalyticsFilterStore {
  id: string;
  code: string;
  name: string;
}

export interface WebAnalyticsFilterClient {
  id: string;
  code: string;
  businessName: string;
  stores: WebAnalyticsFilterStore[];
}

export interface WebAnalyticsFilters {
  generatedAt: string;
  clients: WebAnalyticsFilterClient[];
}

export interface WebAnalyticsOverview {
  range: { from: string; to: string; timezone: 'UTC' };
  scope: { clientId: string | null; storeId: string | null };
  generatedAt: string;
  metricVersion: string;
  summary: {
    activeUsers: number;
    sessions: number;
    pageViews: number;
    frontendErrors: number;
    apiFailures: number;
    affectedSessions: number;
    affectedSessionRate: number;
  };
  usage: Array<{
    day: string;
    activeUsers: number;
    sessions: number;
    pageViews: number;
  }>;
  routes: Array<{ name: string; count: number }>;
  features: Array<{ name: string; count: number }>;
  performance: Array<{
    route: string;
    metricName: 'LCP' | 'INP' | 'CLS';
    deviceClass: 'DESKTOP' | 'MOBILE' | 'TABLET' | 'UNKNOWN';
    sampleCount: number;
    p75: number;
    insufficientSample: boolean;
  }>;
  errors: Array<{
    eventType: 'FRONTEND_ERROR' | 'API_FAILURE';
    errorCode: string;
    appRelease: string;
    count: number;
    affectedSessions: number;
    firstSeenAt: string;
    lastSeenAt: string;
  }>;
}
