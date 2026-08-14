# Architecture Baseline Specification

## Purpose

Record the known technical baseline and constraints that shape Orion Mobile.

## Requirements

### Requirement: Supported stack

The system SHALL keep the documented mobile stack in place unless a change explicitly updates it.

The stack includes:

- Expo SDK 55.
- React Native 0.83 + TypeScript.
- Expo Router and React Navigation.
- NativeWind styling and Tailwind tokens.
- Axios-based API calls.
- Expo Secure Store for sensitive local state.
- Expo File System for local files.
- Expo Local Authentication for biometrics.
- Sentry for error monitoring.

#### Scenario: A contributor reviews the stack

- GIVEN the current implementation
- WHEN the stack is inspected
- THEN the mobile technologies are identifiable

### Requirement: Compatibility first

The system SHALL preserve existing onboarding, authentication, permissions, schedule, task, profile, settings, payslip, and feed flows.

#### Scenario: A feature is added

- GIVEN a new capability is proposed
- WHEN it touches existing flows
- THEN the change must remain compatible with the current app and integrations

### Requirement: Security-sensitive flows remain auditable

The system SHALL keep security-sensitive flows permission-aware and auditable.

#### Scenario: Access control changes

- GIVEN permissions or routes are modified
- WHEN the change is implemented
- THEN access control remains explicit and traceable through the route configuration source
