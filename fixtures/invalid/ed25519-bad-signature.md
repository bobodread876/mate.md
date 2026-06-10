---
mate_version: "0.2"
subject:
  id: "did:key:z6MkfkzzRPZmuRPRjBSHV1yuTty14vwL3hZRv5JNmgnqQrFc"
object:
  id: "did:key:z6MkObjectExample"
bond:
  id: "urn:mate:01HXED25519"
  state: "proposed"
  kind: "unspecified"
  created_at: "2026-04-23T00:00:00.000000Z"
  updated_at: "2026-04-23T00:00:00.000000Z"
consent:
  revocable: true
proofs:
  - type: "Ed25519Signature2026"
    verificationMethod: "did:key:z6MkfkzzRPZmuRPRjBSHV1yuTty14vwL3hZRv5JNmgnqQrFc"
    algorithm: "ed25519"
    created: "2026-04-23T00:00:00.000000Z"
    proofValue: "z4jXtLqottiy2WB7W6JLuXGViqoW1CHoQzfs3iQ11iqLriJctEfPCN73JbotPmQkB2RpxZYqHxr1aMPN4j1yuRqcD"
---

# Ed25519 Bad Signature

Proof value is garbage bytes — signature verification MUST fail.
