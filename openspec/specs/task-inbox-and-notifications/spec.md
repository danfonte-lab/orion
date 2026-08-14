# Task Inbox and Notifications Specification

## Purpose

Describe pending task counts, notification entry points, and task detail behavior.

## Requirements

### Requirement: Pending task counts and notifications

The system SHALL expose a notifications badge and pending task counts.

#### Scenario: Task count is visible

- GIVEN the user has pending tasks
- WHEN the header renders
- THEN the notifications entry point shows the pending count

#### Scenario: Task count is refreshed

- GIVEN the user is signed in
- WHEN the app refreshes task data
- THEN the pending count uses the latest task response

### Requirement: Task list and details

The system SHALL let users open the task list and inspect task details.

#### Scenario: Open task details

- GIVEN a task is visible in the list
- WHEN the user opens it
- THEN the detail view is displayed

#### Scenario: Notifications deep link to a task

- GIVEN a notification points to a task
- WHEN the user opens the notification entry
- THEN the app opens the matching task detail screen
