import { describe, expect, test } from 'vitest';

import { normalizeMateDocument, parseMateDocument } from '../src/index.js';

describe('parseMateDocument', () => {
  test('extracts YAML frontmatter and nullable body', () => {
    const { data, body } = parseMateDocument(`---
mate_version: "0.2"
subject:
  id: "did:key:z6MkSubject"
object:
  id: "did:key:z6MkObject"
bond:
  id: "urn:mate:parse"
  state: "proposed"
consent:
  revocable: true
---

# hello
`);

    expect(data.bond.state).toBe('proposed');
    expect(body).toBe('# hello\n');
  });

  test('rejects documents without YAML frontmatter', () => {
    expect(() => parseMateDocument('# no frontmatter')).toThrow(/frontmatter/i);
  });
});

describe('normalizeMateDocument', () => {
  test('omits proofs and nulls while normalizing timestamps and nested keys', () => {
    const { data } = parseMateDocument(`---
mate_version: "0.2"
subject:
  id: "did:key:z6MkSubject"
object:
  id: "did:key:z6MkObject"
bond:
  id: "urn:mate:normalize"
  state: "active"
  updated_at: "2026-04-23T00:15:00Z"
  created_at: "2026-04-23T00:00:00+00:00"
consent:
  revoked_at: null
  accepted_at: "2026-04-23T00:10:00.123Z"
  revocable: true
events:
  latest_hash: null
  type: "jsonl/mate-events"
  uri: "./events.jsonl"
proofs:
  - type: "Ed25519Signature2026"
    verificationMethod: "did:key:z6MkFake"
    algorithm: "ed25519"
    created: "2026-04-23T00:20:00Z"
    proofValue: "ZmFrZQ=="
---
`);

    expect(normalizeMateDocument(data)).toBe(
      '{"mate_version":"0.2","subject":{"id":"did:key:z6MkSubject"},"object":{"id":"did:key:z6MkObject"},"bond":{"created_at":"2026-04-23T00:00:00.000000Z","id":"urn:mate:normalize","state":"active","updated_at":"2026-04-23T00:15:00.000000Z"},"consent":{"accepted_at":"2026-04-23T00:10:00.123000Z","revocable":true},"events":{"type":"jsonl/mate-events","uri":"./events.jsonl"}}',
    );
  });
});
