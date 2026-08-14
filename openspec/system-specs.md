# System Specs

This file is the living backlog index for the Orion Mobile OpenSpec workspace.

## Technology Stack

### Mobile

- Expo SDK 55.
- React Native 0.83 with TypeScript.
- Expo Router for app navigation and route groups.
- React Navigation for navigation primitives.
- NativeWind + Tailwind tokens.
- Axios for HTTP.
- Expo Secure Store for persisted auth state.
- Expo File System for local file access.
- Expo Local Authentication for biometrics.
- Sentry for error monitoring.
- Expo Image and Expo Video for media rendering.

### Web

- Expo web target through `npm run web`.
- React DOM for browser rendering.
- React Native Web for shared UI primitives.
- The same Expo Router codebase powers mobile and web entry points.

### Shared Services

- Backend API consumed through `EXPO_PUBLIC_API_URL`.
- Route permissions loaded from the backend `routes_config` endpoint.

It tracks each module and requirement through the following states:

| State | Meaning |
| --- | --- |
| Draft | Functional specification and BDD scenarios are being defined or reviewed. |
| Approved | The specification has been validated and is ready for technical planning. |
| In Development | The implementation plan is approved and code or tests are actively being written. |
| Baseline / Completed | The functionality is fully implemented, verified, and documented in baseline specs. |

## Access Identity

| Status | Requirement | Spec |
| --- | --- | --- |
| Baseline / Completed | Onboarding, login, session bootstrap, biometrics, and permission-aware route protection | [Access Identity](./specs/access-identity/spec.md) |

## Schedule Management

| Status | Requirement | Spec |
| --- | --- | --- |
| Baseline / Completed | Personal schedules, team schedules, and direct report drill-down | [Schedule Management](./specs/schedule-management/spec.md) |

## Task Inbox and Notifications

| Status | Requirement | Spec |
| --- | --- | --- |
| Baseline / Completed | Pending task counts, notifications entry points, and task details | [Task Inbox and Notifications](./specs/task-inbox-and-notifications/spec.md) |

## Profile and Settings

| Status | Requirement | Spec |
| --- | --- | --- |
| Baseline / Completed | Profile view, manager data, theme preference, biometrics, and local reset | [Profile and Settings](./specs/profile-and-settings/spec.md) |

## Compensation Access

| Status | Requirement | Spec |
| --- | --- | --- |
| Baseline / Completed | Protected payslip access and history browsing | [Compensation Access](./specs/compensation-access/spec.md) |

## News Feed and Engagement

| Status | Requirement | Spec |
| --- | --- | --- |
| Baseline / Completed | Feed timeline, media previews, and reactions | [News Feed and Engagement](./specs/news-feed-and-engagement/spec.md) |
