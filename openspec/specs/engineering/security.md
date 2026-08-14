# Security

## Purpose

Define security practices for the Orion Mobile codebase.

## Standards

### Authentication and Sessions

- Keep authentication flows explicit and auditable.
- Store only the minimum session state required by the application, using Expo Secure Store on native and `localStorage` only as the web fallback.
- Keep the stored session split into app-owned keys such as `auth.accessToken`, `auth.refreshToken`, `auth.user`, and `onboarding.hasSeenOnboarding`.
- Treat expired or corrupted local auth state as disposable and clear it before continuing.
- Do not expose credentials or tokens in logs, UI messages, or documentation outside controlled examples.
- Use the session-expiry flow to clear auth state and redirect the user through sign-in again.

### Authorization

- Enforce permissions on the client for user experience, but keep server-side validation authoritative.
- Treat UI hiding as convenience, not as security.
- Load route permissions from the backend route-config endpoint before deciding whether to show protected tabs.
- Use route permission checks to hide unsupported tabs and redirect users away from unauthorized routes.

### Data Handling

- Validate user input before sending it to the backend.
- Treat file uploads, images, and local storage content as untrusted.
- Restrict file paths and local storage keys to known safe application namespaces.
