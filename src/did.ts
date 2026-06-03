import { base58, bech32 } from '@scure/base';

import { ProofAlgorithm } from './types.js';

export interface ResolvedDid {
  algorithm: ProofAlgorithm;
  publicKey: Uint8Array;
}

export function resolveDid(did: string): ResolvedDid {
  if (did.startsWith('did:key:')) {
    return resolveDidKey(did);
  }

  if (did.startsWith('did:nostr:')) {
    return resolveDidNostr(did);
  }

  if (did.startsWith('did:web:')) {
    throw new Error('did:web resolution is out of scope for MATE.md v0.2');
  }

  throw new Error(`Unrecognized DID method: ${did}`);
}

function resolveDidKey(did: string): ResolvedDid {
  const didWithoutFragment = did.split('#')[0] ?? did;
  const encoded = didWithoutFragment.slice('did:key:'.length);

  if (!encoded.startsWith('z')) {
    throw new Error('did:key Ed25519 key must be multibase base58btc with z prefix');
  }

  const bytes = base58.decode(encoded.slice(1));

  if (bytes.length !== 34 || bytes[0] !== 0xed || bytes[1] !== 0x01) {
    throw new Error('did:key must use Ed25519 multicodec prefix 0xed');
  }

  return {
    algorithm: ProofAlgorithm.Ed25519,
    publicKey: bytes.slice(2),
  };
}

function resolveDidNostr(did: string): ResolvedDid {
  const didWithoutFragment = did.split('#')[0] ?? did;
  const npub = didWithoutFragment.slice('did:nostr:'.length);
  const decoded = bech32.decode(npub, 1000);

  if (decoded.prefix !== 'npub') {
    throw new Error('did:nostr must contain an npub bech32 public key');
  }

  const publicKey = new Uint8Array(bech32.fromWords(decoded.words));
  if (publicKey.length !== 32) {
    throw new Error('did:nostr npub must decode to a 32-byte x-only secp256k1 public key');
  }

  return {
    algorithm: ProofAlgorithm.Bip340Schnorr,
    publicKey,
  };
}
