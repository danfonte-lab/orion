# Coding Standards

## Purpose

Define the coding standards for the Orion Mobile codebase.

## Stack Awareness

- Mobile: Expo SDK 55, React Native 0.83, and TypeScript 5.9.
- Navigation: Expo Router with route groups and React Navigation primitives.
- Styling: NativeWind + Tailwind tokens.
- HTTP: Axios.
- Monitoring: Sentry.
- Analytics: PostHog.

## Standards

### TypeScript

- Prefer clear, explicit names over abbreviations.
- Keep components and hooks focused on one responsibility.
- Use typed models and avoid `any` unless a boundary requires it.
- Use nullable values intentionally and avoid suppressing warnings without a reason.
- Prefer narrow types at module boundaries and normalize API payloads close to the service that reads them.

### React Native

- Keep screens small and composable.
- Encapsulate network, storage, and device-specific logic behind services or hooks.
- Prefer predictable UI state and simple component boundaries.
- Prefer `useEffect` for data loading and side effects, and keep render paths free of extra work.
- Use `useCallback` or `useMemo` only when they make a dependency boundary or rerender pattern clearer.

### App Structure

- Keep feature code close to the owning route or domain folder.
- Avoid creating shared abstractions until they are proven necessary.
- Prefer small, domain-oriented files over large catch-all modules.
- Keep route groups, screen files, and shared UI components aligned with Expo Router conventions.
- Respect the generated typed route names from `app.json` and avoid hardcoding route shapes that fight the router.
