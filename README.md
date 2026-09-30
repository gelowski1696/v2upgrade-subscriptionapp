# POSV2 Subscriptions

Android-first subscription administration for POSV2. The app is built with Angular 21, Tailwind CSS, Tauri 2, and the local Inter font. It manages clients, versioned plans, and subscription lifecycles through `subsapi`.

## Included workflows

- Secure administrator login with automatic access-token refresh and optional browser remember-login
- Dashboard for active clients, plans, subscriptions, grace periods, and recent activity
- Client search, filtering, pagination, creation, and editing
- Plan creation, immutable versions, publishing, and archiving
- Subscription creation, activation, suspension, reactivation, renewal, and cancellation
- Plan defaults and per-subscription control for all POS and owner-dashboard Feature Mods
- Subscription finance analytics for collected payments, revenue by plan, expenses, and net income
- Payment recording and an auditable expense ledger for operating costs
- API health indicator, loading states, empty states, validation feedback, and toast notifications

## Local development

Install dependencies and start the Angular browser build:

```powershell
npm install
npm start
```

The browser uses `http://localhost:3100/api/v1` by default. Start `subsapi` on port `3100`, then open `http://localhost:4200`.

The API address can also be changed from **Server settings** on the sign-in screen.

## Feature Mods

Configure Feature Mods in two places:

- **Plans** sets the defaults copied into new subscriptions.
- **Subscriptions > subscription details** changes the switches for one existing client.

Only `SUPER_ADMIN` and `ADMIN` accounts can save subscription Feature Mods. The Windows POS applies
changes during its next license validation (normally the next application start). Owner-dashboard
report permissions read the subscription switches immediately. Subscriptions created before this
feature continue using their synchronized desktop switches until an administrator saves their
Feature Mods, which avoids unexpectedly disabling existing installations.

The **Owner web dashboard** switch is managed separately in each subscription. Turning it off blocks
desktop synchronization, desktop web-user management, new portal sessions, and existing portal API
requests. Plans can set its default for new subscriptions. Existing subscriptions default to enabled
until an administrator explicitly disables them.

## Subscription finance

The **Finance** workspace reports actual recorded collections rather than projected subscription
value. Operators can record payments. `SUPER_ADMIN` and `ADMIN` accounts can add or remove
expenses and void incorrect payments with a required reason. Voided payments remain in the audit
history and no longer count toward revenue. Period totals use UTC dates and currently report in PHP.

## Android setup

Required tools:

- Rust with the Android targets installed by `npm run android:init`
- Android SDK, platform tools, build tools, and NDK 27
- Java 17 or newer
- `ANDROID_HOME` pointing to the Android SDK

Initialize the generated Android project once:

```powershell
npm run android:init
```

For hot reload on an emulator or connected device:

```powershell
npm run android:dev
```

Tauri's hot-reload command requires Windows Developer Mode because it creates native-library symlinks.

## Build APKs

Create a signed debug APK for development and device testing:

```powershell
npm run android:build:debug
```

Output:

```text
src-tauri/gen/android/app/build/outputs/apk/arm64/debug/app-arm64-debug.apk
```

Create an optimized release APK:

```powershell
npm run android:build
```

The release APK is unsigned until a production Android signing key is configured. The build helper handles Windows machines where Developer Mode is disabled by copying the compiled library into the generated Android project before Gradle packages it.

## API addresses

- Browser: `http://localhost:3100/api/v1`
- Android emulator: `http://10.0.2.2:3100/api/v1`
- Physical Android device: use the development computer's LAN address, such as `http://192.168.1.20:3100/api/v1`
- Production: use an HTTPS endpoint

For physical-device testing, bind `subsapi` to the local network and allow the API port through Windows Firewall. Debug APKs allow local HTTP traffic; release builds require HTTPS by default.

## Verification

```powershell
npm run build
npm test -- --watch=false
npm audit
```

## Web deployment plan

The production browser adaptation, security, responsive workspace, shared-domain options, and VPS
rollout are tracked in [`docs/SUBSCRIPTION_WEB_APP_PLAN.md`](docs/SUBSCRIPTION_WEB_APP_PLAN.md).

## Production web build

The optimized browser build uses same-origin `/api/v1` on non-local hostnames. The server-address
control is available only on localhost and in Tauri builds.

```powershell
npm run build
docker build -t posv2-subscriptions-web .
docker run --rm -p 8080:8080 posv2-subscriptions-web
```

Open `http://localhost:8080` and route `/api/*` to `subsapi` when testing the container through a
reverse proxy. The production stack serves the application at `https://admin.vmjamdocuai.cloud`;
see `ownerdashboard-posv2/deployment` for Compose and proxy configuration.

Administrator access tokens are held only in memory and are never persisted in browser storage.
The browser restores access through a rotating, host-only `HttpOnly`, `Secure`, `SameSite=Strict`
refresh cookie. Leaving **Remember me** off creates a browser-session cookie; enabling it keeps the
browser signed in for up to 30 days. Tauri builds retain the existing in-memory token flow.
