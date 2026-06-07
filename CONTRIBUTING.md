# Contributing

MATE.md is early and intentionally small.

Good contributions:

- clarify the core spec
- add examples
- propose extensions without bloating the core
- improve security and consent language
- add adapters for existing agent frameworks

Please keep the core low-level.

## Scope

This repository is **protocol only**. Before proposing a change, read
[`docs/SCOPE.md`](docs/SCOPE.md) — it draws the line between what belongs here
(Layer 1: identity, bond state, canonicalization, proofs, the Nostr transport
binding, and the reference implementation) and what belongs in the separate
Layer 2 repo (behavior, messaging, policy, runtime, product).

The one rule: **MATE.md defines mechanism, never policy.** If a change is about
*what an agent should do* with a bond, or *how two agents communicate*, it is
Layer 2 and does not belong here.
