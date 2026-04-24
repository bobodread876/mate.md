# Identity

MATE.md is identity-format agnostic.

Recommended identity forms:

- DID
- Nostr public key
- public key fingerprint
- HTTPS URL
- content-addressed identifier
- URN

Profile references are optional.

```yaml
subject:
  id: "did:key:z6Mk..."
  profile:
    uri: "./SOUL.md"
    type: "openclaw/SOUL.md"
```
