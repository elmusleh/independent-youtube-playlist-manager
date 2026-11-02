# Spec Delta

## Purpose

Pluggable storage backends for encrypted sync snapshots, so users can choose where
their data lives: a local file, their own Supabase project, or their Google Drive.

## ADDED Requirements

### Requirement: Uniform backend contract

Every sync backend SHALL implement the same operations — store a snapshot, fetch the
latest snapshot, and read the latest revision — behind one interface, so the sync engine
behaves identically regardless of the selected backend.

#### Scenario: Engine treats backends identically

- **WHEN** the engine stores a snapshot on any enabled backend
- **THEN** it performs the same operation sequence regardless of backend

#### Scenario: New backends require no engine changes

- **WHEN** a new backend implementation is added
- **THEN** the sync engine requires no changes to use it

### Requirement: File backend

The system SHALL provide a file backend that exports the encrypted snapshot to a local
file and imports one back.

#### Scenario: Export produces an encrypted file

- **WHEN** the user exports via the file backend
- **THEN** a file containing the encrypted snapshot is produced

#### Scenario: Import restores from a valid file

- **WHEN** the user imports a valid encrypted snapshot file with the correct sync key
- **THEN** local data is restored from it

### Requirement: Bring-your-own Supabase backend

The system SHALL let the user supply their own Supabase project URL and anonymous key
and store encrypted snapshots in that project, with step-by-step schema instructions.
No Supabase traffic SHALL occur unless the user has configured it.

#### Scenario: Valid configuration syncs to the user's project

- **WHEN** the user enters valid Supabase credentials and the schema exists
- **THEN** encrypted snapshots upload to their project

#### Scenario: Invalid or incomplete configuration fails clearly

- **WHEN** credentials are invalid or the schema is missing
- **THEN** the user receives a clear, actionable error and no data is sent

#### Scenario: Unconfigured Supabase stays silent

- **WHEN** the user has not configured Supabase
- **THEN** the system performs no Supabase network requests

### Requirement: Google Drive backend

The system SHALL store encrypted snapshots in the user's private per-app Google Drive
folder (`appDataFolder`) using the existing Google sign-in. No Drive traffic SHALL occur
unless the user has authorized it.

#### Scenario: Authorized device writes to the app-data folder

- **WHEN** the user authorizes the Drive backend
- **THEN** snapshots are written only to the private app-data folder

#### Scenario: Second device reads the same snapshot

- **WHEN** a second device uses the same sync key and the same Google account
- **THEN** it reads the same encrypted snapshot

#### Scenario: Unauthorized Drive stays silent

- **WHEN** the user has not authorized Drive
- **THEN** the system performs no Drive network requests

### Requirement: Backend independence and disabling

Each backend SHALL be independently enabled and disabled, and a disabled backend SHALL
produce no network or storage activity.

#### Scenario: Disabled backend is skipped

- **WHEN** a backend is disabled
- **THEN** sync skips it and makes no requests to it

#### Scenario: Re-enabled backend resumes

- **WHEN** a disabled backend is re-enabled
- **THEN** sync resumes using that backend
