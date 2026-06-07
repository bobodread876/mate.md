// Script: Generate Ed25519 and BIP-340 signed MATE.md fixtures
// Uses the pre-computed key vectors from fixtures/vectors/
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import * as ed25519 from '@noble/ed25519';
import { sha256, sha512 } from '@noble/hashes/sha2.js';
import * as secp256k1 from '@noble/secp256k1';
import { base58 } from '@scure/base';

import { normalizeMateDocument } from '../dist/normalize.js';

ed25519.hashes.sha512 = sha512;
secp256k1.hashes.sha256 = sha256;

const root = new URL('..', import.meta.url).pathname;

const ed25519Keys = JSON.parse(
  readFileSync(join(root, 'fixtures/vectors/ed25519-keys.json'), 'utf8')
);

const bip340Keys = JSON.parse(
  readFileSync(join(root, 'fixtures/vectors/bip340-keys.json'), 'utf8')
);

function canonicalBytes(doc) {
  return new TextEncoder().encode(normalizeMateDocument(doc));
}

function decodeHex(hex) {
  return new Uint8Array(hex.match(/.{1,2}/g).map((b) => parseInt(b, 16)));
}

function encodeBase58btc(data) {
  return 'z' + base58.encode(data);
}

// === Ed25519 fixture ===
const ed25519PrivateKey = decodeHex(ed25519Keys.privateKeyHex);
const ed25519Doc = {
  mate_version: '0.2',
  subject: { id: ed25519Keys.didKey },
  object: { id: 'did:key:z6MkObjectExample' },
  bond: {
    id: 'urn:mate:01HXED25519',
    state: 'proposed',
    kind: 'unspecified',
    created_at: '2026-04-23T00:00:00.000000Z',
    updated_at: '2026-04-23T00:00:00.000000Z',
  },
  consent: { revocable: true },
  proofs: [],
};

const ed25519Sig = await ed25519.sign(canonicalBytes(ed25519Doc), ed25519PrivateKey);
const ed25519ProofValue = encodeBase58btc(ed25519Sig);

writeFileSync(join(root, 'fixtures/valid/ed25519-signed-proposed.md'), `---
mate_version: "0.2"
subject:
  id: "${ed25519Keys.didKey}"
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
    verificationMethod: "${ed25519Keys.didKey}"
    algorithm: "ed25519"
    created: "2026-04-23T00:00:00.000000Z"
    value: "${ed25519ProofValue}"
---

# Ed25519-Signed Proposed Bond

This document is signed by the subject using Ed25519.
Key: ${ed25519Keys.didKey}
`);

console.log('✅ Ed25519 fixture. Value starts with', ed25519ProofValue.substring(0, 15));

// === BIP-340 fixture ===
const bip340PrivateKey = decodeHex(bip340Keys.privateKeyHex);
const bip340Doc = {
  mate_version: '0.2',
  subject: { id: bip340Keys.didNostr },
  object: { id: 'did:nostr:npub1objecttestkey4matev02nostrverificationkey' },
  bond: {
    id: 'urn:mate:01HXBIP340',
    state: 'proposed',
    kind: 'unspecified',
    created_at: '2026-04-23T00:00:00.000000Z',
    updated_at: '2026-04-23T00:00:00.000000Z',
  },
  consent: { revocable: true },
  proofs: [],
};

const bip340Bytes = canonicalBytes(bip340Doc);
const bip340Hash = sha256(bip340Bytes);
const bip340Sig = await secp256k1.schnorr.sign(bip340Hash, bip340PrivateKey);
const bip340ProofValue = encodeBase58btc(bip340Sig);

writeFileSync(join(root, 'fixtures/valid/bip340-signed-proposed.md'), `---
mate_version: "0.2"
subject:
  id: "${bip340Keys.didNostr}"
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
    verificationMethod: "${bip340Keys.didNostr}"
    algorithm: "bip340-schnorr"
    created: "2026-04-23T00:00:00.000000Z"
    value: "${bip340ProofValue}"
---

# BIP-340 Signed Proposed Bond

This document is signed by the subject using BIP-340 (Schnorr over secp256k1).
Key: ${bip340Keys.didNostr}
`);

console.log('✅ BIP340 fixture. Value starts with', bip340ProofValue.substring(0, 15));

// === Bad-signature fixtures (same documents, wrong value) ===
const badEd25519Val = 'z' + base58.encode(new Uint8Array(64).fill(0xba));
writeFileSync(join(root, 'fixtures/invalid/ed25519-bad-signature.md'), `---
mate_version: "0.2"
subject:
  id: "${ed25519Keys.didKey}"
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
    verificationMethod: "${ed25519Keys.didKey}"
    algorithm: "ed25519"
    created: "2026-04-23T00:00:00.000000Z"
    value: "${badEd25519Val}"
---

# Ed25519 Bad Signature

Proof value is garbage bytes — signature verification MUST fail.
`);

const badBip340Val = 'z' + base58.encode(new Uint8Array(64).fill(0xde));
writeFileSync(join(root, 'fixtures/invalid/bip340-bad-signature.md'), `---
mate_version: "0.2"
subject:
  id: "${bip340Keys.didNostr}"
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
    verificationMethod: "${bip340Keys.didNostr}"
    algorithm: "bip340-schnorr"
    created: "2026-04-23T00:00:00.000000Z"
    value: "${badBip340Val}"
---

# BIP-340 Bad Signature

Proof value is garbage bytes — signature verification MUST fail.
`);

console.log('✅ Bad signature fixtures generated.');
