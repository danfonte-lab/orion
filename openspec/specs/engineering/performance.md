# Performance

## Purpose

Define performance practices for the Orion Mobile codebase.

## Standards

### General

- Prefer incremental optimization over speculative tuning.
- Measure before changing performance-critical code.
- Keep performance work tied to visible user or operational impact.
- Reuse existing cache and refresh patterns before adding new fetch paths.

### Mobile UI

- Avoid heavy work in render paths.
- Keep state updates predictable and scoped.
- Prefer loading data on demand for screens that do not need everything immediately.
- Use virtualization or pagination for long lists instead of rendering large collections at once.
- Keep expensive derived values behind `useMemo` only when they reduce obvious repeated work.

### Storage and Network

- Keep local storage reads and writes small and intentional.
- Avoid unnecessary network round-trips.
- Prefer compact payloads and pagination for long lists.
- In services, deduplicate requests when a request is already in flight and invalidate caches only when the underlying state changes.
