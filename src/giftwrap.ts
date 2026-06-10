// NIP-59 gift wrap (https://github.com/nostr-protocol/nips/blob/master/59.md)
// and the private bond transport built on it.
//
// A private bond keeps the relationship off the public graph: the kind:30317/1317
// bond event stays an unsigned *rumor*, sealed (kind:13, signed by the real
// author) and gift-wrapped (kind:1059, signed by a one-time key) per recipient.
// Relays see only: an ephemeral author, the recipient's p tag, and a randomized
// timestamp. No bond id, no state, no counterparty linkage, no `t` discriminator.
//
// Because rumors are unsigned, a disclosed rumor proves nothing by itself. The
// authorship evidence for a private bond is the MATE.md document's embedded
// proof (SPEC §12) inside the rumor content — sign documents before wrapping.

import * as secp256k1 from '@noble/secp256k1';

import { getConversationKey, nip44Decrypt, nip44Encrypt } from './nip44.js';
import {
  KIND_BOND_HISTORY,
  KIND_BOND_STATE,
  buildUnsignedBondHistoryEvent,
  buildUnsignedBondStateEvent,
  computeEventId,
  finalizeEvent,
  keypairFromSecret,
  pubkeyHexFromIdentity,
  verifyEvent,
  type NostrEvent,
  type Transition,
  type UnsignedEvent,
} from './nostr.js';
import type { MateDocument } from './types.js';

export const KIND_SEAL = 13;
export const KIND_GIFT_WRAP = 1059;

/** An unsigned event with its id computed — NIP-59's inner payload. */
export type Rumor = UnsignedEvent & { id: string };

const TWO_DAYS_SECONDS = 2 * 24 * 60 * 60;

/** A timestamp up to two days in the past, to thwart time-analysis correlation. */
function randomPastTimestamp(now: number = Math.floor(Date.now() / 1000)): number {
  return now - Math.floor(Math.random() * TWO_DAYS_SECONDS);
}

/** Turn an unsigned event into a rumor (computes the id, never signs). */
export function createRumor(unsigned: UnsignedEvent): Rumor {
  return { ...unsigned, id: computeEventId(unsigned) };
}

/**
 * Seal a rumor: kind:13, content NIP-44-encrypted to the recipient, signed by
 * the real author. Tags MUST be empty; the timestamp is randomized.
 */
export function sealRumor(rumor: Rumor, secret: Uint8Array, recipientPubkeyHex: string): NostrEvent {
  const { pubkeyHex } = keypairFromSecret(secret);
  if (rumor.pubkey !== pubkeyHex) {
    throw new Error('rumor author must match the sealing key');
  }
  const conversationKey = getConversationKey(secret, recipientPubkeyHex);
  return finalizeEvent(
    {
      pubkey: pubkeyHex,
      created_at: randomPastTimestamp(),
      kind: KIND_SEAL,
      tags: [],
      content: nip44Encrypt(JSON.stringify(rumor), conversationKey),
    },
    secret,
  );
}

/**
 * Gift-wrap a seal: kind:1059, content NIP-44-encrypted to the recipient under
 * a one-time key, p-tagging the recipient for routing. Independent randomized
 * timestamp per NIP-59.
 */
export function wrapSeal(seal: NostrEvent, recipientPubkeyHex: string): NostrEvent {
  const ephemeralSecret = secp256k1.utils.randomSecretKey();
  const ephemeralPubkey = Buffer.from(secp256k1.schnorr.getPublicKey(ephemeralSecret)).toString('hex');
  const conversationKey = getConversationKey(ephemeralSecret, recipientPubkeyHex);
  return finalizeEvent(
    {
      pubkey: ephemeralPubkey,
      created_at: randomPastTimestamp(),
      kind: KIND_GIFT_WRAP,
      tags: [['p', recipientPubkeyHex]],
      content: nip44Encrypt(JSON.stringify(seal), conversationKey),
    },
    ephemeralSecret,
  );
}

/** Seal + wrap a rumor for one recipient. */
export function wrapRumor(rumor: Rumor, secret: Uint8Array, recipientPubkeyHex: string): NostrEvent {
  return wrapSeal(sealRumor(rumor, secret, recipientPubkeyHex), recipientPubkeyHex);
}

export interface UnwrappedRumor {
  rumor: Rumor;
  /** The verified kind:13 seal — its pubkey is the authenticated author. */
  seal: NostrEvent;
  /** Authenticated author of the rumor (seal.pubkey === rumor.pubkey). */
  author: string;
}

/**
 * Unwrap a kind:1059 gift wrap addressed to `secret`'s pubkey and authenticate
 * the inner rumor. Throws if any layer fails:
 *
 * 1. wrap content decrypts under conv(secret, wrap.pubkey)
 * 2. the seal is kind:13, has a valid signature, and empty tags
 * 3. the seal content decrypts under conv(secret, seal.pubkey)
 * 4. the rumor's author equals the seal's signer (no impersonation)
 * 5. the rumor's id matches its contents
 */
export function unwrapGiftWrap(wrap: NostrEvent, secret: Uint8Array): UnwrappedRumor {
  if (wrap.kind !== KIND_GIFT_WRAP) {
    throw new Error(`expected kind ${KIND_GIFT_WRAP} gift wrap, got ${wrap.kind}`);
  }

  const wrapKey = getConversationKey(secret, wrap.pubkey);
  const seal = JSON.parse(nip44Decrypt(wrap.content, wrapKey)) as NostrEvent;
  if (seal.kind !== KIND_SEAL) {
    throw new Error(`expected kind ${KIND_SEAL} seal, got ${seal.kind}`);
  }
  if (seal.tags.length !== 0) {
    throw new Error('seal tags must be empty');
  }
  if (!verifyEvent(seal)) {
    throw new Error('seal signature invalid');
  }

  const sealKey = getConversationKey(secret, seal.pubkey);
  const rumor = JSON.parse(nip44Decrypt(seal.content, sealKey)) as Rumor;
  if (rumor.pubkey !== seal.pubkey) {
    throw new Error('rumor author does not match seal signer');
  }
  const { id: _id, ...unsigned } = rumor;
  if (computeEventId(unsigned) !== rumor.id) {
    throw new Error('rumor id does not match its contents');
  }

  return { rumor, seal, author: seal.pubkey };
}

// --- Private bonds ------------------------------------------------------------

export interface PrivateBondEvents {
  /** The canonical unsigned bond event (kind:30317). Holds the real timestamp. */
  rumor: Rumor;
  /** Gift wrap addressed to the counterparty — publish to their relays. */
  toCounterparty: NostrEvent;
  /** Gift wrap addressed to the author — publish to own relays for recovery. */
  toSelf: NostrEvent;
}

export interface PrivateBondOptions {
  /** Unix seconds for the rumor's canonical created_at (defaults to now). */
  createdAt?: number;
}

/**
 * Build the private transport form of a bond-state declaration: the kind:30317
 * event as an unsigned rumor, wrapped once for the counterparty and once for
 * the author (so the author's own relays hold a recoverable encrypted copy).
 *
 * The document MUST carry an embedded proof (signMateDocumentNostr) before
 * wrapping — rumors are unsigned, so without one a disclosed private bond is
 * unverifiable (extension §13.3).
 */
export function buildPrivateBondEvents(
  doc: MateDocument,
  secret: Uint8Array,
  options: PrivateBondOptions = {},
): PrivateBondEvents {
  if (!doc.proofs || doc.proofs.length === 0) {
    throw new Error(
      'private bonds require an embedded document proof (signMateDocumentNostr) — unsigned rumors are unverifiable on disclosure',
    );
  }
  const { pubkeyHex } = keypairFromSecret(secret);
  const counterpartyPubkey = pubkeyHexFromIdentity(doc.object.id);
  const createdAt = options.createdAt ?? Math.floor(Date.now() / 1000);

  const unsigned = buildUnsignedBondStateEvent(doc, pubkeyHex, { createdAt });
  // Canonical content omits `proofs` (SPEC §11.2). On the public transport the
  // event signature vouches for the document; a rumor has no signature, so the
  // proofs array must travel inside the encrypted content (extension §13.3).
  // Verifiers strip it again before recomputing canonical bytes.
  unsigned.content = JSON.stringify({
    ...(JSON.parse(unsigned.content) as Record<string, unknown>),
    proofs: doc.proofs,
  });
  const rumor = createRumor(unsigned);
  return {
    rumor,
    toCounterparty: wrapRumor(rumor, secret, counterpartyPubkey),
    toSelf: wrapRumor(rumor, secret, pubkeyHex),
  };
}

/**
 * Build the private transport form of a kind:1317 lifecycle event (e.g. a
 * reaffirmation), wrapped for the counterparty and for the author. History
 * rumors carry a transition record, not a MATE document, so the embedded-proof
 * rule does not apply: their authenticity is established for the two parties
 * by the verified seal during unwrap, and they are not designed for
 * third-party disclosure (disclose the state document instead).
 */
export function buildPrivateBondHistoryEvents(
  doc: MateDocument,
  secret: Uint8Array,
  transition: Transition,
  options: PrivateBondOptions = {},
): PrivateBondEvents {
  const { pubkeyHex } = keypairFromSecret(secret);
  const counterpartyPubkey = pubkeyHexFromIdentity(doc.object.id);
  const createdAt = options.createdAt ?? Math.floor(Date.now() / 1000);

  const rumor = createRumor(buildUnsignedBondHistoryEvent(doc, pubkeyHex, transition, { createdAt }));
  return {
    rumor,
    toCounterparty: wrapRumor(rumor, secret, counterpartyPubkey),
    toSelf: wrapRumor(rumor, secret, pubkeyHex),
  };
}

export interface PrivateBondRumor extends UnwrappedRumor {
  /** Tag-derived view, mirroring the public BondView fields. */
  bond: string | null;
  counterparty: string | null;
  state: string | null;
}

/**
 * Filter unwrapped rumors down to MATE bond events (kind:30317/1317) and
 * project their tags. Unwrap failures and foreign rumors are skipped, not
 * fatal — inboxes are public-write.
 */
export function selectBondRumors(wraps: NostrEvent[], secret: Uint8Array): PrivateBondRumor[] {
  const rumors: PrivateBondRumor[] = [];
  const seen = new Set<string>();
  for (const wrap of wraps) {
    let unwrapped: UnwrappedRumor;
    try {
      unwrapped = unwrapGiftWrap(wrap, secret);
    } catch {
      continue;
    }
    const { rumor } = unwrapped;
    if (rumor.kind !== KIND_BOND_STATE && rumor.kind !== KIND_BOND_HISTORY) {
      continue;
    }
    // The same rumor can arrive in multiple wraps (e.g. the author's
    // copy-to-self next to the counterparty's copy on a shared relay).
    if (seen.has(rumor.id)) {
      continue;
    }
    seen.add(rumor.id);
    const tag = (name: string) => rumor.tags.find((entry) => entry[0] === name)?.[1] ?? null;
    rumors.push({
      ...unwrapped,
      bond: tag('d'),
      counterparty: tag('p'),
      state: tag('state'),
    });
  }
  return rumors;
}
