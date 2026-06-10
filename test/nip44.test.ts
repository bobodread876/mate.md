import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { sha256 } from '@noble/hashes/sha2.js';
import * as secp256k1 from '@noble/secp256k1';
import { describe, expect, it } from 'vitest';

import { calcPaddedLen, getConversationKey, nip44Decrypt, nip44Encrypt } from '../src/nip44.js';

interface Vectors {
  v2: {
    valid: {
      get_conversation_key: { sec1: string; pub2: string; conversation_key: string; note?: string }[];
      get_message_keys: {
        conversation_key: string;
        keys: { nonce: string; chacha_key: string; chacha_nonce: string; hmac_key: string }[];
      };
      calc_padded_len: [number, number][];
      encrypt_decrypt: {
        sec1: string;
        sec2: string;
        conversation_key: string;
        nonce: string;
        plaintext: string;
        payload: string;
      }[];
      encrypt_decrypt_long_msg: {
        conversation_key: string;
        nonce: string;
        pattern: string;
        repeat: number;
        plaintext_sha256: string;
        payload_sha256: string;
      }[];
    };
    invalid: {
      encrypt_msg_lengths: number[];
      get_conversation_key: { sec1: string; pub2: string; note?: string }[];
      decrypt: { conversation_key: string; nonce: string; plaintext: string; payload: string; note?: string }[];
    };
  };
}

const vectors = JSON.parse(
  readFileSync(join(__dirname, '..', 'fixtures', 'vectors', 'nip44.vectors.json'), 'utf8'),
) as Vectors;

const hexToBytes = (hex: string) => Uint8Array.from(Buffer.from(hex, 'hex'));
const bytesToHex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

describe('nip44 official vectors', () => {
  it('derives conversation keys (35 vectors)', () => {
    for (const v of vectors.v2.valid.get_conversation_key) {
      const key = getConversationKey(hexToBytes(v.sec1), v.pub2);
      expect(bytesToHex(key), v.note ?? v.sec1).toBe(v.conversation_key);
    }
  });

  it('calculates padded lengths', () => {
    for (const [unpadded, padded] of vectors.v2.valid.calc_padded_len) {
      expect(calcPaddedLen(unpadded)).toBe(padded);
    }
  });

  it('encrypts and decrypts (10 vectors, exact payloads)', () => {
    for (const v of vectors.v2.valid.encrypt_decrypt) {
      const pub2 = bytesToHex(secp256k1.schnorr.getPublicKey(hexToBytes(v.sec2)));
      const key1 = getConversationKey(hexToBytes(v.sec1), pub2);
      expect(bytesToHex(key1)).toBe(v.conversation_key);

      const payload = nip44Encrypt(v.plaintext, key1, hexToBytes(v.nonce));
      expect(payload).toBe(v.payload);

      const pub1 = bytesToHex(secp256k1.schnorr.getPublicKey(hexToBytes(v.sec1)));
      const key2 = getConversationKey(hexToBytes(v.sec2), pub1);
      expect(nip44Decrypt(payload, key2)).toBe(v.plaintext);
    }
  });

  it('encrypts and decrypts long messages (checksummed vectors)', () => {
    for (const v of vectors.v2.valid.encrypt_decrypt_long_msg) {
      const key = hexToBytes(v.conversation_key);
      const plaintext = v.pattern.repeat(v.repeat);
      expect(bytesToHex(sha256(new TextEncoder().encode(plaintext)))).toBe(v.plaintext_sha256);

      const payload = nip44Encrypt(plaintext, key, hexToBytes(v.nonce));
      expect(bytesToHex(sha256(new TextEncoder().encode(payload)))).toBe(v.payload_sha256);
      expect(nip44Decrypt(payload, key)).toBe(plaintext);
    }
  });

  it('rejects invalid plaintext lengths', () => {
    for (const length of vectors.v2.invalid.encrypt_msg_lengths) {
      const key = crypto.getRandomValues(new Uint8Array(32));
      expect(() => nip44Encrypt('a'.repeat(length), key)).toThrow();
    }
  });

  it('rejects invalid conversation keys', () => {
    for (const v of vectors.v2.invalid.get_conversation_key) {
      expect(() => getConversationKey(hexToBytes(v.sec1), v.pub2), v.note).toThrow();
    }
  });

  it('rejects tampered payloads', () => {
    for (const v of vectors.v2.invalid.decrypt) {
      expect(() => nip44Decrypt(v.payload, hexToBytes(v.conversation_key)), v.note).toThrow();
    }
  });
});
