import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
    __POSV2_SUBSCRIPTIONS_CONFIG__?: {
      apiBaseUrl?: string;
      buildVersion?: string;
    };
  }
}

export type RuntimePlatform = 'web' | 'tauri';

export interface RuntimeConfig {
  apiBaseUrl: string;
  allowApiOverride: boolean;
  buildVersion: string;
  platform: RuntimePlatform;
}

export interface RuntimeBuildConfig {
  allowApiOverride: boolean;
  buildVersion: string;
  tauriApiBaseUrl: string;
  webApiBaseUrl: string;
}

export function resolveRuntimeConfig(
  browserWindow: Window = window,
  build: RuntimeBuildConfig = environment,
): RuntimeConfig {
  const isTauri = Boolean(browserWindow.__TAURI_INTERNALS__);
  const supplied = browserWindow.__POSV2_SUBSCRIPTIONS_CONFIG__;
  const apiBaseUrl =
    supplied?.apiBaseUrl || (isTauri ? build.tauriApiBaseUrl : build.webApiBaseUrl);

  return {
    apiBaseUrl: normalizeApiUrl(apiBaseUrl),
    allowApiOverride: build.allowApiOverride,
    buildVersion: supplied?.buildVersion?.trim() || build.buildVersion,
    platform: isTauri ? 'tauri' : 'web',
  };
}

@Injectable({ providedIn: 'root' })
export class RuntimeConfigService {
  private readonly storageKey = 'posv2-subscriptions-api-url';
  private readonly config = resolveRuntimeConfig();
  readonly baseUrl = signal(this.initialBaseUrl());
  readonly allowApiOverride = this.config.allowApiOverride;
  readonly buildVersion = this.config.buildVersion;
  readonly platform = this.config.platform;

  setBaseUrl(value: string): void {
    if (!this.allowApiOverride) return;
    const normalized = normalizeApiUrl(value);
    this.baseUrl.set(normalized);
    localStorage.setItem(this.storageKey, normalized);
  }

  private initialBaseUrl(): string {
    if (!this.allowApiOverride) return this.config.apiBaseUrl;
    const saved = localStorage.getItem(this.storageKey);
    return saved ? normalizeApiUrl(saved) : this.config.apiBaseUrl;
  }
}

function normalizeApiUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, '');
  return normalized || '/api/v1';
}
