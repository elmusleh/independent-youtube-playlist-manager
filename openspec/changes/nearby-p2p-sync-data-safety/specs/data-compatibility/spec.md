# Spec Delta

## Purpose

Data compatibility rules keep existing local libraries and user-controlled backups recoverable as the extension evolves across storage, backup, record, and relay versions.

## ADDED Requirements

### Requirement: Backup versions use explicit migration paths

The importer SHALL accept only explicitly supported backup versions and SHALL migrate each supported older version to the current in-memory representation before writing. Unsupported, malformed, or newer versions SHALL be rejected before any local mutation.

#### Scenario: Supported legacy backup imports

- **GIVEN** a valid legacy playlist-array or schema-v1/v2 backup with a registered migration path
- **WHEN** the user imports it
- **THEN** it is normalized to the current representation and imported using the selected merge or overwrite mode

#### Scenario: Future or unmigratable backup is rejected safely

- **GIVEN** a backup has a newer version or a version with no migration implementation
- **WHEN** validation runs
- **THEN** the import is rejected with an upgrade/actionable message before any local store is changed

### Requirement: Backup files exclude credentials and internal sync state

Backup export SHALL include only allowlisted user preferences and user data. Export and import SHALL exclude sync keys, endpoint credentials, access tokens, relay cursors, transient status, and unknown storage keys; importing such fields SHALL NOT replace credentials already configured on the device.

#### Scenario: Export does not include local sync credentials

- **GIVEN** browser storage contains a sync key, relay endpoint configuration, status, and ordinary preferences
- **WHEN** a full JSON backup is exported
- **THEN** it contains the allowlisted preferences but no sync key, endpoint credential, cursor, or transient sync status

#### Scenario: Crafted backup cannot overwrite credentials

- **GIVEN** an otherwise valid backup contains `yph_sync_config` or credential-like fields inside settings
- **WHEN** it is imported in merge or overwrite mode
- **THEN** those fields are ignored and the device's current sync configuration remains unchanged

### Requirement: Local storage upgrades preserve existing records

IndexedDB and browser-storage migrations SHALL be additive, idempotent, and non-destructive. A migration SHALL NOT delete an existing store or key until replacement data is written and verified; a failed migration SHALL remain retryable and SHALL NOT claim completion.

#### Scenario: Existing metadata survives an extension upgrade

- **GIVEN** an older database contains metadata records
- **WHEN** a newer extension opens or upgrades the database
- **THEN** existing records remain readable and any required migration can be safely retried

### Requirement: Legacy relay data is not silently abandoned

A client SHALL NOT report successful setup or create a new v2 sync space as a substitute for a detected legacy snapshot. If legacy data is available, it SHALL be migrated and verified before the old copy is retired; if it is unavailable, the user SHALL receive a clear recovery warning and local data SHALL remain unchanged until the user explicitly chooses how to proceed.

#### Scenario: Legacy snapshot is available

- **GIVEN** a v1 snapshot and its required decryption material are available
- **WHEN** a device upgrades to the v2 record relay
- **THEN** the client decrypts, validates, imports, and verifies the records in v2 before treating migration as complete

#### Scenario: Legacy snapshot is unavailable

- **GIVEN** a v1 client configuration is detected but its legacy relay data cannot be read
- **WHEN** the v2 sync engine starts
- **THEN** it reports the legacy-data recovery state, does not mark the device synchronized, and does not modify local user data

### Requirement: Mixed versions fail visibly rather than overwrite

When peers or relays use incompatible record or protocol versions, the client SHALL reject the incompatible data before applying it and SHALL preserve the local copy for recovery.

#### Scenario: Unknown encrypted record version arrives

- **WHEN** a client receives a record version it cannot decode or migrate
- **THEN** the record is not applied or acknowledged and the user receives a version-compatibility error
