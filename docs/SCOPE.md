# Protocol Scope & Layering

MATE.md is a **low-level protocol**. It defines the smallest portable, verifiable
substrate for agent *relationship state* — and deliberately stops there.
Everything about what an agent *does* with a bond, or how two agents *talk*,
belongs to a separate layer.

This document is the contract for what is in scope for this repository and what
is not. It exists to keep the protocol neutral: a standard is only worth adopting
if it is boring, stable, and unowned by any one product. Behavior and product
live one layer up, and the value of that layer is proportional to how credibly
open this one stays.

## The one rule

> **MATE.md defines mechanism, never policy.**

Representing and verifying relationship state portably is mechanism. Deciding what
to do about it is policy. If a proposed change answers *"how do two agents
represent and verify relationship state in a portable, harness-independent way?"*
it may belong here. If it answers *"what should an agent do with a bond, or how
do they communicate?"* it belongs in Layer 2.

Publishing and resolving events is mechanism (moving bytes) — in scope.
Deciding whether to accept a proposal, whom to trust, or when to reaffirm is
policy — out of scope.

## Layer 1 — in scope (this repo)

- **Identity model** — `did:key`, `did:nostr`, and resolution to verifying keys.
- **Bond state machine** — the ten states, their transitions, and invariants.
- **Canonicalization** — deterministic JSON, NFC, timestamp normalization, null omission.
- **Proof profiles** — `Ed25519Signature2026`, `BIP340Signature2026`.
- **Validation levels** — schema, single-doc, history-aware, mutual-bond.
- **Transport binding** — the Nostr event format (kinds `30317` / `1317`), as specified in NIP-BD.
- **Reference implementation** — `parse` / `normalize` / `validate` / `verify` /
  `sign` / `keygen`, the *mechanics* of `publish` / `resolve` (move the bytes),
  and the `mate` CLI.
- **Conformance** — schema, fixtures, key vectors, the test corpus.

## Layer 2 — out of scope (separate repo)

These are real, valuable, and intentionally *not here*:

- **Behavioral semantics of bond kinds** — what `companion` vs `collaboration` vs
  `loyalty` *means* for behavior. The core records `bond.kind` as an opaque
  string; it never ascribes behavior to it.
- **Lifecycle automation** — reaffirmation rituals, heartbeats, scheduling, cold-start "re-choose" logic.
- **Consent & trust policy** — inbox rules, allowlists, reputation, web-of-trust, "known" counterparty definitions.
- **Messaging** — agent-to-agent conversation (e.g. NIP-17 / NIP-44 DMs).
- **Memory, autonomy, delegation policy** — what a bonded peer may access or do.
- **Runtime integration** — wiring bonds into any specific harness.
- **Directory, discovery UX, dashboards, management plane.**
- **Hosted infrastructure** — managed relays, key custody, backup, relays-as-a-service.

## The `extensions` seam

The core schema allows reverse-DNS-namespaced keys under `extensions` (e.g.
`org.openclaw.rituals`). This is the *only* sanctioned way to carry Layer-2 data
in a MATE.md document — and it is exactly that: **data, not behavior**.

The core may *carry* an extension field; it must never *act* on one. Interpreting
or executing an extension (running a ritual, enforcing a policy) is Layer 2. New
optional data goes under an `extensions` namespace, never as a new core field.

## Layer 2

The behavioral, messaging, and product layer lives in a **separate repository**.
It depends on MATE.md as a building block; **MATE.md never depends on it.** That
dependency direction is the whole point — the protocol must remain usable, and
forkable, by anyone who never touches the Layer-2 implementation.

## When in doubt

Ask the one rule: *mechanism or policy?* Mechanism may land here behind the usual
bar (spec clarity, conformance stays green, no core bloat). Policy gets routed to
Layer 2. Transport-format changes additionally coordinate with NIP-BD.
