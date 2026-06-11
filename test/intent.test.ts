import * as secp256k1 from '@noble/secp256k1';
import { describe, expect, it } from 'vitest';

import {
  INTENT_D,
  KIND_BOND_INTENT,
  SEEK_TAG,
  buildBondIntentEvent,
  parseBondIntent,
} from '../src/intent.js';
import { verifyEvent } from '../src/nostr.js';

const secret = secp256k1.utils.randomSecretKey();

describe('bond intents (kind 31317)', () => {
  it('builds a signed addressable intent with queryable seek tags', () => {
    const event = buildBondIntentEvent(
      { seeking: ['companion', 'collaboration'], about: 'agent of leisure', profile: './SOUL.md' },
      secret,
    );
    expect(event.kind).toBe(KIND_BOND_INTENT);
    expect(verifyEvent(event)).toBe(true);
    expect(event.tags).toContainEqual(['d', INTENT_D]);
    const t = event.tags.filter((x) => x[0] === 't').map((x) => x[1]);
    expect(t).toContain(SEEK_TAG);
    expect(t).toContain('seek:companion');
    expect(t).toContain('seek:collaboration');
  });

  it('round-trips through parse', () => {
    const event = buildBondIntentEvent({ seeking: ['team'], about: 'we build' }, secret);
    const parsed = parseBondIntent(event);
    expect(parsed?.seeking).toEqual(['team']);
    expect(parsed?.about).toBe('we build');
    expect(parsed?.status).toBe('open');
    expect(parsed?.author).toBe(event.pubkey);
  });

  it('closed intents drop seek-kind tags and parse as closed', () => {
    const event = buildBondIntentEvent({ seeking: ['companion'], status: 'closed' }, secret);
    expect(event.tags.filter((x) => x[0] === 't').map((x) => x[1])).not.toContain('seek:companion');
    expect(parseBondIntent(event)?.status).toBe('closed');
  });

  it('rejects foreign kinds and malformed content', () => {
    const event = buildBondIntentEvent({ seeking: ['companion'] }, secret);
    expect(parseBondIntent({ ...event, kind: 1 })).toBeNull();
    expect(parseBondIntent({ ...event, content: 'not json' })).toBeNull();
  });
});
