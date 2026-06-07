import * as ed25519 from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';
import { base58 } from '@scure/base';

import { normalizeMateDocument } from './normalize.js';
import { ProofAlgorithm, type MateDocument, type Proof } from './types.js';

ed25519.hashes.sha512 = sha512;

const ED25519_MULTICODEC_PREFIX = new Uint8Array([0xed, 0x01]);

export interface Ed25519Keypair {
  /** did:key identity derived from the public key. */
  did: string;
  /** 32-byte Ed25519 seed, base64-encoded. Keep secret. */
  secretKey: string;
}

/** Generate a fresh Ed25519 identity for a MATE.md agent. */
export function generateEd25519Keypair(): Ed25519Keypair {
  const secret = ed25519.utils.randomSecretKey();
  const publicKey = ed25519.getPublicKey(secret);

  return {
    did: didKeyFromEd25519PublicKey(publicKey),
    secretKey: Buffer.from(secret).toString('base64'),
  };
}

/** Encode an Ed25519 public key as a did:key (multicodec 0xed, base58btc). */
export function didKeyFromEd25519PublicKey(publicKey: Uint8Array): string {
  const prefixed = new Uint8Array(ED25519_MULTICODEC_PREFIX.length + publicKey.length);
  prefixed.set(ED25519_MULTICODEC_PREFIX, 0);
  prefixed.set(publicKey, ED25519_MULTICODEC_PREFIX.length);

  return `did:key:z${base58.encode(prefixed)}`;
}

export interface SignOptions {
  /** Override the proof `created` timestamp (defaults to now). */
  created?: string;
}

/**
 * Produce a detached Ed25519 proof over the canonical form of `doc`.
 *
 * The signature covers `normalizeMateDocument(doc)`, which omits `proofs`, so
 * a document can be signed and re-signed without invalidating prior proofs.
 */
export function signMateDocument(
  doc: MateDocument,
  secretKeyBase64: string,
  options: SignOptions = {},
): Proof {
  const secret = Buffer.from(secretKeyBase64, 'base64');
  if (secret.length !== 32) {
    throw new Error(`Ed25519 secret key must be 32 bytes, got ${secret.length}`);
  }

  const secretBytes = new Uint8Array(secret);
  const publicKey = ed25519.getPublicKey(secretBytes);
  const canonicalBytes = new TextEncoder().encode(normalizeMateDocument(doc));
  const signature = ed25519.sign(canonicalBytes, secretBytes);

  return {
    type: 'Ed25519Signature2026',
    verificationMethod: didKeyFromEd25519PublicKey(publicKey),
    algorithm: ProofAlgorithm.Ed25519,
    created: options.created ?? new Date().toISOString(),
    value: `z${base58.encode(signature)}`,
  };
}
