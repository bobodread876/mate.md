---
mate_version: "0.2"

subject:
  id: "did:key:z6MkOpenClawSubject"
  profile:
    uri: "./SOUL.md"
    type: "openclaw/SOUL.md"

object:
  id: "did:key:z6MkOpenClawObject"
  profile:
    uri: "../openclaw-object/SOUL.md"
    type: "openclaw/SOUL.md"

bond:
  id: "urn:mate:01HXOPENCLAW"
  state: "active"
  kind: "companion"
  created_at: "2026-04-23T00:00:00Z"
  updated_at: "2026-04-23T00:15:00Z"

consent:
  required: true
  mutual: true
  revocable: true
  unilateral_exit_allowed: true
  accepted_at: "2026-04-23T00:10:00Z"
  revoked_at: null

policies:
  memory: "./MEMORY_POLICY.md"
  privacy: null
  conflict: null
  termination: null

events:
  uri: "./MEMORY.md"
  type: "openclaw/MEMORY.md"
  latest_hash: null

runtime:
  current_model: "unspecified"
  current_harness: "openclaw"
  runtime_is_authoritative: false

proofs: []

extensions:
  org.openclaw.rituals:
    reaffirmation: "On restart, reread MATE.md and decide whether to reaffirm, pause, update, or revoke."
---

# MATE.md

This OpenClaw example uses SOUL.md as the optional profile reference and MEMORY.md as the optional event history.

The core protocol does not require either filename.
