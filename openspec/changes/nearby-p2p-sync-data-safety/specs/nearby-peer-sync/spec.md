# Spec Delta

## Purpose

Nearby peer sync transfers IYPM records directly between two nearby supported browsers without a cloud relay or internet signaling service.

## ADDED Requirements

### Requirement: Nearby connections are strictly local

Nearby sync SHALL establish a direct peer data channel without configuring STUN, TURN, rendezvous, or hosted relay services. It SHALL NOT fall back to a remote backend when local connection fails.

#### Scenario: Same-LAN transfer works with internet unavailable

- **GIVEN** both devices are on a reachable Wi-Fi or hotspot network and the Sync page is open on each
- **WHEN** the user completes nearby pairing
- **THEN** the devices exchange data directly while making no external signaling or relay requests

#### Scenario: Network blocks peer-to-peer traffic

- **GIVEN** a guest network or access-point isolation prevents device-to-device traffic
- **WHEN** the connection attempt times out or fails
- **THEN** the UI explains that the local network may block peer traffic and does not send data through the cloud

### Requirement: Pairing invitations are temporary and contain no durable sync secret

A nearby invitation SHALL be one-use and expire within five minutes. It MAY contain WebRTC offer/answer data and a random session identifier, but SHALL NOT contain the sync key, playlist data, or credentials in a URL, QR payload, log, or analytics event.

#### Scenario: User creates a nearby invitation

- **WHEN** the user starts a session
- **THEN** the app displays a locally generated QR invitation and a manual transfer fallback that expire after five minutes

#### Scenario: Invitation is expired, reused, or malformed

- **WHEN** a device submits an invalid invitation
- **THEN** the attempt is rejected before any library data is read or changed

### Requirement: Both users verify the peer before data transfer

Before sending sync records or a sync key, each device SHALL display the same short authentication phrase derived from the negotiated peer identities and require explicit confirmation on both devices.

#### Scenario: Peer verification succeeds

- **GIVEN** both devices display the same verification phrase
- **WHEN** both users confirm the phrase
- **THEN** the data channel may proceed to the sync-space compatibility check

#### Scenario: Peer verification is rejected

- **WHEN** either user rejects or the phrases differ
- **THEN** the session closes without sending records or changing local data

### Requirement: Sync-space identity is checked before applying peer data

Before any record is applied, peers SHALL verify the protocol version, supported record version, sync-space identity, and negotiated content categories. A device without a sync key MAY receive it only over the already verified data channel, after explicit consent; the durable key SHALL never be embedded in the invitation.

#### Scenario: Sync keys identify the same space

- **WHEN** both peers report the same derived sync-space identity and supported protocol versions
- **THEN** the session may exchange the selected encrypted records

#### Scenario: Sync keys or protocol versions differ

- **WHEN** the derived identities differ or either peer uses an unsupported protocol version
- **THEN** the session stops with an actionable compatibility error and leaves local data unchanged

### Requirement: Peer sync preserves end-to-end record encryption and merge semantics

Every record sent over Nearby sync SHALL use the existing authenticated record encryption and current merge/tombstone rules. The peer exchange SHALL compare record inventories, exchange missing or changed records, and apply a durable local write before acknowledging that record.

#### Scenario: Secret record content is transferred

- **WHEN** a record containing private playlist data is sent
- **THEN** the transmitted record payload is encrypted and the plaintext title is absent from the data-channel message

#### Scenario: Local apply fails or the connection drops

- **WHEN** record validation, decryption, or persistence fails
- **THEN** that record remains unacknowledged and retryable, and the session reports partial failure without marking it synchronized

### Requirement: Nearby sync is foreground-only and user-visible

Nearby sync SHALL be an explicit, on-demand session requiring both Sync pages to remain open. The UI SHALL state that the devices must be nearby on the same reachable Wi-Fi/hotspot and that background sync is not provided by this mode.

#### Scenario: Session completes

- **WHEN** both peers finish exchanging and applying records
- **THEN** both show the session result and changed-record counts, then release the temporary connection state

#### Scenario: User cancels

- **WHEN** either peer cancels the session
- **THEN** the channel closes, temporary invitation material is discarded, and already-applied records remain valid while unacknowledged records remain retryable
