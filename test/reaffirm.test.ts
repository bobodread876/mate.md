import * as secp256k1 from '@noble/secp256k1';
import { describe, expect, it } from 'vitest';

import { buildPrivateBondHistoryEvents, unwrapGiftWrap } from '../src/giftwrap.js';
import {
  KIND_BOND_HISTORY,
  buildBondHistoryEvent,
  keypairFromSecret,
  verifyEvent,
} from '../src/nostr.js';
import type { MateDocument } from '../src/types.js';

const alice = secp256k1.utils.randomSecretKey();
const bob = secp256k1.utils.randomSecretKey();
const bobPub = keypairFromSecret(bob).pubkeyHex;

function activeBond(): MateDocument {
  const now = new Date().toISOString();
  return {
    mate_version: '0.2',
    subject: { id: keypairFromSecret(alice).did },
    object: { id: `nostr:${bobPub}` },
    bond: { id: 'urn:mate:reaffirm-test', state: 'active', kind: 'companion', created_at: now, updated_at: now },
    consent: { required: true, mutual: true, revocable: true, unilateral_exit_allowed: true, accepted_at: now },
    proofs: [],
  };
}

const REAFFIRM = { from: 'active', to: 'active', type: 'bond.reaffirmed', at: new Date().toISOString() };

describe('typed lifecycle events (reaffirmation)', () => {
  it('public: carries both t tags and the type in the content record', () => {
    const event = buildBondHistoryEvent(activeBond(), alice, REAFFIRM, {
      createdAt: Math.floor(Date.now() / 1000),
    });
    expect(event.kind).toBe(KIND_BOND_HISTORY);
    expect(verifyEvent(event)).toBe(true);
    const tTags = event.tags.filter((t) => t[0] === 't').map((t) => t[1]);
    expect(tTags).toContain('mate-bond');
    expect(tTags).toContain('bond.reaffirmed');
    const record = JSON.parse(event.content);
    expect(record.type).toBe('bond.reaffirmed');
    expect(record.from).toBe('active');
    expect(record.to).toBe('active');
  });

  it('private: both wraps unwrap to the same typed history rumor', () => {
    const events = buildPrivateBondHistoryEvents(activeBond(), alice, REAFFIRM);
    expect(events.rumor.kind).toBe(KIND_BOND_HISTORY);
    expect(events.rumor.tags.filter((t) => t[0] === 't').map((t) => t[1])).toContain('bond.reaffirmed');

    // No bond metadata on the wire.
    for (const wrap of [events.toCounterparty, events.toSelf]) {
      expect(wrap.kind).toBe(1059);
      expect(JSON.stringify(wrap.tags)).not.toContain('reaffirm');
      expect(wrap.content).not.toContain('urn:mate:reaffirm-test');
    }

    const forBob = unwrapGiftWrap(events.toCounterparty, bob);
    expect(forBob.author).toBe(keypairFromSecret(alice).pubkeyHex);
    expect(forBob.rumor).toEqual(events.rumor);
    const record = JSON.parse(forBob.rumor.content);
    expect(record.type).toBe('bond.reaffirmed');
  });
});
