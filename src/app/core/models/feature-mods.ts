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

export type FeatureModKey = (typeof FEATURE_MOD_GROUPS)[number]['features'][number][0];
export type FeatureMods = Record<FeatureModKey, boolean>;

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
