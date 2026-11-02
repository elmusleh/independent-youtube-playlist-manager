# Spec Delta

## Purpose

Zero-knowledge, automatic cross-device sync of the user's playlists, metadata, history
and settings, protected by a sync-key-only identity and end-to-end encryption.

## ADDED Requirements

### Requirement: Sync key is the sole credential

The system SHALL let a user create a sync key and use it as the only credential for
cross-device sync. The system SHALL NOT require or store an email address, password, or
any personal identifier in order to sync.

#### Scenario: First enablement generates and shows the key once

- **WHEN** a user enables cloud sync for the first time
- **THEN** the system generates a sync key and shows it exactly once with a prominent
  warning to keep it safe

#### Scenario: Same key unlocks sync on a second device

- **WHEN** the same sync key is entered on a second device
- **THEN** that device reads and writes the same synced data as the first device

#### Scenario: Wrong key fails safely

- **WHEN** a user enters an incorrect sync key
- **THEN** sync fails with a clear error and no local data is modified

### Requirement: End-to-end encrypted payloads

The system SHALL encrypt every sync payload on the device, using a key derived solely
from the sync key, before the payload is transmitted to or stored by any backend.

#### Scenario: Stored payloads contain no plaintext

- **WHEN** a snapshot is written to any backend
- **THEN** the stored bytes contain no plaintext playlist, metadata or settings data

#### Scenario: Tampering is detected

- **WHEN** an encrypted payload is modified or corrupted after encryption
- **THEN** decryption fails and the payload is rejected without touching local data

#### Scenario: Distinct keys are cryptographically isolated

- **WHEN** two different sync keys are used
- **THEN** they derive different encryption keys and different storage addresses

### Requirement: Deterministic storage identity without personal data

The system SHALL derive the storage location for a user's snapshots from a one-way hash
of the sync key, and SHALL NOT transmit any email, name or other personal identifier to
a sync backend.

#### Scenario: Two devices resolve the same storage location

- **WHEN** the same sync key is used on two devices
- **THEN** both devices read and write the same storage location

#### Scenario: Backend records carry no personal identifiers

- **WHEN** a snapshot is uploaded to a backend
- **THEN** the stored record contains no email, name or other personal identifier

### Requirement: Automatic sync

The system SHALL sync automatically: a debounced push after local changes, a pull when
the app starts, and a manual "Sync now" action. The system SHALL NOT require a manual
export or import per change.

#### Scenario: Edits are pushed without manual action

- **WHEN** a user edits local data and leaves it idle for the debounce period
- **THEN** the change is pushed to every enabled backend without further user action

#### Scenario: Startup pulls newer remote data

- **WHEN** the app starts and a newer remote snapshot exists
- **THEN** the snapshot is downloaded and applied subject to the conflict policy

#### Scenario: Manual sync on demand

- **WHEN** a user triggers "Sync now"
- **THEN** a push and a pull complete and their results are shown

### Requirement: Conflict resolution and pre-import safety

The system SHALL resolve conflicts by monotonic revision, applying the newer snapshot,
and SHALL create a local pre-import backup before applying any remote snapshot.

#### Scenario: Newer remote snapshot is applied

- **WHEN** a remote snapshot has a newer revision than the local state
- **THEN** it is applied and the local state is backed up first

#### Scenario: Older remote snapshot is ignored

- **WHEN** a remote snapshot has an older revision than the local state
- **THEN** it is ignored and local state is left unchanged

#### Scenario: Failed import leaves data recoverable

- **WHEN** applying a remote snapshot fails partway
- **THEN** local state remains intact and recoverable from the pre-import backup

### Requirement: Selectable sync content

The system SHALL let the user choose which data categories are included in sync:
playlists, video metadata, thumbnails, watch history, and settings.

#### Scenario: Excluding a category

- **WHEN** the user disables a sync category
- **THEN** the next snapshot excludes that category

#### Scenario: Re-including a category

- **WHEN** the user re-enables a sync category
- **THEN** the next snapshot includes that category

### Requirement: Key loss is unrecoverable and disclosed

The system SHALL provide no recovery path for a lost sync key and SHALL disclose this
consequence before the key is first shown.

#### Scenario: Generation warns about key loss

- **WHEN** the sync key is generated
- **THEN** the user sees an explicit warning that losing the key makes synced data
  unrecoverable

#### Scenario: Lost key cannot be recovered

- **WHEN** a sync key is lost
- **THEN** no feature of the system can recover the encrypted data
