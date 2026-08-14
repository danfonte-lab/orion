# OpenSpec

This directory is the source of truth for the Orion Mobile OpenSpec workspace.

## Minimum reading

1. [Repo rules](../.agents/AGENTS.md)
2. [System specs backlog](./system-specs.md)
3. [Specs index](./specs/README.md)
4. [Project overview](./specs/project-overview/spec.md)
5. [Working method](./specs/working-method/spec.md)
6. [Architecture baseline](./specs/architecture-baseline/spec.md)
7. [Changes folder](./changes/) when working on a proposal

## Workspace

`openspec/specs/` describes the current behavior of the system.

`openspec/changes/` describes proposed modifications before they are implemented.

`openspec/system-specs.md` is the repository-wide backlog and status index.

## Current product areas

- Authentication and access control.
- Schedule management.
- Task inbox and notifications.
- Profile and settings.
- Compensation access.
- News feed and engagement.

## Writing Rules

- Keep documents short and focused.
- Avoid duplicating the same information across files.
- Only describe behavior that is implemented today in `openspec/specs/`.
- Put proposed work in `openspec/changes/`.
- Update the documentation in the same pull request that changes relevant behavior.
