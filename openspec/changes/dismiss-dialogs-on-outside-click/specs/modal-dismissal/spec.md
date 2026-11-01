# Spec Delta

## Purpose

Modal dialogs should dismiss when the user clicks or taps outside them on the backdrop,
for every dialog size and pointer type, without affecting dialogs that must not be
dismissible.

## ADDED Requirements

### Requirement: Backdrop click dismisses dismissible dialogs of any size

The system SHALL dismiss a dismissible modal dialog when the user clicks the backdrop,
regardless of the dialog's size.

#### Scenario: Standard-sized dialog dismissed by backdrop click

- **WHEN** a user clicks the backdrop of a dismissible `small`, `standard` or `wide`
  dialog
- **THEN** the dialog closes and its close handler runs

#### Scenario: Drawer keeps its existing backdrop dismissal

- **WHEN** a user clicks the backdrop of a `drawer` dialog
- **THEN** the drawer closes and its close handler runs

### Requirement: Non-dismissible dialogs ignore backdrop clicks

The system SHALL NOT dismiss a dialog whose `dismissible` state is false when the user
clicks the backdrop.

#### Scenario: Loading dialog survives a backdrop click

- **WHEN** a user clicks the backdrop of a non-dismissible dialog
- **THEN** the dialog remains open

### Requirement: Backdrop dismissal cancels, never confirms

Backdrop dismissal SHALL follow the cancel/close path and SHALL NOT trigger a confirm
action.

#### Scenario: Confirmation dialog dismissed via backdrop cancels

- **WHEN** a user clicks the backdrop of a confirmation dialog
- **THEN** the cancel handler runs and the confirm handler does not

### Requirement: Backdrop dismissal works for mouse and touch

The system SHALL dismiss on backdrop interaction for both mouse click and touch tap,
across screen sizes and devices.

#### Scenario: Touch tap dismisses

- **WHEN** a user taps the backdrop on a touch device
- **THEN** the dialog closes and its close handler runs

### Requirement: Interactions beginning inside do not dismiss

The system SHALL NOT dismiss a dialog when the interaction starts inside the dialog and
ends on the backdrop.

#### Scenario: Drag-selection does not dismiss

- **WHEN** a user presses inside the dialog and releases on the backdrop
- **THEN** the dialog remains open
