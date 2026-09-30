# Owner Web Dashboard Readiness and Web Analytics Plan

**Status:** In progress - the Phase 3 analytics MVP and operational-status hardening are implemented; secure Remember login and Stage 4 rollout remain pending
**Prepared:** 2026-09-30  
**Delivery order:** Owner web dashboard first, then analytics visibility in the subscription app  
**Applies to:** `ownerdashboard-posv2`, `subsapi`, and `subscriptionapp-posv2`

## 1. Corrected scope

This plan has two ordered goals:

1. Make the deployed owner dashboard at `vmjamdocuai.cloud` production-ready: indexing policy, security, authentication, privacy, accessibility, performance, reliability, monitoring, and deployment checks.
2. Collect **web usage and health analytics from the owner dashboard** and display those analytics in the subscription app.

In this plan, web analytics means:

- dashboard visits, sessions, and active users;
- pages/routes and features used;
- frontend errors and failed API calls;
- Core Web Vitals and page performance;
- application version, browser/device class, and deployment environment;
- service availability, request volume, latency, and status-code health.

It does **not** mean copying the owner's sales, inventory, payment, customer, or transaction reports into the subscription app. Those remain business analytics inside the owner dashboard.

## 2. Decisions recommended now

- Keep the owner dashboard as a private authenticated application and explicitly prevent search indexing.
- If public SEO is wanted, build a separate public marketing surface later, for example `www.vmjamdocuai.cloud`, while the private dashboard remains on its existing host or moves to `app.vmjamdocuai.cloud`.
- Use first-party analytics collected through `subsapi`; do not add Google Analytics or another third-party browser tracker in the first release.
- Collect authenticated, privacy-minimized operational data only. Do not collect session replays, screenshots, keystrokes, form values, passwords, tokens, POS records, or URL query values.
- Derive client, store, user, and role context on the server from the authenticated session. Do not trust tenant identifiers supplied in event payloads.
- Make the analytics viewer in the subscription app read-only and role-protected.

## 3. Current baseline found in the repositories

### Implementation progress (2026-09-29)

The first recommended security steps are deployed, and the next operations batch is implemented locally:

- owner browser access tokens are memory-only and refresh credentials use dedicated cookie endpoints;
- refresh cookies are host-only, `HttpOnly`, `SameSite=Strict`, and `Secure` in production;
- cookie refresh/logout requires an exact allowlisted origin and a custom CSRF header;
- refresh tokens now rotate atomically within a tracked family; concurrent browser refreshes receive a narrow retry grace, while reuse outside that window revokes the active family and creates an audit event;
- legacy body-token endpoints remain available for non-browser compatibility;
- the owner dashboard now restores its session before deciding whether to show login;
- private-app robots metadata, `X-Robots-Tag`, CSP, framing, content-type, referrer, permissions, COOP, and CORP headers are configured;
- SPA entry and hashed/static asset cache rules have been separated;
- production source maps are explicitly disabled;
- security CI now builds and browser-tests the app, scans dependencies and secrets, and scans the runtime image for fixed high/critical vulnerabilities;
- API responses and structured access logs now carry end-to-end request IDs without logging query values, credentials, cookies, tokens, or request bodies;
- authentication, refresh replay, synchronization rejection, and unexpected server failures now emit safe structured events;
- readiness and liveness responses expose service, version, release, uptime, and database status;
- deployed web/API release identifiers are visible in the owner dashboard support area;
- production smoke verification now checks web metadata, API readiness, and request-ID propagation;
- an external GitHub Actions monitor checks availability, database-backed API health, security headers, response latency, releases, and TLS expiry every 30 minutes;
- WCAG 2.2 AA automated scans now cover sign-in and the authenticated overview on desktop and mobile, with keyboard-order regression coverage and corrected muted-text contrast;
- production bundle verification now enforces explicit JavaScript, CSS, and total-output ceilings;
- the first analytics ingestion foundation uses authenticated server-derived tenant/user/session/role context, validated store access, strict event allowlists, deduplication, retention, and a tenant enable switch;
- analytics storage excludes usernames, email addresses, IP addresses, raw user agents, query strings, form values, free-form error messages, tokens, and POS business data;
- the authenticated owner dashboard now batches normalized report page views, allowlisted feature usage, sanitized global frontend errors, and LCP/INP/CLS samples without blocking normal application work;
- a `SUPER_ADMIN`-only, audited aggregate overview endpoint returns summary counts, daily usage, top routes/features, Web Vital p75 values with sample warnings, and sanitized error groups without exposing raw events or user identities;
- the subscription app now has a lazy-loaded, `SUPER_ADMIN`-only Website Analytics workspace with client/store/date filters, a dominant usage trend, accessible tabular equivalents, adoption rankings, Web Vital sample warnings, sanitized issue groups, and responsive desktop/mobile layouts;
- the owner dashboard now emits allowlisted API-failure signals with safe operation templates, status classes, and error codes while excluding analytics-ingestion failures from the feedback loop;
- global API-enforced switches now control owner web collection, real-user monitoring, and subscription-app analytics visibility in addition to the existing tenant collection switch;
- the subscription analytics workspace now shows current API/database health, API and observed web releases, uptime, environment, collection coverage, retention, first/last issue sightings, partial/disabled collection notices, and privacy suppression below a three-user/session threshold;
- builds, 92 API tests, 6 subscription-app unit tests, 8 subscription-app browser tests, and 62 owner-dashboard browser tests pass.

Still pending are CSP nonce/Trusted Types tightening, MFA, bundle splitting, off-server backup
replication, and broader manual accessibility review. Backup and restore drills now pass; recurring
backup scheduling and off-server replication were intentionally deferred. Historical availability and
server latency reporting, controlled production data reconciliation, trend-to-detail interaction,
secure subscription-app Remember login, and broader role access remain Phase 3/4 work.

### Owner dashboard

- Angular production output hashing is enabled.
- Nginx exposes `/healthz`, enables gzip, and serves the SPA fallback.
- Nginx now has the first CSP/no-index/browser-header baseline; nonce/Trusted Types tightening remains pending.
- `index.html` now includes an explicit private-app indexing policy and description.
- Browser access tokens are now memory-only and refresh credentials are delivered through dedicated HttpOnly-cookie endpoints; legacy browser-storage values are removed during startup.
- Static asset caching now distinguishes hashed build assets, non-hashed files, and the SPA entry document.
- The application already has Playwright coverage and Angular bundle budgets, but the large dashboard has known bundle/component-style pressure.
- Existing code called "analytics" is sales/business reporting, not website usage telemetry.

### Subscription app and API

- The subscription app can host a new read-only Website Analytics area.
- `subsapi` already owns clients, users, roles, stores, subscriptions, sessions, and audit logging, making it the appropriate first-party collector and reporting boundary.
- No web usage event pipeline or analytics tables currently exist.

## 4. Phase 1 - owner web dashboard production readiness

Phase 1 should be completed before collecting web analytics, so telemetry is added to a secure and stable application.

### 4.1 Private dashboard SEO and search indexing

An authenticated dashboard does not need public search ranking. Its SEO work is to prevent accidental indexing and make the browser experience correct.

Required plan:

- Add `noindex,nofollow,noarchive` using both a robots meta tag and the HTTP `X-Robots-Tag` header.
- Apply the HTTP header to the login page, SPA fallback, normal routes, and error responses.
- Keep authentication as the protection. `robots.txt` and `noindex` are not security controls.
- Do not publish a sitemap or structured data for authenticated routes.
- Keep sensitive client/store information out of page titles, metadata, route names, and query strings.
- Use an accurate application title and short description, plus complete favicon/icon assets.
- Verify the production canonical hostname and redirect alternate HTTP/host variants to it.

Optional public SEO later:

- Create a separate public marketing site with product pages, support/contact details, privacy notice, terms, metadata, canonical URLs, social preview images, sitemap, and structured data.
- Keep marketing pages and authenticated dashboard routes clearly separated. Never prerender tenant data.

### 4.2 Authentication and session security

This is the highest-priority code work for the owner dashboard when implementation begins.

- Stop storing access and refresh tokens in `localStorage`.
- Keep the short-lived access token in memory.
- Store the rotating refresh credential in a host-only cookie with `Secure`, `HttpOnly`, `SameSite=Strict`, and `Path=/`.
- Prefer a `__Host-` cookie name and do not set a `Domain` attribute.
- Add browser-specific login, refresh, and logout endpoints while retaining any required desktop-compatible flow separately.
- Rotate refresh credentials on every use and detect replay of an already-rotated token.
- Revoke the server session and expire the cookie on logout.
- Validate exact allowed origins and add CSRF protection for cookie-authenticated state-changing requests.
- Rate-limit login, refresh, password-reset, and other abuse-sensitive routes.
- Use generic login failure messages and security logging that does not expose passwords or tokens.
- Add session/device visibility and revoke-other-sessions as a later account-security enhancement.
- Plan MFA for privileged owner and subscription-administrator roles.

### 4.3 Transport, proxy, and API boundaries

- Require HTTPS and redirect HTTP at the public edge.
- Verify certificate renewal and alert before expiry.
- Enable HSTS only after all included hostnames are confirmed HTTPS-ready.
- Prefer same-origin `/api` proxying where deployment permits it. Otherwise allow only exact production origins through CORS.
- Never combine credentialed requests with wildcard CORS origins.
- Disable production Swagger/debug endpoints or restrict them to an administrative network.
- Configure request-body limits, upstream timeouts, connection limits, and safe proxy headers.
- Do not reveal Nginx, framework, database, or internal host details in error responses.

### 4.4 Browser security headers

Add and test a shared production header baseline:

- Content Security Policy with `default-src 'self'`, restrictive `script-src`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, and exact `connect-src` targets.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: strict-origin-when-cross-origin` or a stricter compatible policy.
- A restrictive `Permissions-Policy` disabling camera, microphone, geolocation, payment, USB, and other unused capabilities.
- `Cross-Origin-Opener-Policy: same-origin` and a compatible `Cross-Origin-Resource-Policy` after testing downloads and integrations.
- The explicit `X-Robots-Tag` private-app policy.

Roll CSP out in report-only mode first, resolve violations, and then enforce it. Avoid third-party scripts so `script-src 'self'` remains practical. Evaluate Angular nonce/automatic CSP and Trusted Types after the baseline works.

### 4.5 Secrets and frontend data exposure

- Keep API secrets, database credentials, signing keys, and refresh credentials out of frontend bundles.
- Treat Angular environment values as public configuration, not secrets.
- Disable production source maps unless access to them is separately controlled.
- Sanitize errors shown to users; keep detailed diagnostics in protected server monitoring.
- Check built JavaScript and container layers for development URLs, tokens, credentials, and source paths before release.
- Establish signing-key rotation and recovery procedures.

### 4.6 Dependency, build, and container security

- Run dependency, secret, static-code, and container-image scanning in CI.
- Produce an SBOM for production images.
- Pin or intentionally update base images and application dependencies.
- Run the web container as a non-root user where feasible.
- Copy only production build output into the runtime image.
- Add automated dependency update pull requests with required build and end-to-end checks.
- Define which vulnerability severities block deployment and how exceptions expire.

### 4.7 Performance and caching

- Serve `index.html` with `no-store` or a short revalidation policy so deployments are picked up quickly.
- Give only content-hashed JavaScript/CSS/assets a long immutable cache lifetime.
- Do not mark changing non-hashed assets immutable.
- Preserve gzip and evaluate Brotli at the edge.
- Split the oversized dashboard into lazy-loaded report areas and smaller components.
- Remove unused dependencies and resolve bundle/style budget warnings instead of only increasing the limits.
- Paginate or virtualize large tables and cancel obsolete API requests when filters change.
- Establish a baseline for LCP, INP, and CLS on login, dashboard overview, and the heaviest report route.

Proposed initial user-experience targets at the 75th percentile:

- LCP no more than 2.5 seconds;
- INP no more than 200 milliseconds;
- CLS no more than 0.1.

Targets should be checked separately for desktop and mobile rather than hidden in a single average.

### 4.8 Accessibility and browser quality

- Target WCAG 2.2 AA.
- Verify keyboard navigation, visible focus, skip navigation, semantic headings, form labels, error association, status announcements, and 200% zoom.
- Do not use color alone for sales, inventory, status, or trend meaning.
- Give every chart a text summary and accessible table alternative.
- Test loading, empty, stale, offline, unauthorized, and server-error states.
- Test supported Chrome, Edge, Safari, Firefox, and representative mobile layouts.
- Include reduced-motion and high-contrast behavior.

### 4.9 Reliability and operations

- Monitor public availability, API health, database health, authentication failures, refresh-token replay, snapshot synchronization, and certificate expiry.
- Define availability and latency service objectives only after collecting a representative baseline.
- Add correlation/request IDs from the browser-facing API through server logs.
- Redact tokens, cookies, credentials, POS payloads, and personal data from logs.
- Display a release/build version in a support-accessible place.
- Document deployment, smoke testing, rollback, database migration rollback, backup restore, and incident response.
- Perform a restore drill rather than verifying backup creation only.

### 4.10 Privacy and governance

- Publish appropriate privacy and cookie notices for the jurisdictions in which the system operates.
- Determine whether consent is required for each analytics category before enabling it.
- Record data purpose, fields, access roles, retention, deletion, and export rules.
- Provide a tenant-level analytics disable switch if required by policy or contract.
- Do not use browser fingerprinting or advertising identifiers.

## 5. Phase 1 acceptance gate

Do not begin broad analytics collection until:

- production HTTPS, hostname redirects, and certificate renewal are verified;
- browser tokens no longer persist in `localStorage`;
- CSP and the agreed security headers pass staging tests;
- private routes return `noindex` directives;
- secret, dependency, and container scans meet the agreed release policy;
- core keyboard/accessibility flows and production smoke tests pass;
- logging, monitoring, backup restore, and rollback procedures are usable.

## 6. Phase 2 - web analytics from the owner dashboard

### 6.1 Analytics categories

Keep these separate in collection and reporting:

| Category             | Examples                                                | Source                  |
| -------------------- | ------------------------------------------------------- | ----------------------- |
| Product usage        | Page views, sessions, active users, routes, feature use | Owner dashboard browser |
| Real-user monitoring | LCP, INP, CLS, navigation timing, frontend errors       | Owner dashboard browser |
| API operations       | Request count, status class, latency, auth failures     | `subsapi` server        |
| Availability         | Uptime, health checks, certificate state                | External monitor/edge   |

The subscription app may present them together, but the labels must make the source and meaning clear.

### 6.2 First-release metrics

Product usage:

- authenticated daily, weekly, and monthly active users;
- sessions and average engaged session duration;
- page views by normalized Angular route;
- top used report areas/features;
- new versus returning authenticated users;
- adoption by client and store where authorization permits;
- application version, device class, and browser family distribution.

Performance and reliability:

- p75 LCP, INP, and CLS by route and application version;
- frontend error count and affected-session rate;
- failed API request rate by safe endpoint template and status class;
- server request volume and p50/p95/p99 latency;
- dashboard uptime and current deployment health;
- snapshot sync age/failure as a separate operational indicator, not a page-view metric.

### 6.3 Metric definitions

- **Active user:** a distinct authenticated internal user observed in the selected period. The reporting layer should use a pseudonymous/internal identifier, not username or email.
- **Session:** activity grouped until 30 minutes of inactivity. Keep the threshold configurable and show it in metric documentation.
- **Page view:** a completed navigation to a normalized route template such as `/reports/sales`, never the full URL or query string.
- **Feature use:** an allowlisted meaningful action such as exporting an approved report or changing a report mode; not every click.
- **Affected-session rate:** sessions containing at least one frontend error divided by total sessions.
- **Core Web Vitals:** report the 75th percentile and sample count, segmented by route/device class when the sample is large enough.

## 7. Collection architecture

```text
Owner dashboard browser
  |  batched allowlisted events and Web Vitals
  v
subsapi /telemetry/web/events
  |  authenticate, derive tenant context, validate, rate-limit
  v
short-retention raw events -> daily/hourly aggregates
                                  |
Server/edge metrics --------------+
                                  v
subscription app /admin/web-analytics/*
```

### 7.1 Browser collection

- Create a small Angular telemetry service initialized after authentication.
- Track Angular route templates, not raw URLs.
- Batch events and send periodically; flush best-effort on page hide.
- Use a random session identifier with limited lifetime.
- Allow only versioned event names and bounded property values.
- Queue only briefly during transient network failure; cap memory and discard safely when unavailable.
- Analytics failure must never block login, navigation, reports, or synchronization.
- Respect the configured privacy/consent state before starting optional collection.

### 7.2 Event ingestion

Recommended endpoint:

- `POST /telemetry/web/events`

Rules:

- Start with authenticated post-login events only. Use server authentication logs for login successes/failures instead of an anonymous browser tracker.
- Accept small batches with strict item count and body-size limits.
- Reject unknown event names/properties and invalid metric ranges.
- Set `receivedAt` on the server and bound acceptable client clock differences.
- Derive `userId`, `clientId`, `storeId`, role, and environment from the authenticated context/deployment configuration.
- Rate-limit per session/user/IP without retaining unnecessary full IP addresses.
- Make ingestion idempotent using a client-generated event ID.
- Never log full rejected event bodies.
- Exclude ingestion requests themselves from usage analytics to prevent feedback loops.

### 7.3 Proposed event allowlist

- `session_started`
- `page_viewed`
- `feature_used`
- `web_vital_recorded`
- `frontend_error_occurred`
- `api_request_failed`
- `session_ended` as best-effort only

No generic arbitrary event API should be exposed to feature code in the first release.

### 7.4 Data model and retention

Use separate storage concerns:

1. A short-retention raw event table for validation, deduplication, and investigation.
2. Hourly/daily aggregate tables for subscription-app reporting.
3. Server operational metrics in the monitoring system, importing only safe aggregates into the admin view when necessary.

Suggested starting retention, subject to privacy approval:

- raw web events: 30 days;
- frontend error details: 14-30 days, with sensitive fields removed;
- hourly aggregates: 90 days;
- daily aggregates: 13 months;
- security/audit logs: a separately approved security retention policy.

Avoid storing full IP addresses, raw user-agent strings indefinitely, emails, usernames, report parameters, search terms, receipt/order identifiers, or API bodies.

## 8. Analytics reporting API for the subscription app

Recommended read-only endpoints:

- `GET /admin/web-analytics/overview?from&to&clientId&storeId`
- `GET /admin/web-analytics/usage?from&to&group=day|week`
- `GET /admin/web-analytics/routes?from&to&page&limit`
- `GET /admin/web-analytics/features?from&to&page&limit`
- `GET /admin/web-analytics/performance?from&to&route&deviceClass`
- `GET /admin/web-analytics/errors?from&to&appVersion&page&limit`
- `GET /admin/web-analytics/availability?from&to`

Every response should include:

- effective time range and timezone;
- filter scope and environment;
- data generation/freshness timestamp;
- metric definition/version and sample count;
- partial-data or insufficient-sample markers;
- paginated details rather than unbounded event lists.

Authorization proposal:

| Capability                        |      OPERATOR |                 ADMIN |                   SUPER_ADMIN |
| --------------------------------- | ------------: | --------------------: | ----------------------------: |
| Overall uptime and release health |          Read |                  Read |                          Read |
| Aggregated usage/performance      |      Optional |                  Read |                          Read |
| Filter by client/store            | No by default | Authorized scope only |                          Read |
| View sanitized error groups       |            No |                  Read |                          Read |
| View raw events                   |            No |                    No | Emergency-only backend access |
| Change retention/collection       |            No |                    No |      Controlled configuration |

Every cross-client analytics query must be role checked and audited. The UI must not be the authorization boundary.

## 9. Phase 3 - Website Analytics UI in the subscription app

### Visual thesis

A restrained operational workspace: one dominant usage-and-health trend, a compact status line, and exception-focused detail. Avoid a mosaic of equal-weight cards.

### Content plan

1. **Current health:** uptime, active deployment version, affected-session rate, and current incident state.
2. **Usage:** active users and sessions over time, with client/store/date filters.
3. **Adoption:** routes and meaningful features used.
4. **Experience:** Core Web Vitals distributions by route/device class.
5. **Issues:** grouped frontend errors and API failures with first/last seen, affected sessions, and version.

### Interaction thesis

- One shared date range and environment filter controls the page.
- Selecting a trend segment filters the detail table below it.
- Client/store filters are explicit and always visible when cross-tenant data is shown.
- Freshness, insufficient samples, collection disabled, and partial outages are visible states.
- Motion is limited to filter transitions and incident/status changes; it must respect reduced-motion preferences.

### UI safeguards

- Default to aggregates, not individual user timelines.
- Do not show usernames, emails, IP addresses, full URLs, payloads, or stack traces containing customer data.
- Require minimum group sizes before displaying client/store/browser breakdowns to reduce re-identification risk.
- Clearly separate browser-observed metrics from server and uptime metrics.
- Provide an accessible table equivalent for every chart.
- Keep exports disabled in the first release.

## 10. Remember login in the subscription app

The earlier Remember me request remains a separate subscription-app authentication task and should follow the same secure browser pattern:

- access token in memory;
- rotating refresh credential in a `Secure`, `HttpOnly`, host-only, `SameSite=Strict` cookie;
- session cookie when Remember me is off;
- persistent cookie with an approved lifetime, initially proposed as 30 days, when it is on;
- startup session restoration, CSRF/origin validation, replay detection, logout revocation, and rate limiting;
- no access or refresh tokens in `localStorage` or `sessionStorage`.

This can be implemented alongside Phase 3, after the owner dashboard security foundation is settled and the shared API session design is proven.

## 11. Testing plan

### Owner dashboard readiness

- Header tests for normal routes, SPA fallback, assets, health endpoint, and error responses.
- CSP report-only review followed by enforcement tests.
- Cross-origin, CSRF, refresh replay, logout, expiry, and multi-tab session tests.
- Checks that production bundles contain no source maps, secrets, localhost URLs, or debug endpoints.
- Keyboard, screen-reader, zoom, responsive, and supported-browser tests.
- Lighthouse/lab checks plus real-user metrics after privacy approval.
- Container, dependency, secret, and static-analysis scans.
- Backup restore and deployment rollback drills.

### Analytics correctness and safety

- Event schema, batch-size, deduplication, invalid range, and rate-limit tests.
- Proof that tenant identifiers are server-derived and cannot be changed in the payload.
- Role tests for every reporting endpoint and filter combination.
- Verification that routes are normalized and query strings/payloads are never stored.
- Known synthetic sessions to reconcile page, session, and active-user calculations.
- Web Vitals percentile and sample-size calculation tests.
- Retention deletion and tenant-disable tests.
- Analytics-outage tests proving the owner dashboard still works normally.

## 12. Delivery sequence

### Stage 0 - approve definitions

- Confirm that "web analytics" means usage, performance, errors, and availability as defined here.
- Approve privacy purpose, consent requirements, role matrix, retention, session definition, and whether client/store breakdowns are needed.

### Stage 1 - owner dashboard security and release baseline

- Replace browser token persistence.
- Add CSRF/origin/session protections.
- Add no-index and browser security headers.
- Correct caching, source-map, dependency/container, and production configuration.
- Establish accessibility, performance, monitoring, backup, and rollback baselines.

### Stage 2 - first-party collection

- Add the analytics schema/migration and retention job.
- Add strict ingestion, server metrics, aggregation jobs, feature flags, and tests.
- Instrument authenticated routes, selected meaningful features, errors, and Core Web Vitals.
- Validate the data in staging without enabling the subscription UI broadly.

### Stage 3 - subscription-app visibility

- Add read-only reporting endpoints.
- Add the Website Analytics route and role-aware UI.
- Reconcile displayed counts against controlled test sessions.
- Enable for internal `SUPER_ADMIN` users first.

### Stage 4 - hardening and controlled rollout

- Review privacy, security, performance overhead, sample quality, and false error noise.
- Expand access only after authorization and audit-log review.
- Set service objectives from the measured baseline.

## 13. Feature flags

- `OWNER_WEB_ANALYTICS_ENABLED`
- `OWNER_REAL_USER_MONITORING_ENABLED`
- `ADMIN_WEB_ANALYTICS_VIEW_ENABLED`
- `WEB_REMEMBER_LOGIN_ENABLED`

Flags must be enforced by the API where applicable, not only hidden in Angular.

## 14. Definition of done

The complete initiative is done when:

- the owner dashboard has the approved HTTPS, session, CSRF, header, indexing, caching, scanning, accessibility, performance, monitoring, backup, and rollback baseline;
- access and refresh tokens are no longer persisted in browser storage;
- analytics contains only approved web usage/health data and never business transaction content or sensitive browser input;
- tenant context is derived server-side and cross-tenant access is role checked and audited;
- collection failure cannot affect normal dashboard operation;
- metric definitions, sample sizes, timezones, retention, and freshness are visible and tested;
- the subscription app shows accurate read-only owner-dashboard usage, performance, errors, and availability analytics;
- privacy/consent requirements and deletion/disable procedures are documented and verified;
- Remember me uses secure cookie-based refresh semantics when that separate task is enabled.

## 16. Remember-login implementation status (2026-09-30)

The separate browser remember-login batch is implemented:

- browser login, refresh, and logout use host-only `HttpOnly`, `Secure`, `SameSite=Strict` cookies;
- access tokens remain in memory and refresh credentials are never exposed to Angular;
- leaving **Remember me** off uses a browser-session cookie, while enabling it uses the configured
  persistent duration (30 days by default);
- refresh sessions rotate atomically, preserve session type, detect replay, and tolerate a short
  concurrent-tab rotation window;
- cookie-authenticated requests require the exact admin origin and the `X-POSV2-CSRF` header;
- browser startup restores the session before protected routing, while Tauri keeps its existing
  token-body flow; and
- `WEB_REMEMBER_LOGIN_ENABLED` is enforced by the API, with duration and origin controls supplied
  through deployment environment variables.

## 15. Reference standards for implementation review

- Google Search Central: robots meta tags and `X-Robots-Tag`
- OWASP HTTP Headers Cheat Sheet
- OWASP Session Management and CSRF Prevention Cheat Sheets
- OWASP Application Security Verification Standard, Level 2 target
- Angular security guidance for CSP and Trusted Types
- W3C WCAG 2.2 AA
- web.dev Core Web Vitals guidance
