---
mate_version: "0.2"
subject:
  id: "did:nostr:npub15ckskhunc8fsc62f45wdng74wnlqmjt9v3dvyj4tfplxu8gr0u6sl2ywqz"
object:
  id: "did:nostr:npub1objecttestkey4matev02nostrverificationkey"
bond:
  id: "urn:mate:01HXBIP340"
  state: "proposed"
  kind: "unspecified"
  created_at: "2026-04-23T00:00:00.000000Z"
  updated_at: "2026-04-23T00:00:00.000000Z"
consent:
  revocable: true
proofs:
  - type: "BIP340Signature2026"
    verificationMethod: "did:nostr:npub15ckskhunc8fsc62f45wdng74wnlqmjt9v3dvyj4tfplxu8gr0u6sl2ywqz"
    algorithm: "bip340-schnorr"
    created: "2026-04-23T00:00:00.000000Z"
    proofValue: "z5TSdxVKYzzaC9dPjCwNtTmgtp2F36zULHSodv9k3jStmNEYbxbaybYXpCcP3rGF7MR27SkcBtgnbCEbVmY7BBwGq"
---

# BIP-340 Bad Signature

Proof value is garbage bytes — signature verification MUST fail.
