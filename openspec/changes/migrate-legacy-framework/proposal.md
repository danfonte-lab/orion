# Proposal: Migrate the Legacy Engineering Framework to OpenSpec

Status: Completed

## Intent

Replace the legacy Engineering framework with an OpenSpec workspace that uses specs as the source of truth and a separate change folder for proposed modifications.

## Scope

In scope:

- Rename the framework directory to `openspec`.
- Add an `openspec/system-specs.md` file that acts as the live backlog index.
- Model product knowledge as module-based specs instead of Epic, Feature, Story, and Task documents.
- Add a `.agents` folder at the repository root for AI agent rules.
- Move legacy framework content into archived references after migration.

Out of scope:

- Changing product behavior.
- Rewriting the application architecture.
- Introducing new product requirements beyond the current baseline.

## Approach

Create module-level baseline specs under `openspec/specs`, keep proposed work under `openspec/changes`, and use `openspec/system-specs.md` as the human-readable backlog and status index.
