import { describe, expect, test } from 'vitest';

import {
  generateEd25519Keypair,
  parseMateDocument,
  signMateDocument,
  validateMateDocument,
  verifyProof,
} from '../src/index.js';

const UNSIGNED = `---
mate_version: "0.2"
subject:
  id: "PLACEHOLDER"
object:
  id: "did:key:z6MkObject"
bond:
  id: "urn:mate:keys-test"
  state: "proposed"
  kind: "companion"
  created_at: "2026-06-07T00:00:00Z"
  updated_at: "2026-06-07T00:00:00Z"
consent:
  revocable: true
proofs: []
---
`;

describe('generateEd25519Keypair', () => {
  test('produces an Ed25519 did:key and a 32-byte secret', () => {
    const { did, secretKey } = generateEd25519Keypair();
    expect(did).toMatch(/^did:key:z6Mk/);
    expect(Buffer.from(secretKey, 'base64').length).toBe(32);
  });
});

describe('signMateDocument', () => {
  test('round-trips: a signed document validates and verifies', () => {
    const { did, secretKey } = generateEd25519Keypair();
    const { data } = parseMateDocument(UNSIGNED.replace('PLACEHOLDER', did));

    const proof = signMateDocument(data, secretKey);
    expect(proof.verificationMethod).toBe(did);

    const signed = { ...data, proofs: [proof] };
    expect(verifyProof(signed, proof)).toBe(true);
    expect(validateMateDocument(signed).valid).toBe(true);
  });

  test('a tampered document fails verification', () => {
    const { did, secretKey } = generateEd25519Keypair();
    const { data } = parseMateDocument(UNSIGNED.replace('PLACEHOLDER', did));

    const proof = signMateDocument(data, secretKey);
    const tampered = { ...data, bond: { ...data.bond, state: 'active' }, proofs: [proof] };
    expect(verifyProof(tampered, proof)).toBe(false);
  });
});
