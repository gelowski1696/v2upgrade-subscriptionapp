import { describe, expect, it } from 'vitest';
import {
  FEATURE_MOD_KEYS,
  featureModsFrom,
  featureOverridesFrom,
  featureValuesFrom,
  webDashboardFrom,
} from './feature-mods';

describe('featureModsFrom', () => {
  it('normalizes every known feature and ignores unrelated entitlements', () => {
    const result = featureModsFrom({
      reports: true,
      summaryCsv: true,
      discountReport: false,
    });

    expect(Object.keys(result)).toHaveLength(FEATURE_MOD_KEYS.length);
    expect(result.summaryCsv).toBe(true);
    expect(result.discountReport).toBe(false);
    expect(result.cashAdvance).toBe(false);
    expect(result).not.toHaveProperty('reports');
  });

  it('keeps legacy subscriptions enabled until explicitly disabled', () => {
    expect(webDashboardFrom()).toBe(true);
    expect(webDashboardFrom({ webDashboard: true })).toBe(true);
    expect(webDashboardFrom({ webDashboard: false })).toBe(false);
  });

  it('returns only subscription feature changes from a plan baseline', () => {
    const baseline = featureValuesFrom({ reports: true, summaryCsv: false, purchases: true });
    const values = { ...baseline, reports: false, summaryCsv: true, purchases: false };

    expect(featureOverridesFrom(baseline, values)).toEqual({
      summaryCsv: true,
      purchases: false,
    });
  });
});
