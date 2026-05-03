# Easishift Mobile

Easishift Mobile is the React Native staff portal for facility onboarding, staffing operations, scheduling, coverage planning, time-off workflows, shift swaps, messaging, preferences, and subscription management.

This README is written as a product-flow guide so a new developer, tester, or stakeholder can understand how the mobile app behaves from first entry to daily operations.

## Tech Stack

- Expo + React Native
- Expo Router for file-based routing
- TypeScript
- Central API client in `config/api.ts`
- Auth/session state in `context/auth-context.tsx`

## Running the App

1. Install dependencies.

```bash
npm install
```

2. Start the Expo app.

```bash
npx expo start
```

3. Open the app in Expo Go, simulator, or a development build.

## Route Structure

The app is split into two main route groups:

- `app/(public)` for unauthenticated screens
- `app/(protected)` for authenticated staff portal screens

Public routes currently include:

- landing page
- login
- tenant signup
- reset password
- turnover ROI calculator

Protected routes currently include:

- dashboard
- coverage planning
- schedule
- staff management
- messages
- preferences
- time off requests
- time off decisions
- shift swaps
- paywall (initial subscription gate for inactive admins)
- billing (ongoing subscription management for active admins)
- billing success and cancel states

## High-Level User Flow

### 1. Public Entry

Users land on the marketing/entry experience first. From there they can:

- log in if they already belong to a facility
- create a new tenant/facility account
- access password reset flows

### 2. Tenant Signup

Tenant signup is the facility onboarding flow. The form captures:

- hospital or facility name
- facility phone
- facility address
- admin name
- admin email
- admin password
- admin phone

On successful signup, the app sends the request to `/auth/signup/tenant` and then redirects the user to login.

### 3. Login

Staff and admins log in through the mobile login screen. The login flow:

- posts to `/auth/login/staff`
- stores the authenticated user, role, and token in local storage
- restores the session on app relaunch
- loads the tenant record if the user belongs to a tenant

After login, the app routes the user into the protected experience at `/dashboard`.

## Protected App Shell

Once authenticated, users enter the protected shell, which contains:

- a top bar with the current page title and logout action
- the active screen content
- a role-based bottom navigation bar

The bottom navigation differs by role.

### Admin Main Tabs

- Dashboard
- Coverage
- Schedule
- Messages
- More

### Admin More Menu

- Staff Management
- Time Off Decisions
- My Time Off Requests
- Manage Subscription

### Staff Main Tabs

- Dashboard
- Schedule
- Preferences
- Messages
- More

### Staff More Menu

- My Time Off Requests
- Shift Swaps

## Subscription Gate and Paywall Route

The protected layout checks subscription state for admins on every navigation.

An admin is redirected to `/paywall` when all of the following are true:

- the user is an admin
- a tenant record exists
- the subscription status is not `"active"`, or the tenant seat limit is `1` or less

This is the initial paywall behavior for a newly created or inactive account.

In practice, that means:

- a brand-new facility can sign up and log in
- the admin reaches the protected area
- if the facility is inactive or still limited to a single seat, the app redirects to `/paywall`
- the admin must choose a subscription before normal admin operations fully open up

The `/paywall` route renders the `Paywall` component. It is a standalone full-screen plan selection page — not embedded inside another screen.

To prevent redirect loops, the protected layout tracks whether the current route is already inside the paywall or billing flow (`inPaywallFlow`). If the user is already on `/paywall` or `/billing`, no further redirects happen.

The dashboard does **not** show an inline paywall. All subscription gating flows through the `/paywall` route.

## Billing Flow

Billing is split into two separate routes with distinct purposes.

### `/paywall` — Initial Plan Selection

The `/paywall` route is where new or inactive admins choose their first subscription plan.

The Paywall screen includes:

- a yearly vs monthly billing period toggle (centered header)
- three plan cards displayed in a vertical stack: **Starter**, **Growth**, and **Premium**
- each card shows price, seat count, and feature highlights
- a checkout button per plan

When the admin selects a plan, the app posts to `/stripe/create-checkout-session` with:

- `tenantId`
- `planKey`

If the backend returns a checkout URL, the app opens it on the device via the system browser.

### Billing Success

After a successful checkout, the success screen:

- confirms payment success
- refreshes tenant state
- returns the user to the dashboard

### Billing Cancel

If checkout is cancelled or interrupted, the cancel screen:

- informs the user that payment did not complete
- sends them back to the paywall to retry

### `/billing` — Ongoing Subscription Management

Once the account is active and has a valid seat count, the admin no longer hits the paywall redirect. The `/billing` route becomes the subscription management area for active accounts.

Admins reach `/billing` from `More → Manage Subscription`.

The `ManageSubscriptionPage` component at `/billing` lets admins:

- review current plan name, status, seat count, and billing email
- switch to a different plan
- cancel at period end
- cancel immediately

Subscription cancellation posts to `/stripe/cancel-subscription`.

### Route Separation Summary

| Condition                                          | Route      | Component                |
| -------------------------------------------------- | ---------- | ------------------------ |
| Admin with inactive subscription or seat limit ≤ 1 | `/paywall` | `Paywall`                |
| Active admin managing existing subscription        | `/billing` | `ManageSubscriptionPage` |

## Dashboard Flow

The dashboard is the operational landing page after login.

### Admin Dashboard

Admins use the dashboard as the command center for setup and staffing operations. It includes quick actions for:

- Add Staff
- Add Coverage
- Manual Schedule
- AI Generated Schedule

These actions open working native forms and modals directly from the dashboard.

### Staff Dashboard

Staff see a simplified dashboard focused on their own work. Their primary quick action is:

- Pick Up Shift

Both admin and staff dashboards also show schedule and coverage charts relevant to the current role.

## Recommended Operational Flow for a New Facility

This is the typical lifecycle after signup.

### Step 1. Activate subscription

The admin signs up, logs in, and is automatically redirected to `/paywall` by the protected layout. The admin selects a plan and completes Stripe checkout.

### Step 2. Add staff

After activation, the admin uses Staff Management or the dashboard `Add Staff` action to create users.

Staff management supports:

- creating staff manually
- editing existing staff
- bulk import or bulk add workflows adapted for mobile

### Step 3. Create coverage needs

The admin defines open staffing needs in Coverage Planning.

Coverage supports:

- list view and calendar view (real month-grid calendar with day badges showing coverage counts)
- role filtering
- add, edit, and delete for admins
- tracking required staffing counts and note fields

Coverage is the supply of open shifts that later feed scheduling.

### Step 4. Build schedules

Once coverage exists, the admin creates schedules using either:

- Manual Schedule
- AI Generated Schedule

Manual scheduling assigns staff into available coverage windows.

AI scheduling works from unfilled coverage and sends selected coverage items to `/schedules/auto-generate`.

Staff users can use the schedule area for their own view and pickup flow rather than full admin scheduling.

Both the Schedule and Coverage modules include a real month-grid calendar (`MonthCalendar` component). The calendar shows navigation arrows to move between months, weekday headers, and per-day badges indicating how many items exist on each day. Tapping a day filters the list below the calendar to that day's items.

### Step 5. Manage time off

Time off has two role-aware screens.

#### My Time Off Requests

Available to both admins and staff.

Users can:

- open the time-off request modal
- submit a request to `/timeoff`
- review submitted requests
- see current status and review notes

#### Time Off Decisions

Admin-only navigation entry.

Admins can:

- review pending requests
- filter by status
- approve or deny requests
- attach review notes

Review actions patch `/timeoff/{id}/review`.

## Shift Swap Flow

Shift swaps are staff-focused, but admins can still observe or process the workflow where supported.

The swap flow includes:

- opening a swap request modal from available schedules
- selecting a target or replacement shift context
- sending swap requests through the schedules API
- viewing inbox and outbox swap requests
- responding to incoming requests

This allows staff to resolve scheduling conflicts without requiring all changes to be manually coordinated by an admin.

## Preferences Flow

Preferences are staff-facing and help improve scheduling quality.

The Preferences screen lets a user manage:

- preferred days of the week
- unavailable days of the week
- preferred shift start and end times
- minimum and maximum weekly hours
- work style preferences
- notification preferences
- additional notes

The app loads and saves these values through `/preferences/me`.

These settings are soft constraints. They guide scheduling decisions but do not guarantee assignments.

## Messages Flow

The Messages module supports internal communication.

Users can:

- view inbox and sent messages
- search messages
- open message details
- mark inbox messages as read
- compose a new message
- reply to an existing thread with prefilled defaults

Messages use user-specific sender and receiver API endpoints.

## Role Summary

### Admin

Admins can:

- manage subscription and billing
- add staff
- create and edit coverage
- manually schedule staff
- trigger AI scheduling
- review time-off decisions
- submit their own time-off requests
- use messaging

### Staff

Staff can:

- view their dashboard
- view schedules and pick up shifts
- manage personal preferences
- submit time-off requests
- use shift swaps
- use messaging

## Core Business Rules to Remember

**Subscription gate**: An admin with an inactive subscription or a tenant seat limit of `1` or less is redirected to `/paywall` on every protected navigation until the account is activated. That rule is what separates the initial onboarding paywall from the normal post-subscription admin experience.

**Route separation**: `/paywall` is strictly for plan selection by new/inactive admins. `/billing` is strictly for subscription management by already-active admins. The two routes serve different purposes and should not be confused.

**No inline paywall**: The dashboard does not contain any embedded subscription gate. All paywall logic lives in the protected layout and the `/paywall` route.

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
