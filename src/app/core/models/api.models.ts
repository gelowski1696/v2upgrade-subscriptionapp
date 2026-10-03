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
  refreshToken?: string;
  user: AuthenticatedUser;
}

export type ClientStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type ClientGroupStatus = 'ACTIVE' | 'ARCHIVED';

export interface ClientGroupRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: ClientGroupStatus;
  clientCount: number;
  createdAt: string;
  updatedAt: string;
}

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
  groupId: string | null;
  group: Pick<ClientGroupRecord, 'id' | 'code' | 'name' | 'status'> | null;
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
    features?: Record<string, unknown>;
    plan: { id: string; code: string; name: string };
  };
}

export interface SubscriptionRenewalRecord {
  id: string;
  subscriptionId: string;
  previousExpiresAt: string | null;
  periodStartsAt: string;
  periodEndsAt: string;
  amount: string;
  currency: string;
  billingInterval: BillingInterval;
  reason: string | null;
  createdById: string;
  createdBy?: { id: string; displayName: string };
  createdAt: string;
}

export interface SubscriptionRenewalResult {
  subscription: SubscriptionRecord;
  renewal: SubscriptionRenewalRecord;
}

export type ExpenseCategory =
  | 'INFRASTRUCTURE'
  | 'SOFTWARE'
  | 'MARKETING'
  | 'OPERATIONS'
  | 'PROFESSIONAL_SERVICES'
  | 'TAXES'
  | 'OTHER';

export interface ExpenseRecord {
  id: string;
  category: ExpenseCategory;
  description: string;
  amount: string;
  currency: string;
  incurredAt: string;
  vendor: string | null;
  reference: string | null;
  notes: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export type PaymentPurpose = 'INITIAL' | 'RENEWAL' | 'MODIFICATION' | 'OTHER';

export interface PaymentRecord {
  id: string;
  batchId: string | null;
  subscriptionId: string | null;
  renewalId: string | null;
  purpose: PaymentPurpose;
  description: string | null;
  amount: string;
  currency: string;
  reference: string | null;
  paidAt: string;
  notes: string | null;
  status: 'POSTED' | 'VOIDED';
  voidedAt: string | null;
  voidReason: string | null;
  client: {
    id: string;
    businessName: string;
    group: { id: string; code: string; name: string } | null;
  };
  plan: { id: string; name: string } | null;
  renewal: {
    id: string;
    periodStartsAt: string;
    periodEndsAt: string;
  } | null;
}

export interface FinanceOverview {
  range: { from: string; to: string; timezone: 'UTC'; currency: string };
  summary: {
    revenue: number;
    expenses: number;
    netIncome: number;
    paymentCount: number;
    expenseCount: number;
  };
  daily: Array<{
    day: string;
    revenue: number;
    expenses: number;
    netIncome: number;
  }>;
  byPlan: Array<{
    planId: string;
    planName: string;
    revenue: number;
    payments: number;
  }>;
  byPurpose: Array<{
    purpose: PaymentPurpose;
    revenue: number;
    payments: number;
  }>;
  recentPayments: PaymentRecord[];
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
  environment: string;
  health: {
    status: 'OPERATIONAL';
    api: {
      version: string;
      release: string;
      uptimeSeconds: number;
      database: 'AVAILABLE';
    };
    ownerDashboard: {
      observedRelease: string | null;
      latestSignalAt: string | null;
    };
    historicalAvailabilityAvailable: boolean;
  };
  collection: {
    state: 'ACTIVE' | 'PARTIAL' | 'DISABLED';
    activeClients: number;
    enabledClients: number;
    realUserMonitoringEnabled: boolean;
    retentionDays: number;
  };
  privacy: {
    minimumGroupSize: number;
    breakdownsSuppressed: boolean;
  };
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
