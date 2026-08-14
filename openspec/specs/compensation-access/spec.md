# Compensation Access Specification

## Purpose

Describe secure payslip access behavior.

## Requirements

### Requirement: Protected payslip access

The system SHALL allow employees to unlock and browse payslips securely.

#### Scenario: Unlock payslips

- GIVEN the employee authenticates the device or protected view
- WHEN access is granted
- THEN the latest and historical payslips become visible

#### Scenario: Browse payslips safely

- GIVEN the payslip list is visible
- WHEN the employee reviews amounts
- THEN sensitive values remain masked when visibility is disabled

#### Scenario: Open a payslip document

- GIVEN a payslip entry has a file URL
- WHEN the employee taps the item
- THEN the corresponding document opens in the browser or device viewer
