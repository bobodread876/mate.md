# Changelog

All notable changes to MATE.md are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); the protocol/schema version is the
authoritative version number.

## [Unreleased]

_Nothing yet. Candidate work is listed in `AGENTS.md` → "Next agent — start here"._

## [0.2.0] — 2026-06-03

First strict, reference-backed release. **Breaking** vs v0.1 — v0.1 documents do not
validate; see [`docs/migration-v0.1-to-v0.2.md`](docs/migration-v0.1-to-v0.2.md).

### Added
- Normative state machine in `SPEC.md`: 10 states (`none`, `proposed`, `accepted`,
  `active`, `paused`, `revoked`, `withdrawn`, `rejected`, `expired`, `archived`) with
  authorship rules and invariants.
- Canonicalization rules (frontmatter-only, core minus `proofs`, NFC, timestamp
  normalization, null omission).
- Two mandatory proof profiles: `Ed25519Signature2026` (`did:key`, RFC 8032) and
  `BIP340Signature2026` (`did:nostr`, BIP-340 Schnorr; npub→x-only via NIP-19).
- Reference implementation `@mate-protocol/core`: `parse`, `normalize`, `validate`,
  real signature `verify`, `did:key` + `did:nostr` resolution, and a `mate` CLI.
- Conformance suite: 23 fixtures (valid + invalid) with `fixtures/manifest.json` and
  pre-computed signature test vectors for both DID methods.
- GitHub Actions CI (`.github/workflows/ci.yml`): build + `vitest run` + `validate-all`.
- `AGENTS.md` source-of-truth & handoff guide; this `CHANGELOG.md`.

### Changed
- Schema bumped `^0.1` → `^0.2`; core objects are now strict
  (`additionalProperties: false`); `extensions` is the sole open map (reverse-DNS keys).
- `EXTENSION-NOSTR.md` moved to `docs/extension-nostr.md` and marked draft.
- Examples migrated to v0.2.
- `package-lock.json`: corrected stale `mate` bin path to `dist/src/cli.js`.

### Quality bar at release
Clean `tsc` build · 28/28 tests · 23/23 fixtures · CI green.

[Unreleased]: https://github.com/bobodread876/mate.md/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/bobodread876/mate.md/releases/tag/v0.2.0
