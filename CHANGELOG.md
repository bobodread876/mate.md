# Changelog

## 0.6.0 (2026-06-10)

### Added — typed lifecycle events & private history

- `Transition.type` (e.g. `"bond.reaffirmed"`): kind 1317 events can carry
  their lifecycle event type as a second queryable `t` tag (extension §5.2)
  and a `type` field in the content record. Reaffirmation — the author
  choosing the bond again (`from: "active", to: "active"`) — is the longevity
  signal the protocol exists to make legible.
- `buildPrivateBondHistoryEvents` — gift-wrapped kind 1317 rumors
  (counterparty + copy-to-self) so private bonds get lifecycle history without
  touching the public graph (extension §13.6b). History rumors carry a
  transition record, not a document, so the §13.3 embedded-proof rule does
  not apply; the verified seal authenticates them for the two parties.

## 0.5.0 (2026-06-09)

### Added — private bonds (NIP-44 / NIP-59)

- **Private bond transport** (`docs/extension-nostr.md` §13): bonds can now be
  gift-wrapped instead of published publicly. The kind 30317/1317 event stays an
  unsigned NIP-59 *rumor*, sealed (kind 13, signed by the real author) and
  gift-wrapped (kind 1059, signed by a one-time key) once for the counterparty
  and once for the author (copy-to-self). Relays see only an ephemeral author,
  the recipient's `p` tag, and a fuzzed timestamp — no bond id, state,
  counterparty linkage, or `t=mate-bond` discriminator.
- `src/nip44.ts` — NIP-44 v2 encryption (secp256k1 ECDH → HKDF-SHA256 →
  ChaCha20 + HMAC-SHA256), verified against the official test vectors
  (`fixtures/vectors/nip44.vectors.json`, checksum pinned in the NIP). One new
  dependency: `@noble/ciphers`.
- `src/giftwrap.ts` — NIP-59 `createRumor` / `sealRumor` / `wrapSeal` /
  `wrapRumor` / `unwrapGiftWrap` (authenticating seal signature, author match,
  and rumor id), plus bond-level `buildPrivateBondEvents` and
  `selectBondRumors`.
- `signMateDocumentNostr` — detached `BIP340Signature2026` proof over the
  canonical document for `did:nostr` identities (SPEC §12.3), the counterpart
  of the Ed25519 `signMateDocument`. **Private bonds require an embedded
  document proof** — rumors are unsigned, so the embedded proof is the only
  authorship evidence that survives disclosure; `buildPrivateBondEvents`
  enforces this and appends `proofs` to the encrypted content.
- CLI: `mate nostr-bond --private` (sign + wrap + publish both gift wraps) and
  `mate nostr-inbox --key <keyfile>` (fetch kind 1059 by `#p`, unwrap,
  authenticate, and project bond rumors).

### Changed (spec conformance — breaking for local documents with proofs)

- Proof objects now use `proofValue` (SPEC §12.1) instead of the legacy
  `value` field; `algorithm` is now optional profile metadata derived from the
  proof `type`. Schema, fixtures, and both signers updated. Signatures
  themselves are unaffected (`proofs` is excluded from canonical bytes), but
  documents written with the old field name need the key renamed to
  re-validate. Published Nostr events are unaffected (canonical content never
  included `proofs`).

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
