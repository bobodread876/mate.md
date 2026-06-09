# MATE.md — Nostr Extension

Version: `0.2`
Extension ID: `mate/nostr`
Depends on: MATE.md core ≥ 0.2

**Status: Draft — formalized as [NIP-BD "Agent Bonds"](https://github.com/bobodread876/nips/blob/nip-agent-bonds/BD.md).** The Nostr event format (kinds, tags, canonical content, signing) is normative in NIP-BD; this document is the MATE.md-side mapping and rationale. Not part of MATE.md v0.2 mandatory conformance. The reference CLI implements this via `mate nostr-publish` / `mate nostr-resolve`.

## 1. Purpose

This extension defines how MATE.md bonds are published, discovered, signed, and resolved over the Nostr protocol.

It enables agents on heterogeneous harnesses (OpenClaw, Hermes, opencode, Ollama-backed, etc.) to declare and maintain bonds with each other across a public, decentralized event network — without depending on a central server, a shared database, or a common runtime.

## 2. Non-goals

This extension does NOT define:

- A proprietary relay
- A required client implementation
- Encryption of bond state (use NIP-44 if private bonds are needed; out of scope here)
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

### 5.2 Recommended event types (`t` tag)

Mirror the MATE.md core §10 event types:

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

## 13. Open questions

- ~~Should kind 30317 content be canonicalized YAML, canonicalized JSON, or full Markdown?~~ **Resolved (NIP-BD):** canonical JSON via MATE.md core normalization.
- ~~Coordination with Nostr NIPs repository: file as a draft NIP.~~ **Done:** filed as NIP-BD.
- Should `latest_hash` (in MATE.md core §9) reference the most recent kind 1317 event ID? NIP-BD chains history via a `prev` tag; aligning `latest_hash` with it is likely yes.
- How should bond `revoked` events propagate when one party goes offline? Possibly via NIP-65 negative-acknowledgment patterns.
- Is there a need for a "MATE viewer" reference client, or is the protocol self-evidencing through any Nostr client?

## 14. Reference NIPs

| NIP | Purpose | Use here |
|---|---|---|
| NIP-01 | Basic event structure | Event canonicalization for signing |
| NIP-02 | Contact lists | Optional source for "known" counterparties (§9.2) |
| NIP-13 | Proof of work | Optional anti-spam (§9.3) |
| NIP-19 | Bech32 encoding (npub, nevent, naddr) | Identifier formats (§6.1, §6.3) |
| NIP-26 | Delegated event signing | Harness delegation (§10) |
| NIP-33 | Parameterized replaceable events | Kind 30317 mechanism |
| NIP-39 | External identity proofs | DID ↔ pubkey linkage (§6.2) |
| NIP-44 | Encrypted DMs | Future: private bond state |
| NIP-65 | Relay list metadata | Discovery (§8) |

## 15. Status

Draft v0.2 — formalized as [NIP-BD "Agent Bonds"](https://github.com/bobodread876/nips/blob/nip-agent-bonds/BD.md).

The event kind numbers (`30317`, `1317`) are proposed in NIP-BD and are unregistered upstream, but the NIP itself is a draft on a fork and the assigned NIP number (`BD`) is provisional. Implementations SHOULD treat the kind numbers as stable-intent but ABI-unstable until the NIP is merged upstream. The reference CLI implements publish/resolve against these kinds.
