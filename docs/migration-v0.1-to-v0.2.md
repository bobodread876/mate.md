# Migration Guide: v0.1 → v0.2

## What Changed

| Area | v0.1 | v0.2 |
|------|------|------|
| Schema | permissive (`additionalProperties: true` everywhere) | strict core (`additionalProperties: false` on top-level, subject, object, bond, consent, events, runtime) |
| State machine | 7 states | 10 states — added `withdrawn`, `rejected`, `expired` (pre-acceptance terminals) |
| Proofs | optional, shape-only guidance | two mandatory proof profiles (Ed25519Signature2026, BIP340Signature2026) |
| Canonicalization | not specified | Section 11 defines normative canonical JSON form |
| DID resolution | recommended, no detail | `did:key` and `did:nostr` both mandatory-to-implement with concrete resolution rules |
| Validation levels | not specified | Four levels defined; Levels 1-2 in scope for v0.2 |
| Identity | loose "SHOULD support" | Section 5.3-5.4 tightens to mandatory `did:key` + `did:nostr` |
| Extensions | no namespace rules | Reverse-DNS namespacing required (Section 14.1) |
| mate_version | `^0.1` | `^0.2` |

## How to Migrate

1. **Bump `mate_version`** from `0.1` to `0.2` (or `0.2.0`)
2. **Check for extra properties** — any field not in the v0.2 schema will fail validation. Move non-core fields to `extensions.<namespace>`.
3. **Validate state** — if your document uses `revoked`, ensure it implies the bond was previously `accepted`. Pre-acceptance states should use `withdrawn`, `rejected`, or `expired` instead.
4. **Add proofs** — v0.2 mandates at least one proof per the Ed25519Signature2026 or BIP340Signature2026 profile for production bonds. Test/example documents may omit proofs with an explicit note.
5. **Canonicalize identifiers** — ensure `subject.id` and `object.id` use `did:key` or `did:nostr` format for conformance.
6. **Update timestamps** — ensure all timestamps are ISO 8601 with UTC suffix (`Z`) and microsecond precision.

## Backward Compatibility

v0.1 documents are **not valid** under v0.2 strict schema. However:

- A parser MAY offer a `relaxed: true` mode that accepts v0.1 documents with warnings
- The two schemas differ in `additionalProperties` strictness, state enumeration, and version pattern — no silent breakage
- All v0.1 examples in this repo have been updated to v0.2 format
