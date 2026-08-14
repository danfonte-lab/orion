# Analytics

## Purpose

Define how the Orion Mobile app captures product analytics.

## Standards

### Analytics provider

The system SHALL route analytics through the app-level `AnalyticsProvider`.

When analytics is enabled, the provider uses PostHog with the configured API key and host.

#### Scenario: Analytics is disabled

- GIVEN analytics is not enabled or the PostHog API key is missing
- WHEN the app renders the provider
- THEN analytics calls become no-ops and the app continues normally

#### Scenario: Analytics is enabled

- GIVEN analytics is enabled and a PostHog API key is present
- WHEN the app renders the provider
- THEN the app initializes PostHog and analytics events can be captured

### Screen view tracking

The system SHALL capture screen view events from focused screens.

`useScreenView` emits a `screen_view` event with the current screen name whenever a screen gains focus.

#### Scenario: A screen is opened

- GIVEN a screen uses `useScreenView`
- WHEN the screen becomes focused
- THEN a `screen_view` event is captured with the screen identifier

### User identification

The system SHALL identify authenticated users so analytics events can be associated with a user record.

#### Scenario: A user signs in

- GIVEN the app has an authenticated user
- WHEN the login flow completes
- THEN analytics identify calls can attach the user id and relevant profile properties

### Analytics boundaries

The system SHALL keep PostHog analytics separate from Sentry error monitoring and application logs.

#### Scenario: An exception occurs

- GIVEN an error must be recorded for diagnosis
- WHEN the app reports the failure
- THEN the event is sent through Sentry instead of analytics
