# POSV2 Subscription API

NestJS and PostgreSQL API for managing POSV2 clients, plan versions, subscriptions, devices, and licenses.

## Stack

- NestJS 11
- Prisma ORM 7.9 with the PostgreSQL driver adapter
- PostgreSQL 16 or newer
- JWT access tokens and rotating opaque refresh tokens
- Argon2id password hashing
- Swagger/OpenAPI at `/docs`

Prisma is isolated in `src/infrastructure`. Domain and application code do not import generated database models.

## Requirements

- Node.js 22
- PostgreSQL running locally or on a reachable server
- An empty PostgreSQL database named `posv2_subscription`, or another name configured in `DATABASE_URL`

## Configure

Copy `.env.example` to `.env` and replace every placeholder:

```powershell
Copy-Item .env.example .env
```

Generate strong JWT secrets. Do not reuse the access and refresh secrets.

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

## Database

Generate the typed client after schema changes:

```powershell
npm run db:generate
```

Apply migrations during local development:

```powershell
npm run db:migrate
```

Apply committed migrations in a deployed environment:

```powershell
npm run db:deploy
```

Schema synchronization is not used. Database changes must be committed as migrations.

## First Administrator

After migrating the database, create the first administrator:

```powershell
npm run admin:create -- adminvmjam "replace-with-a-strong-password" "System Administrator"
```

The command refuses passwords shorter than 12 characters and never creates a default account automatically.

## Run

```powershell
npm run start:dev
```

- API: `http://localhost:3100/api/v1`
- Swagger: `http://localhost:3100/docs`
- Health: `http://localhost:3100/api/v1/health`

## Implemented Endpoints

```text
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
GET    /api/v1/auth/me

GET    /api/v1/clients
POST   /api/v1/clients
GET    /api/v1/clients/:id
PATCH  /api/v1/clients/:id
POST   /api/v1/clients/:id/archive

GET    /api/v1/plans
POST   /api/v1/plans
GET    /api/v1/plans/:id
POST   /api/v1/plans/:id/versions
POST   /api/v1/plans/:id/versions/:versionId/publish
POST   /api/v1/plans/:id/archive

GET    /api/v1/subscriptions
POST   /api/v1/subscriptions
GET    /api/v1/subscriptions/:id
GET    /api/v1/subscriptions/:id/events
POST   /api/v1/subscriptions/:id/activate
POST   /api/v1/subscriptions/:id/suspend
POST   /api/v1/subscriptions/:id/reactivate
POST   /api/v1/subscriptions/:id/cancel
POST   /api/v1/subscriptions/:id/renew
```

All client, plan, and subscription endpoints require a bearer access token. Mutation permissions are also enforced by API roles.

## Verification

```powershell
npm run build
npm test
npm run lint
```

Database E2E tests will use a separate `posv2_subscription_test` connection once its credentials are configured. Never point test commands at development or production data.

## Architecture

```text
src/
|-- domain/          Framework-independent contracts and rules
|-- application/     Use-case services
|-- infrastructure/  Prisma, PostgreSQL, hashing, and JWT adapters
|-- presentation/    HTTP controllers, DTOs, guards, and filters
`-- modules/         Nest dependency wiring
```

Dependency direction is `presentation -> application -> domain`; infrastructure implements domain ports and is bound only in Nest modules.
