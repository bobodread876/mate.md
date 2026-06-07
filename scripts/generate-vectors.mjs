// Regenerate proper test vectors
import * as ed25519 from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';
import * as secp256k1 from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha2.js';
import { bech32 } from '@scure/base';
import { base58 } from '@scure/base';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

ed25519.hashes.sha512 = sha512;
secp256k1.hashes.sha256 = sha256;

function hex(b) {
  return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
}

function bech32EncodeNpub(pubkeyBytes) {
  const words = bech32.toWords(pubkeyBytes);
  return bech32.encode('npub', words, 1000);
}

// Ed25519 keypair
const edPriv = ed25519.utils.randomSecretKey();
const edPub = await ed25519.getPublicKey(edPriv);

// did:key from Ed25519 pub
const multicodecPrefix = new Uint8Array([0xed, 0x01]);
const didKeyBytes = new Uint8Array(multicodecPrefix.length + edPub.length);
didKeyBytes.set(multicodecPrefix);
didKeyBytes.set(edPub, 2);
const didKey = 'did:key:z' + base58.encode(didKeyBytes);

// BIP-340 keypair (32-byte x-only secp256k1)
import { randomBytes } from 'node:crypto';
const bipPriv = randomBytes(32);
const bipFullPub = secp256k1.getPublicKey(bipPriv);
const bipXOnly = bipFullPub.slice(1); // drop 0x02/0x03 prefix

const npub = bech32EncodeNpub(bipXOnly);
const didNostr = 'did:nostr:' + npub;

const edVectors = {
  note: 'Deterministic Ed25519 keypair for MATE.md v0.2 test vectors. DO NOT USE IN PRODUCTION.',
  privateKeyHex: hex(edPriv),
  publicKeyHex: hex(edPub),
  didKey,
};

const bipVectors = {
  note: 'Deterministic secp256k1 (BIP-340) keypair for MATE.md v0.2 test vectors. DO NOT USE IN PRODUCTION.',
  privateKeyHex: hex(bipPriv),
  publicKeyHex: hex(bipFullPub),
  xOnlyPublicKeyHex: hex(bipXOnly),
  npub,
  didNostr,
};

const root = new URL('..', import.meta.url).pathname;
writeFileSync(join(root, 'fixtures/vectors/ed25519-keys.json'), JSON.stringify(edVectors, null, 2) + '\n');
writeFileSync(join(root, 'fixtures/vectors/bip340-keys.json'), JSON.stringify(bipVectors, null, 2) + '\n');

console.log('Ed25519 key:', hex(edPub), 'length:', edPub.length, 'did:', didKey);
console.log('BIP340 key:', hex(bipXOnly), 'length:', bipXOnly.length, 'npub:', npub);
