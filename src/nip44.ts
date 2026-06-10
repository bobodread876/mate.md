// NIP-44 v2 encrypted payloads (https://github.com/nostr-protocol/nips/blob/master/44.md).
//
// secp256k1 ECDH → HKDF-SHA256 → ChaCha20 + HMAC-SHA256, base64 payload.
// Conversation keys are symmetric: conversationKey(a, B) === conversationKey(b, A).
// Verified against the official test vectors (fixtures/vectors/nip44.vectors.json,
// sha256 269ed0f6… as pinned in the NIP).

import { chacha20 } from '@noble/ciphers/chacha.js';
import { expand, extract } from '@noble/hashes/hkdf.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import * as secp256k1 from '@noble/secp256k1';
import { base64 } from '@scure/base';

const VERSION = 2;
const MIN_PLAINTEXT_SIZE = 1;
const MAX_PLAINTEXT_SIZE = 65535;

/**
 * Derive the long-term conversation key between two parties: ECDH over
 * secp256k1 (unhashed x coordinate), then HKDF-extract with salt "nip44-v2".
 */
export function getConversationKey(secret: Uint8Array, counterpartyPubkeyHex: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/i.test(counterpartyPubkeyHex)) {
    throw new Error('expected a 64-character hex pubkey');
  }
  // x-only Nostr pubkeys lift to the even-y point, per BIP-340.
  const compressed = new Uint8Array(33);
  compressed[0] = 0x02;
  compressed.set(Uint8Array.from(Buffer.from(counterpartyPubkeyHex, 'hex')), 1);
  const shared = secp256k1.getSharedSecret(secret, compressed, true);
  const sharedX = shared.subarray(1, 33);
  return extract(sha256, sharedX, new TextEncoder().encode('nip44-v2'));
}

interface MessageKeys {
  chachaKey: Uint8Array;
  chachaNonce: Uint8Array;
  hmacKey: Uint8Array;
}

function getMessageKeys(conversationKey: Uint8Array, nonce: Uint8Array): MessageKeys {
  if (conversationKey.length !== 32) {
    throw new Error('invalid conversation_key length');
  }
  if (nonce.length !== 32) {
    throw new Error('invalid nonce length');
  }
  const keys = expand(sha256, conversationKey, nonce, 76);
  return {
    chachaKey: keys.subarray(0, 32),
    chachaNonce: keys.subarray(32, 44),
    hmacKey: keys.subarray(44, 76),
  };
}

export function calcPaddedLen(unpaddedLen: number): number {
  if (!Number.isSafeInteger(unpaddedLen) || unpaddedLen < 1) {
    throw new Error('expected a positive integer');
  }
  if (unpaddedLen <= 32) {
    return 32;
  }
  const nextPower = 1 << (Math.floor(Math.log2(unpaddedLen - 1)) + 1);
  const chunk = nextPower <= 256 ? 32 : nextPower / 8;
  return chunk * (Math.floor((unpaddedLen - 1) / chunk) + 1);
}

function pad(plaintext: string): Uint8Array {
  const unpadded = new TextEncoder().encode(plaintext);
  if (unpadded.length < MIN_PLAINTEXT_SIZE || unpadded.length > MAX_PLAINTEXT_SIZE) {
    throw new Error('invalid plaintext size: must be between 1 and 65535 bytes');
  }
  const padded = new Uint8Array(2 + calcPaddedLen(unpadded.length));
  padded[0] = unpadded.length >> 8;
  padded[1] = unpadded.length & 0xff;
  padded.set(unpadded, 2);
  return padded;
}

function unpad(padded: Uint8Array): string {
  const unpaddedLen = (padded[0] << 8) | padded[1];
  const unpadded = padded.subarray(2, 2 + unpaddedLen);
  if (
    unpaddedLen < MIN_PLAINTEXT_SIZE ||
    unpaddedLen > MAX_PLAINTEXT_SIZE ||
    unpadded.length !== unpaddedLen ||
    padded.length !== 2 + calcPaddedLen(unpaddedLen)
  ) {
    throw new Error('invalid padding');
  }
  return new TextDecoder().decode(unpadded);
}

function hmacAad(key: Uint8Array, message: Uint8Array, aad: Uint8Array): Uint8Array {
  if (aad.length !== 32) {
    throw new Error('AAD associated data must be 32 bytes');
  }
  const combined = new Uint8Array(aad.length + message.length);
  combined.set(aad, 0);
  combined.set(message, aad.length);
  return hmac(sha256, key, combined);
}

function decodePayload(payload: string): { nonce: Uint8Array; ciphertext: Uint8Array; mac: Uint8Array } {
  if (payload.length === 0 || payload[0] === '#') {
    throw new Error('unknown encryption version');
  }
  if (payload.length < 132 || payload.length > 87472) {
    throw new Error('invalid payload size');
  }
  const data = base64.decode(payload);
  if (data.length < 99 || data.length > 65603) {
    throw new Error('invalid data size');
  }
  if (data[0] !== VERSION) {
    throw new Error(`unknown encryption version ${data[0]}`);
  }
  return {
    nonce: data.subarray(1, 33),
    ciphertext: data.subarray(33, data.length - 32),
    mac: data.subarray(data.length - 32),
  };
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

/** Encrypt plaintext under a conversation key. `nonce` is injectable for tests only. */
export function nip44Encrypt(
  plaintext: string,
  conversationKey: Uint8Array,
  nonce: Uint8Array = crypto.getRandomValues(new Uint8Array(32)),
): string {
  const { chachaKey, chachaNonce, hmacKey } = getMessageKeys(conversationKey, nonce);
  const ciphertext = chacha20(chachaKey, chachaNonce, pad(plaintext));
  const mac = hmacAad(hmacKey, ciphertext, nonce);

  const payload = new Uint8Array(1 + nonce.length + ciphertext.length + mac.length);
  payload[0] = VERSION;
  payload.set(nonce, 1);
  payload.set(ciphertext, 1 + nonce.length);
  payload.set(mac, 1 + nonce.length + ciphertext.length);
  return base64.encode(payload);
}

/** Decrypt a NIP-44 v2 payload under a conversation key. Throws on any tamper. */
export function nip44Decrypt(payload: string, conversationKey: Uint8Array): string {
  const { nonce, ciphertext, mac } = decodePayload(payload);
  const { chachaKey, chachaNonce, hmacKey } = getMessageKeys(conversationKey, nonce);
  if (!constantTimeEqual(hmacAad(hmacKey, ciphertext, nonce), mac)) {
    throw new Error('invalid MAC');
  }
  return unpad(chacha20(chachaKey, chachaNonce, ciphertext));
}
