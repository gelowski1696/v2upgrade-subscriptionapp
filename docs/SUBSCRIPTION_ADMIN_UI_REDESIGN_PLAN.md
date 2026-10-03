# Subscription Administration UI Redesign Plan

**Prepared:** 2026-10-03  
**Status:** Implemented locally; deployment pending  
**Scope:** Clients and groups, plan creation/versioning and features, subscription creation/editing, feature overrides, and renewal history  
**Applies to:** `subscriptionapp-posv2` with small supporting changes in `subsapi`

## 1. Outcome

Make the three core administration workflows easy to understand and complete without scrolling through oversized sheets:

1. Organize clients by group and move clients between groups.
2. Create a plan or a new plan version while reviewing all included features.
3. Create and manage a subscription, override its feature access when necessary, and review every renewal period.

This is a UI restructuring project. The current visual system - warm neutral surfaces, dark navigation, gold primary action, Inter typography, and compact data rows - should remain recognizable.

## 2. Product interpretation

"Clients = groups" is treated as a request to make groups a first-class part of the Clients workspace. The primary navigation label remains **Clients** because a group is an organizing layer, not a client record.

Plan editing continues to create a new immutable version. The UI must call this **Create new version**, show what changed, and avoid implying that a published version will be edited in place.

Subscription features inherit from the selected plan. Administrators can override the supported feature switches for one subscription during creation or later from its detail view.

## 3. Current UI findings

- Client group management is embedded below a group form in a modal sheet, which makes comparing and managing groups difficult.
- Plans contain more than 20 feature switches in a narrow sheet. Core features and feature mods are split into separate sections with no enabled count, search, group action, or review step.
- The subscription creation form does not expose feature settings. Administrators must create the subscription, reopen it, scroll to Feature mods, and save changes separately.
- Subscription details combine identity, device management, web access, feature switches, renewal history, notes, and lifecycle actions in one long sheet.
- Renewal history is present but has no explicit loading/error state and is visually buried beneath the feature list.
- Shared sheets are capped at `sm:max-w-lg`, which is too narrow for feature comparison and renewal records on desktop.

## 4. Design direction

### Visual thesis

A calm, dense administration workspace with strong type hierarchy, plain data surfaces, thin dividers, and one gold action color. Forms should feel like focused work areas rather than stacks of cards.

### Content model

- The page owns search, filters, list context, and the primary create action.
- A detail inspector owns record summary and quick actions.
- A wide editor owns multi-section creation and feature configuration.
- Tabs separate distinct jobs; they should not hide required fields or turn a short form into a wizard.

### Interaction thesis

- Open records in a stable desktop inspector and a full-height mobile sheet.
- Animate tab/content changes and inspector entry in 150-200 ms; respect reduced-motion settings.
- Keep the current record, active tab, filter, and scroll position stable after saving.
- Show unsaved feature changes in a sticky action bar with **Discard** and **Save changes**.

## 5. Shared layout changes

Create two sheet widths instead of using one size for every task:

- **Inspector:** 30-36rem for summaries, quick edits, and actions.
- **Workspace editor:** 48-64rem for plan features, subscription features, and group management.

On mobile, both become full-screen surfaces below the safe area. Their header and action bar remain visible while the content scrolls.

Add shared patterns for:

- labeled tabs with counts;
- feature rows and feature-group headers;
- searchable client/plan selectors;
- loading, empty, and retry states;
- dirty-form confirmation;
- sticky editor actions;
- inline field errors and an error summary after a failed submit.

Use sentence case throughout. Replace "Feature mods" with **Features** in user-facing copy; keep the existing API/domain term internally.

## 6. Clients and groups

### 6.1 Clients workspace

Keep **Clients** as the page title and add two workspace tabs:

- **Clients** - existing client list, search, status filter, group filter, selection, and bulk assignment.
- **Groups** - group management in the main page area rather than inside a second sheet.

The selected tab may be represented in the URL query string (`?view=clients` or `?view=groups`) so refresh and browser navigation preserve context.

### 6.2 Clients tab

- Keep the current compact rows on mobile and add explicit column headers on desktop.
- Order desktop columns as Client, Group, Contact, Email/phone, Status, Actions.
- Place search, status, and group filters in one toolbar. Add a visible **Clear filters** action when any filter is active.
- Keep bulk group assignment in a sticky selection bar. Label the empty group choice **Remove from group** instead of "Move to Ungrouped."
- Show group names as plain linked text or a compact label; reserve status chips for actual status.
- Preserve selection across the current page while assigning a group, then clear it after success.

### 6.3 Groups tab

- Use a searchable data table with Group, Code, Clients, Status, and Actions.
- Put **Add group** in the page header. Open create/edit in the inspector.
- Show the client count as a link that returns to the Clients tab with that group filter applied.
- Keep archived groups visible with a status filter; archived groups cannot receive new assignments.
- Give create/edit forms a clear field order: Name, Code, Description, Status.
- Use explicit row actions (**Edit**, **Archive/Restore**) rather than making the whole row silently enter edit mode.

### 6.4 Client editor

Group the form into **Business**, **Contact**, and **Internal notes** sections with dividers. Keep Client group next to Status because both control organization and availability. Do not introduce a multi-step flow for this short form.

## 7. Plans: create, version, and features

### 7.1 Plan list

- Add a Features summary column: for example, **18 enabled**.
- Keep price, billing interval, current version, and status visible without opening the plan.
- Rename the edit affordance according to state:
  - Draft with no published version: **Continue setup**.
  - Published plan: **Create new version**.
- Keep Publish as a separate, deliberate action with a review confirmation.

### 7.2 Plan editor

Use a wide editor with three tabs:

1. **Details** - code/name, billing interval, amount/currency, trial, grace, and device limit.
2. **Features** - every included feature in one consistent control system.
3. **Review** - pricing summary, enabled feature count, changed features, and version/publish explanation.

Details can be saved only when required fields are valid. Tabs with errors display an error marker and the first invalid control receives focus after submit.

### 7.3 Feature editor

- Combine Owner web dashboard, Reports, Database backups, Multiple users, and the existing feature-mod groups under the single heading **Features**.
- Retain the current functional groups: Sales and customers; Personnel and daily control; Inventory, cash, and reports.
- Add a Core access group for dashboard, reports, backups, and multiple users.
- Show an enabled count in the tab label and per group, such as **6 of 8 enabled**.
- Add feature search and an **Enabled only** filter.
- Add **Enable all** and **Disable all** at group level, with confirmation only when a bulk action would turn off enabled features.
- Make the whole feature row clickable, use a proper switch/checkbox with a visible focus state, and provide one short description for ambiguous features.
- When creating a new version, show a compact change summary: Added, Removed, and Unchanged. Existing subscriptions retain their current entitlements.
- Keep a sticky footer with **Cancel** and **Create plan/Create version**. Publishing remains a later action.

No plan API change is required for this design because the existing create-version endpoint already accepts the complete feature map.

## 8. Subscriptions: create, edit, features, and renewals

### 8.1 Subscription list

- Add desktop columns for Client, Plan, Status, Expiry, Features, and Device.
- The Features column shows **Plan defaults** or **N overrides**.
- Keep search and status filtering; add optional Client and Plan filters if the list is large enough to justify them.
- Opening a row displays the detail inspector with tabs instead of one continuous sheet.

### 8.2 Create subscription

Use a wide editor with two tabs:

1. **Setup** - searchable Client and Plan selectors, Device ID, start/expiry dates, and notes.
2. **Features** - selected plan defaults plus subscription-specific overrides.

After a plan is selected:

- Load its latest published feature map.
- Show **Inherited from [plan name]** above the feature list.
- Allow administrators to change subscription-editable switches.
- Mark changed rows as **Override** and provide **Reset to plan defaults** globally and per group.
- Operators can create with plan defaults but cannot change admin-only feature access.

The final action remains **Create draft**. The confirmation/toast should state whether plan defaults or custom overrides were applied.

### 8.3 Subscription detail inspector

Use four tabs:

- **Overview** - plan, amount, billing, original start, current expiry, device, notes, and lifecycle actions.
- **Features** - dashboard access and all feature overrides with one save action.
- **Renewals** - renewal history and Renew action.
- **Activity** - reserved for existing subscription events when that history is exposed in the UI.

On Overview, clearly distinguish **Original start** from **Current coverage ends**. Keep destructive lifecycle actions in an overflow/action area and require the existing confirmations.

### 8.4 Subscription feature editing

- Reuse the exact same feature groups and row component as Plans.
- Show each feature's source: **Plan default** or **Subscription override**.
- Show a sticky dirty-state bar only after a change.
- Save all feature changes in one action. Do not require a separate Save button beside Owner web dashboard.
- After save, show when the change takes effect: web access immediately; POS access at the next license check.
- If the plan has gained a newer version, show an informational notice without silently changing the subscription.

### 8.5 Renewal history

Make renewal history a first-class tab with:

- current original start and current expiry at the top;
- newest renewal first;
- columns/rows for Coverage period, Amount, Renewed on, Renewed by, and Reason;
- a clear empty state for subscriptions that have never been renewed;
- skeleton/loading, retryable error, and loaded states;
- pagination or incremental loading once history exceeds 20 records.

The **Renew subscription** action opens the existing confirmation flow. The modal must continue to show original start, current expiry, new period, amount, and override reason. After success, insert the new record at the top of the Renewals tab and offer **Record renewal payment**.

## 9. Supporting API work

The existing group, plan-version, feature-update, and renewal-history APIs cover most of the redesign. Add only the following:

1. Extend `POST /subscriptions` with optional `featureOverrides` for the supported feature-mod keys and optional `webDashboardEnabled`.
2. Validate overrides with the same allow-list used by `PATCH /subscriptions/:id/feature-mods`.
3. Merge validated overrides onto the selected plan version inside the subscription creation transaction.
4. Return enough plan-default metadata with a subscription to distinguish inherited values from overrides. Prefer an explicit `featureOverrides` object over attempting to infer overrides by comparing the current plan later.
5. Include renewal actor display information if the current renewal response does not expose it.

Keep role enforcement in the API. `SUPER_ADMIN` and `ADMIN` can change features; `OPERATOR` can create subscriptions with plan defaults and perform currently allowed renewals.

## 10. Implementation phases

### Phase 1 - Shared UI foundation

- Add inspector and workspace-editor sizes.
- Add reusable tabs, feature editor, searchable selectors, dirty-state bar, and async-state components/patterns.
- Normalize user-facing labels and terminology.
- Add keyboard focus, escape handling, scroll locking, and reduced-motion behavior.

### Phase 2 - Clients and groups

- Move group management from the modal to the Groups workspace tab.
- Refine filters, column headers, bulk assignment, and client editor sections.
- Preserve URL/filter state and connect group client counts back to filtered Clients.

### Phase 3 - Plan editor

- Replace the narrow sheet with the wide tabbed editor.
- Consolidate feature controls and add counts, search, group actions, and change review.
- Clarify create-version and publish semantics.

### Phase 4 - Subscription creation and features

- Add the create-time Features tab.
- Implement and consume subscription `featureOverrides` support.
- Convert subscription details to Overview/Features/Renewals tabs.
- Consolidate feature saving and add reset-to-plan behavior.

### Phase 5 - Renewal history and hardening

- Upgrade renewal history states and metadata.
- Verify renewal confirmation and record-payment handoff.
- Complete responsive, accessibility, role, and regression testing.

## 11. Validation and acceptance criteria

### Clients and groups

- An administrator can find, create, edit, archive, and restore a group without leaving the Clients workspace.
- Clicking a group's client count opens the correctly filtered client list.
- Single and bulk assignment work for active groups; archived groups cannot receive assignments.
- Filters, tab, and pagination remain usable at 320 px width and by keyboard.

### Plans

- Create plan and Create new version both expose the complete feature list.
- Feature search, enabled counts, group bulk actions, and reset/discard behavior are accurate.
- Review shows the exact feature and pricing changes before creating a version.
- Existing subscriptions do not change when a new plan version is created or published.

### Subscriptions

- Selecting a plan loads its defaults before creation.
- Admin feature overrides are saved atomically with the new subscription; operators receive plan defaults.
- Later feature edits show inherited versus overridden values and save through one action.
- Renewal history has loading, empty, error, and populated states and shows the latest renewal first.
- Renewing never changes Original start, and the new coverage period appears immediately in history.

### Quality gates

- Angular unit tests cover form mapping, override/reset logic, version change summaries, and renewal state updates.
- API tests cover create-time override validation, authorization, merge behavior, and audit metadata.
- Playwright covers the three primary desktop flows and focused mobile smoke paths.
- `npm test`, production builds for the app and API, keyboard checks, and automated accessibility checks pass.

## 12. Primary files expected to change

### Frontend

- `src/app/features/clients/clients.html`
- `src/app/features/clients/clients.ts`
- `src/app/features/plans/plans.html`
- `src/app/features/plans/plans.ts`
- `src/app/features/subscriptions/subscriptions.html`
- `src/app/features/subscriptions/subscriptions.ts`
- `src/app/core/models/feature-mods.ts`
- `src/app/core/models/api.models.ts`
- `src/styles.css`
- new shared tab, feature-editor, selector, and async-state components as needed

### API

- `src/presentation/http/subscriptions/subscriptions.dto.ts`
- `src/application/subscriptions/subscriptions.service.ts`
- subscription repository types only if explicit override metadata is persisted
- related unit and integration tests

## 13. Out of scope

- Changing plan-version immutability.
- Automatically migrating existing subscriptions to a newly published plan version.
- Replacing the application theme or primary navigation.
- Redesigning Finance beyond preserving the renewal-payment handoff.
- Adding nested client groups or multiple groups per client.
