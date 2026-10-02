# Client Groups, Payment Classification, and Renewal Integrity Plan

## 1. Objective

Extend the subscription administration app and API so administrators can:

1. Organize clients into manageable groups.
2. Record payments for initial subscriptions, renewals, modifications, and other client charges.
3. Renew a subscription without changing its original subscription start date.

This plan covers the Angular subscription app, `subsapi`, the Prisma schema, migration, tests, and production rollout.

Implementation status: the application, API, migration, audit command, and automated regression tests are implemented locally. Production migration and deployment are still pending.

## 2. Current behavior and confirmed renewal defect

### Client records

Clients currently have identity and contact fields, status, subscriptions, devices, stores, and portal users. There is no client-group model or group filter.

### Payments

The existing finance module already records and voids payments, but:

- every payment must belong to a subscription;
- there is no payment purpose or category;
- a modification or other client payment cannot be recorded cleanly unless a subscription is selected;
- reports cannot separate initial, renewal, modification, and other revenue.

### Renewal

The current renewal service calculates a renewal start date and passes it to the repository as the subscription's new `startsAt` value. The repository then overwrites the original start date. The Renew button also performs this immediately, without first showing the dates that will change.

Example of the defect:

- Original subscription start: October 2
- Current expiry: November 2
- User presses Renew
- Current result: `startsAt` becomes November 2
- Required result: `startsAt` remains October 2, while the new renewal period is November 2 to December 2

## 3. Product decisions

### 3.1 Client grouping

Use one optional group per client in the first release.

Examples include reseller, territory, corporate account, industry, or account owner. A client that is not assigned to a group appears under `Ungrouped`.

This first version will not include nested groups or multiple tags per client. Those features can be added later without changing the basic client-group API.

### 3.2 Payment meaning

A payment represents money actually received. Creating or renewing a subscription must not automatically mark it paid.

Payment purposes:

- `INITIAL` — onboarding, deposit, or first subscription payment.
- `RENEWAL` — payment for an extension of an existing subscription.
- `MODIFICATION` — payment for a requested customization or feature change.
- `OTHER` — another client payment that does not fit the categories above.

Every payment belongs to a client. A subscription link is optional in the database, but required by validation for renewal payments. The UI should allow an initial payment to be linked to a subscription when one already exists.

This release records received payments only. Invoices, amounts due, partial balances, tax documents, and accounts receivable are outside this scope and should be handled as a later finance project.

### 3.3 Subscription date rules

- `startsAt` is the original subscription activation/start date and is immutable after creation.
- `expiresAt` is the end of the currently purchased coverage.
- `renewsAt` follows the current expiry used for renewal reminders.
- Every renewal gets its own history record containing the period start and period end.
- Renewing an active, unexpired subscription extends from its current expiry.
- Renewing an expired subscription defaults to a new period beginning today. The UI must clearly show the coverage gap before confirmation.
- Backdating an expired renewal is allowed only for `SUPER_ADMIN` or `ADMIN`, requires a reason, and must be an explicit choice.
- A cancelled subscription remains non-renewable under the current rule.

## 4. Data model changes

### 4.1 Client groups

Add a `ClientGroup` model:

| Field         | Type                  | Rule                                       |
| ------------- | --------------------- | ------------------------------------------ |
| `id`          | UUID                  | Primary key                                |
| `code`        | String                | Unique, stable code                        |
| `name`        | String                | Required display name                      |
| `description` | String?               | Optional operational note                  |
| `status`      | `ACTIVE` / `ARCHIVED` | Archived groups cannot receive new clients |
| `createdBy`   | UUID                  | Audit owner                                |
| `createdAt`   | DateTime              | Creation timestamp                         |
| `updatedAt`   | DateTime              | Last update timestamp                      |

Add nullable `groupId` and a `group` relation to `Client` with `onDelete: SetNull`. Index `groupId` together with client status for list filtering.

Prefer archiving a group over deleting it. Hard deletion should only be permitted when the group has no clients and no historical report dependency.

### 4.2 Renewal history

Add a `SubscriptionRenewal` model:

| Field               | Type      | Rule                                       |
| ------------------- | --------- | ------------------------------------------ |
| `id`                | UUID      | Primary key                                |
| `subscriptionId`    | UUID      | Required subscription relation             |
| `previousExpiresAt` | DateTime? | Expiry before renewal                      |
| `periodStartsAt`    | DateTime  | Start of the new coverage period           |
| `periodEndsAt`      | DateTime  | End of the new coverage period             |
| `amount`            | Decimal   | Price captured at renewal time             |
| `currency`          | String    | Currency captured at renewal time          |
| `billingInterval`   | Enum      | Interval captured at renewal time          |
| `reason`            | String?   | Required for backdated or overridden dates |
| `createdBy`         | UUID      | Actor                                      |
| `createdAt`         | DateTime  | Renewal timestamp                          |

The renewal transaction must atomically:

1. Lock or re-check the current subscription.
2. Insert the renewal history row.
3. Update `expiresAt`, `renewsAt`, and status as required.
4. Leave `startsAt` unchanged.
5. Write the existing subscription event and audit log.

### 4.3 Payment records

Add:

- `purpose`: `INITIAL`, `RENEWAL`, `MODIFICATION`, or `OTHER`.
- `clientId`: required relation to `Client`.
- `subscriptionId`: change from required to optional.
- `renewalId`: optional relation to `SubscriptionRenewal` for a payment entered from a renewal.
- `description`: optional generally, required by service validation for `MODIFICATION` and `OTHER`.

Retain the current posted/voided lifecycle. A correction must void the incorrect payment and create a new record; posted payment history must not be silently edited.

Validation rules:

- amount must be greater than zero;
- client must be active or explicitly allowed by an administrator;
- selected subscription must belong to the selected client;
- `RENEWAL` requires a subscription;
- a supplied renewal must belong to the supplied subscription;
- `MODIFICATION` and `OTHER` require a meaningful description;
- currency must match the linked subscription when one is selected;
- voiding continues to require a reason and retains the original record.

## 5. API changes

### 5.1 Client groups

Add endpoints:

- `GET /client-groups` — paged search with status and usage count.
- `POST /client-groups` — create a group.
- `PATCH /client-groups/:id` — rename, edit description, or archive.
- `PATCH /clients/:id/group` — assign or clear a group.
- `POST /clients/bulk-group` — assign selected clients to one group or clear their group.

Extend `GET /clients` with `groupId`, including an explicit `ungrouped` filter. Include a compact group object in client responses.

### 5.2 Renewal

Keep `POST /subscriptions/:id/renew`, but replace the ambiguous renewal `startsAt` input with:

- `periodStartsAt?` — only used for an explicit admin override;
- `periodEndsAt?` — optional custom expiry;
- `reason?` — required when overriding the default period;
- no field may change the subscription's original `startsAt`.

The response should include the updated subscription and the newly created renewal record. Add `GET /subscriptions/:id/renewals` for the date and renewal history.

### 5.3 Payments and reporting

Extend `POST /finance/payments` with `clientId`, `purpose`, optional `subscriptionId`, optional `renewalId`, and optional/conditionally required `description`.

Extend payment list and finance overview queries with:

- `clientId`;
- `groupId`;
- `purpose`;
- `status`.

Finance totals must exclude voided records and expose revenue totals grouped by purpose. Existing total revenue behavior remains unchanged after migration.

## 6. Subscription app UI

### 6.1 Clients page

Keep the existing operational table layout. Add:

- a Group filter beside search and status;
- a Group column with `Ungrouped` as plain muted text;
- a Group selector in the client create/edit sheet;
- row selection and a compact `Assign group` bulk action;
- a `Manage groups` action that opens a focused sheet or modal.

The group manager should be a simple searchable table with name, code, client count, status, and edit/archive actions. Do not create a separate dashboard or decorative group cards.

### 6.2 Finance payments

Update the existing Record payment sheet in this order:

1. Client — required searchable selector.
2. Purpose — required segmented select or standard select.
3. Subscription — shown when relevant; required for renewal.
4. Renewal period — optional selector when a renewal exists.
5. Description — shown and required for modification/other.
6. Amount, paid date, reference, and notes — retain current controls.

On the Payments tab, add Purpose and Group filters and columns. The Overview tab should include a revenue-by-purpose breakdown without adding a crowded card grid.

### 6.3 Renewal confirmation

Replace the current immediate Renew action with a confirmation modal showing:

- Original subscription start — read-only.
- Current expiry — read-only.
- New period start — calculated and read-only by default.
- New expiry — calculated, or editable for custom plans/authorized override.
- Plan and renewal amount.
- Optional reason.

Use labels that distinguish `Original start` from `Renewal period`. The confirmation copy must state that the original start date will not change.

After a successful renewal, show a `Record renewal payment` action. It opens the payment sheet prefilled with client, subscription, renewal, purpose, amount, and currency. Renewal remains successful even if the client will pay later.

The subscription detail sheet should add a compact Renewal history section. The existing `Started` value must continue to show the original start date.

## 7. Permissions

| Capability                            | SUPER_ADMIN | ADMIN | OPERATOR             | VIEWER |
| ------------------------------------- | ----------- | ----- | -------------------- | ------ |
| View groups and client assignments    | Yes         | Yes   | Yes                  | Yes    |
| Create/edit/archive group definitions | Yes         | Yes   | No                   | No     |
| Assign clients to active groups       | Yes         | Yes   | Yes                  | No     |
| Renew with calculated dates           | Yes         | Yes   | Yes                  | No     |
| Override/backdate renewal period      | Yes         | Yes   | No                   | No     |
| Record a payment                      | Yes         | Yes   | Yes                  | No     |
| Void a payment                        | Yes         | Yes   | No                   | No     |
| View finance and renewal history      | Yes         | Yes   | As currently allowed | Yes    |

All group changes, assignments, renewals, payment creation, and payment voids must be written to the audit log.

## 8. Migration strategy

Use a staged, production-safe migration:

1. Create `ClientGroup` and `SubscriptionRenewal` tables.
2. Add nullable `PaymentRecord.clientId`, `purpose`, `description`, and `renewalId` columns.
3. Backfill `clientId` through each existing payment's subscription.
4. Backfill existing payment purpose as `OTHER` with the description `Legacy subscription payment`, unless reliable event history allows classification as renewal.
5. Make `PaymentRecord.clientId` and `purpose` required.
6. Make `subscriptionId` optional.
7. Add indexes and foreign keys after validating the backfill.

Do not rewrite historical subscription `startsAt` values automatically. Existing records may already have been changed by past renewals, and the original date cannot be inferred safely in every case.

Provide a one-time audit report listing subscriptions where the earliest `subscription.created` event is older than the stored `startsAt`. An administrator can review those records and run a guarded repair command with a database backup taken first.

## 9. Implementation batches

### Batch 1 — Renewal integrity hotfix

- Add regression tests proving renewal never changes `startsAt`.
- Change repository/service renewal behavior to update expiry only.
- Add renewal history model and migration.
- Add the confirmation modal and renewal-history view.
- Add active, expired, custom-period, cancelled, and concurrent-renewal tests.

This batch should be implemented and deployed first because the current behavior destroys historical date information on every renewal.

### Batch 2 — Client groups

- Add group schema, repository, service, DTOs, controller, permissions, and audit events.
- Add client group relation, query filter, assignment, and bulk assignment.
- Add group management and filtering to the Clients page.
- Add API and UI tests for grouped, archived, and ungrouped clients.

### Batch 3 — Classified client payments

- Migrate payment ownership to the client and add payment purpose.
- Update finance APIs and validation.
- Update the Record payment sheet and payment table.
- Connect the renewal success action to a prefilled renewal payment form.
- Preserve current void behavior and audit history.

### Batch 4 — Finance filters and reporting

- Add client group and payment-purpose filters.
- Add revenue-by-purpose totals and exports.
- Verify all totals exclude voided payments.
- Add grouped finance tests and CSV/export tests if export is enabled.

### Batch 5 — Data audit and rollout hardening

- Generate the historical start-date audit report.
- Run migration and rollback rehearsal against a production-like backup.
- Add release notes and administrator usage notes.
- Perform accessibility, keyboard, responsive, and supported-browser checks.
- Monitor renewal, payment, and migration errors after deployment.

## 10. Acceptance tests

### Renewal integrity

1. Create a monthly subscription starting October 2 and expiring November 2.
2. Renew it before November 2.
3. Confirm original `startsAt` remains October 2.
4. Confirm the renewal row contains November 2 to December 2.
5. Confirm subscription expiry becomes December 2.
6. Renew it again and confirm the original start still remains October 2.
7. Verify subscription events and audit logs contain both renewals.

For an expired subscription, confirm the modal defaults the new period to today and clearly shows the gap. Verify only an administrator can backdate it and that a reason is required.

### Client groups

- Create, rename, archive, and filter a group.
- Assign one client and bulk-assign multiple clients.
- Clear an assignment and verify the client appears under `Ungrouped`.
- Confirm an archived group cannot receive new assignments.
- Confirm existing clients in an archived group remain visible and reportable.

### Payments

- Record each of the four payment purposes.
- Record a modification payment linked only to a client.
- Confirm modification/other cannot save without a description.
- Confirm renewal cannot save without a subscription.
- Confirm a subscription from another client is rejected.
- Void a payment and confirm it is retained but excluded from totals.
- Filter payment history and finance totals by group and purpose.

## 11. Definition of done

- Renewing never changes the original subscription start date.
- Every renewal has a separate, auditable coverage-period record.
- Clients can be grouped, filtered, assigned, and bulk-assigned.
- Initial, renewal, modification, and other payments can be recorded without fake subscription links.
- Finance totals and filters reflect payment purpose and client group accurately.
- Role checks are enforced in both UI and API.
- Migrations, regression tests, build, lint, production verification, and backup/restore rehearsal pass.

## 12. Recommended execution order

Start with Batch 1, then deploy and verify the renewal fix before building the grouping and finance changes. Continue with Batches 2 and 3, then add reporting in Batch 4. Keep the historical repair audit in Batch 5 because it requires human review and must not delay protection against future date overwrites.
