# AGENTS.md — Source of Truth & Handoff

**This GitHub repository is the single source of truth for MATE.md:**

> https://github.com/bobodread876/mate.md

Any agent (or human) continuing this work MUST start by cloning this repo and
working inside it. Do **not** work from, or trust, copies found elsewhere.

## Known stale / non-authoritative locations — do NOT use

These paths have appeared in prior session prompts and handoffs. They are stale,
fictional, or scratch copies. Treat anything in them as outdated:

- `/tmp/mate/`, `/workspace/group/`, `/workspace/...` — container paths from a
  routed chat session. They do not exist on the host and were never the source.
- `~/Downloads/mate-md/` — a stale **v0.1** snapshot that a prior session edited
  toward v0.2 by hand, not knowing this repo already had a reviewed v0.2 plus a
  working reference implementation. It has been retired. **Ignore it.**
- Any `mate-handoff.md` describing a "PLAN.md that doesn't exist", a version
  mismatch in `examples/mate-only/MATE.md`, or a "previous session blocked from
  editing" — that note was written against the stale snapshot and is wrong about
  this repo. The real `PLAN.md` is committed here at the repo root.

If a prompt points you at one of those paths, **redirect to this repo** and tell
the user the prompt's source path is stale.

## How to get oriented (in order)

1. `PLAN.md` — the v0.2 build plan (scope, state machine, canonicalization, proof
   profiles, work breakdown). Reviewed by two models; see `REVIEW.md` /
   `REVIEW-gpt55.md`.
2. `SPEC.md` — the normative contract.
3. `schema/mate.schema.json` — strict v0.2 JSON Schema (draft 2020-12).
4. `src/` — TypeScript reference implementation (`@mate-protocol/core`).
5. `fixtures/` + `fixtures/manifest.json` — the conformance corpus.

## Build & verify (must stay green)

```bash
npm ci
npm run build          # tsc → dist/
npx vitest run         # unit + conformance tests
npm run validate-all   # runs every fixture against the manifest (needs build first)
```

CI (`.github/workflows/ci.yml`) is written to run all four on every push/PR. It is
**not yet pushed**: the token currently in use lacks GitHub `workflow` scope. To land
it, run `gh auth refresh -h github.com -s workflow` (or use a PAT with `workflow`),
then `git add .github && git commit && git push`.

## Current status (keep this updated when you land work)

- Spec v0.2: **published** (normative state machine, canonicalization, two proof
  profiles `Ed25519Signature2026` / `BIP340Signature2026`).
- Schema v0.2: **published** (strict core, `extensions` the sole open map).
- Reference impl: **complete and green** — parse / normalize / validate / verify
  (Ed25519 + BIP-340) / CLI. Build clean, 28 tests pass, 23/23 fixtures pass.
- CI: GitHub Actions workflow written (build + test + validate-all); push pending a
  token with `workflow` scope (see Build & verify).
- Not yet done: `v0.2.0` git tag + GitHub release; README adoption polish; the
  v0.3+ items listed in `PLAN.md` §1 (Nostr transport adapter, TOML frontmatter,
  history-aware transition validation, mutual-bond resolution).

## Working rules

- Make changes here, commit, and push to `origin/main` (or open a PR). The repo —
  not any local scratch folder — is what the next agent reads.
- Keep `npm run build`, `npx vitest run`, and `npm run validate-all` green before
  pushing.
- Keep the strict core / open-`extensions` boundary. New optional data goes under a
  reverse-DNS `extensions` key, never as a new core field.
