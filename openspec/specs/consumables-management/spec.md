# Archived: consumables-management Specification

## Purpose

Describe the legacy consumable browsing, editing, dashboard, and scope catalog behavior.

## Requirements

### Requirement: Consumable search, dashboard, and editing

The system SHALL allow operators to inspect consumables, search them, and edit their records from the dashboard flow.

#### Scenario: Search consumables

- GIVEN an operator searches for a consumable
- WHEN the search is executed
- THEN matching consumables are listed

#### Scenario: Edit a consumable

- GIVEN the operator opens a consumable record
- WHEN the fields are updated and saved
- THEN the consumable changes are persisted

### Requirement: Scope catalogs

The system SHALL allow the maintenance of the catalogs that support consumable classification and filtering.

#### Scenario: Maintain catalogs

- GIVEN an authorized user opens a catalog screen
- WHEN the user creates or edits a value
- THEN the catalog is updated and available to dependent forms
