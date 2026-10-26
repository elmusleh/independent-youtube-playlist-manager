# Version 1.1.1

Includes all responsive, accessibility, pagination and reliability improvements
described in [the 1.1.0 candidate notes](RELEASE_1.1.0.md).

The 1.1.0 Firefox candidate was withdrawn before approval because its data
declaration incorrectly said no data was transmitted. This replacement declares
video-link/metadata requests and asks separately for optional account and search
consent. Account tokens and background SDK requests cannot bypass missing consent;
revocation closes existing cloud subscriptions and refresh timers. Chrome privacy
disclosures and the privacy policy now describe local data handling and external
feature requests accurately.

See [release readiness](RELEASE_READINESS.md) for validation and store outcomes.
