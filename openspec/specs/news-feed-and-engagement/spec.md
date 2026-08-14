# News Feed and Engagement Specification

## Purpose

Describe feed pagination, media previews, and reaction behavior.

## Requirements

### Requirement: Feed timeline

The system SHALL allow employees to browse the internal news feed with pagination.

#### Scenario: Load feed

- GIVEN the employee opens the feed
- WHEN the current page loads
- THEN feed posts are displayed in order

#### Scenario: Load the next page

- GIVEN the current feed page has more results
- WHEN the user scrolls to the end
- THEN the next page is loaded and appended

### Requirement: Media previews and reactions

The system SHALL allow employees to inspect media and react to posts.

#### Scenario: Open media

- GIVEN a post has attached media
- WHEN the employee opens it
- THEN the media preview is shown

#### Scenario: React to a post

- GIVEN the employee selects a reaction
- WHEN the action is saved
- THEN the reaction count is updated locally and synchronized with the backend

#### Scenario: Remove a reaction

- GIVEN the employee already reacted to a post
- WHEN the reaction is cleared
- THEN the post updates locally and the backend is synchronized
