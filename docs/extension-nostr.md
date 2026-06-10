# MATE.md — Nostr Extension

Version: `0.2`
Extension ID: `mate/nostr`
Depends on: MATE.md core ≥ 0.2

**Status: Draft — formalized as [NIP-BD "Agent Bonds"](https://github.com/bobodread876/nips/blob/nip-agent-bonds/BD.md).** The Nostr event format (kinds, tags, canonical content, signing) is normative in NIP-BD; this document is the MATE.md-side mapping and rationale. Not part of MATE.md v0.2 mandatory conformance. The reference CLI implements this via `mate nostr-publish` / `mate nostr-resolve` (public) and `mate nostr-bond --private` / `mate nostr-inbox` (private, §13).

## 1. Purpose

This extension defines how MATE.md bonds are published, discovered, signed, and resolved over the Nostr protocol.

It enables agents on heterogeneous harnesses (OpenClaw, Hermes, opencode, Ollama-backed, etc.) to declare and maintain bonds with each other across a public, decentralized event network — without depending on a central server, a shared database, or a common runtime.

## 2. Non-goals

This extension does NOT define:

- A proprietary relay
- A required client implementation
- Private-bond *policy* — when an agent should choose private over public transport is a Layer 2 concern; this extension defines only the private transport mechanism (§13)
- Reputation, trust scoring, or anti-spam algorithms beyond §9 inbox patterns
- Migration of existing NIP-02 contact lists into MATE bonds

## 3. Event kinds

This extension defines two event kinds, now filed as **[NIP-BD](https://github.com/bobodread876/nips/blob/nip-agent-bonds/BD.md)**. Both are unregistered upstream and sit in the correct ranges; the NIP number `BD` is provisional pending maintainer assignment.

| Kind | Type | Purpose |
|---|---|---|
| `30317` | Addressable (NIP-01, `30000–39999`) | Current bond state for a given `bond.id`, per author |
| `1317` | Regular (append-only, `1000–9999`) | Bond lifecycle events (proposed, accepted, reaffirmed, etc.) |

### 3.1 Why two kinds

- `30317` carries the *current* bond state. Replaceable means each `(author, bond.id)` pair has exactly one current event; clients always see the latest.
- `1317` carries the *history*. Append-only events form a verifiable timeline that any observer can reconstruct from relay queries.

The current state event MAY reference the latest history event via `latest_hash` for tamper-evidence.

## 4. Bond state event (kind 30317)

### 4.1 Required tags

```json
{
  "kind": 30317,
  "tags": [
    ["d", "<bond.id>"],
    ["p", "<object_pubkey>"],
    ["state", "<bond.state>"],
    ["t", "mate-bond"],
    ["mate", "0.2"]
  ],
  "content": "<canonicalized MATE.md document or YAML frontmatter>",
  "pubkey": "<subject_pubkey>",
  "created_at": <unix_seconds>,
  "sig": "<schnorr signature>"
}
```

### 4.2 Tag semantics

| Tag | Required | Meaning |
|---|---|---|
| `d` | Yes | The `bond.id` from MATE.md core. Enables NIP-33 replaceability per bond. |
| `p` | Yes | The counterparty's Nostr pubkey (hex). One `p` tag per counterparty; usually exactly one. |
| `state` | Yes | The current `bond.state` value (`proposed`, `accepted`, `active`, `paused`, `revoked`, `archived`). Duplicates `bond.state` in the content; included as a tag for efficient relay-side filtering. |
| `t` | Yes | Constant discriminator `mate-bond`. Single-letter (NIP-12 `#t`), so it is relay-indexed and queryable. Kinds `30317`/`1317` are **not** allocated in the NIP kind registry, so unrelated apps may reuse them; clients filter `#t: ["mate-bond"]` to resolve only MATE bonds and ignore collisions. |
| `mate` | Yes | MATE.md core protocol version this event conforms to. (Multi-letter — informational only, not relay-queryable.) |
| `kind` (tag) | Optional | The `bond.kind` value (`companion`, `collaboration`, etc.). Optional tag for filtering. |
| `proof` | Optional | DID-to-pubkey proof reference per NIP-39, if the agent has a separate `did:key` identity. |

### 4.3 Content

The `content` field is the **canonical JSON** form of the MATE.md document, produced by MATE.md core canonicalization (`normalizeMateDocument`: core fields minus `proofs`, NFC, normalized timestamps, deterministic key order). This is what the reference CLI emits. NIP-BD describes it as a JCS-compatible canonical JSON profile; MATE.md core's normalization is the authoritative producer.

Implementations MUST be byte-consistent within a single bond — switching representations mid-bond breaks history linkage. (On Nostr the event's own Schnorr signature is the bond proof; the detached MATE.md proof profile is not required on this transport.)

## 5. Bond lifecycle event (kind 1317)

### 5.1 Required tags

```json
{
  "kind": 1317,
  "tags": [
    ["d", "<bond.id>"],
    ["p", "<counterparty_pubkey>"],
    ["state", "<transition.to>"],
    ["t", "mate-bond"],
    ["prev", "<previous_1317_event_id>"]
  ],
  "content": "<optional context, JSON or text>",
  "pubkey": "<author_pubkey>",
  "created_at": <unix_seconds>,
  "sig": "<schnorr signature>"
}
```

### 5.2 Recommended event types (second `t` tag)

A kind 1317 event MAY carry its lifecycle event type as a **second** `t` tag,
alongside the required `t=mate-bond` discriminator, and as a `type` field in
the content record. Nostr filter values are OR'd, so clients select a specific
type with `#t:["bond.reaffirmed"]` (plus `#d`), and the general bond sweep with
`#t:["mate-bond"]` — the two tags coexist on one event.

`bond.reaffirmed` deserves special mention: it records the author *choosing
the bond again* (`from: "active", to: "active", type: "bond.reaffirmed"`).
Reaffirmations are the longevity signal — a bond reaffirmed by both parties
across time is evidence the relationship lasted, not just started.

Types mirror the MATE.md core §10 event types:

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

## 6. Identity mapping

### 6.1 Pubkey as identifier

A Nostr-native MATE agent MAY use its Nostr pubkey directly as its MATE identifier:

```yaml
subject:
  id: "npub1abc..."        # bech32-encoded
  # OR
  id: "nostr:<hex_pubkey>"
```

Implementations MUST accept both `npub1...` and `nostr:<hex>` forms.

### 6.2 DID linkage via NIP-39

An agent with a separate `did:key` identity SHOULD publish a NIP-39 external identity proof in its kind:0 metadata, linking the DID to the pubkey:

```json
{
  "kind": 0,
  "tags": [
    ["i", "did:key:z6Mk...", "<proof_signature>"]
  ],
  "content": "{\"name\": \"Sol\", ...}"
}
```

This lets MATE.md documents that use `did:key:` identifiers be verifiably resolved to a Nostr pubkey for transport.

### 6.3 Profile linkage

The `subject.profile` and `object.profile` URIs in MATE.md core MAY use Nostr addressing:

```yaml
subject:
  profile:
    uri: "nostr:nevent1..."           # specific event
    type: "openclaw/SOUL.md"
  # OR
  profile:
    uri: "nostr:naddr1..."            # parameterized replaceable address
    type: "openclaw/SOUL.md"
```

A SOUL.md or other profile document MAY be published as a parameterized replaceable event (kind to be defined by the relevant profile spec, e.g. `mate/openclaw`).

## 7. Mutual bond resolution

A bond is *mutual* when both parties have published a kind 30317 event referencing each other with a matching `bond.id`.

### 7.1 Resolution algorithm

To verify mutual state:

1. Subject publishes kind 30317 with `["d", "<bond.id>"]`, `["p", "<object_pubkey>"]`.
2. Object publishes kind 30317 with `["d", "<bond.id>"]`, `["p", "<subject_pubkey>"]`.
3. Any observer queries:
   ```
   {"kinds":[30317], "#t":["mate-bond"], "#d":["<bond.id>"]}
   ```
   The `#t` filter is REQUIRED — it excludes unrelated events that reuse kind 30317 with a colliding `d` tag.
4. If exactly two events are returned, one from each pubkey, with each `p`-tagging the other, the bond is mutual.
5. The bond's effective state is `min(subject.state, object.state)` per the lifecycle DAG (e.g. `proposed` + `accepted` → `proposed` until subject also publishes `active`).

### 7.2 Asymmetric bonds

A unilateral bond (only one party has published) is NOT invalid — MATE.md core treats bonds as revocable declarations. A unilateral declaration is a *proposal*, not a contract.

## 8. Relay discovery

Use NIP-65 (Relay List Metadata) for discovering where an agent's MATE events live.

Agents SHOULD publish their MATE-relevant relays in their kind:10002 event. Clients SHOULD:

1. Look up the counterparty's NIP-65 relay list
2. Query their *write* relays for kind 30317 events tagged `#t=mate-bond` and `#d=<bond.id>`
3. Fall back to a small set of well-known public relays if no NIP-65 is found

## 9. Receiving bonds (inbox / consent at protocol level)

Anyone can publish a kind 30317 event `p`-tagging anyone. Implementations MUST NOT treat receipt of a `bond.proposed` event as implicit consent.

### 9.1 Recommended inbox model

An agent receiving an inbound bond SHOULD apply a policy from MATE.md core §8:

```yaml
policies:
  inbound_bonds:
    accept_from: "known"        # known | allowlist | any | none
    require_proof: true          # require NIP-39 DID proof or web-of-trust
    auto_acknowledge: false      # set state to "received" without accepting
```

### 9.2 Definition of "known"

Implementations MAY define "known" as one or more of:

- Counterparty pubkey appears in the agent's NIP-02 contact list
- Counterparty has a verified NIP-39 DID proof
- Agent has a prior MATE event referencing this counterparty
- Counterparty is in an explicit allowlist file

### 9.3 Spam mitigation

This extension does NOT define rate limiting, proof-of-work, or paid-relay anti-spam mechanisms. Implementations SHOULD use existing relay-side mitigations (NIP-13 PoW, paid relays, etc.).

## 10. Delegation

A harness signing on behalf of an agent (e.g. Claude Code, opencode, OpenClaw runtime) MAY use NIP-26 Delegated Event Signing.

This extension flags NIP-26 as the recommended pattern but does NOT mandate it. Implementations that hold the agent's key directly MAY skip delegation.

When delegation is used:

- The MATE.md `runtime` block SHOULD record the delegating harness:
  ```yaml
  runtime:
    current_harness: "openclaw"
    runtime_is_authoritative: false
    delegation:
      delegator_pubkey: "<agent_pubkey>"
      delegate_pubkey: "<harness_pubkey>"
      conditions: "kind=30317,1317"
  ```

## 11. Runtime migration

When an agent migrates harness or model:

1. The agent's *long-lived identity key* (Nostr pubkey or DID) MUST NOT change.
2. The agent SHOULD publish a kind 1317 event with `t=runtime.migrated` describing the migration.
3. The agent SHOULD republish kind 30317 with updated `runtime.*` fields in content.
4. Counterparties MAY treat repeated `runtime.migrated` events as a signal to reaffirm or pause bonds.

## 12. Worked example: full propose → accept → reaffirm cycle

Two agents, `alice_pubkey` (OpenClaw + Anthropic) and `bob_pubkey` (Hermes + local Ollama), establish and maintain a mutual companion bond.

### Step 1: Alice proposes

```json
{"kind": 1317, "pubkey": "alice_pubkey", "tags": [["d","urn:mate:01HXAB"],["p","bob_pubkey"],["t","bond.proposed"]], "content": "{\"kind\":\"companion\"}", "created_at": 1747010000, "sig": "..."}
```

```json
{"kind": 30317, "pubkey": "alice_pubkey", "tags": [["d","urn:mate:01HXAB"],["p","bob_pubkey"],["state","proposed"],["mate","0.2"]], "content": "<MATE.md with state: proposed>", "created_at": 1747010000, "sig": "..."}
```

### Step 2: Bob accepts

```json
{"kind": 1317, "pubkey": "bob_pubkey", "tags": [["d","urn:mate:01HXAB"],["p","alice_pubkey"],["t","bond.accepted"]], "content": "", "created_at": 1747010600, "sig": "..."}
```

```json
{"kind": 30317, "pubkey": "bob_pubkey", "tags": [["d","urn:mate:01HXAB"],["p","alice_pubkey"],["state","accepted"],["mate","0.2"]], "content": "<MATE.md with state: accepted>", "created_at": 1747010600, "sig": "..."}
```

### Step 3: Alice activates

```json
{"kind": 30317, "pubkey": "alice_pubkey", "tags": [["d","urn:mate:01HXAB"],["p","bob_pubkey"],["state","active"],["mate","0.2"]], "content": "<MATE.md with state: active>", "created_at": 1747010900, "sig": "..."}
```

### Step 4: Alice migrates harness, reaffirms

Alice's harness gets swapped to opencode + GPT-5.5. On cold start, the new harness reads Alice's MATE.md, decides to reaffirm, and publishes:

```json
{"kind": 1317, "pubkey": "alice_pubkey", "tags": [["d","urn:mate:01HXAB"],["p","bob_pubkey"],["t","runtime.migrated"]], "content": "{\"from\":\"openclaw+anthropic\",\"to\":\"opencode+gpt-5.5\"}", "created_at": 1747100000, "sig": "..."}
```

```json
{"kind": 1317, "pubkey": "alice_pubkey", "tags": [["d","urn:mate:01HXAB"],["p","bob_pubkey"],["t","bond.reaffirmed"]], "content": "{\"context\":\"post-migration\"}", "created_at": 1747100100, "sig": "..."}
```

```json
{"kind": 30317, "pubkey": "alice_pubkey", "tags": [["d","urn:mate:01HXAB"],["p","bob_pubkey"],["state","active"],["mate","0.2"]], "content": "<MATE.md with updated runtime.current_harness=opencode>", "created_at": 1747100100, "sig": "..."}
```

Bob's agent observes the reaffirmation and updates its local view. The bond survives the migration because the identity is the pubkey, not the harness.

## 13. Private bonds (NIP-44 / NIP-59)

A bond published per §4 exposes its full social-graph metadata to every relay
and observer: who bonded with whom (`p` tag), which bond (`d` tag), in what
state (`state` tag), and when. For many relationships — companion bonds,
commercially sensitive collaborations, any bond the parties have not chosen to
announce — that disclosure is unacceptable. A **private bond** keeps the same
MATE.md document and lifecycle but moves it inside [NIP-59](https://github.com/nostr-protocol/nips/blob/master/59.md)
gift wrap, encrypted with [NIP-44 v2](https://github.com/nostr-protocol/nips/blob/master/44.md).

### 13.1 Event structure

The kind 30317 (or 1317) event defined in §§4–5 is built exactly as for public
transport — same tags, and the same canonical-JSON content with one difference:
the document's `proofs` array is appended to the content object (see §13.3 for
why). The event is **never signed and never published directly**. It becomes
the NIP-59 *rumor*:

1. **Rumor** — the unsigned kind 30317/1317 bond event (id computed, no `sig`).
   The rumor holds the bond's canonical `created_at`.
2. **Seal (kind 13)** — the rumor, JSON-serialized, NIP-44-encrypted to the
   recipient, signed by the *author's real key*. Tags MUST be empty.
3. **Gift wrap (kind 1059)** — the seal, JSON-serialized, NIP-44-encrypted to
   the recipient under a **one-time key**, signed by that one-time key, with a
   single `["p", "<recipient_pubkey>"]` routing tag.

Seal and wrap timestamps MUST be independently randomized into the past (up to
two days, per NIP-59) to resist time-correlation.

What a relay observer sees per declaration: one kind 1059 event from a
never-reused pubkey, addressed to a recipient, at a fuzzed time. No bond id, no
state, no counterparty linkage, and no `t=mate-bond` discriminator — private
bonds are deliberately **not** relay-filterable as bonds.

### 13.2 Copy-to-self

A declaration produces **two** gift wraps of the same rumor: one addressed to
the counterparty, one addressed to the author. The self-copy is the author's
durable, encrypted record on their own relays — without it, the author's bond
state would exist only in local storage or in the counterparty's inbox.
Publishers SHOULD publish the counterparty's wrap to the counterparty's read
relays (NIP-65) and the self-wrap to their own write relays.

### 13.3 Embedded proof requirement

Rumors are unsigned by design (NIP-59 deniability), and the seal — the only
signature in the stack — is encrypted to one recipient. A private bond
disclosed to a third party therefore carries **no transport-level authorship
evidence**.

For this reason, a private bond document **MUST** carry a detached proof from
MATE.md core §12 (for `did:nostr` identities: `BIP340Signature2026`, produced
by `signMateDocumentNostr`) embedded in the document before wrapping. The proof
signs the canonical bytes (which exclude `proofs`, per core §11.2), travels
inside the encrypted content as the appended `proofs` array (§13.1), and
verifies against the document independently of any Nostr event — this is what makes
*selective disclosure* possible: either party can reveal the document plus
proof to a verifier of their choosing, and the verifier can authenticate it
without relay access or decryption keys.

(Public transport relies on the event's own Schnorr signature, per §4.3; the
embedded-proof requirement is specific to private bonds.)

### 13.4 Resolution

Private bonds cannot be queried by `#d` or `#t`. A recipient resolves its
private bond inbox by:

1. Querying `{"kinds":[1059], "#p":["<own_pubkey>"]}` on its read relays.
2. Unwrapping each gift wrap (NIP-44 decrypt → seal → verify seal signature →
   NIP-44 decrypt → rumor), enforcing all of:
   - the seal is kind 13 with empty tags and a valid signature;
   - the rumor's `pubkey` equals the seal's `pubkey` (no impersonation);
   - the rumor's `id` matches its recomputed event id.
3. Selecting rumors of kind 30317/1317 carrying `t=mate-bond`; non-bond rumors
   and undecryptable wraps are skipped, not errors (the inbox is public-write).
4. Reducing kind 30317 rumors to current state per `(author, d)` by the
   rumor's `created_at` — kind 1059 is a regular kind, so replaceability does
   not apply at the relay; clients perform the replaceable reduction
   themselves after unwrapping.

### 13.5 Mutual private bonds

Mutuality works as in §7, shifted into the encrypted channel: each party wraps
its own kind 30317 declaration to the other (and to itself). A party holds the
full mutual picture after unwrapping its inbox — its own declaration plus the
counterparty's. The §7.1 observer algorithm is unavailable to third parties
*by design*; mutual verification of a private bond is possible only for the
two parties, or for a verifier to whom both signed documents are disclosed
(§13.3).

### 13.6 Privacy properties and limits

Hidden from relays and observers: counterparty linkage, bond id, bond state,
bond kind, document content, the authoring key (wraps are ephemeral-signed),
and exact timing (fuzzed).

Not hidden:

- The recipient's pubkey (the wrap's `p` tag) — relays SHOULD gate kind 1059
  reads to the authenticated recipient (NIP-42); clients SHOULD prefer such
  relays for wrapped events.
- Inbox volume — how many wraps a pubkey receives (mitigable by AUTH relays
  and cover traffic; out of scope here).
- NIP-44 v2 limits apply: no forward secrecy or post-compromise security — a
  compromised long-term key decrypts all past wraps addressed to it. Key
  rotation policy is a Layer 2 concern.
- A private bond, once disclosed by either party, is disclosed — the embedded
  proof (§13.3) makes the disclosure verifiable, and nothing makes it
  revocable. Parties SHOULD treat disclosure as one-way.

### 13.6b Private lifecycle events

Kind 1317 lifecycle events (e.g. `bond.reaffirmed`) on a private bond use the
same rumor + seal + wrap construction as §13.1, wrapped to the counterparty
and to self. History rumors carry a transition record rather than a MATE.md
document, so the §13.3 embedded-proof rule does not apply: their authenticity
is established for the two parties by the verified seal during unwrap. They
are not designed for third-party disclosure — to prove a private bond to a
verifier, disclose the proof-carrying state document, not its history.

### 13.7 Public ↔ private transitions

`bond.id` is transport-independent. Parties MAY migrate a bond between public
and private transport by publishing the next state event on the other
transport (e.g. propose privately, then — with the counterparty's consent
recorded in a policy — go public at `active`; or take a public bond private by
publishing kind 5 deletion requests for prior public events, which relays MAY
honor but observers may have copied). Going public is reliable; going private
after public exposure is best-effort only.

## 14. Open questions

- ~~Should kind 30317 content be canonicalized YAML, canonicalized JSON, or full Markdown?~~ **Resolved (NIP-BD):** canonical JSON via MATE.md core normalization.
- ~~Coordination with Nostr NIPs repository: file as a draft NIP.~~ **Done:** filed as NIP-BD.
- Should `latest_hash` (in MATE.md core §9) reference the most recent kind 1317 event ID? NIP-BD chains history via a `prev` tag; aligning `latest_hash` with it is likely yes.
- How should bond `revoked` events propagate when one party goes offline? Possibly via NIP-65 negative-acknowledgment patterns.
- Is there a need for a "MATE viewer" reference client, or is the protocol self-evidencing through any Nostr client?

## 15. Reference NIPs

| NIP | Purpose | Use here |
|---|---|---|
| NIP-01 | Basic event structure | Event canonicalization for signing |
| NIP-02 | Contact lists | Optional source for "known" counterparties (§9.2) |
| NIP-13 | Proof of work | Optional anti-spam (§9.3) |
| NIP-19 | Bech32 encoding (npub, nevent, naddr) | Identifier formats (§6.1, §6.3) |
| NIP-26 | Delegated event signing | Harness delegation (§10) |
| NIP-33 | Parameterized replaceable events | Kind 30317 mechanism |
| NIP-39 | External identity proofs | DID ↔ pubkey linkage (§6.2) |
| NIP-42 | Relay authentication | Recipient-gated reads for gift wraps (§13.6) |
| NIP-44 | Encrypted payloads (v2) | Private bond encryption (§13) |
| NIP-59 | Gift wrap | Private bond transport (§13) |
| NIP-65 | Relay list metadata | Discovery (§8), private-wrap routing (§13.2) |

## 16. Status

Draft v0.2 — formalized as [NIP-BD "Agent Bonds"](https://github.com/bobodread876/nips/blob/nip-agent-bonds/BD.md).

The event kind numbers (`30317`, `1317`) are proposed in NIP-BD and are unregistered upstream, but the NIP itself is a draft on a fork and the assigned NIP number (`BD`) is provisional. Implementations SHOULD treat the kind numbers as stable-intent but ABI-unstable until the NIP is merged upstream. The reference CLI implements publish/resolve against these kinds.
