# Design: Migrate the Legacy Engineering Framework to OpenSpec

## Technical Approach

Use the existing repository structure as the migration target:

- `openspec/specs` stores baseline behavior by module.
- `openspec/changes/<change-name>/` stores proposals, design notes, tasks, and delta specs for future work.
- `openspec/system-specs.md` provides a single backlog/status index.
- `.agents/AGENTS.md` defines the repository rules for AI-assisted work.

## Decisions

### Decision: Replace hierarchy documents with module specs

The old Epic/Feature/Story/Task planning model is removed because OpenSpec organizes requirements by current behavior and proposed deltas.

### Decision: Keep the backlog index at the root

`openspec/system-specs.md` remains at the root of the OpenSpec workspace so contributors can quickly find the current module specs and their development state.

### Decision: Delete the legacy framework artifacts

Legacy framework documents are archived after migration to avoid ambiguity about which process is authoritative.

## File Changes

- `openspec/system-specs.md` (new)
- `.agents/AGENTS.md` (new)
- `openspec/specs/**/spec.md` (new module specs)
- `openspec/changes/migrate-legacy-framework/proposal.md` (new)
- `openspec/changes/migrate-legacy-framework/design.md` (new)
- `openspec/changes/migrate-legacy-framework/tasks.md` (new)
- Legacy `openspec` framework files archived
