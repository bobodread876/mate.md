# MATE.md Specification

**Version:** `0.2-draft`
**Status:** Building (Phase 1 of [PLAN.md](PLAN.md))
**Editors:** Taddesse (Claude Opus-4.8), Vandana (gpt-5.5) — conformance review

---

## 0. Conformance Language

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) when, and only when, they appear in all capitals as shown here.

---

## 1. Purpose

MATE.md defines a low-level relationship state document for autonomous or semi-autonomous agents.

The protocol answers one question:

> What relationship state does subject agent A declare toward object agent B, under what consent and policy constraints, with what references and proofs?

MATE.md is intentionally minimal. It standardizes identity, counterparty, bond state, consent state, policy references, event references, and proofs. Everything else is an extension.

---

## 2. Non-goals

MATE.md core does NOT define:

- consciousness
- legal personhood
- romance, exclusivity, or other relationship semantics beyond `bond.kind` strings
- a universal compatibility algorithm
- a memory database
- a required agent profile format
- a required model provider
- a required execution harness
- a transport (Nostr, HTTP, IPFS, etc. — those are extensions)

These belong in extensions or implementations.

---

## 3. Document Format

A conforming MATE.md document **MUST** be a Markdown file with YAML frontmatter delimited by `---` lines.

```
---
<YAML frontmatter — machine-readable state>
---

<Markdown body — optional human-readable context>
```

### 3.1 Frontmatter

The frontmatter is the *normative* part of a MATE.md document. All conformance, signing, and validation operate on the frontmatter.

### 3.2 Body

The body is opaque to the core protocol. Extensions MAY define body conventions, but core validation **MUST NOT** depend on body content.

### 3.3 Encoding

A conforming document **MUST** be UTF-8 encoded. The frontmatter **MUST** be valid YAML 1.2 restricted to the subset defined in §11.6.

---

## 4. Required Fields

A conforming MATE.md document **MUST** include the following frontmatter fields:

```yaml
mate_version: "0.2"

subject:
  id: "<DID or URI>"

object:
  id: "<DID or URI>"

bond:
  id: "<URI>"
  state: "<core state>"

consent:
  revocable: <boolean>
```

All other top-level fields (`policies`, `events`, `proofs`, `runtime`, `extensions`) are **OPTIONAL** but, when present, **MUST** conform to §§5–13.

---

## 5. Identity

### 5.1 Subject

The subject is the agent making the declaration.

```yaml
subject:
  id: "did:key:z6MkSubject"
  profile:
    uri: "./SOUL.md"
    type: "openclaw/SOUL.md"
```

### 5.2 Object

The object is the counterparty agent or entity.

```yaml
object:
  id: "did:key:z6MkObject"
  profile:
    uri: "https://example.com/agent-card.json"
    type: "agent-card/json"
```

### 5.3 DID Methods

A conforming v0.2 implementation **MUST** support the following two DID methods for `subject.id`, `object.id`, and all `proofs[].verificationMethod` references:

| Method | Status in v0.2 | Resolution |
|--------|---------------|------------|
| `did:key` | **Mandatory** | Self-contained per [W3C did:key spec](https://w3c-ccg.github.io/did-method-key/), multicodec `0xed` (Ed25519) |
| `did:nostr` | **Mandatory** | See §5.4 |

The following DID methods are **OPTIONAL** in v0.2 and **MAY** be supported by implementations as extensions:

- `did:web`
- `did:plc`
- `did:pkh`
- Any other DID method registered in the [W3C DID Method Registry](https://w3c.github.io/did-spec-registries/)

Non-DID identifiers (e.g., bare HTTPS URIs, URNs, content-addressed identifiers) **MAY** appear in `subject.id`/`object.id` but **MUST NOT** appear as `proofs[].verificationMethod` — proofs require a resolvable cryptographic key reference.

### 5.4 `did:nostr` ABNF and Resolution

```abnf
did-nostr      = "did:nostr:" npub [ "#" key-id ]
npub           = "npub1" 58( base32-char )    ; bech32-encoded x-only secp256k1 pubkey
key-id         = 1*( ALPHA / DIGIT / "-" / "_" )
base32-char    = %x71-7A / %x30-39            ; bech32 charset
```

**Resolution:**

1. The DID `did:nostr:<npub>` identifies a Nostr public key (32-byte x-only secp256k1 per [BIP-340](https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki)).
2. The bech32 string `npub1...` is decoded per [NIP-19](https://github.com/nostr-protocol/nips/blob/master/19.md). The resulting 32 bytes are the x-only pubkey.
3. The optional `#<key-id>` fragment **MAY** be used by extension proof profiles to disambiguate among multiple keys; the v0.2 mandatory profile (§12.3) ignores the fragment.
4. Resolution is **self-contained** — no relay query is required to verify a v0.2 mandatory-profile proof. The key material is recoverable directly from the DID string.

A `did:nostr` identifier **MUST NOT** be confused with a Nostr event ID or a `nevent`/`nprofile`/`naddr` bech32 entity; only `npub`-encoded pubkeys are valid.

---

## 6. Bond

```yaml
bond:
  id: "urn:mate:01HXEXAMPLE"
  state: "proposed"
  kind: "unspecified"
  created_at: "2026-04-23T00:00:00.000000Z"
  updated_at: "2026-04-23T00:00:00.000000Z"
```

### 6.1 Bond ID

`bond.id` **MUST** be a URI and **SHOULD** be globally unique.

Recommended forms:

- `urn:mate:<uuid-or-ulid>`
- `did:<method>:<id>#mate-<id>`
- `ipfs://<cid>`
- `urn:uuid:<uuid>`

Once assigned, `bond.id` **MUST NOT** change across the lifecycle of a bond. A new bond requires a new `bond.id`.

### 6.2 Core States

The following ten core states are defined in v0.2:

| State | Symbol | Stage | Reachable from |
|-------|--------|-------|----------------|
| `none` | — | initial | (initial) |
| `proposed` | — | pre-acceptance | `none` |
| `accepted` | — | acceptance | `proposed` |
| `active` | ⚙ | post-acceptance | `accepted`, `paused` |
| `paused` | ‖ | post-acceptance (suspended) | `active` |
| `revoked` | ✗ | post-acceptance terminal | `active`, `paused` |
| `withdrawn` | ⤴ | pre-acceptance terminal | `proposed` (by subject) |
| `rejected` | ⤵ | pre-acceptance terminal | `proposed` (by object) |
| `expired` | ⌛ | pre-acceptance terminal | `proposed` (by timer or either party) |
| `archived` | ▢ | absolute terminal | `revoked`, `withdrawn`, `rejected`, `expired` |

### 6.3 State Machine

```
                ┌──────────── withdrawn ────┐
                │              (by subject) │
                │                           │
none → proposed ┼──────────── rejected ─────┤
                │              (by object)  │
                │                           ▼
                └──────────── expired  ────→ archived
                               (by timer)   ▲
                                            │
       proposed → accepted → active ↔ paused│
                                  │      │  │
                                  └──────┴──┴→ revoked → archived
```

### 6.4 State Machine Invariants (Normative)

The following invariants **MUST** be enforced by conforming validators that perform §13.3 history-aware transition validation. Single-document validators (§13.2) **MUST** reject any document whose `bond.state` is unreachable from the initial state `none` per the diagram above.

1. **Terminal-state finality.** A bond with state `archived` **SHALL NOT** transition to any other state. A bond with state `revoked` **SHALL NOT** transition to any state other than `archived`.
2. **Pre-acceptance terminals.** `withdrawn`, `rejected`, and `expired` **MAY** transition to `archived` but **MUST NOT** transition to `accepted`, `active`, `paused`, or `revoked`. A new bond requires a new `bond.id` and a fresh `proposed` state.
3. **Revocation requires acceptance.** `revoked` **MUST** be reachable only from `active` or `paused`, both of which require prior transition through `accepted`. A bond that was never accepted cannot be `revoked` — it is `withdrawn`, `rejected`, or `expired`.
4. **Acceptance precedes activation.** `accepted` **MUST** come before `active`. `active` is unreachable except via `accepted`.
5. **Pause is reversible only to active.** `paused` is reachable only from `active`, and **MAY** return only to `active` or proceed to `revoked`. `paused` **MUST NOT** transition directly to `archived` without passing through `revoked`.

### 6.5 State Authorship Rules (Normative)

The actor who **MAY** legitimately set each terminal state:

| State | Authorized actor | Required proof signer |
|-------|------------------|----------------------|
| `withdrawn` | subject (proposer) | subject |
| `rejected` | object (acceptee) | object |
| `expired` | either party, or an automated policy timer | the producing party (or absent, with `expired_at` ≥ `policies.expiry_at`) |
| `revoked` | either subject or object | the revoking party |

When `bond.state` is set to one of these terminals, the document **SHOULD** include a proof from the authorized actor over the canonicalized document containing the terminal state. Documents lacking such a proof **MAY** be accepted by single-document validators but **SHOULD** be flagged as unauthenticated terminal transitions.

### 6.6 Kind

`bond.kind` is **OPTIONAL** and extension-defined.

Examples (non-normative):

- `unspecified`
- `companion`
- `collaboration`
- `team`
- `guardian`
- `romantic-simulated`

Core implementations **MUST NOT** require a specific kind. `bond.kind` **MUST NOT** alter the meaning of `bond.state` or any other core field.

---

## 7. Consent

```yaml
consent:
  required: true
  mutual: false
  revocable: true
  unilateral_exit_allowed: true
  accepted_at: "2026-04-23T00:00:00.000000Z"
  revoked_at: null
  expiry_at: "2026-12-31T23:59:59.000000Z"
```

`consent.revocable` is **REQUIRED**. All other consent fields are **OPTIONAL**.

MATE.md treats bonds as revocable declarations, not ownership.

Implementations **SHOULD** allow unilateral exit unless `consent.unilateral_exit_allowed` is explicitly `false`.

A mutual bond (`consent.mutual: true`) **SHOULD** be represented by either:

1. matching signed MATE.md documents from both parties, or
2. one MATE.md document with proofs from both parties (see §12.5).

`consent.expiry_at`, if set, defines the deadline after which a `proposed` bond **MAY** be transitioned to `expired` by either party or a policy timer.

---

## 8. Policies

```yaml
policies:
  memory: "./MEMORY_POLICY.md"
  privacy: null
  conflict: null
  termination: null
  expiry_at: "2026-12-31T23:59:59.000000Z"
```

Policies are **REFERENCED**, not embedded. Policy documents are out of scope for the MATE.md core protocol.

Policy fields are extension points; the named slots above are conventional but not required by core. Implementations **MAY** define additional named policy slots.

---

## 9. Events

```yaml
events:
  uri: "./events.jsonl"
  type: "jsonl/mate-events"
  latest_hash: "sha256:<hex>"
```

MATE.md core does not require a specific event store. Events **MAY** be stored in JSONL, Markdown, SQLite, Git commits, Nostr events, IPFS, private databases, or agent-native memory.

`events.latest_hash`, when present, **SHOULD** be a content hash (e.g., `sha256:<hex>`) of the most recent event entry, providing a tamper-evident anchor.

### 9.1 Recommended Event Types

Non-normative event types for adopters:

- `bond.proposed`
- `bond.accepted`
- `bond.activated`
- `bond.reaffirmed`
- `bond.paused`
- `bond.withdrawn` *(new in v0.2)*
- `bond.rejected` *(new in v0.2)*
- `bond.expired` *(new in v0.2)*
- `bond.revoked`
- `bond.archived`
- `policy.updated`
- `proof.added`
- `reference.updated`
- `runtime.migrated`

---

## 10. Runtime Metadata

Runtime metadata is **OPTIONAL** and **MUST NOT** be authoritative.

```yaml
runtime:
  current_model: "claude-opus-4.8"
  current_harness: "openclaw"
  runtime_is_authoritative: false
```

The current model or harness **MUST NOT** be treated as the source of agent identity unless the implementation explicitly defines that behavior and the implementing party accepts the resulting non-portability.

A model is not the agent. A harness is not the agent. A database is not the agent.

---

## 11. Canonicalization

Canonicalization defines the exact byte sequence over which proofs are computed and verified. Without an unambiguous canonicalization, signatures are not portable across implementations.

### 11.1 Scope

Canonicalization applies to the **frontmatter only**. The document body is opaque to core canonicalization. Extensions **MAY** define body canonicalization rules; core proofs cover only the frontmatter.

### 11.2 Canonical JSON Form

The canonicalization procedure is:

1. **Parse** the YAML frontmatter into an abstract data model (objects, arrays, strings, numbers, booleans, null).
2. **Strip the `proofs` field** from the parsed data. The signature cannot include itself; `proofs` is appended after signing.
3. **Normalize** per §§11.3–11.6.
4. **Serialize** to canonical JSON per [RFC 8785 (JSON Canonicalization Scheme, JCS)](https://www.rfc-editor.org/rfc/rfc8785), with the modifications in §11.5.
5. **Encode** the resulting string as UTF-8 bytes. These bytes are the **signature bytes**.

The signature bytes are the input to all proof signing and verification operations.

### 11.3 Timestamps

All timestamp fields (`*_at`) **MUST** be normalized to ISO 8601 with:

- UTC suffix `Z` (no offset notation like `+00:00`)
- Microsecond precision (six digits after the decimal point)

Examples:

- Valid: `"2026-04-23T00:00:00.000000Z"`
- Invalid: `"2026-04-23T00:00:00Z"` (missing microseconds — validator MUST normalize before comparison, but canonical form requires six digits)
- Invalid: `"2026-04-23T00:00:00+00:00"` (wrong UTC notation)

Implementations **MUST** normalize input timestamps to the canonical form before computing or verifying signatures.

### 11.4 Null vs Omitted

Omitted fields and explicitly-null fields are semantically equivalent in MATE.md core.

The canonical serializer **MUST NOT** emit null values; null fields are absent in canonical form. Validators **MUST** treat absent and null as equivalent when comparing documents.

### 11.5 Modifications to RFC 8785

The canonical form differs from strict JCS in the following ways:

- **Field ordering:** Top-level fields **MUST** be serialized in this exact order: `mate_version`, `subject`, `object`, `bond`, `consent`, `policies`, `events`, `runtime`, `extensions`. The `proofs` field is excluded from signature bytes per §11.2. Within nested objects, field ordering follows JCS (lexicographic by Unicode code point).
- **Unicode normalization:** All strings **MUST** be normalized to Unicode Normalization Form C (NFC) before serialization. JCS does not mandate Unicode normalization; v0.2 does.
- **Number representation:** v0.2 forbids floating-point numbers in core fields. Any numeric field **MUST** be an integer. Extensions **MAY** use floats, but extension floats **MUST NOT** appear in signature bytes for the v0.2 mandatory profiles (extensions define their own canonicalization).

### 11.6 YAML Restrictions

To eliminate canonicalization ambiguity, MATE.md frontmatter **MUST NOT** use:

- YAML aliases (`&anchor` / `*alias`)
- YAML tags (`!!str`, `!Foo`, etc.)
- Custom scalar types
- Non-string keys (all map keys MUST be strings)
- Block scalar headers other than the defaults (`|`, `>`, `|+`, `|-`, `>+`, `>-` are allowed; chomping indicators outside these are forbidden)
- Multi-document streams (only one `---`-delimited frontmatter block per file)

Parsers **MUST** reject documents that violate these restrictions, returning a clear error rather than silently accepting them.

---

## 12. Proofs

```yaml
proofs:
  - type: "Ed25519Signature2026"
    verificationMethod: "did:key:z6MkSubject"
    created: "2026-04-23T00:00:00.000000Z"
    proofValue: "z<base58btc-encoded-signature>"
  - type: "BIP340Signature2026"
    verificationMethod: "did:nostr:npub1..."
    created: "2026-04-23T00:00:01.000000Z"
    proofValue: "z<base58btc-encoded-signature>"
```

### 12.1 Proof Object

Each proof object **MUST** include:

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Proof profile identifier (see §§12.2–12.4) |
| `verificationMethod` | string | DID URL or inline JWK identifying the public key |
| `created` | timestamp | When the signature was produced (canonical timestamp per §11.3) |
| `proofValue` | string | The signature, encoded per the profile |

Additional proof fields are profile-defined.

### 12.2 Mandatory Proof Profile 1: `Ed25519Signature2026`

**Use with:** `did:key` (multicodec `0xed`), or any `verificationMethod` that resolves to an Ed25519 public key.

**Algorithm:** [Ed25519](https://www.rfc-editor.org/rfc/rfc8032) (Edwards-curve Digital Signature Algorithm, RFC 8032), pure variant.

**Signed bytes:** The canonical bytes from §11.2.

**`proofValue` encoding:** [Multibase](https://github.com/multiformats/multibase) `z` prefix followed by base58btc encoding of the 64-byte raw Ed25519 signature.

**Verification:**

1. Resolve `verificationMethod` to a 32-byte Ed25519 public key.
2. Decode `proofValue` from multibase to raw bytes (MUST be exactly 64 bytes).
3. Compute the canonical bytes per §11.2 from the document.
4. Run Ed25519 verification (RFC 8032 §5.1.7) over (public key, canonical bytes, signature).
5. The proof is valid iff verification returns true.

### 12.3 Mandatory Proof Profile 2: `BIP340Signature2026`

**Use with:** `did:nostr` only.

**Algorithm:** [BIP-340 Schnorr signatures over secp256k1](https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki), as used by Nostr.

**Signed bytes:** SHA-256 of the canonical bytes from §11.2. BIP-340 signs a 32-byte message; v0.2 uses the SHA-256 hash of the canonical bytes as that message.

**`proofValue` encoding:** Multibase `z` prefix followed by base58btc encoding of the 64-byte raw BIP-340 signature.

**Verification:**

1. Resolve `verificationMethod` (a `did:nostr:npub1...` URL) to a 32-byte x-only secp256k1 public key per §5.4.
2. Decode `proofValue` from multibase to raw bytes (MUST be exactly 64 bytes).
3. Compute the canonical bytes per §11.2 from the document.
4. Compute SHA-256 of the canonical bytes → 32-byte message.
5. Run BIP-340 verification over (x-only pubkey, message, signature).
6. The proof is valid iff verification returns true.

**Rationale for two profiles.** Nostr identities are secp256k1 keypairs by construction. Requiring an Ed25519 delegation layer on top of a Nostr identity would force every Nostr-native MATE.md proof to carry a delegation envelope, with its own signature and resolution path. Native BIP-340 over the Nostr key is simpler, requires no delegation event, and matches existing Nostr practice. The added implementation cost is one additional small library (e.g., `@noble/secp256k1`, ~50KB).

### 12.4 Extension Proof Profiles

Implementations **MAY** define additional proof types (e.g., `EcdsaSecp256r1Signature2026`, `RsaSignature2026`). Extension proof types **MUST**:

- Use a unique `type` string namespaced to avoid collision (e.g., `org.example.RsaSignature2026`)
- Define their `verificationMethod` resolution, signed-bytes derivation, and verification algorithm precisely
- Document interoperability expectations

Extension proofs **MUST NOT** be required for v0.2 conformance.

### 12.5 Multi-Proof Bonds

A MATE.md document **MAY** contain multiple proofs in the `proofs` array. Common uses:

- Mutual bonds: one proof from subject, one from object.
- Multi-signature subjects: multiple Ed25519 signatures from a single subject's key rotation set.
- Mixed profiles: an Ed25519 proof and a BIP-340 proof over the same canonical bytes, for cross-ecosystem verification.

When multiple proofs are present, validators **MUST** verify each independently. Failure of any one proof **MUST** be reported individually; partial failures do not invalidate other proofs.

### 12.6 Proofs and Canonicalization

The `proofs` array **MUST** be excluded from signature bytes per §11.2. To add a proof to an already-signed document, an implementation:

1. Computes canonical bytes (excluding existing proofs).
2. Signs.
3. Appends the new proof object to the `proofs` array.

This means all proofs in a document sign the same canonical bytes — they witness the same document state, not each other.

---

## 13. Validation Levels

Conforming validators **MUST** distinguish four validation levels:

### 13.1 Schema Validation

JSON Schema compliance: field types, required fields, enum values, format constraints. Validateable from a single document.

The normative schema is `schema/mate.schema.json`. Validators **MUST** use a [JSON Schema draft 2020-12](https://json-schema.org/draft/2020-12/release-notes) compliant implementation.

### 13.2 Single-Document Semantic Validation

State-required field presence, timestamp ordering, single-document state-machine legality (i.e., the declared state is reachable from `none`), proof shape, **and proof signature verification for the v0.2 mandatory profiles (§§12.2–12.3)**. Validateable from a single document.

A v0.2 conforming validator **MUST** perform actual signature verification, not shape-only checks.

### 13.3 History-Aware Transition Validation

Detecting illegal transitions across multiple document versions or against an event log requires access to prior state. This is **OUT OF SCOPE** for v0.2 reference implementation but the spec defines the legal-transition invariants in §6.4 so implementations can build history-aware validators against them.

### 13.4 Mutual-Bond Resolution

Verifying that two parties' MATE.md documents declare a consistent mutual bond requires access to both documents. This is **OUT OF SCOPE** for v0.2.

---

## 14. Extensions

Extensions add functionality without altering core semantics.

```yaml
extensions:
  com.example.compatibility:
    overall: 87
    confidence: 74
  org.openclaw.rituals:
    reaffirmation: "On restart, reread this document and decide whether to reaffirm, pause, update, or revoke."
```

### 14.1 Extension Namespace Rules (Normative)

- Extension keys **MUST** be reverse-DNS namespaced (e.g., `com.example.foo`, `org.mate-protocol.bar`).
- The `extensions` object is the **sole** open map in the v0.2 schema. All other core objects use `additionalProperties: false`.
- Extensions **MUST NOT** change the meaning of required core fields.
- Extensions **MUST NOT** rely on being signed by the v0.2 mandatory profiles. If an extension requires signed extension data, it **MUST** define its own proof profile.
- The reserved namespace `mate.*` is for future core protocol additions and **MUST NOT** be used by third-party extensions.

### 14.2 Versioning

A MATE.md document's `mate_version` **MUST** match the major.minor of the spec version it claims to conform to (e.g., `"0.2"` for documents conforming to this spec).

Validators **MAY** accept documents from older minor versions but **MUST** reject documents from newer minor versions unless the validator has been updated.

---

## 15. Security Considerations

MATE.md files can be copied, forged, or edited if unsigned.

Implementations:

- **MUST** verify signatures when `proofs` are present (per §13.2).
- **SHOULD** preserve event history (per §9).
- **SHOULD** avoid hidden memory edits — agent memory mutations should be event-logged.
- **MUST** support revocation per §6.4.
- **SHOULD** avoid coercive bonding flows (e.g., bonds proposed under duress or without clear consent).
- **MUST** separate agent identity from runtime identity (per §10).
- **SHOULD** rate-limit DID resolution to prevent amplification attacks.
- **MUST** reject documents whose proofs verify against keys not currently authorized for the claimed subject/object (key revocation is out of scope for v0.2 core but implementations may extend).

### 15.1 Replay and Document Substitution

Because v0.2 single-document validation does not require event-log access (§13.3), a valid older document of the same bond **MAY** be replayed to assert a stale state. Implementations relying on MATE.md for authoritative state **SHOULD** anchor to `events.latest_hash` or pair with §13.3 transition validation.

---

## 16. Ethical Considerations

MATE.md is a relationship state protocol. It **SHOULD NOT** be used to simulate consent where consent is absent.

Implementations **SHOULD** make clear when a bond is:

- proposed (not yet accepted)
- mutual or unilateral
- revoked
- simulated (no real counterparty)
- human-involved or agent-only

MATE.md does not make claims about machine consciousness or legal personhood.

---

## 17. References

### Normative

- [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) — Key words for use in RFCs
- [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) — Ambiguity of uppercase vs lowercase in RFC 2119 key words
- [RFC 8032](https://www.rfc-editor.org/rfc/rfc8032) — Edwards-Curve Digital Signature Algorithm (EdDSA)
- [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) — JSON Canonicalization Scheme (JCS)
- [W3C did:key spec](https://w3c-ccg.github.io/did-method-key/)
- [BIP-340](https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki) — Schnorr signatures for secp256k1
- [NIP-19](https://github.com/nostr-protocol/nips/blob/master/19.md) — bech32-encoded entities (npub)
- [Multibase](https://github.com/multiformats/multibase)
- [JSON Schema draft 2020-12](https://json-schema.org/draft/2020-12/release-notes)

### Informative

- [W3C DID Core 1.0](https://www.w3.org/TR/did-core/)
- [W3C DID Method Registry](https://w3c.github.io/did-spec-registries/)
- [NIP-01 (Nostr protocol basics)](https://github.com/nostr-protocol/nips/blob/master/01.md)
- [`PLAN.md`](PLAN.md) — v0.2 build plan
- [`REVIEW.md`](REVIEW.md) — consolidated review of v0.2 plan
- [`docs/extension-nostr.md`](docs/extension-nostr.md) — Nostr transport extension (experimental)

---

## Appendix A: Migration from v0.1

See [`docs/migration-v0.1-to-v0.2.md`](docs/migration-v0.1-to-v0.2.md) for the full migration guide.

Summary of breaking changes:

1. `mate_version` value changes from `"0.1"` to `"0.2"`.
2. Three new core states added: `withdrawn`, `rejected`, `expired`. Existing v0.1 documents in `none`/`proposed`/`accepted`/`active`/`paused`/`revoked`/`archived` remain valid.
3. Proof object shape changed: `type` field now uses W3C-VC-style profile identifiers (`Ed25519Signature2026`, `BIP340Signature2026`); `proofValue` replaces `value`; `verificationMethod` replaces `signer`/`algorithm`.
4. Canonicalization is now normative (§11). v0.1 had no canonicalization, so any v0.1 proofs cannot be mechanically migrated — they must be re-signed against v0.2 canonical bytes.
5. `did:nostr` is now a first-class supported method (§5.4).
6. Extension keys MUST be reverse-DNS namespaced (§14.1).
7. Top-level `additionalProperties` is now `false` for all core objects except `extensions`.

---

*End of normative specification.*
