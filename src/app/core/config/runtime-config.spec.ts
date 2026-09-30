import { describe, expect, it } from 'vitest';
import { resolveRuntimeConfig } from './runtime-config';

const development = {
  allowApiOverride: true,
  buildVersion: 'development',
  tauriApiBaseUrl: 'http://10.0.2.2:3100/api/v1',
  webApiBaseUrl: 'http://localhost:3100/api/v1',
};

const production = {
  allowApiOverride: false,
  buildVersion: '0.1.0',
  tauriApiBaseUrl: '/api/v1',
  webApiBaseUrl: '/api/v1',
};

function browserWindow(
  hostname: string,
  config?: Window['__POSV2_SUBSCRIPTIONS_CONFIG__'],
): Window {
  return {
    location: { hostname },
    __POSV2_SUBSCRIPTIONS_CONFIG__: config,
  } as unknown as Window;
}

describe('resolveRuntimeConfig', () => {
  it('uses the local API and permits overrides during browser development', () => {
    const config = resolveRuntimeConfig(browserWindow('localhost'), development);
    expect(config.apiBaseUrl).toBe('http://localhost:3100/api/v1');
    expect(config.allowApiOverride).toBe(true);
  });

  it('uses the same-origin API and locks overrides in production', () => {
    const config = resolveRuntimeConfig(browserWindow('admin.vmjamdocuai.cloud'), production);
    expect(config.apiBaseUrl).toBe('/api/v1');
    expect(config.allowApiOverride).toBe(false);
  });

  it('accepts a production runtime override without allowing user changes', () => {
    const config = resolveRuntimeConfig(
      browserWindow('admin.vmjamdocuai.cloud', {
        apiBaseUrl: '/platform/api/v1/',
        buildVersion: '2026.09.29',
      }),
      production,
    );
    expect(config.apiBaseUrl).toBe('/platform/api/v1');
    expect(config.buildVersion).toBe('2026.09.29');
  });
});
