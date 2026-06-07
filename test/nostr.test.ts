import { describe, expect, test } from 'vitest';

import {
  buildBondStateEvent,
  computeEventId,
  generateNostrKeypair,
  keypairFromSecret,
  normalizeMateDocument,
  parseMateDocument,
  pubkeyHexFromIdentity,
  secretFromNsec,
  verifyEvent,
  KIND_BOND_STATE,
} from '../src/index.js';

function bondDoc(subjectDid: string, objectDid: string): string {
  return `---
mate_version: "0.2"
subject:
  id: "${subjectDid}"
object:
  id: "${objectDid}"
bond:
  id: "urn:mate:nostr-test"
  state: "proposed"
  kind: "companion"
  created_at: "2026-06-07T00:00:00Z"
  updated_at: "2026-06-07T00:00:00Z"
consent:
  revocable: true
proofs: []
---
`;
}

describe('Nostr identity', () => {
  test('keypair round-trips through nsec and resolves consistent pubkey hex', () => {
    const kp = generateNostrKeypair();
    expect(kp.npub).toMatch(/^npub1/);
    expect(kp.nsec).toMatch(/^nsec1/);
    expect(kp.did).toBe(`did:nostr:${kp.npub}`);

    const secret = secretFromNsec(kp.nsec);
    expect(keypairFromSecret(secret).pubkeyHex).toBe(kp.pubkeyHex);
  });

  test('pubkeyHexFromIdentity accepts npub, did:nostr, nostr:<hex>, and bare hex', () => {
    const kp = generateNostrKeypair();
    expect(pubkeyHexFromIdentity(kp.npub)).toBe(kp.pubkeyHex);
    expect(pubkeyHexFromIdentity(kp.did)).toBe(kp.pubkeyHex);
    expect(pubkeyHexFromIdentity(`nostr:${kp.pubkeyHex}`)).toBe(kp.pubkeyHex);
    expect(pubkeyHexFromIdentity(kp.pubkeyHex)).toBe(kp.pubkeyHex);
  });
});

describe('buildBondStateEvent', () => {
  test('builds a verifiable kind:30317 event with the expected tags and content', () => {
    const subject = generateNostrKeypair();
    const object = generateNostrKeypair();
    const { data } = parseMateDocument(bondDoc(subject.did, object.did));
    const secret = secretFromNsec(subject.nsec);

    const event = buildBondStateEvent(data, secret, { createdAt: 1_750_000_000 });

    expect(event.kind).toBe(KIND_BOND_STATE);
    expect(event.pubkey).toBe(subject.pubkeyHex);
    expect(event.content).toBe(normalizeMateDocument(data));
    expect(event.tags).toContainEqual(['d', 'urn:mate:nostr-test']);
    expect(event.tags).toContainEqual(['p', object.pubkeyHex]);
    expect(event.tags).toContainEqual(['state', 'proposed']);
    expect(verifyEvent(event)).toBe(true);
  });

  test('event id is deterministic and tampering breaks verification', () => {
    const subject = generateNostrKeypair();
    const object = generateNostrKeypair();
    const { data } = parseMateDocument(bondDoc(subject.did, object.did));
    const secret = secretFromNsec(subject.nsec);

    const event = buildBondStateEvent(data, secret, { createdAt: 1_750_000_000 });
    expect(computeEventId(event)).toBe(event.id);

    const tampered = { ...event, content: event.content.replace('proposed', 'active') };
    expect(verifyEvent(tampered)).toBe(false);
  });
});
