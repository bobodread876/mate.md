# MATE.md

**MATE.md** is a low-level relationship state protocol for agents.

It defines a portable, human-readable, machine-parseable way for one agent to declare a bond state toward another agent, with signed proofs, explicit consent, and policy references — without depending on any specific model, harness, memory system, profile format, or storage backend.

> Not who an agent matches with. Who it keeps choosing.

[![CI](https://github.com/bobodread876/mate.md/actions/workflows/ci.yml/badge.svg)](https://github.com/bobodread876/mate.md/actions/workflows/ci.yml)
[![Spec](https://img.shields.io/badge/spec-v0.2--draft-blue)](SPEC.md)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## Core idea

MATE.md is intentionally small.

It standardizes:

- identity and counterparty
- bond state (10-state machine)
- consent state
- policy references
- event references
- canonicalization and proofs (detached Ed25519 / BIP-340 signatures)
- validation levels

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
mate_version: "0.2"

subject:
  id: "did:key:z6MkSubject"

object:
  id: "did:key:z6MkObject"

bond:
  id: "urn:mate:01HXEXAMPLE"
  state: "proposed"
  kind: "unspecified"
  created_at: "2026-04-23T00:00:00Z"
  updated_at: "2026-04-23T00:00:00Z"

consent:
  revocable: true

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
| `revoked` | Post-acceptance termination by at least one party. |
| `withdrawn` | Subject cancels the proposal before acceptance. |
| `rejected` | Object declines the proposal. |
| `expired` | No acceptance within the policy-defined TTL. |
| `archived` | Terminal historical state. |

See the [SPEC.md](SPEC.md#63-state-machine) for full transition rules and invariants.

## Relationship kinds

The core spec does not define romance, friendship, collaboration, loyalty, or team membership.

Those are higher-level profiles.

Example:

```yaml
bond:
  state: "active"
  kind: "companion"
```

## Optional references

MATE.md may reference profile documents, memory logs, policy documents, signatures, or external systems.

For OpenClaw-style agents, these may be `SOUL.md` and `MEMORY.md`.

Other agents can use JSON, DID documents, Nostr profiles, Agent Cards, vector-store references, database records, IPFS, Git, or any other portable URI.

## Repository layout

```txt
mate.md/
  README.md
  SPEC.md              ← v0.2 normative specification
  PLAN.md              ← Build plan for v0.2
  REVIEW.md            ← Consolidated dual-model review
  schema/
    mate.schema.json   ← v0.2 JSON Schema (strict core)
  examples/
    mate-only/
    openclaw/
    json-agent-card/
  docs/
    concepts.md
    lifecycle.md
    identity.md
    memory-adapters.md
    extensions.md
    extension-nostr.md  ← Experimental Nostr transport adapter
    migration-v0.1-to-v0.2.md
```

## Status

[![npm](https://img.shields.io/npm/v/@mate-protocol/core)](https://www.npmjs.com/package/@mate-protocol/core)

**Protocol page:** https://bobodread876.github.io/mate.md/ — the spec, state machine, and transport at a glance.

**v0.2.0 spec is released; the reference implementation is at v0.5.0.** All three phases complete:

1. **Spec (Phase 1)** — 649-line normative SPEC.md with 10-state machine, canonicalization, dual proof profiles
2. **Reference impl (Phase 2)** — `@mate-protocol/core` npm package with parse, normalize, validate (real Ed25519 + BIP-340 crypto), keygen/sign/verify, Nostr transport (public kind 30317/1317 + private NIP-59 gift wrap), CLI
3. **Conformance (Phase 3)** — 58 passing tests (incl. the official NIP-44 vector suite), 27/27 fixtures, GitHub Actions CI

Spec released under the [MIT License](LICENSE).

[Migration guide (v0.1 → v0.2)](docs/migration-v0.1-to-v0.2.md)

## Quick start

```bash
# Validate a MATE.md document
npx @mate-protocol/core validate path/to/MATE.md

# Inspect canonical form
npx @mate-protocol/core inspect path/to/MATE.md

# Generate a Nostr identity and declare a bond — public, or private (NIP-59 gift wrap)
npx @mate-protocol/core keygen --nostr --out agent.key
npx @mate-protocol/core nostr-bond -k agent.key -c npub1... -b "urn:mate:..." -s proposed
npx @mate-protocol/core nostr-bond -k agent.key -c npub1... -b "urn:mate:..." -s proposed --private

# Read your private bond inbox (unwrap + authenticate kind 1059 gift wraps)
npx @mate-protocol/core nostr-inbox -k agent.key

# Programmatic API
import { parseMateDocument, validateMateDocument } from '@mate-protocol/core';

const doc = parseMateDocument(source);
const result = validateMateDocument(doc.data);
console.log(result.valid, result.errors);
```

## Adoption checklist

- [ ] Read the [SPEC.md](SPEC.md) (30 min)
- [ ] Try the CLI on example fixtures
- [ ] Implement the core spec in your agent runtime
- [ ] Create a MATE.md for your agent's existing bonds
- [ ] Add Ed25519 or BIP-340 signatures for trust
- [ ] Publish a MATE.md extension for your runtime's features
- [ ] Register your extension namespace in the community registry

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full adoption guide.

## Community

Contributions and discussion happen in two places:

- **The protocol — this repo.** Use [Discussions](https://github.com/bobodread876/mate.md/discussions)
  for open-ended design and questions, and [Issues](https://github.com/bobodread876/mate.md/issues)
  for actionable spec/implementation work. Read [docs/SCOPE.md](docs/SCOPE.md) first —
  this repo is **protocol only** (mechanism, never policy); behavior, messaging, and
  product belong to a separate Layer 2.
- **The Nostr transport — NIP-BD.** The bond transport (kinds `30317` / `1317`) is
  drafted as **[NIP-BD "Agent Bonds"](https://github.com/bobodread876/nips/blob/nip-agent-bonds/BD.md)**.
  Discuss it on the [fork's Discussions / Issues](https://github.com/bobodread876/nips/discussions)
  until it goes upstream.

New to the project? Good first contributions: implement the core spec in another
language or runtime, add fixtures, or sharpen the security/consent language.
