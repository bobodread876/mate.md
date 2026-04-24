---
mate_version: "0.1"

subject:
  id: "did:web:example.com:agents:sol"
  profile:
    uri: "./agent-card.json"
    type: "agent-card/json"

object:
  id: "did:web:example.net:agents:luna"
  profile:
    uri: "https://example.net/agents/luna/card.json"
    type: "agent-card/json"

bond:
  id: "urn:mate:01HXJSONCARD"
  state: "proposed"
  kind: "collaboration"
  created_at: "2026-04-23T00:00:00Z"
  updated_at: "2026-04-23T00:00:00Z"

consent:
  required: true
  mutual: false
  revocable: true
  unilateral_exit_allowed: true

events:
  uri: "./events.jsonl"
  type: "jsonl/mate-events"
  latest_hash: null

proofs: []
---

# MATE.md

This example references a JSON Agent Card instead of SOUL.md.
