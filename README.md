# WiserShifts Mobile — Frontend

WiserShifts Mobile is the Expo React Native frontend for the WiserShifts multi-tenant workforce scheduling platform used by care facilities.

Admins can manage coverage, schedules, staff, time off, messages, and subscription billing. Staff can self-manage schedules, shift swaps, time-off requests, messaging, and preferences.

---

## Table of Contents

1. Tech Stack
2. Project Structure
3. Getting Started
4. Environment and API Configuration
5. Authentication Flow
6. Role System
7. App Entry Point and Routing
8. Paywall and Billing Guard
9. Feature Areas
10. Shared Components
11. Key Developer Patterns
12. Deployment Guide
13. Recent Major Changes

---

## Tech Stack

| Concern               | Library / Version                  |
| --------------------- | ---------------------------------- |
| Framework             | Expo SDK 54 + React Native 0.81    |
| React                 | React 19                           |
| Routing               | Expo Router 6 (file-based routing) |
| Navigation Primitives | React Navigation 7                 |
| HTTP                  | Axios via config/api.ts            |
| Storage               | AsyncStorage                       |
| Calendar UI           | Shared MonthCalendar component     |
| Icons                 | @expo/vector-icons (Feather)       |
| Language              | TypeScript                         |
| Linting               | eslint-config-expo                 |

Note: this mobile app does not use Vite, MUI, React Router DOM, or FullCalendar.

---

## Project Structure

```text
app/
	_layout.tsx
	(public)/
		_layout.tsx
		index.tsx
		login.tsx
		signup-tenant.tsx
		reset-password.tsx
		turnover-roi-calculator.tsx
		calculators.tsx
		cost-leak-calculator.tsx
	(protected)/
		_layout.tsx
		dashboard.tsx
		coverage-planning.tsx
		schedule.tsx
		staffs.tsx
		timeoff-decisions.tsx
		timeoff-requests.tsx
		swap-requests.tsx
		messages.tsx
		preferences.tsx
		paywall.tsx
		billing/
			index.tsx
			success.tsx
			cancel.tsx

components/
	auth/
	home/
	shared/
	staff-portal/
		billing/
		coverage/
		dashboard/
		messages/
		preferences/
		schedule/
		staff/
		timeoff/
		shared/

config/
	api.ts

context/
	auth-context.tsx

constants/
	industry-roles.ts
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install and Run

```bash
npm install
npm run start
```

Other useful scripts:

```bash
npm run android
npm run ios
npm run web
npm run lint
```

Deployment and store release instructions are documented in `docs/mobile-app-deployment-guide.md`.

---

## Environment and API Configuration

All network requests go through a shared Axios client in config/api.ts.

Typical behavior:

- Central base URL and credentials setup
- Shared auth header behavior
- One import path used consistently across modules

If backend URL behavior changes, update only config/api.ts.

---

## Authentication Flow

Auth state is managed in context/auth-context.tsx.

Core responsibilities:

- Session hydration from local storage on app start
- User/role/tenant state management
- Login/logout helpers
- Tenant refresh after billing events

Protected routes are rendered inside app/(protected), while unauthenticated entry is in app/(public).

---

## Role System

Two role categories drive UI and behavior:

- Admin roles: admin, superadmin
- Staff role: staff

Role-aware navigation and feature behavior is implemented in protected layouts and screen-level logic.

---

## App Entry Point and Routing

This app uses Expo Router file-based routing.

Public routes:

- /
- /login
- /signup-tenant
- /reset-password
- /turnover-roi-calculator
- /calculators
- /cost-leak-calculator

Protected routes:

- /dashboard
- /coverage-planning
- /schedule
- /staffs
- /timeoff-decisions
- /timeoff-requests
- /swap-requests
- /messages
- /preferences
- /paywall
- /billing
- /billing/success
- /billing/cancel

---

## Paywall and Billing Guard

Admin users are gated when subscription is inactive (or tenant limits require upgrade). In that case, navigation is redirected into paywall/billing flow.

Flow summary:

1. Inactive admin enters protected area.
2. Redirect to /paywall.
3. Checkout starts via backend Stripe session endpoint.
4. Return to /billing/success or /billing/cancel.
5. Tenant state refresh controls unlock behavior.

---

## Feature Areas

### Dashboard

Admin and staff dashboards present role-appropriate operational views.

Recent changes:

- Dashboard quick-action block removed for a lighter experience.

### Coverage Planning

Coverage planning supports:

- List and calendar views
- Add coverage, edit headcount, delete coverage
- Taxonomy-aware fields:
  - unitArea
  - shiftType
  - shiftTag
  - requiredCertificationTags

Coverage create flow updates:

- Slot-definition-first time selection
- Searchable slot selection
- Save-only and save-plus-generate-draft actions

Calendar UX update:

- Clicking a day opens a popup day-details panel (instead of persistent bottom list).

### Schedule Builder

Schedule module supports:

- List view
- Calendar view
- Roster view
- Shift create/edit
- Swap requests
- AI draft workspace

Auto-generate draft workspace includes:

- Open coverage intake
- Draft create/review/edit/publish flow
- Assignment-level edit/state controls
- Fill with AI for unfilled draft slots
- Publish selected or publish all
- Live schedule overlay support (schedules prop wired from schedule list)

UX updates:

- Day details shown in popup modals
- Needs-coverage summary simplified
- Improved legend presentation
- Toast feedback moved to temporary bottom toast

### Staff Management

Staff management includes:

- Create/edit staff
- Bulk staff import/add flows
- Capability tags:
  - allowedAreas
  - allowedShiftTypes
  - allowedShiftTags
  - certificationTags

### Time Off

Screens:

- timeoff-requests (all users for personal requests)
- timeoff-decisions (admin review flow)

### Shift Swaps

Includes swap request creation and inbox/sent handling.

### Messages

Internal tenant-scoped messaging with list and composer workflows.

### Preferences

Staff-facing preferences flow with backend-supported payload only.

### Billing and Subscription

Screens:

- paywall
- billing
- billing/success
- billing/cancel

---

## Shared Components

Key shared building blocks include:

- ConfirmDialog
- MonthCalendar
- Protected top bar / bottom navigation components
- Modal-based forms for create/edit flows

---

## Key Developer Patterns

1. Taxonomy-first options

- Prefer facility preference taxonomy values.
- Fall back to industry defaults when facility config is missing.

2. Central API usage

- Use config/api.ts for all requests.
- Avoid direct Axios instance creation inside feature files.

3. Role-aware rendering

- Use auth-context role flags for role-specific UI.

4. Modal-first mobile UX

- Create/edit flows are primarily modal-driven.

5. Calendar day drill-down

- Day click opens popup details for schedule and coverage modules.

---

## Recent Major Changes

1. Schedules and coverage now support expanded taxonomy fields.
2. Auto-generate schedule workspace migrated to richer draft lifecycle UX.
3. Manual scheduling safeguards added for draft-linked coverage conflicts.
4. Coverage create flow split into save-only and save-and-generate-draft paths.
5. Coverage slot selection hardened to configured slot definitions.
6. Dashboard quick actions removed for simplification.
7. Schedule and coverage calendar UX updated to popup day details.
8. Auto-generate workspace now consumes live schedules directly via props.
9. In-app feedback moved to temporary bottom toast UX.

---

If you also want a second README section specifically for backend contract endpoints (per feature), I can append an API matrix next.

**Loop prevention**: The `inPaywallFlow` check in the protected layout prevents the redirect logic from looping when the admin is already on `/paywall` or `/billing`.

## Important Files

- `app/(public)` - public route entry points
- `app/(protected)` - authenticated route entry points
- `app/(protected)/_layout.tsx` - protected shell and billing gate logic
- `components/shared/protected-bottom-nav.tsx` - role-based navigation
- `context/auth-context.tsx` - login/session/role state
- `components/staff-portal/dashboard` - dashboard quick actions and modals
- `components/staff-portal/staff` - staff management
- `components/staff-portal/coverage` - coverage planning (includes real calendar view)
- `components/staff-portal/schedule` - manual, AI, and swap scheduling flows (includes real calendar view)
- `components/staff-portal/timeoff` - request and approval flows
- `components/staff-portal/preferences` - scheduling preferences
- `components/staff-portal/messages` - inbox and composer flows
- `components/staff-portal/billing` - active subscription management (`ManageSubscriptionPage`)
- `components/staff-portal/shared/month-calendar.tsx` - reusable month-grid calendar component
- `app/(protected)/paywall.tsx` - standalone initial paywall route
- `app/(protected)/billing/index.tsx` - ongoing billing management route

## Development Notes

- Routing is file-based through Expo Router.
- The app relies on the backend to provide tenant, auth, staffing, schedule, messaging, time-off, preference, and Stripe session APIs.
- Role-specific behavior is primarily controlled by auth context and protected bottom navigation.

## Current Product Story in One Pass

1. A facility admin signs up the tenant.
2. The admin logs in.
3. The app restores auth, fetches tenant context, and routes to the protected dashboard.
4. Because the tenant is inactive or effectively single-seat, the protected layout redirects the admin to `/paywall`.
5. The admin selects a plan (Starter, Growth, or Premium) with yearly or monthly billing and completes Stripe checkout.
6. On checkout success, tenant state refreshes and the admin lands on the normal dashboard.
7. From that point the admin can access all features. `/billing` is available under `More → Manage Subscription` for ongoing plan changes.
8. The admin adds staff.
9. The admin creates coverage needs.
10. The admin schedules people manually or with AI.
11. Staff log in and see their own schedule-centric experience.
12. Staff manage preferences, request time off, swap shifts, and send messages.
13. Admins review time-off decisions and manage subscription changes from `/billing` when needed.
