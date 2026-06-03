---
mate_version: "0.2"
subject:
  id: "did:key:z6MkhaX7BHNJ7ytsBHzQZYZqJsmFJGvvqPRTzQgKgKFBCZ1R"
  profile:
    uri: "./SOUL.md"
    type: "openclaw/SOUL.md"
object:
  id: "did:key:z6MkObjectExample"
bond:
  id: "urn:mate:01HXACTIVE"
  state: "active"
  kind: "companion"
  created_at: "2026-04-23T00:00:00.000Z"
  updated_at: "2026-04-23T00:15:00.000Z"
consent:
  required: true
  mutual: true
  revocable: true
  unilateral_exit_allowed: true
  accepted_at: "2026-04-23T00:10:00.000Z"
events:
  uri: "./events.jsonl"
  type: "jsonl/mate-events"
extensions:
  org.example.rituals:
    reaffirmation: "On restart, reread MATE.md"
proofs: []
---
