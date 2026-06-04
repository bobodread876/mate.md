# Changelog

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
