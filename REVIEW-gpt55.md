# MATE.md v0.2 Build Plan — Engineering Review

## 1. What the plan gets right

- The release framing is correct: v0.2 should be a spec-and-reference release, not a product and not a transport project.
- The highest-value deliverables are correctly prioritized: normative spec, stricter schema, reference validator, conformance fixtures, docs, and CI.
- Deferring Nostr is the right call. `EXTENSION-NOSTR.md` is useful but explicitly ABI-unstable, and including it in v0.2 would drag the release into relay discovery, event-kind allocation, spam policy, and identity mapping.
- The plan correctly identifies that the current repo is a solid skeleton. The existing `README.md`, `SPEC.md`, lifecycle doc, schema, and examples are enough to turn into fixtures.
- The success criteria are practical and testable. ">= 20 fixtures, valid + invalid, CI green" is the right kind of release gate.
- `additionalProperties: false` on core fields is directionally right. The current schema is too loose everywhere; v0.2 needs a real core/extensions boundary.

## 2. What's missing or underspecified

- Canonicalization is under-scoped. This is the hardest part of the release, not a one-day spec polish item. The plan must define exactly what bytes are signed and validated:
  - frontmatter only or full document
  - parsed data canonicalized to JSON or original text preserved
  - whitespace handling
  - field ordering
  - null versus omitted fields
  - Unicode normalization
  - timestamp normalization
  - whether YAML aliases/tags/custom scalars are allowed

- Frontmatter format support is inconsistent with the current spec. The current spec says Markdown with YAML frontmatter. The plan proposes YAML + JSON + TOML support. That multiplies parser and canonicalization complexity for little v0.2 value. Pick YAML only for v0.2 unless there is a real adopter need.

- Proof verification is too vague. "Signature format, key material reference, verification algorithm" needs concrete profiles. For v0.2, define one mandatory-to-implement proof profile, probably detached Ed25519 over canonicalized core data, and mark other proof types as extension-defined. Otherwise the validator can only check shape, not interoperability.

- State transitions are not well-defined for a single static document. A validator cannot know whether `active -> proposed` happened unless it has a previous document or event history. The plan should separate:
  - document state invariants, validateable from one file
  - transition validation, requiring previous state or event log
  - mutual-bond resolution, requiring both parties' declarations

- Mutuality/consent semantics need sharper invariants. Current examples allow `bond.state: active` with `consent.mutual: true` and no proofs. That may be fine as an unsigned example, but v0.2 should state whether mutual active bonds require dual signatures, reciprocal documents, an event reference, or are merely declarative claims.

- Schema strictness needs a migration design. Setting `additionalProperties: false` blindly inside `subject`, `object`, `bond`, `consent`, `events`, and `runtime` may break current flexibility unless extension points are explicit. The plan should define which nested maps stay open, if any. My recommendation: core objects strict; `subject.profile` and `object.profile` strict with `uri`/`type`; all non-core extensibility goes under `extensions.<namespace>`.

- The package architecture is underspecified. "Deno or Node" is not a target. Choose one primary runtime and publish target. For credibility, v0.2 should probably be Node ESM with browser-safe parser/validator exports, plus a Node-only CLI.

- The parser plan is too hand-wavy. "Custom minimal parser (regex + JSON parse)" does not match YAML frontmatter. Use a small, boring parser stack and restrict YAML features, or implement a deliberately tiny YAML subset and document it. Do not pretend regex + JSON parse handles the current examples.

- Conformance should include a machine-readable manifest. Fixtures need expected outcome and reason, not just files in valid/invalid folders. Include cases for schema-invalid, spec-invalid, canonicalization-invalid, and proof-invalid separately.

- The release plan does not mention package publishing/versioning details:
  - npm package name and scope
  - CLI binary name
  - exports map
  - ESM/CJS stance
  - browser bundle stance
  - lockfile/package manager
  - generated schema URL/versioning

- The repo currently includes `GIT_INIT_NOTE.txt`, which looks like scaffolding debris. The cleanup phase should explicitly remove it.

## 3. Scope critique

Cut from v0.2:

- TOML frontmatter support. It creates canonicalization and dependency work without improving protocol credibility.
- Deno as a first-class implementation target unless someone is actively adopting it. TypeScript can be Deno-compatible later; do not make it a release promise.
- `mate check <spec-dir>` as currently described. It is unclear whether this checks a user directory, the upstream conformance suite, or third-party implementation output. Start with `mate validate <file...>` and `mate conformance` or `vitest` for the reference suite.
- Proof verification across multiple algorithms. One interoperable algorithm beats several shape-only placeholders.
- Any extension lifecycle tooling beyond a simple `docs/extensions.md` namespace rule.

Pull into v0.2:

- A fixture manifest format, e.g. `fixtures/manifest.json`, with expected result, category, and rationale.
- A "single-document vs history-aware validation" distinction in the spec and CLI.
- A canonical JSON representation of the parsed core object. Even if authors write YAML, machines need one stable representation.
- A minimal `mate parse <file>` or `mate inspect <file>` command that outputs normalized JSON. This is more useful for adopters than `mate check <spec-dir>` and proves canonicalization works.
- A migration section explaining how v0.1 examples become v0.2 examples.

## 4. Tech stack feedback

- TypeScript is the right first implementation language. It fits browser/Node consumers, schema tooling, and future OpenClaw/runtime adapters.
- Ajv is the right JSON Schema validator, but the plan should include `ajv-formats` for `date-time`. Without it, timestamp format validation is incomplete.
- Vitest is fine. The test suite should be fixture-driven and should run both library tests and CLI smoke tests.
- JSON Schema draft 2020-12 is fine, but only if the repo commits to validator support and schema URL/version stability.
- For parsing, prefer a known frontmatter/YAML parser plus explicit restrictions. Candidate shape:
  - `gray-matter` or a tiny delimiter splitter for frontmatter boundaries
  - `yaml` or `js-yaml` for YAML parsing
  - reject non-plain YAML features if canonicalization/proofs are involved
- Avoid a heavy monorepo unless there is a real need. For v0.2, one package can expose:
  - `parseMateDocument`
  - `normalizeMateDocument`
  - `validateMateDocument`
  - CLI binary `mate`
  Splitting parser, validator, and CLI into three packages may cost more setup than it saves.
- If separate packages are kept, define the workspace tooling up front: npm/pnpm, TypeScript config, build tool, exports, and CI.

## 5. Timeline reality check

Three weeks is possible only if this is one person's focused work and the scope is narrowed.

The optimistic parts:

- Canonicalization + proof verification will take longer than planned. Expect 3-5 days just to get this right enough to publish without regret.
- Reference implementation setup will take longer if it becomes a three-package monorepo with browser compatibility and CLI packaging.
- Conformance fixtures will take longer if they cover semantic validation, not just schema validation.
- Docs will take longer because the spec needs to be implementable by strangers, not just internally coherent.

More realistic shape:

- Narrow v0.2: 3 weeks.
- Current plan as written: 4 weeks.
- Current plan plus multi-format frontmatter and serious proof verification: 4-5 weeks.

The phase most likely to slip is Phase 1, not Phase 2. If the spec is ambiguous, the implementation will either stall or encode accidental policy.

## 6. Single biggest risk

The biggest risk is publishing a validator before the protocol semantics are precise enough.

If canonicalization, proof scope, mutuality, and transition validation are left ambiguous, the TypeScript package will become the real spec by accident. That creates exactly the interoperability problem v0.2 is supposed to solve.

## 7. Recommendation

Ship with changes before publishing.

The plan is directionally right and should not be reworked from scratch, but it needs a tighter v0.2 contract:

- YAML-only frontmatter for v0.2.
- One canonical machine representation.
- One mandatory proof profile or proof verification deferred to shape-only validation with honest wording.
- Clear separation between schema validation, single-document semantic validation, and history-aware transition validation.
- One package target: Node ESM library + Node CLI, with browser-safe exports.
- Fixture manifest and CLI `parse/inspect` output added to success criteria.

With those changes, the plan is credible. As written, it risks underestimating the protocol-design work and overbuilding package structure before the core semantics are stable.
