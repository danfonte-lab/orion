# Schedule Management Specification

## Purpose

Describe personal schedule, team schedule, and direct report drill-down behavior.

## Requirements

### Requirement: Personal weekly schedule

The system SHALL show the employee's current weekly schedule.

#### Scenario: Open personal schedule

- GIVEN the employee opens the schedule screen
- WHEN the current week loads
- THEN the employee sees their personal schedule

### Requirement: Team weekly schedule and drill-down

The system SHALL allow authorized users to review the team schedule and open a direct report's schedule.

#### Scenario: Open team schedule

- GIVEN the user is allowed to view team schedules
- WHEN the team schedule screen loads
- THEN the current team's schedule is shown

#### Scenario: Open a team member schedule

- GIVEN a direct report is visible in the team list
- WHEN the user opens that person's schedule
- THEN the schedule view switches to that team member
