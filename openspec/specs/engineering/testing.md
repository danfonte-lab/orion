# Testing

## Purpose

Define the testing approach for the Orion Mobile codebase.

## Standards

### Mobile

- Prefer unit tests for isolated business rules, selectors, services, and helpers.
- Use component tests when UI behavior can be validated without a device.
- Cover happy paths, validation failures, permission-sensitive branches, and cache-invalidation flows.
- Mock API clients, secure storage, analytics, and device APIs instead of reaching real services.

### Shared Logic

- Every new requirement should ship with tests that prove the acceptance criteria.
- Tests should describe behavior, not implementation details.
- Keep test names explicit and scenario-driven.
- Prefer deterministic fixtures and local test data over live backend dependencies.

## Quality Rules

- Arrange-Act-Assert is the preferred structure.
- One behavior per test when possible.
- Use deterministic data and avoid time-sensitive randomness unless the scenario needs it.
- Keep tests close to the code they exercise.
- At the moment, `package.json` exposes linting and build scripts but no dedicated test runner, so add one before relying on automated coverage in this repo.
