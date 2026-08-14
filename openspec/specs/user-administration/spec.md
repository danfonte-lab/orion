# Archived: user-administration Specification

## Purpose

Describe the legacy user listing, editing, and role assignment behavior.

## Requirements

### Requirement: User list and editing

The system SHALL allow administrators to browse users, edit user records, and manage role assignments.

#### Scenario: List users

- GIVEN an administrator opens the user screen
- WHEN the list loads
- THEN the configured users are displayed

#### Scenario: Edit a user

- GIVEN a user record is open
- WHEN the administrator updates the user information
- THEN the changes are saved

#### Scenario: Assign roles

- GIVEN a user has role assignments to change
- WHEN the administrator updates them
- THEN the new role set is persisted
