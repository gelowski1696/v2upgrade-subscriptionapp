import { describe, expect, it } from 'vitest';
import { FEATURE_MOD_KEYS, featureModsFrom, webDashboardFrom } from './feature-mods';

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
});
