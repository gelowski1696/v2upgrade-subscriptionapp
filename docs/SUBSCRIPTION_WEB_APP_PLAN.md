# POSV2 Subscription Web App Plan

**Status:** Core local implementation complete; release hardening, DNS, and VPS rollout pending  
**Prepared:** 2026-09-29  
**Applies to:** `subscriptionapp-posv2`, `subsapi`, and the existing owner-dashboard VPS deployment

## Decision Summary

The existing subscription application should be adapted and deployed as the web application. It is
already an Angular single-page application; Tauri is only its Android packaging layer. A second
frontend implementation would duplicate the current client, plan, subscription, authentication,
and API logic without adding useful capability.

The owner dashboard is deployed at `https://vmjamdocuai.cloud`. Keep that application at the apex
hostname and add a dedicated administrative hostname for the subscription application:

```text
https://vmjamdocuai.cloud        -> ownerdashboard-posv2
https://admin.vmjamdocuai.cloud  -> subscriptionapp-posv2
https://*/api/v1                 -> the same subsapi service
```

If a new subdomain is not wanted, both applications can instead coexist on the exact current
hostname:

```text
https://vmjamdocuai.cloud/        -> ownerdashboard-posv2
https://vmjamdocuai.cloud/admin/  -> subscriptionapp-posv2
https://vmjamdocuai.cloud/api/v1  -> subsapi
```

Two applications cannot both own `/` on the same hostname. The reverse proxy must separate them by
hostname or path. The dedicated administrative hostname is recommended because it gives the
privileged application a clearer security boundary, simpler Angular routing, separate browser
storage, and independent deployment and rollback.

### Verified Production Baseline

Checked on 2026-09-29:

- `https://vmjamdocuai.cloud/` returns the deployed Angular dashboard over HTTPS.
- `https://vmjamdocuai.cloud/api/v1/health` returns HTTP 200 with the API and database healthy.
- Plain HTTP redirects permanently to HTTPS.
- The public request path is Caddy at the edge, Nginx for the SPA, and NestJS for `/api/v1`.

The new `admin.vmjamdocuai.cloud` DNS record and TLS route do not exist yet and are part of this
plan. Because the current HSTS policy includes subdomains, the administrative hostname must have a
valid HTTPS certificate before it is opened in a browser.

## Current State

The following foundations already exist:

- Angular 21 browser build with lazy-loaded routes for Dashboard, Clients, Plans, and Subscriptions.
- Responsive, touch-friendly screens and one Playwright mobile smoke workflow.
- Administrator login, bearer access token, rotating refresh token, logout, route guard, and API
  health checks.
- Role-protected API endpoints for `SUPER_ADMIN`, `ADMIN`, and `OPERATOR`.
- A production NestJS API and PostgreSQL service already shared with the owner portal.
- A production Docker, Nginx, Compose, and Caddy pattern in `ownerdashboard-posv2/deployment`.

The main web-release gaps are:

- Browser builds default to `http://localhost:3100/api/v1` instead of same-origin `/api/v1`.
- The sign-in screen permits an arbitrary API address in every browser build.
- Absolute asset URLs and the current Angular base path assume deployment at `/`.
- The current UI is optimized for a narrow/mobile shell and needs an efficient desktop workspace.
- Authentication survives only while the page remains open; refresh, reload, concurrent request,
  and multi-tab behavior need an explicit production policy.
- There is no production image, web-server configuration, security-header policy, or VPS service for
  this application.
- Automated coverage is limited to a mocked mobile happy path.

## Product And UX Direction

### Visual thesis

A restrained operations console that keeps the existing obsidian, champagne, and gold identity,
but uses desktop space for faster scanning and bulk administration rather than stretching the
mobile layout.

### Content plan

1. Persistent application navigation and signed-in administrator context.
2. Operational dashboard with status, renewals, grace periods, and recent activity.
3. Dense, searchable workspaces for clients, plans, and subscriptions.
4. Contextual detail and edit panels that preserve the user's list position and filters.

### Interaction thesis

- Change bottom navigation into a compact left rail at desktop widths while retaining bottom
  navigation on small screens.
- Use drawers or sheets for short create/edit tasks and full pages for workflows that need history
  or several decisions.
- Make status changes, loading, success, and validation feedback immediate and consistent; keep
  motion short and honor `prefers-reduced-motion`.

## Scope

### Included

- Browser production build of the existing Angular application.
- Desktop, tablet, and mobile layouts for all existing workflows.
- Secure production API configuration and administrator session behavior.
- Dedicated Docker/Nginx service and reverse-proxy routing.
- DNS/TLS and CORS changes required by the selected domain topology.
- Accessibility, browser automation, deployment verification, monitoring, and rollback guidance.
- Continued Android/Tauri support from the same source tree.

### Not included in the first web release

- Rewriting the application in another framework.
- Combining owner and administrator accounts or navigation.
- Giving owner-portal users access to subscription-administration endpoints.
- Payment-gateway billing, invoices, or automated collection unless separately specified.
- Changes to POS licensing rules or two-way owner-dashboard data editing.

## Implementation Plan

### Phase 1: Web Build And Runtime Configuration

- [x] Introduce an explicit runtime configuration contract for API base URL and deployment mode.
- [x] Use `http://localhost:3100/api/v1` only for local browser development.
- [x] Use same-origin `/api/v1` for the deployed web application.
- [x] Preserve the configurable server address only for Tauri/Android builds; remove or disable it
      in production web builds so credentials cannot be sent to an arbitrary server.
- [x] Make public asset references base-path safe.
- [x] Add separate production web and Tauri build configurations. The selected administrative
      subdomain deploys at `/`; the `/admin/` fallback is not selected.
- [x] Configure SPA fallback routing for direct navigation and refresh on every lazy route.
- [x] Add a visible build/version identifier to the account area.

**Exit criteria:** one source tree can produce a local browser build, a production web build, and the
existing Tauri build without manually editing source files.

### Phase 2: Browser Authentication And Security

- [x] Keep administrator and owner-portal authentication flows, routes, and roles separate.
- [x] Choose and document one browser session policy before launch:
  - [x] First release: keep tokens in memory and require sign-in after a full reload.
  - Recommended option: keep the access token in memory and place the rotating refresh token in a
    `Secure`, `HttpOnly`, `SameSite=Strict` cookie issued only for the web flow.
- [ ] If cookie refresh is implemented, add origin/CSRF checks and preserve body-token refresh for
      Tauri clients through an explicitly separate client mode.
- [x] Replace the fixed refresh timer with single-flight refresh handling so simultaneous expired
      requests do not rotate the same token more than once.
- [x] Ensure logout revokes the server session, cancels refresh work, and clears client state.
- [ ] Handle expired, revoked, malformed, and role-insufficient sessions with a clear sign-in or
      access-denied result.
- [x] Enforce API authorization server-side for every action; UI role checks should only improve
      usability and must not be treated as security controls.
- [x] Add a strict web Content Security Policy, clickjacking protection, MIME sniffing protection,
      referrer policy, and HSTS at the edge.
- [x] Disable Swagger in production unless `SWAGGER_ENABLED=true` is set explicitly.

**Exit criteria:** authentication behaves predictably on reload, expiry, concurrent calls, logout,
and multiple tabs, and no production control can redirect credentials to another API.

### Phase 3: Responsive Administrative Workspace

- [x] Add a desktop shell with a left navigation rail, top-level user/session controls, and a wide
      primary workspace; retain the existing mobile bottom navigation.
- [x] Set content widths per workflow instead of applying one global narrow maximum.
- [x] Provide desktop tables for high-density client, plan, and subscription data, with the current
      stacked rows retained on small screens.
- [ ] Keep filters and pagination visible while reviewing detail where screen size permits.
- [x] Add explicit read-only/disabled states for actions unavailable to the signed-in role.
- [x] Review destructive lifecycle actions such as cancel, archive, and suspend; require a clear
      confirmation that names the affected record and consequence.
- [x] Preserve filters, page, and scroll position after closing a detail or edit panel.
- [ ] Cover loading, empty, validation, offline, permission, and server-error states on every page.
- [ ] Complete keyboard navigation, visible focus, dialog focus trapping/restoration, labels,
      status announcements, contrast, and 200% zoom checks.

**Exit criteria:** the application is efficient at 1440 px, usable at 1024 px, and has no horizontal
page overflow at 390 px, with equivalent capabilities at each size.

### Phase 4: Deployment And Domain Routing

- [x] Add a multi-stage Dockerfile that builds Angular with Node 22 and serves the static output
      from unprivileged or hardened Nginx.
- [x] Add an SPA-safe Nginx configuration with `/healthz`, immutable caching for hashed assets, and
      no long-lived cache for `index.html` or runtime configuration.
- [x] Add a `subscription-web` service to the existing Compose stack, bound to an unused loopback
      port such as `127.0.0.1:3202`.
- [ ] Create an `A` record for `admin.vmjamdocuai.cloud` pointing to the same VPS as
      `vmjamdocuai.cloud`.
- [x] Add the Caddy site configuration for `admin.vmjamdocuai.cloud` and route both `/api/*` and the
      SPA. Certificate issuance remains part of the VPS rollout.
- [x] Replace or extend the single `DOMAIN` deployment variable with explicit `OWNER_DOMAIN` and
      `ADMIN_DOMAIN` values so Caddy and API origin configuration remain unambiguous.
- [x] Set `CORS_ORIGINS` to include both `https://vmjamdocuai.cloud` and
      `https://admin.vmjamdocuai.cloud`, even when normal browser requests are same-origin through
      the proxy.
- [x] Record the exact-host `/admin/` deployment as an unselected fallback; no path-prefix build is
      required for the chosen subdomain topology.
- [x] Keep PostgreSQL and the API private; expose only the reverse proxy on ports 80/443.
- [x] Add independent health checks, log labels, image tags, and restart policy for the new web
      service.
- [x] Document update and rollback commands that can replace the admin SPA without replacing the
      owner dashboard or API.

**Recommended host-proxy shape:**

```text
Internet
   |
   +-- vmjamdocuai.cloud -------+-- /api/* --> subsapi:3100
   |                            `-- /* ------> owner-web:80
   |
   `-- admin.vmjamdocuai.cloud -+-- /api/* --> subsapi:3100
                                `-- /* ------> subscription-web:8080
```

**Exit criteria:** both applications load over HTTPS, direct SPA routes refresh correctly, API calls
are same-origin, and either frontend can be rolled back independently.

### Phase 5: Verification

- [x] Add unit coverage for runtime configuration and session roles, plus browser coverage for
      refresh single-flight behavior and role presentation.
- [x] Add Playwright projects for desktop Chromium and a mobile viewport.
- [~] Cover login, logout, expiry/refresh, direct-route reload, client create/edit/archive, plan
  create/version/publish/archive, and subscription lifecycle operations.
- [~] Verify `SUPER_ADMIN`, `ADMIN`, and `OPERATOR` behavior, including server rejection of actions
  outside a role. Current browser coverage includes `SUPER_ADMIN`, `OPERATOR`, and `VIEWER` UI
  behavior; the API remains the authorization boundary.
- [~] Test keyboard-only operation, focus restoration, reduced motion, 200% zoom, and no horizontal
  overflow.
- [ ] Run tests against the production container and reverse-proxy path, not only `ng serve`.
- [~] Run `npm audit`, production Angular build budgets, API tests, and a basic dependency/image
  vulnerability scan before release. Dependency audit and builds pass; the image scan remains.
- [ ] Perform a staging smoke test using a non-production administrator and disposable records.

**Exit criteria:** the production image and routing topology pass the same critical workflows as the
local build on desktop and mobile.

### Local Verification Record — 2026-09-29

- Production web build passed at 393.44 kB initial bundle size.
- Tauri production frontend build passed.
- Four Angular/Vitest unit tests passed.
- Ten Playwright tests passed across desktop and mobile Chromium projects, covering the responsive
  workflow, role presentation, logout, the memory-only reload policy, and single-flight refresh.
- `npm audit` reported zero vulnerabilities.
- The API production build and all 54 API tests passed.
- The owner-dashboard production build passed with its two pre-existing budget warnings.
- `docker compose --env-file .env.example config --quiet` passed.
- The local Docker image build could not run because the Docker Desktop engine was not running; the
  Dockerfile and Nginx configuration still require a container smoke test before VPS release.

### Phase 6: Release And Operations

- [ ] Back up PostgreSQL and verify a recent restore drill before the first public deployment.
- [ ] Deploy the new frontend without changing existing owner-dashboard routing.
- [ ] Create the initial production administrator through the existing server-side command; do not
      ship default credentials.
- [ ] Verify HTTPS, headers, health endpoints, authentication throttling, audit entries, and all
      role boundaries from the public URL.
- [ ] Monitor API error rate, login failures, refresh failures, frontend health, certificate expiry,
      and container restarts.
- [ ] Keep the previous image tag and proxy configuration available for rollback.
- [ ] Review administrator accounts and sessions after launch and on a regular schedule.

## Acceptance Criteria

The web version is ready when all of the following are true:

- The same Angular codebase builds for web and Tauri without source edits.
- Production web requests use HTTPS and same-origin `/api/v1`; no localhost URL appears in the
  delivered production bundle or runtime configuration.
- Owner accounts cannot authenticate to or call administrator endpoints.
- Every existing client, plan, and subscription workflow works at desktop and mobile widths.
- Direct links and browser refresh work on every route.
- Session expiry and token rotation never create duplicate refresh attempts or leave the UI in a
  partially authenticated state.
- The owner dashboard and subscription web app have independent health checks and rollback paths.
- Automated browser tests cover the critical workflows and all three administrator roles.
- Deployment, DNS, TLS, backup, verification, and rollback steps are documented and rehearsed in
  staging.

## Recommended Delivery Order

1. Confirm `admin.vmjamdocuai.cloud` as the production subscription-app hostname; use the
   exact-host `/admin/` layout only if a separate DNS name is not desired.
2. Complete runtime configuration and production build separation.
3. Complete session/security hardening.
4. Implement the responsive desktop workspace.
5. Add the production container and proxy route.
6. Expand automated coverage and validate the production topology in staging.
7. Back up, deploy, smoke-test, monitor, and retain a tested rollback.
