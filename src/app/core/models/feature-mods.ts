export const FEATURE_MOD_GROUPS = [
  {
    label: 'Sales and customers',
    features: [
      ['customerImport', 'Customer import'],
      ['dueReminders', 'Balance reminders'],
      ['posQuickOrders', 'Quick orders'],
      ['customerInactivityRules', 'Customer inactivity'],
      ['paymentReferenceTracking', 'Payment references'],
      ['customerGroups', 'Customer groups'],
      ['loyaltyPoints', 'Loyalty points'],
      ['scheduledDeliveries', 'Scheduled deliveries'],
    ],
  },
  {
    label: 'Personnel and daily control',
    features: [
      ['cashAdvance', 'Cash advances'],
      ['attendanceCapture', 'Attendance capture'],
      ['personnelTankCommission', 'Tank commissions'],
      ['taskReminders', 'Task reminders'],
      ['specialReceipts', 'Special receipts'],
      ['customerReport', 'Customer report'],
      ['summaryCsv', 'Summary CSV'],
      ['financialReport', 'Financial report'],
    ],
  },
  {
    label: 'Inventory, cash, and reports',
    features: [
      ['inventoryReportPrinting', 'Inventory report printing'],
      ['pettyCashReceivables', 'Petty cash receivables'],
      ['purchases', 'Purchases'],
      ['discountReport', 'Discount report'],
    ],
  },
] as const;

export const CORE_FEATURES = [
  ['webDashboard', 'Owner web dashboard', 'Desktop sync, web users, and owner portal access.'],
  ['reports', 'Reports', 'Core reporting screens and exports.'],
  ['backups', 'Database backups', 'Managed database backup access.'],
  ['multiUser', 'Multiple users', 'Create and manage more than one user account.'],
] as const;

export interface FeatureDefinition {
  key: string;
  label: string;
  description: string;
}

export interface FeatureGroup {
  label: string;
  features: readonly FeatureDefinition[];
}

export const FEATURE_GROUPS: readonly FeatureGroup[] = [
  {
    label: 'Core access',
    features: CORE_FEATURES.map(([key, label, description]) => ({ key, label, description })),
  },
  ...FEATURE_MOD_GROUPS.map((group) => ({
    label: group.label,
    features: group.features.map(([key, label]) => ({ key, label, description: '' })),
  })),
];

export type FeatureModKey = (typeof FEATURE_MOD_GROUPS)[number]['features'][number][0];
export type FeatureMods = Record<FeatureModKey, boolean>;
export type FeatureValues = Record<string, boolean>;

export const FEATURE_MOD_KEYS = FEATURE_MOD_GROUPS.flatMap((group) =>
  group.features.map(([key]) => key),
) as FeatureModKey[];

export function featureModsFrom(source?: Record<string, unknown>): FeatureMods {
  return Object.fromEntries(
    FEATURE_MOD_KEYS.map((key) => [key, source?.[key] === true]),
  ) as FeatureMods;
}

export function webDashboardFrom(source?: Record<string, unknown>): boolean {
  return source?.['webDashboard'] !== false;
}

export function featureValuesFrom(source?: Record<string, unknown>): FeatureValues {
  return Object.fromEntries(
    FEATURE_GROUPS.flatMap((group) =>
      group.features.map((feature) => [
        feature.key,
        feature.key === 'webDashboard' ? webDashboardFrom(source) : source?.[feature.key] === true,
      ]),
    ),
  );
}

export function featureOverridesFrom(baseline: FeatureValues, values: FeatureValues): FeatureMods {
  return Object.fromEntries(
    FEATURE_MOD_KEYS.filter((key) => baseline[key] !== values[key]).map((key) => [
      key,
      values[key] === true,
    ]),
  ) as FeatureMods;
}
