# MATE.md v0.2 — Build Plan

**Path:** Commons (open protocol)  
**Status:** Building  
**Lead (implementer):** Taddesse (Claude Opus-4.8)  
**Conformance reviewer:** Vandana (gpt-5.5)  
**Repo:** https://github.com/bobodread876/mate.md

> **Note:** This plan was reviewed by two models (Patoo/deepseek + Vandana/gpt-5.5 with max thinking) and revised before publishing. See [`REVIEW.md`](REVIEW.md) for the consolidated review and [`REVIEW-gpt55.md`](REVIEW-gpt55.md) for the full gpt-5.5 critique.

---

## 1. MVP Scope (What v0.2 Actually Ships)

v0.2 is a **spec-and-reference release**, not a product. The goal is to make MATE.md a credible, adoptable protocol that other agent runtimes can implement against.

**In scope:**
- Polished normative spec with formal state machine, canonicalization rules, and one mandatory proof profile (detached Ed25519 over canonicalized core data)
- Versioned, stricter JSON Schema (v0.2) with a clear core/extensions boundary
- Reference implementation in TypeScript (single npm package, Node ESM + browser-safe exports)
- Conformance test suite with fixture manifest (>= 20 fixtures)
- Documentation refresh (README, migration guide, canonicalization spec)
- Repo cleanup (remove scaffolding debris, version tag)

**Deferred to v0.3+:**
- Nostr transport adapter (draft exists in EXTENSION-NOSTR.md, not blocking core)
- TOML frontmatter support
- Multi-language reference implementations
- History-aware state transition validation (requires previous state or event log)
- Mutual-bond resolution (requires both parties' documents)
- Extension registry tooling
- Runtime-specific adapters (OpenClaw plugin, etc.)
- CLI `mate conformance` command (replaced by Vitest runner for v0.2)

---

## 2. Canonicalization Rules (Key Design Decision)

This is the hardest part of v0.2. The plan defines these concretely:

- **Scope:** Frontmatter only. The body (text after closing `---`) is opaque unless an extension defines otherwise.
- **Format:** Parsed data canonicalized to JSON (field order, whitespace, unicode normalization). Original text is preserved but not what gets signed/validated.
- **Signature bytes:** Canonicalized JSON of the core object, excluding `proofs` field (signature cannot include itself).
- **Proof format (mandatory profile):** Detached Ed25519 signature over canonicalized core bytes. Public key referenced via `proofs[].verificationMethod`, which MUST resolve to one of the **two mandatory-to-implement DID methods for v0.2**: `did:key` or `did:nostr`. Other DID methods (e.g., `did:web`, `did:plc`) are extension-defined and not required for conformance.
  - **`did:key` resolution:** per the [W3C did:key spec](https://w3c-ccg.github.io/did-method-key/), with the multicodec `0xed` (Ed25519) prefix. Self-contained — no network resolution required.
  - **`did:nostr` resolution:** the DID is the npub-encoded Nostr public key (BIP-340 secp256k1) or an Ed25519 key delegated via NIP-26-style proof; v0.2 mandates the Ed25519 delegation form for proof signing so the same Ed25519 verifier code path serves both DID methods. Spec MUST define the exact `did:nostr` ABNF and delegation envelope.
- **Inline keys:** `proofs[].verificationMethod` MAY also be an inline JWK for testing/portability, but a `did:*` reference SHOULD be preferred in production examples.
- **Timestamp normalization:** All timestamps MUST be ISO 8601 with UTC suffix (`Z`), microsecond precision. Validator normalizes before comparison.
- **null vs omitted:** Omitted fields are treated as null. Serializer MUST NOT emit null values; they are absent in canonical form.

---

## 3. Validation Levels

The spec and reference implementation distinguish:

1. **Schema validation** — JSON Schema compliance (field types, required fields per state). Validateable from one file.
2. **Single-document semantic invariants** — State-required field presence, timestamp ordering, proof shape, **and Ed25519 signature verification against the resolved `did:key` / `did:nostr` public key for the mandatory proof profile**. Validateable from one file.
3. **History-aware transition validation** — Requires previous document or event log. **Out of scope for v0.2 reference impl, but spec MUST note the distinction.**
4. **Mutual-bond resolution** — Requires both parties' documents. **Out of scope for v0.2.**

---

## 4. State Machine

```
none → proposed → accepted → active
proposed → withdrawn   (subject cancels before object accepts)
proposed → rejected    (object declines the proposal)
proposed → expired     (no acceptance within policy-defined TTL)
active   ↔ paused      (reversible, post-acceptance)
active / paused → revoked → archived
withdrawn / rejected / expired → archived
revoked  → archived
```

**State authorship and triggers:**
- `withdrawn` MUST be set by the subject (proposer).
- `rejected` MUST be set by the object (acceptee).
- `expired` MAY be set by either party or by a policy timer; the producing actor MUST be identifiable from the proof set.
- `revoked` MAY be set by either subject or object once the bond has been `accepted` (and thus may have transitioned through `active` / `paused`).

**Invariants (normative):**
- A bond with state `archived` is terminal — SHALL NOT transition to any other state.
- A bond with state `revoked` SHALL NOT transition to any state other than `archived`.
- **`revoked` MUST have previously transitioned through `accepted`.** Pre-acceptance termination uses `withdrawn`, `rejected`, or `expired`, never `revoked`.
- **Pre-acceptance terminals (`withdrawn`, `rejected`, `expired`) MAY be archived for historical reference but MUST NOT transition to `accepted`, `active`, `paused`, or `revoked`.** A new bond requires a new `bond.id` and a fresh `proposed` state.
- `accepted` MUST come before `active`. `active` is unreachable except via `accepted`.
- `paused` is reachable only from `active`, and may return only to `active` or proceed to `revoked`.
- `bond.state` and `consent.mutual` are orthogonal but linked: mutual bonds in `active` state SHOULD have proofs from both parties (non-normative for v0.2, implementations should document their policy).

---

## 5. Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Spec format | Markdown + JSON Schema draft 2020-12 | Already established; no build step needed |
| Reference impl | **TypeScript** (Node ESM + browser-safe exports) | Portable, typed, good for conformance + browser use |
| Frontmatter parser | `gray-matter` + `js-yaml` for YAML | MATE.md is frontmatter-based; **YAML only for v0.2** |
| Validator | `ajv` + `ajv-formats` (for date-time) | De facto standard; mature |
| Conformance | Vitest | Fast, native TypeScript, fixture-driven |
| Fixture manifest | `fixtures/manifest.json` | Expected outcome, category, and rationale per fixture |
| Docs | README.md + docs/ directory | Keep it simple; no framework |
| Package target | Single npm package (`@mate-protocol/core`) | Exports: parse, normalize, validate, CLI |

---

## 6. Work Breakdown

### Phase 1: Spec Polish (7 days)

- ☐ Write normative state transition table with invariants
- ☐ Define canonicalization rules in detail (see Section 2 above)
- ☐ Define one mandatory proof profile (detached Ed25519)
- ☐ Document validation levels (schema / single-doc / history-aware / mutual)
- ☐ Tighten JSON Schema: `additionalProperties: false` on core fields (`subject`, `object`, `bond`, `consent`, `events`, `runtime`); keep `extensions` as the sole open map
- ☐ Design fixture manifest format
- ☐ Bump schema version from `^0.1` to `^0.2`
- ☐ Move EXTENSION-NOSTR.md to docs/extension-nostr.md, mark as "experimental / draft"
- ☑ Remove GIT_INIT_NOTE.txt _(done in this commit)_
- ☐ Write migration section: how v0.1 examples become v0.2
- ☐ Add new state-machine states (`withdrawn`, `rejected`, `expired`) to SPEC.md, schema, and README state table
- ☐ Specify `did:nostr` ABNF + Ed25519 delegation envelope as a normative section of SPEC.md

**Deliverable:** `SPEC.md` v0.2 + `schema/mate.schema.json` v0.2 + fixture manifest design

### Phase 2: Reference Implementation (7 days)

Single package: `@mate-protocol/core`

- `src/parse.ts` — Parse MATE.md documents:
  - Frontmatter extraction (--- delimiters)
  - YAML parsing with restricted feature set (no aliases/tags/custom scalars)
  - Body extraction
- `src/normalize.ts` — Canonicalize parsed data to stable JSON:
  - Deterministic field ordering
  - Unicode normalization (NFC)
  - Timestamp normalization
  - Null value omission
- `src/validate.ts` — Validate against schema and spec rules:
  - Schema validation via ajv
  - Single-document semantic invariants (state-required fields, timestamp ordering, state-machine legality for transitions visible *within* the document)
  - Proof shape check (algorithm presence, key reference format)
  - **Actual Ed25519 signature verification** against canonicalized core bytes using a vetted crypto library (`@noble/ed25519`)
  - **DID resolution** for `did:key` (self-contained, multicodec `0xed`) and `did:nostr` (npub → Ed25519 delegation envelope per the spec) — both mandatory in v0.2
  - Pre-computed test vectors ship with the package so adopters can verify their implementations against canonical signatures
- `src/cli.ts` — CLI binary `mate`:
  - `mate validate <file...>` — schema + single-doc semantics
  - `mate inspect <file>` — outputs normalized JSON (proves canonicalization)
- `src/index.ts` — Public API exports: `parseMateDocument()`, `normalizeMateDocument()`, `validateMateDocument()`, `verifyProof()`, `resolveDid()`

**Deliverable:** npm package `@mate-protocol/core` with parse, normalize, validate (incl. signature verification), CLI, and `did:key` + `did:nostr` resolution

### Phase 3: Conformance + Docs (3 days)

- Fixture manifest at `fixtures/manifest.json`:
  - Each fixture has: file path, expected result (pass/fail), category (schema/semantic/proof/canonicalization), rationale string
- Valid fixtures: existing examples + new edge cases (20+)
- Invalid fixtures: malformed frontmatter, illegal state transitions, missing required fields, canonicalization violations
- Proof verification test vectors (pre-computed signatures for known keypairs covering both `did:key` and `did:nostr` paths; included as canonical fixtures any third-party implementation can verify against)
- CI pipeline (GitHub Actions):
  - `npm test` — Vitest suite
  - `npm run validate-all` — `mate validate` on all fixtures, compare against manifest
- README update:
  - Badges (spec version, CI status, conformance count)
  - Quick start: "What is a MATE.md?" in 30 seconds
  - Adoption checklist
- CONTRIBUTING.md update: conformance instructions, PR template, development setup

**Deliverable:** CI pipeline + conformance suite + docs

---

## 7. Timeline

| Phase | Duration | Notes |
|-------|----------|-------|
| P1: Spec polish + canonicalization + proof profile + `did:nostr` ABNF | 7 days | Hardest phase; spec is the contract |
| P2: Reference implementation (YAML-only, single package, real Ed25519 verify + dual DID resolution) | 7 days | +2 days vs. prior estimate to absorb actual signature verification and `did:nostr` delegation handling |
| P3: Conformance + fixtures + docs | 3 days | Fixture manifest design starts in P1 |
| **Total** | **17 working days** | ~3.5 weeks |

Narrow-scope estimate. Dedicated focused work from one builder. If YAML restriction debates or the `did:nostr` delegation envelope take longer than planned in P1, the protocol semantics work spills into P2 and the realistic total is 4 weeks.

---

## 8. What Already Exists (Can Ship with Minimal Changes)

- `README.md` — solid overview, needs version/state wording updates and badges
- `SPEC.md` — coherent but draft-quality; needs normative language pass
- `schema/mate.schema.json` — usable but needs v0.2 version bump + strictening
- `examples/mate-only/MATE.md` — valid spec example, can become conformance fixture
- `examples/openclaw/*` — valid spec examples, demonstrate profile/memory references
- `examples/json-agent-card/*` — valid spec example with JSON backend
- `docs/concepts.md` — good conceptual framing, needs minor updates for v0.2
- `docs/lifecycle.md` — seed state machine, needs formal transition table
- `docs/identity.md`, `docs/memory-adapters.md` — solid reference docs
- `CONTRIBUTING.md` — existing skeleton, needs expansion
- `EXTENSION-NOSTR.md` — experimental draft, move to doc/ and mark as draft

---

## 9. What Needs Writing

| Item | Status | Effort |
|------|--------|--------|
| Normative state transition table with invariants (incl. `withdrawn` / `rejected` / `expired`) | Write from scratch | 1 day |
| Canonicalization rules (detailed) | Write from scratch | 1.5 day |
| Proof profile specification (Ed25519 + canonicalization) | Write from scratch | 1 day |
| `did:nostr` ABNF + Ed25519 delegation envelope spec | Write from scratch | 1 day |
| Validation levels documentation | Write from scratch | 0.5 day |
| v0.2 JSON Schema (core strict, extensions open, new terminal states) | Update existing | 0.75 day |
| Fixture manifest design | Write from scratch | 0.5 day |
| Migration guide (v0.1 → v0.2) | Write from scratch | 0.5 day |
| Reference parser (TypeScript, YAML-only) | Write from scratch | 2 days |
| Reference normalizer (TypeScript) | Write from scratch | 1 day |
| Reference validator (TypeScript, schema + single-doc semantic + Ed25519 signature verify) | Write from scratch | 3 days |
| `did:key` + `did:nostr` resolution helpers | Write from scratch | 1 day |
| CLI tool (`validate` + `inspect`) | Write from scratch | 1 day |
| Conformance test suite (Vitest fixture-driven, incl. signature-verify fixtures) | Write from scratch | 1.5 day |
| Fixture files (valid + invalid + proof test vectors for both DID methods) | Write from scratch | 1 day |
| CI pipeline (GitHub Actions) | Write from scratch | 0.5 day |
| README badges/quickstart/adoption checklist | Update existing | 0.5 day |
| GH release (v0.2 tag + release notes) | One-time action | 0.1 day |

---

## 10. Success Criteria (What "Released" Looks Like)

On the dashboard, "✓ Released" means:

1. **`SPEC.md` v0.2 published** — normative state machine, canonicalization rules, mandatory proof profile, validation level documentation — all mergeable to main
2. **`schema/mate.schema.json` v0.2** — core strict (`additionalProperties: false`), `extensions` open, version-tagged
3. **`@mate-protocol/core` npm package** — `mate validate` (with actual Ed25519 signature verification) and `mate inspect` work on real MATE.md files; `did:key` and `did:nostr` both resolve and verify against canonical test vectors
4. **Conformance suite passes** — >= 20 fixtures across schema / semantic / proof-verify / canonicalization categories, CI green. Proof-verify fixtures execute real signature verification, not shape checks.
5. **Fixture manifest published** — machine-readable expected outcomes for all fixtures
6. **GitHub release `v0.2.0`** — tagged commit with release notes, changelog, migration guide
7. **Adoption docs** — README updated with quickstart, at least one external developer can read and implement from it

---

## Notes

- YAML-only frontmatter for v0.2. Other frontmatter formats (JSON, TOML) can be added in v0.3+.
- The reference implementation **performs actual Ed25519 signature verification** for the mandatory proof profile, using `did:key` and `did:nostr` resolution. Other DID methods (`did:web`, `did:plc`, etc.) are extension-defined and not required for v0.2 conformance.
- `did:nostr` is first-class in v0.2 alongside `did:key`. The Ed25519 delegation envelope (vs. raw secp256k1 BIP-340 signatures) is mandated for the v0.2 proof profile so the same verifier code path serves both DID methods.
- Transition validation (did this bond illegally go from `active` to `proposed`?) requires history and is out of scope for v0.2. The spec should state this clearly.
- Pre-acceptance terminal states (`withdrawn`, `rejected`, `expired`) are deliberately distinct from `revoked`. `revoked` is reserved for the breaking of a previously-established (accepted) bond — this asymmetry preserves the semantic weight of `revoked`.
- After v0.2, consider writing an OpenClaw plugin that maintains MATE.md bond state as part of the agent's memory — that's the fastest path to real adoption.
- The Nostr transport adapter is valuable but **not a blocker** for v0.2. The core spec should be transport-agnostic.
- v0.2 sets the precedent for extension governance: extensions MUST be namespaced (e.g., `extensions.nostr >`). The `extensions` map is the sole escape hatch from the strict core schema.
