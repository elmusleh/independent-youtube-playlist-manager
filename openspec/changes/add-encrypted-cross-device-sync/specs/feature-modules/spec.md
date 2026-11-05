# Spec Delta

## Purpose

A registry of toggleable optional features (modules) with a Plugins screen, so users can
enable or disable features such as API Setup without losing their data.

## ADDED Requirements

### Requirement: Module registry with persisted state

The system SHALL maintain a registry of optional feature modules, each with a stable id,
a display label and an enable/disable state that persists across restarts.

#### Scenario: Toggling persists

- **WHEN** a user toggles a module's enable/disable state
- **THEN** the new state is persisted and applied

#### Scenario: State survives restarts

- **WHEN** the app restarts
- **THEN** each module's state matches the user's last choice

### Requirement: Plugins entry point in the sidebar footer

The system SHALL provide a Plugins entry in the sidebar footer that opens a screen
listing all modules with their toggles.

#### Scenario: Plugins entry opens the module list

- **WHEN** the user clicks the Plugins entry in the sidebar footer
- **THEN** a screen listing all toggleable modules is shown

#### Scenario: Module setup is reachable from the list

- **WHEN** a module has additional configuration
- **THEN** that configuration is reachable from the same screen

### Requirement: API Setup is a toggleable module

The API Setup feature SHALL be a module in the registry. When disabled, its navigation
entry and route SHALL be hidden.

#### Scenario: Disabling hides the entry and route

- **WHEN** the user disables the API Setup module
- **THEN** its sidebar entry disappears and its direct URL no longer opens the page

#### Scenario: Re-enabling restores the feature

- **WHEN** the user re-enables the API Setup module
- **THEN** the entry and route return with the existing missing-credential warning intact

### Requirement: Disabling never deletes data

Disabling a module SHALL never delete or modify the data that module manages.

#### Scenario: Data survives a disabled module

- **WHEN** a module is disabled
- **THEN** the local data it manages remains stored unchanged

#### Scenario: Re-enabled module sees the same data

- **WHEN** the module is re-enabled
- **THEN** it operates on the same data as before it was disabled
