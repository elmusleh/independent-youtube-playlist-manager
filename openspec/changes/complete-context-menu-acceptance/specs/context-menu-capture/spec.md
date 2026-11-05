# Spec Delta

## Purpose

Let users capture YouTube video IDs from an explicit source into the intended playlist
while preserving privacy, existing edits and recoverable progress across supported browsers.

## ADDED Requirements

### Requirement: Capture uses the clicked source and requested scope

The system SHALL anchor capture to the clicked tab and resolve the seven planned
scopes in stable order, excluding private tabs and non-normal windows from the
all-windows scope. Only valid HTTP(S) YouTube video URLs and IDs SHALL be captured.

#### Scenario: Inactive anchor with multiple windows

- **WHEN** a user invokes an all-windows capture from an inactive tab
- **THEN** valid unique IDs follow anchor-window order, other window IDs ascending,
  and tab-strip order within each window, without private tabs or spoofed hosts

#### Scenario: Unhighlighted selected scope

- **WHEN** selected-tabs capture is invoked from an unhighlighted tab
- **THEN** only the anchor qualifies instead of unrelated highlighted tabs

### Requirement: Destination choice is explicit and bounded

The system SHALL provide a bounded native menu, cached destination labels and a
searchable chooser identifying Local or YouTube targets. Choosing a destination
SHALL NOT add videos. Missing targets SHALL require a choice rather than substitution.
Existing destination, insertion and disable preferences SHALL remain effective.

#### Scenario: Missing favorite while offline

- **WHEN** a configured favorite no longer exists and capture is invoked offline
- **THEN** the chooser explains the missing destination without creating a replacement
  or fetching remote lists merely to construct the native menu

### Requirement: Successful captures survive concurrent edits and retries

The system SHALL preserve durable captures against concurrent playlist or builder
writes. Stale edits SHALL fail visibly without discarding the editor's changes.
Retrying a durably saved capture SHALL NOT create a second destination or duplicate IDs.

#### Scenario: Stale editor and parallel captures

- **WHEN** captures update different playlists while an editor holds an older version
- **THEN** both captures survive and a conflicting editor write preserves its dirty
  state while explaining the conflict

#### Scenario: Restart after a new local playlist was saved

- **WHEN** the worker stops after persistence but before acknowledging completion
- **THEN** retry identifies the original result instead of creating another playlist

### Requirement: Remote changes require consent and reconciliation

The system SHALL require explicit review and Sync before changing a YouTube playlist.
It SHALL preserve confirmed progress and reconcile uncertain requests before retry.
It SHALL NOT silently convert a remote target into a local copy.

#### Scenario: Cancel remote review

- **WHEN** the user cancels before Sync
- **THEN** no remote playlist mutation occurs

#### Scenario: Uncertain remote request after interruption

- **WHEN** a previous request's result cannot be confirmed after restart
- **THEN** the system explains the uncertainty and does not automatically resend it

### Requirement: Page import retains source permissions and options

The system SHALL scan only after explicit invocation, validate the captured source
before and after scanning, retain quantity/order options including zero meaning all,
and offer progress, cancellation and retry without silently expanding permissions.
Cross-origin frame contents SHALL NOT be scanned.

#### Scenario: Native import from a regular article

- **WHEN** the actual native menu imports the non-YouTube fixture using its activeTab grant
- **THEN** the three unique valid IDs are offered for review, excluding duplicates and spoofed URLs

#### Scenario: Source changes or access is denied

- **WHEN** the source navigates, closes, moves or loses required access during import
- **THEN** capture fails safely with an actionable explanation and no unrelated page scan

### Requirement: Tab closing follows durable complete success

Native captures SHALL keep tabs open by default, independently of popup closing.
Optional closing SHALL affect only newly added, unchanged, non-private, unpinned
source tabs after complete durable success. Duplicates and partial remote failures
SHALL NOT close tabs.

#### Scenario: Navigation during a successful save

- **WHEN** a source tab navigates or moves before optional closing
- **THEN** it remains open even when other newly saved unchanged tabs qualify

### Requirement: Saving IDs does not depend on metadata availability

The system SHALL save valid IDs even if metadata providers fail. Metadata work SHALL
be bounded and cancellable, and failed refreshes SHALL preserve existing cached data.
Large destinations SHALL NOT increase native menu size with playlist count.

#### Scenario: Large offline destination

- **WHEN** capture adds IDs to a 14,000-video local playlist with metadata providers unavailable
- **THEN** IDs are durably saved, order and duplicates are handled correctly, and
  metadata failure does not produce a false save failure

### Requirement: Supported browser paths remain usable

Desktop Chrome and Firefox SHALL support actual native capture gestures. The chooser
SHALL retain reachable controls at 320px and 390px with keyboard focus and cancellation.
Firefox Android SHALL retain popup/extension-page paths without a native-menu parity claim.

#### Scenario: Narrow chooser and Android fallback

- **WHEN** the chooser is used at narrow widths or the extension is used on Firefox Android
- **THEN** the supported controls remain usable and unsupported native-menu APIs do not break the fallback
