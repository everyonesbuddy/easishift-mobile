# WiserShifts Mobile

WiserShifts Mobile is the Expo React Native frontend for the WiserShifts multi-tenant workforce scheduling platform used by care facilities.

Admins can manage coverage, schedules, staff, time off, messages, and subscription billing. Staff can self-manage schedules, shift swaps, time-off requests, messaging, and preferences.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Getting Started](#getting-started)
4. [Environment and API Configuration](#environment-and-api-configuration)
5. [Authentication and Roles](#authentication-and-roles)
6. [Routing and Billing Guard](#routing-and-billing-guard)
7. [Feature Areas](#feature-areas)
8. [Guided Tours](#guided-tours)
9. [Key Developer Patterns](#key-developer-patterns)
10. [Deployment](#deployment)

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
	timezone.ts

context/
	auth-context.tsx
	guide-tour-context.tsx

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

All network requests go through a shared Axios client in [config/api.ts](config/api.ts).

Typical behavior:

- Production requests use the deployed API.
- Development requests use `localhost:5000` on web, `10.0.2.2:5000` on Android emulators, or the Expo host for iOS/physical devices.
- `EXPO_PUBLIC_API_BASE` overrides the selected API base URL.
- The client uses the `/api/v1` prefix and restores a bearer token after session hydration.

If backend URL behavior changes, update only [config/api.ts](config/api.ts).

---

## Authentication and Roles

Auth state is managed in [context/auth-context.tsx](context/auth-context.tsx).

Core responsibilities:

- Session hydration from `AsyncStorage` on app start
- User/role/tenant state management
- Login/logout helpers
- Tenant refresh after billing events
- Facility preference hydration alongside tenant context

Protected routes are rendered inside app/(protected), while unauthenticated entry is in app/(public).

Permissions are derived from normalized system and facility roles using [constants/industry-roles.ts](constants/industry-roles.ts). Feature screens should use `can(permission)` and facility-role helpers instead of relying on a single role string.

---

## Routing and Billing Guard

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

The protected layout gates admins when a subscription is inactive or the tenant requires a plan upgrade. The `inPaywallFlow` check prevents redirect loops while the user is already at `/paywall` or `/billing`.

Mobile billing is deliberately view-only:

1. Inactive admin enters protected area.
2. Redirect to /paywall.
3. Paywall and subscription screens show published yearly/monthly plans from `/stripe/plans` with a yearly fallback for offline plan reference.
4. Subscription setup, upgrades, and cancellations occur in the WiserShifts web portal.

---

## Feature Areas

### Facility Preferences

Facility administrators configure scheduling patterns, role families, unit areas, shift types, time slots, certification tags, workload signals, fairness settings, notifications, and time tracking. Facility timezones are stored as IANA identifiers with confirmation state; the device-zone shortcut uses [config/timezone.ts](config/timezone.ts).

### Coverage and Schedule

Coverage planning and staff scheduling provide list/calendar workflows, taxonomy-aware requirements, modal forms, draft generation/review, shift creation/editing, and swap requests. Shared `MonthCalendar` supplies mobile calendar interactions.

### Staff Management and Preferences

Staff records include capability restrictions (`allowedAreas`, `allowedShiftTags`, `allowedShiftTypes`, `certificationTags`) and scheduler signals. Administrators can configure preferred and avoided days, overtime openness, weekly hour targets, shift and consecutive-day limits, and alternate-week rotation anchors. The staff-only Preferences screen exposes only personal preferred days, avoided days, overtime openness, and notification choices.

### Time Off, Swaps, and Messages

All staff can create personal time-off requests, swap requests, and tenant-scoped messages. Administrators can review time-off decisions and access broader operational workflows according to permissions.

### Billing

`/paywall` and `/billing` display the current subscription, seat limit, billing contact, and plan reference. The native app does not initiate checkout or modify subscriptions.

---

## Guided Tours

[context/guide-tour-context.tsx](context/guide-tour-context.tsx) provides the foundation for in-app guided tours. Tour completion is saved per user in `AsyncStorage` using `wisershifts_guide_seen_<tourId>_<userScopeId>`. It exposes tour state and `startTourIfUnseen`, but no video-guide system is included.

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

5. Native persistence

- Use `AsyncStorage` for session and per-user client persistence. Do not use browser `localStorage` APIs in native components.

---

## Deployment

Deployment and store release instructions are documented in [docs/mobile-app-deployment-guide.md](docs/mobile-app-deployment-guide.md).
