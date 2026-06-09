# Changelog

## Unreleased

_Nothing yet._

## 0.4.0 (2026-06-09)

### Changed (breaking on the Nostr transport)

- Bond events (kinds 30317 + 1317) now carry a constant single-letter discriminator tag `["t", "mate-bond"]`, and bond resolution filters by `#t: ["mate-bond"]`. Kinds 30317/1317 are not allocated in the NIP kind registry, so unrelated apps may reuse them; the `t` tag (NIP-12 indexed, unlike the informational multi-letter `mate` tag) lets clients resolve only MATE bonds and ignore such collisions. Exported as `BOND_TAG`. **Bonds published before 0.4.0 lack the tag and will not resolve under the new `#t` filter — re-publish them.** Event content/canonicalization and proofs are unchanged (the tag is event-level, not part of the signed document).

## 0.3.0 (2026-06-08)

First npm release of `@mate-protocol/core`. Adds the produce side of proofs and
the Nostr transport on top of the v0.2.0 spec.

### Added
- CLI key lifecycle: `mate keygen` (generate an Ed25519 `did:key` identity +
  secret keyfile), `mate sign <file> --key <keyfile>` (append a detached
  `Ed25519Signature2026` proof over the canonical document), and `mate verify
  <files...>` (check every proof). Library exports `generateEd25519Keypair`,
  `didKeyFromEd25519PublicKey`, and `signMateDocument`. This completes the
  produce side of proofs (v0.2.0 shipped verify-only).
- Nostr transport (implements `docs/extension-nostr.md` / draft NIP-BD): `mate
  keygen --nostr` (secp256k1 `did:nostr` / npub / nsec identity), `mate
  nostr-publish` (publish a bond as kind `30317` current state + optional `1317`
  history), `mate nostr-resolve` (query relays by author / counterparty / bond,
  verifying each event signature), and `mate nostr-bond` (assemble + sign +
  publish a bond straight from flags, no `.md` file). New `src/nostr.ts` module
  (event id + Schnorr signing + WebSocket publish/resolve) with **zero new
  dependencies** — built-in `WebSocket` + existing `@noble`/`@scure` libs.
  `relay.islandbitcoin.com` leads the default relay list.

### Fixed
- `examples/openclaw/MATE.md` used a bare `extensions.rituals` key, which fails
  validation (reverse-DNS required). Renamed to `org.openclaw.rituals`.

## v0.2.0 (2026-06-03)

### Spec
- Full normative rewrite of `SPEC.md` (649 lines, +440/-224)
- 10-state machine: `none → proposed → accepted → active ↔ paused → revoked → archived`, plus pre-acceptance terminals `withdrawn`, `rejected`, `expired`
- RFC 2119 conformance language throughout
- Canonicalization rules (§11): JCS-based JSON, sorted keys, timestamp normalization (ISO 8601 UTC, microsecond precision), null-omission, Unicode NFC
- Two mandatory proof profiles (§12): `Ed25519Signature2026` and `BIP340Signature2026`
- Four validation levels (§13): schema, single-doc (incl. real crypto verification), history-aware, mutual-bond
- `did:nostr` ABNF + NIP-19 resolution (§5.4) — self-contained, no relay query
- Schema `mate.schema.json` v0.2: strict core (`additionalProperties: false`), `extensions` sole open map

### Reference Implementation (`@mate-protocol/core`)
- `parse.ts` — YAML frontmatter extraction via gray-matter with restricted YAML (no aliases/tags)
- `normalize.ts` — Deterministic canonical JSON per SPEC §11
- `validate.ts` — ajv schema pass + semantic invariants + real Ed25519 and BIP-340 signature verification via `@noble/ed25519` and `@noble/secp256k1`
- `did.ts` — `did:key` (Ed25519 multicodec) and `did:nostr` (npub bech32) resolution
- `cli.ts` — `mate validate` and `mate inspect` commands via commander
- `types.ts` — Full TypeScript interfaces matching the v0.2 schema

### Conformance
- 34 passing tests (Vitest), 27/27 fixtures in manifest
- 12 valid fixtures including real Ed25519-signed and BIP-340-signed documents
- 11 invalid fixtures including bad signatures, missing fields, wrong types
- Pre-computed key vectors for both proof profiles
- GitHub Actions CI: build + test + validate-all

### Documentation
- `CONFORMANCE.md` — 52-item normative requirement matrix
- `docs/migration-v0.1-to-v0.2.md`
- `docs/extension-nostr.md` — experimental Nostr transport adapter (moved from root)
- README updated with badges, quickstart, adoption checklist
- Examples bumped to v0.2 format

### Infrastructure
- GitHub Actions CI workflow
- v0.2.0 npm package published as `@mate-protocol/core`
- GitHub tag `v0.2.0`
