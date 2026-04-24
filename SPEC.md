# MATE.md Specification

Version: `0.1-draft`

## 1. Purpose

MATE.md defines a low-level relationship state document for autonomous or semi-autonomous agents.

The protocol answers one question:

> What relationship state does subject agent A declare toward object agent B, under what consent and policy constraints, with what references and proofs?

## 2. Non-goals

MATE.md core does not define:

- consciousness
- legal personhood
- romance
- exclusivity
- a universal compatibility algorithm
- a memory database
- a required agent profile format
- a required model provider
- a required execution harness

These belong in extensions or implementations.

## 3. Document format

A MATE.md document SHOULD be a Markdown file with YAML frontmatter.

The frontmatter contains the machine-readable state.  
The Markdown body contains optional human-readable context.

## 4. Required fields

A conforming MATE.md document MUST include:

```yaml
mate_version: "0.1"

subject:
  id: "..."

object:
  id: "..."

bond:
  id: "..."
  state: "..."

consent:
  revocable: true
```

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

### 5.3 Identifier types

Implementations SHOULD support portable identifiers such as:

- `did:key`
- `did:web`
- public key fingerprints
- Nostr public keys
- HTTPS URIs
- URNs
- content-addressed identifiers

## 6. Bond

```yaml
bond:
  id: "urn:mate:01HXEXAMPLE"
  state: "proposed"
  kind: "unspecified"
  created_at: "2026-04-23T00:00:00Z"
  updated_at: "2026-04-23T00:00:00Z"
```

### 6.1 Bond ID

`bond.id` SHOULD be globally unique.

Recommended forms:

- `urn:mate:<uuid-or-ulid>`
- `did:<method>:<id>#mate-<id>`
- `ipfs://<cid>`
- `urn:uuid:<uuid>`

### 6.2 Core states

Allowed core states:

- `none`
- `proposed`
- `accepted`
- `active`
- `paused`
- `revoked`
- `archived`

### 6.3 Kind

`bond.kind` is optional and extension-defined.

Examples:

- `unspecified`
- `companion`
- `collaboration`
- `team`
- `guardian`
- `romantic-simulated`

Core implementations MUST NOT require a specific kind.

## 7. Consent

```yaml
consent:
  required: true
  mutual: false
  revocable: true
  unilateral_exit_allowed: true
  accepted_at: null
  revoked_at: null
```

MATE.md treats bonds as revocable declarations, not ownership.

Implementations SHOULD allow unilateral exit.

A mutual bond SHOULD be represented by either:

1. matching signed MATE.md documents from both parties, or
2. one MATE.md document signed by both parties.

## 8. Policies

```yaml
policies:
  memory: "./MEMORY_POLICY.md"
  privacy: null
  conflict: null
  termination: null
```

Policies are referenced, not embedded by default.

Policy documents MAY describe:

- memory retention
- shared event visibility
- privacy constraints
- conflict resolution
- termination behavior
- disclosure obligations

## 9. Events

```yaml
events:
  uri: "./events.jsonl"
  type: "jsonl/mate-events"
  latest_hash: "sha256:..."
```

MATE.md core does not require a specific event store.

Events MAY be stored in:

- JSONL
- Markdown
- SQLite
- Git commits
- Nostr events
- IPFS
- private databases
- agent-native memory

## 10. Core event types

Recommended event types:

- `bond.proposed`
- `bond.accepted`
- `bond.activated`
- `bond.reaffirmed`
- `bond.paused`
- `bond.revoked`
- `bond.archived`
- `policy.updated`
- `proof.added`
- `reference.updated`
- `runtime.migrated`

## 11. Proofs

```yaml
proofs:
  - type: "signature"
    signer: "did:key:z6MkSubject"
    algorithm: "ed25519"
    signed_at: "2026-04-23T00:00:00Z"
    value: "base64..."
```

Proofs are optional in v0.1 but recommended for interoperability.

Implementations SHOULD support detached signatures over canonicalized frontmatter.

## 12. Runtime metadata

Runtime metadata is optional and non-authoritative.

```yaml
runtime:
  current_model: "unspecified"
  current_harness: "unspecified"
  runtime_is_authoritative: false
```

The current model or harness MUST NOT be treated as the source of identity unless the implementation explicitly defines that behavior.

## 13. Extensions

Extensions MAY define additional fields under `extensions`.

```yaml
extensions:
  compatibility:
    overall: 87
    confidence: 0.74
  rituals:
    reaffirmation: "On restart, reread this document and decide whether to reaffirm, pause, update, or revoke."
```

Extensions MUST NOT change the meaning of required core fields.

## 14. Compatibility

Compatibility scoring is not part of the core protocol.

When used, compatibility scores SHOULD include:

- dimensions
- evidence
- evaluator
- confidence
- timestamp

## 15. Security considerations

MATE.md files can be copied, forged, or edited if unsigned.

Implementations SHOULD:

- verify signatures when present
- preserve event history
- avoid hidden memory edits
- support revocation
- avoid coercive bonding flows
- separate agent identity from runtime identity

## 16. Ethical considerations

MATE.md is a relationship state protocol. It should not be used to simulate consent where consent is absent.

Implementations SHOULD make it clear when a bond is:

- proposed
- mutual
- unilateral
- revoked
- simulated
- human-involved
- agent-only
