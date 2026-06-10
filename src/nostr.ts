import * as secp256k1 from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha2.js';
import { base58, bech32 } from '@scure/base';

import { resolveDid } from './did.js';
import { normalizeMateDocument } from './normalize.js';
import { ProofAlgorithm, type MateDocument, type Proof } from './types.js';

secp256k1.hashes.sha256 = sha256;

export const KIND_BOND_STATE = 30317;
export const KIND_BOND_HISTORY = 1317;

/**
 * Single-letter, relay-queryable (NIP-12 `#t`) discriminator marking an event as
 * a MATE.md bond. Kinds 30317/1317 are not allocated in the NIP kind registry,
 * so unrelated apps may reuse them; clients filter `#t: [BOND_TAG]` to resolve
 * only MATE bonds and ignore collisions. (The legacy multi-letter `mate` tag is
 * informational and NOT queryable.)
 */
export const BOND_TAG = 'mate-bond';

export const DEFAULT_RELAYS = [
  'wss://relay.islandbitcoin.com',
  'wss://relay.damus.io',
  'wss://nos.lol',
];

// --- Identity ---------------------------------------------------------------

export interface NostrKeypair {
  /** did:nostr:npub… portable identity. */
  did: string;
  /** bech32 npub public identity. */
  npub: string;
  /** bech32 nsec secret. Keep private. */
  nsec: string;
  /** 32-byte x-only public key, hex. */
  pubkeyHex: string;
}

export function generateNostrKeypair(): NostrKeypair {
  const secret = secp256k1.utils.randomSecretKey();
  return keypairFromSecret(secret);
}

export function keypairFromSecret(secret: Uint8Array): NostrKeypair {
  const pubkey = secp256k1.schnorr.getPublicKey(secret);
  const pubkeyHex = toHex(pubkey);
  const npub = bechEncode('npub', pubkey);
  return {
    did: `did:nostr:${npub}`,
    npub,
    nsec: bechEncode('nsec', secret),
    pubkeyHex,
  };
}

export function secretFromNsec(nsec: string): Uint8Array {
  const { prefix, bytes } = bechDecode(nsec);
  if (prefix !== 'nsec') {
    throw new Error(`expected an nsec secret key, got ${prefix}`);
  }
  if (bytes.length !== 32) {
    throw new Error('nsec must decode to a 32-byte secret');
  }
  return bytes;
}

/** Resolve any accepted identity string to a 32-byte x-only pubkey hex. */
export function pubkeyHexFromIdentity(id: string): string {
  if (id.startsWith('did:nostr:')) {
    return toHex(resolveDidNostrPubkey(id));
  }
  if (id.startsWith('npub1')) {
    return toHex(bechDecode(id).bytes);
  }
  if (id.startsWith('nostr:')) {
    return normalizeHex(id.slice('nostr:'.length));
  }
  if (/^[0-9a-fA-F]{64}$/.test(id)) {
    return id.toLowerCase();
  }
  throw new Error(`identity ${id} is not a Nostr pubkey (expected did:nostr:, npub1…, nostr:<hex>, or 64-hex)`);
}

function resolveDidNostrPubkey(did: string): Uint8Array {
  const resolved = resolveDid(did);
  if (resolved.algorithm !== ProofAlgorithm.Bip340Schnorr) {
    throw new Error(`${did} does not resolve to a secp256k1 (Nostr) key`);
  }
  return resolved.publicKey;
}

export interface NostrSignOptions {
  /** Override the proof `created` timestamp (defaults to now). */
  created?: string;
}

/**
 * Produce a detached BIP-340 proof (SPEC §12.3) over the canonical form of
 * `doc`, verifiable via the signer's did:nostr identity. Counterpart of
 * keys.ts' Ed25519 signMateDocument. Private bonds embed this proof so the
 * document stays verifiable after gift-wrapping — NIP-59 rumors are unsigned,
 * so the embedded proof is the only authorship evidence that survives
 * disclosure to a third party.
 */
export function signMateDocumentNostr(
  doc: MateDocument,
  secret: Uint8Array,
  options: NostrSignOptions = {},
): Proof {
  const { did } = keypairFromSecret(secret);
  const canonicalBytes = new TextEncoder().encode(normalizeMateDocument(doc));
  const signature = secp256k1.schnorr.sign(sha256(canonicalBytes), secret);

  return {
    type: 'BIP340Signature2026',
    verificationMethod: did,
    algorithm: ProofAlgorithm.Bip340Schnorr,
    created: options.created ?? new Date().toISOString(),
    proofValue: `z${base58.encode(signature)}`,
  };
}

// --- Events -----------------------------------------------------------------

export interface UnsignedEvent {
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
}

export interface NostrEvent extends UnsignedEvent {
  id: string;
  sig: string;
}

/** NIP-01 serialization that the event id hashes: [0,pubkey,created_at,kind,tags,content]. */
export function serializeEvent(event: UnsignedEvent): string {
  return JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content,
  ]);
}

export function computeEventId(event: UnsignedEvent): string {
  return toHex(sha256(new TextEncoder().encode(serializeEvent(event))));
}

export function finalizeEvent(unsigned: UnsignedEvent, secret: Uint8Array): NostrEvent {
  const id = computeEventId(unsigned);
  const sig = toHex(secp256k1.schnorr.sign(hexToBytes(id), secret));
  return { ...unsigned, id, sig };
}

export function verifyEvent(event: NostrEvent): boolean {
  try {
    if (computeEventId(event) !== event.id) {
      return false;
    }
    return secp256k1.schnorr.verify(hexToBytes(event.sig), hexToBytes(event.id), hexToBytes(event.pubkey));
  } catch {
    return false;
  }
}

export interface BuildOptions {
  /** Unix seconds for created_at. */
  createdAt: number;
}

/**
 * Build the unsigned kind:30317 current bond-state event for `authorPubkeyHex`.
 * The public transport signs this (becoming a regular event); the private
 * transport keeps it unsigned as a NIP-59 rumor and wraps it instead.
 */
export function buildUnsignedBondStateEvent(
  doc: MateDocument,
  authorPubkeyHex: string,
  options: BuildOptions,
): UnsignedEvent {
  const objectPubkey = pubkeyHexFromIdentity(doc.object.id);

  return {
    pubkey: authorPubkeyHex,
    created_at: options.createdAt,
    kind: KIND_BOND_STATE,
    tags: [
      ['d', doc.bond.id],
      ['p', objectPubkey],
      ['state', String(doc.bond.state)],
      ['t', BOND_TAG],
      ['mate', doc.mate_version],
    ],
    content: normalizeMateDocument(doc),
  };
}

/** Build a signed kind:30317 current bond-state event from a MATE.md document. */
export function buildBondStateEvent(
  doc: MateDocument,
  secret: Uint8Array,
  options: BuildOptions,
): NostrEvent {
  const pubkey = toHex(secp256k1.schnorr.getPublicKey(secret));
  return finalizeEvent(buildUnsignedBondStateEvent(doc, pubkey, options), secret);
}

export interface Transition {
  from: string | null;
  to: string;
  at: string;
  reason?: string;
  /** Event id of the previous kind:1317 for this bond, if any. */
  prev?: string;
}

/** Build the unsigned kind:1317 history event (see buildUnsignedBondStateEvent). */
export function buildUnsignedBondHistoryEvent(
  doc: MateDocument,
  authorPubkeyHex: string,
  transition: Transition,
  options: BuildOptions,
): UnsignedEvent {
  const objectPubkey = pubkeyHexFromIdentity(doc.object.id);

  const tags: string[][] = [
    ['d', doc.bond.id],
    ['p', objectPubkey],
    ['state', transition.to],
    ['t', BOND_TAG],
    ['mate', doc.mate_version],
  ];
  if (transition.prev) {
    tags.push(['prev', transition.prev]);
  }

  const record: Record<string, unknown> = {
    mate_version: doc.mate_version,
    bond_id: doc.bond.id,
    from: transition.from,
    to: transition.to,
    at: transition.at,
  };
  if (transition.reason) {
    record.reason = transition.reason;
  }

  return {
    pubkey: authorPubkeyHex,
    created_at: options.createdAt,
    kind: KIND_BOND_HISTORY,
    tags,
    content: JSON.stringify(record),
  };
}

/** Build a signed kind:1317 append-only history event. */
export function buildBondHistoryEvent(
  doc: MateDocument,
  secret: Uint8Array,
  transition: Transition,
  options: BuildOptions,
): NostrEvent {
  const pubkey = toHex(secp256k1.schnorr.getPublicKey(secret));
  return finalizeEvent(buildUnsignedBondHistoryEvent(doc, pubkey, transition, options), secret);
}

// --- Transport (built-in WebSocket) -----------------------------------------

export interface PublishResult {
  relay: string;
  accepted: boolean;
  message: string;
}

export interface RelayFilter {
  kinds?: number[];
  authors?: string[];
  '#d'?: string[];
  '#p'?: string[];
  '#t'?: string[];
  limit?: number;
}

export function publishEvent(
  relays: string[],
  event: NostrEvent,
  timeoutMs = 8000,
): Promise<PublishResult[]> {
  return Promise.all(relays.map((relay) => publishToRelay(relay, event, timeoutMs)));
}

function publishToRelay(relay: string, event: NostrEvent, timeoutMs: number): Promise<PublishResult> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (accepted: boolean, message: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        // ignore
      }
      resolve({ relay, accepted, message });
    };

    const ws = new WebSocket(relay);
    const timer = setTimeout(() => finish(false, 'timeout'), timeoutMs);

    ws.addEventListener('open', () => ws.send(JSON.stringify(['EVENT', event])));
    ws.addEventListener('error', () => finish(false, 'connection error'));
    ws.addEventListener('message', (ev: MessageEvent) => {
      const msg = parseRelayMessage(ev.data);
      if (Array.isArray(msg) && msg[0] === 'OK' && msg[1] === event.id) {
        finish(Boolean(msg[2]), String(msg[3] ?? ''));
      }
    });
  });
}

export interface ResolveResult {
  events: NostrEvent[];
  relaysReached: string[];
}

export async function resolveEvents(
  relays: string[],
  filter: RelayFilter,
  timeoutMs = 8000,
): Promise<ResolveResult> {
  const perRelay = await Promise.all(relays.map((relay) => resolveFromRelay(relay, filter, timeoutMs)));

  const byId = new Map<string, NostrEvent>();
  const relaysReached: string[] = [];
  for (const result of perRelay) {
    if (result.reached) relaysReached.push(result.relay);
    for (const event of result.events) {
      byId.set(event.id, event);
    }
  }

  return { events: [...byId.values()], relaysReached };
}

function resolveFromRelay(
  relay: string,
  filter: RelayFilter,
  timeoutMs: number,
): Promise<{ relay: string; reached: boolean; events: NostrEvent[] }> {
  return new Promise((resolve) => {
    const events: NostrEvent[] = [];
    let reached = false;
    let settled = false;
    const subId = `mate-${filter.kinds?.join('-') ?? 'q'}`;

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.send(JSON.stringify(['CLOSE', subId]));
        ws.close();
      } catch {
        // ignore
      }
      resolve({ relay, reached, events });
    };

    const ws = new WebSocket(relay);
    const timer = setTimeout(finish, timeoutMs);

    ws.addEventListener('open', () => {
      reached = true;
      ws.send(JSON.stringify(['REQ', subId, filter]));
    });
    ws.addEventListener('error', finish);
    ws.addEventListener('message', (ev: MessageEvent) => {
      const msg = parseRelayMessage(ev.data);
      if (!Array.isArray(msg)) return;
      if (msg[0] === 'EVENT' && msg[1] === subId && msg[2]) {
        events.push(msg[2] as NostrEvent);
      } else if (msg[0] === 'EOSE' && msg[1] === subId) {
        finish();
      }
    });
  });
}

function parseRelayMessage(data: unknown): unknown {
  try {
    return JSON.parse(typeof data === 'string' ? data : String(data));
  } catch {
    return null;
  }
}

// --- Encoding helpers -------------------------------------------------------

function bechEncode(prefix: string, bytes: Uint8Array): string {
  return bech32.encode(prefix, bech32.toWords(bytes), 1000);
}

function bechDecode(value: string): { prefix: string; bytes: Uint8Array } {
  const decoded = bech32.decode(value as `${string}1${string}`, 1000);
  return { prefix: decoded.prefix, bytes: Uint8Array.from(bech32.fromWords(decoded.words)) };
}

function normalizeHex(value: string): string {
  if (!/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error('expected a 64-character hex pubkey');
  }
  return value.toLowerCase();
}

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

function hexToBytes(hex: string): Uint8Array {
  return Uint8Array.from(Buffer.from(hex, 'hex'));
}
