# Logging

## Purpose

Define logging practices for the Orion Mobile codebase.

## Standards

### App Logging

- Use structured logs instead of string concatenation when logging diagnostics.
- Log at the right level: information for expected milestones, warning for recoverable issues, error for failed operations, critical for unrecoverable failures.
- Avoid logging secrets, session tokens, raw credentials, or large unfiltered payloads.

### Error Monitoring

- Use Sentry for exception capture and error monitoring.
- Keep monitoring events useful for diagnosis without becoming noisy.
- Prefer one clear log entry per meaningful event rather than repeated chatter.
- Log exceptions with enough context to debug network, storage, or integration failures.
