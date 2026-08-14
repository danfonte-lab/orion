# Working Method Specification

## Purpose

Describe the working method used in this repository for specs, changes, and implementation.

## Requirements

### Requirement: Spec-driven work

The system SHALL organize work around specs for current behavior and changes for proposed modifications.

#### Scenario: Planning a change

- GIVEN a new modification is being discussed
- WHEN the team starts planning
- THEN they use a change artifact instead of jumping directly to code

### Requirement: Incremental implementation

The system SHALL encourage incremental work and avoid large rewrites.

#### Scenario: Executing a change

- GIVEN a change is approved for implementation
- WHEN work begins
- THEN the implementation proceeds in small, testable steps

### Requirement: Traceable tasks

The system SHALL keep task breakdowns close to the work they support.

#### Scenario: A change enters execution

- GIVEN a change is ready to build
- WHEN implementation starts
- THEN the task checklist is updated inside the change folder

### Requirement: Story-level execution boundaries

The system SHALL keep task generation tied to story execution rather than discovery.

#### Scenario: A story is selected for implementation

- GIVEN a story has been chosen for execution
- WHEN implementation begins
- THEN task checklists are added or updated only at that time
