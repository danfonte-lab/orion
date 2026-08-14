# Archived: reporting-and-drill-down Specification

## Purpose

Describe the legacy report browsing and drill-down inspection behavior.

## Requirements

### Requirement: Drill-down reports

The system SHALL allow users to open reports and inspect detail views from summary results.

#### Scenario: Open a report

- GIVEN a report is available to the user
- WHEN the report opens
- THEN the summary view is displayed

#### Scenario: Inspect drill-down data

- GIVEN the report supports drill-down
- WHEN the user opens a detail row
- THEN the corresponding detailed data is shown
