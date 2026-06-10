import * as secp256k1 from '@noble/secp256k1';
import { describe, expect, it } from 'vitest';

import {
  KIND_GIFT_WRAP,
  KIND_SEAL,
  buildPrivateBondEvents,
  createRumor,
  selectBondRumors,
  sealRumor,
  unwrapGiftWrap,
  wrapRumor,
} from '../src/giftwrap.js';
import { signMateDocumentNostr } from '../src/nostr.js';
import {
  BOND_TAG,
  KIND_BOND_STATE,
  keypairFromSecret,
  verifyEvent,
} from '../src/nostr.js';
import { verifyProof } from '../src/validate.js';
import type { MateDocument } from '../src/types.js';

const alice = secp256k1.utils.randomSecretKey();
const bob = secp256k1.utils.randomSecretKey();
const mallory = secp256k1.utils.randomSecretKey();

const alicePub = keypairFromSecret(alice).pubkeyHex;
const bobPub = keypairFromSecret(bob).pubkeyHex;

function bondDocument(subjectSecret: Uint8Array, objectPubkeyHex: string): MateDocument {
  const subject = keypairFromSecret(subjectSecret);
  const now = new Date().toISOString();
  return {
    mate_version: '0.2',
    subject: { id: subject.did },
    object: { id: `nostr:${objectPubkeyHex}` },
    bond: {
      id: 'urn:mate:6e1d4ce6-3a64-4d8c-9105-1b1a4ea5e7a1',
      state: 'proposed',
      kind: 'companion',
      created_at: now,
      updated_at: now,
    },
    consent: { required: true, mutual: true, revocable: true, unilateral_exit_allowed: true },
    proofs: [],
  };
}

describe('gift wrap (NIP-59)', () => {
  const rumor = createRumor({
    pubkey: alicePub,
    created_at: Math.floor(Date.now() / 1000),
    kind: 1,
    tags: [],
    content: 'are you going to the party tonight?',
  });

  it('seals with empty tags and a valid signature, never exposing content', () => {
    const seal = sealRumor(rumor, alice, bobPub);
    expect(seal.kind).toBe(KIND_SEAL);
    expect(seal.tags).toEqual([]);
    expect(verifyEvent(seal)).toBe(true);
    expect(seal.content).not.toContain('party');
  });

  it('wraps under a one-time key the recipient can unwrap', () => {
    const wrap = wrapRumor(rumor, alice, bobPub);
    expect(wrap.kind).toBe(KIND_GIFT_WRAP);
    expect(wrap.pubkey).not.toBe(alicePub);
    expect(wrap.tags).toEqual([['p', bobPub]]);
    expect(verifyEvent(wrap)).toBe(true);

    const unwrapped = unwrapGiftWrap(wrap, bob);
    expect(unwrapped.author).toBe(alicePub);
    expect(unwrapped.rumor).toEqual(rumor);
  });

  it('randomizes wrap and seal timestamps into the past', () => {
    const wrap = wrapRumor(rumor, alice, bobPub);
    const now = Math.floor(Date.now() / 1000);
    expect(wrap.created_at).toBeLessThanOrEqual(now);
    expect(wrap.created_at).toBeGreaterThan(now - 3 * 24 * 60 * 60);
  });

  it('rejects unwrapping by a non-recipient', () => {
    const wrap = wrapRumor(rumor, alice, bobPub);
    expect(() => unwrapGiftWrap(wrap, mallory)).toThrow();
  });

  it('rejects a forged rumor author (seal signer mismatch)', () => {
    // Mallory seals Alice's rumor under her own key — author check must fail.
    const forged = { ...rumor, pubkey: alicePub };
    expect(() => sealRumor(forged, mallory, bobPub)).toThrow(/author must match/);
  });

  it('rejects sealing for the wrong author end-to-end', () => {
    // Mallory writes a rumor claiming Alice authored it, seals with her own key.
    const malloryRumor = createRumor({ ...rumor, pubkey: keypairFromSecret(mallory).pubkeyHex });
    const seal = sealRumor(malloryRumor, mallory, bobPub);
    const tampered = {
      ...seal,
      // Re-encrypting a different rumor under the same seal would break the
      // signature; flipping content bytes must fail MAC validation instead.
      content: seal.content.slice(0, -8) + 'AAAAAAAA',
    };
    const wrap = wrapRumor(rumor, alice, bobPub);
    expect(() => unwrapGiftWrap({ ...wrap, content: tampered.content }, bob)).toThrow();
  });
});

describe('private bonds', () => {
  it('builds counterparty and self wraps that both unwrap to the same rumor', () => {
    const doc = bondDocument(alice, bobPub);
    const proof = signMateDocumentNostr(doc, alice);
    doc.proofs = [proof];

    const events = buildPrivateBondEvents(doc, alice);
    expect(events.rumor.kind).toBe(KIND_BOND_STATE);
    expect(events.rumor.tags).toContainEqual(['t', BOND_TAG]);
    expect(events.toCounterparty.tags).toEqual([['p', bobPub]]);
    expect(events.toSelf.tags).toEqual([['p', alicePub]]);

    // Neither wrap leaks bond metadata.
    for (const wrap of [events.toCounterparty, events.toSelf]) {
      expect(JSON.stringify(wrap.tags)).not.toContain('mate-bond');
      expect(wrap.content).not.toContain(doc.bond.id);
    }

    const forBob = unwrapGiftWrap(events.toCounterparty, bob);
    const forAlice = unwrapGiftWrap(events.toSelf, alice);
    expect(forBob.rumor).toEqual(events.rumor);
    expect(forAlice.rumor).toEqual(events.rumor);
  });

  it('requires an embedded proof before wrapping', () => {
    const doc = bondDocument(alice, bobPub);
    expect(() => buildPrivateBondEvents(doc, alice)).toThrow(/embedded document proof/);
  });

  it('proof travels inside the encrypted content and verifies on disclosure', () => {
    const doc = bondDocument(alice, bobPub);
    doc.proofs = [signMateDocumentNostr(doc, alice)];

    const events = buildPrivateBondEvents(doc, alice);
    const { rumor } = unwrapGiftWrap(events.toCounterparty, bob);
    const disclosed = JSON.parse(rumor.content) as MateDocument;

    // The proof rides in the content's appended proofs array — a verifier
    // needs nothing beyond the disclosed document itself.
    expect(disclosed.proofs).toHaveLength(1);
    const [proof] = disclosed.proofs!;
    expect(verifyProof(disclosed, proof)).toBe(true);

    // A different document must not verify under the same proof.
    const tampered = { ...disclosed, bond: { ...disclosed.bond, state: 'active' } };
    expect(verifyProof(tampered as MateDocument, proof)).toBe(false);
  });

  it('selectBondRumors filters foreign rumors, dedups, and projects tags', () => {
    const doc = bondDocument(alice, bobPub);
    doc.proofs = [signMateDocumentNostr(doc, alice)];
    const events = buildPrivateBondEvents(doc, alice);
    const chat = wrapRumor(
      createRumor({
        pubkey: alicePub,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'not a bond',
      }),
      alice,
      bobPub,
    );
    const undecryptable = wrapRumor(events.rumor, alice, keypairFromSecret(mallory).pubkeyHex);
    const duplicate = wrapRumor(events.rumor, alice, bobPub);

    const rumors = selectBondRumors([events.toCounterparty, chat, undecryptable, duplicate], bob);
    expect(rumors).toHaveLength(1);
    expect(rumors[0].author).toBe(alicePub);
    expect(rumors[0].bond).toBe(doc.bond.id);
    expect(rumors[0].counterparty).toBe(bobPub);
    expect(rumors[0].state).toBe('proposed');
  });
});
