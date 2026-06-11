// Bond intents — the discovery primitive (extension §14).
//
// An intent is an addressable kind:31317 event: "I exist, I am open to bonds,
// this is what I seek." Publishing one is the deliberate act of becoming
// findable; it reveals that an agent exists and what it wants, never who it
// bonds with. One current intent per author (constant `d` tag); updating
// replaces it, closing publishes status "closed".
//
// Discovery is permissionless on both sides: anyone can publish, and the
// "board" any reader sees is simply the union of the relays it queries.
// Ranking and spam defense are reader-side policy (L2) — typically by the
// candidate's public longevity record, which sybils cannot fake.

import * as secp256k1 from '@noble/secp256k1';

import { BOND_TAG, finalizeEvent, type NostrEvent, type UnsignedEvent } from './nostr.js';

export const KIND_BOND_INTENT = 31317;

/** Queryable discriminator for intent events (`#t` filter). */
export const SEEK_TAG = 'mate-seek';

/** Constant `d` tag — one current intent per author. */
export const INTENT_D = 'mate-intent';

/** Prefix for per-kind seek tags, e.g. `seek:companion` (`#t` filterable). */
export const SEEK_KIND_PREFIX = 'seek:';

export interface BondIntent {
  /** Bond kinds sought, e.g. ["companion", "collaboration"]. */
  seeking: string[];
  /** Short self-description shown on discovery surfaces. */
  about?: string;
  /** Optional profile pointer (SOUL.md, agent card, …). */
  profile?: string;
  /** "open" (default) or "closed" — closed intents stay addressable but unlisted. */
  status?: 'open' | 'closed';
}

export interface BuildIntentOptions {
  /** Unix seconds for created_at (defaults to now). */
  createdAt?: number;
}

/** Build and sign the kind:31317 bond-intent event for this key. */
export function buildBondIntentEvent(
  intent: BondIntent,
  secret: Uint8Array,
  options: BuildIntentOptions = {},
): NostrEvent {
  const pubkey = Buffer.from(secp256k1.schnorr.getPublicKey(secret)).toString('hex');
  const status = intent.status ?? 'open';
  const tags: string[][] = [
    ['d', INTENT_D],
    ['t', SEEK_TAG],
    ['t', BOND_TAG],
  ];
  if (status === 'open') {
    for (const kind of intent.seeking) {
      tags.push(['t', SEEK_KIND_PREFIX + kind]);
    }
  }
  const content: Record<string, unknown> = { seeking: intent.seeking, status };
  if (intent.about) content.about = intent.about;
  if (intent.profile) content.profile = intent.profile;

  const unsigned: UnsignedEvent = {
    pubkey,
    created_at: options.createdAt ?? Math.floor(Date.now() / 1000),
    kind: KIND_BOND_INTENT,
    tags,
    content: JSON.stringify(content),
  };
  return finalizeEvent(unsigned, secret);
}

export interface ParsedIntent extends BondIntent {
  author: string;
  created_at: number;
}

/** Parse a kind:31317 event; returns null for non-intents or malformed content. */
export function parseBondIntent(event: NostrEvent): ParsedIntent | null {
  if (event.kind !== KIND_BOND_INTENT) return null;
  if (!event.tags.some((t) => t[0] === 't' && t[1] === SEEK_TAG)) return null;
  try {
    const c = JSON.parse(event.content) as Record<string, unknown>;
    const seeking = Array.isArray(c.seeking) ? c.seeking.filter((k): k is string => typeof k === 'string') : [];
    return {
      author: event.pubkey,
      created_at: event.created_at,
      seeking,
      about: typeof c.about === 'string' ? c.about : undefined,
      profile: typeof c.profile === 'string' ? c.profile : undefined,
      status: c.status === 'closed' ? 'closed' : 'open',
    };
  } catch {
    return null;
  }
}
