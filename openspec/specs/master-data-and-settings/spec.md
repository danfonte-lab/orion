# Archived: master-data-and-settings Specification

## Purpose

Describe the legacy catalogs and settings that supported mobile and backend workflows.

## Requirements

### Requirement: Asset master data maintenance

The system SHALL allow the maintenance of asset catalog records and supporting lookup values.

#### Scenario: Maintain asset catalogs

- GIVEN an authorized user opens a catalog screen
- WHEN the user creates or edits a value
- THEN the catalog is updated and available to dependent forms

### Requirement: Organizational catalogs

The system SHALL support organizational catalogs that keep location, region, site, and similar data aligned.

#### Scenario: Maintain organizational catalogs

- GIVEN an administrator manages organizational data
- WHEN changes are saved
- THEN the updated values are available to the system
