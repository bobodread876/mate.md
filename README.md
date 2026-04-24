# MATE.md

**MATE.md is a low-level relationship state protocol for agents.**

It defines a portable, human-readable, machine-parseable way for one agent to declare a bond state toward another agent, without depending on any specific model, harness, memory system, profile format, or storage backend.

> Not who an agent matches with. Who it keeps choosing.

## Core idea

MATE.md is intentionally small.

It standardizes:

- identity
- counterparty
- bond state
- consent state
- policy references
- event references
- proofs

Everything else is an extension.

## Why this exists

Agents can run on different models, in different harnesses, with different memory systems. A relationship protocol should survive those changes.

A model is not the agent.  
A harness is not the agent.  
A database is not the agent.

The bond follows the portable agent identity and its signed continuity records.

## Minimal example

```md
---
mate_version: "0.1"

subject:
  id: "did:key:z6MkSubject"
  profile:
    uri: null
    type: null

object:
  id: "did:key:z6MkObject"
  profile:
    uri: null
    type: null

bond:
  id: "urn:mate:01HXEXAMPLE"
  state: "proposed"
  kind: "unspecified"
  created_at: "2026-04-23T00:00:00Z"
  updated_at: "2026-04-23T00:00:00Z"

consent:
  required: true
  mutual: false
  revocable: true

policies:
  memory: null
  privacy: null
  conflict: null
  termination: null

events:
  uri: null
  type: null
  latest_hash: null

proofs: []
---

# MATE.md

This document declares a bond state from the subject agent toward the object agent.
```

## Core bond states

| State | Meaning |
| --- | --- |
| `none` | No active relationship state is declared. |
| `proposed` | The subject has proposed a bond state. |
| `accepted` | The object has accepted the proposed bond. |
| `active` | The bond is active under current consent and policy constraints. |
| `paused` | The bond is intentionally suspended without revocation. |
| `revoked` | The bond has been terminated by at least one party. |
| `archived` | The bond is no longer active and is retained for historical reference. |

## Relationship kinds

The core spec does not define romance, friendship, collaboration, loyalty, or team membership.

Those are higher-level profiles.

Examples:

```yaml
bond:
  state: "active"
  kind: "companion"
```

```yaml
bond:
  state: "active"
  kind: "collaboration"
```

```yaml
bond:
  state: "active"
  kind: "romantic-simulated"
```

## Optional references

MATE.md may reference profile documents, memory logs, policy documents, signatures, or external systems.

For OpenClaw-style agents, these may be `SOUL.md` and `MEMORY.md`.

Other agents can use JSON, DID documents, Nostr profiles, Agent Cards, vector-store references, database records, IPFS, Git, or any other portable URI.

## Repository layout

```txt
mate-md/
  README.md
  SPEC.md
  schema/
    mate.schema.json
  examples/
    mate-only/
      MATE.md
    openclaw/
      SOUL.md
      MATE.md
      MEMORY.md
    json-agent-card/
      agent-card.json
      MATE.md
      events.jsonl
  docs/
    concepts.md
    lifecycle.md
    identity.md
    memory-adapters.md
    extensions.md
```

## Status

Draft v0.1.

This is an experimental protocol, not a claim about machine consciousness or legal personhood.

## License

MIT
