# MATE.md v0.2 Build Plan — Consolidated Dual-Model Review

**Reviewers:** Patoo (deepseek) + Vandana (gpt-5.5, max thinking)  
**Date:** 2026-06-03

---

## What Both Reviews Agree On

1. **Plan framing is correct.** v0.2 as a spec-and-reference release, not a product. Deferring Nostr is right. Scope discipline is good.

2. **TypeScript is the right first language** for reference implementation — fits Node + browser, good conformance tooling.

3. **`additionalProperties: false` on core, keep `extensions` open** — both call out the core/extension boundary as critical.

4. **3 weeks is optimistic.** Both flag that canonicalization + proof semantics will take longer than estimated.

5. **Biggest risk: underspecified proof format.** If v0.2 ships without a concrete, mandatory proof/verification mechanism, every implementation will interpret it differently and fragment the protocol.

---

## Key Changes Recommended

### 1. YAML-only frontmatter for v0.2
Both agree: drop TOML from Phase 2. JSON frontmatter support should be spec-level (it's valid frontmatter per the spec) but the reference parser ships YAML-first. The current repo uses YAML. Don't multiply surface area.

### 2. Pick a concrete proof profile
- One mandatory-to-implement proof format: detached Ed25519 over canonicalized core data.
- Other proof types permitted via `extensions` or future profiles.
- Must define exactly what bytes get signed (canonicalization bytes, not raw text).

### 3. Scoped canonicalization rules
Define explicitly in the plan:
- Frontmatter only (body is opaque unless extensions define otherwise)
- Parsed data canonicalized to JSON (field order, whitespace, unicode normalization)
- Timestamp normalization rules
- null vs omitted fields

### 4. Separate document validation from transition validation
The spec must distinguish:
- **Single-document invariants** — validateable from one MATE.md file (schema check, required fields per state)
- **Transition validation** — requires previous state or event log (out of scope for v0.2 reference impl, but spec must note it)
- **Mutual-bond resolution** — requires both parties' documents (out of scope for v0.2)

### 5. Move from 3-package monorepo to single package
One npm package exposing:
- `parseMateDocument()`
- `normalizeMateDocument()`
- `validateMateDocument()`
- CLI binary: `mate`
Target: Node ESM, browser-safe exports. No separate parser/validator/cli packages for v0.2.

### 6. Fixture manifest
`fixtures/manifest.json` with expected outcome, category (schema-valid, spec-valid, canonicalization-valid, proof-valid), and rationale. Don't just drop files in valid/invalid folders.

### 7. CLI changes
- `mate validate <file...>` — schema + single-doc semantics
- `mate inspect <file>` — outputs normalized JSON (proves canonicalization works)
- Drop `mate check <spec-dir>` from v0.2 scope
- `mate conformance` — runs reference test suite

### 8. Cleanup
- Remove `GIT_INIT_NOTE.txt` (scaffolding debris)
- Add npm package publishing details: name, scope, exports map, ESM/CJS
- Add migration section: how v0.1 examples become v0.2

---

## Revised Timeline

| Phase | Estimated | Notes |
|-------|-----------|-------|
| P1: Spec polish + canonicalization + proof profile | 7 days | 2 days longer than originally planned; this is the hardest part |
| P2: Reference implementation (YAML-only, single package) | 5 days | Doable if scope is tight |
| P3: Conformance + fixtures + docs | 3 days | Need fixture manifest design upfront |
| Buffer | 1 day | |
| **Total** | **3 weeks** | Narrow-scope: 3 weeks. Original scope: 4 weeks. |

---

## Recommendation

**Ship the plan with the above changes applied.** The direction is right. The scope just needs sharper edges around YAML, proof format, and the document/transition distinction. Apply changes directly to `plan.md`, then publish to the repo.
