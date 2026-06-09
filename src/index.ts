export * from './types.js';
export { parseMateDocument } from './parse.js';
export { normalizeMateDocument } from './normalize.js';
export { validateMateDocument, verifyProof, validateMateSchema } from './validate.js';
export { resolveDid } from './did.js';
export {
  generateEd25519Keypair,
  didKeyFromEd25519PublicKey,
  signMateDocument,
  type Ed25519Keypair,
  type SignOptions,
} from './keys.js';
export {
  KIND_BOND_STATE,
  KIND_BOND_HISTORY,
  BOND_TAG,
  DEFAULT_RELAYS,
  generateNostrKeypair,
  keypairFromSecret,
  secretFromNsec,
  pubkeyHexFromIdentity,
  serializeEvent,
  computeEventId,
  finalizeEvent,
  verifyEvent,
  buildBondStateEvent,
  buildBondHistoryEvent,
  publishEvent,
  resolveEvents,
  type NostrKeypair,
  type NostrEvent,
  type UnsignedEvent,
  type RelayFilter,
  type PublishResult,
  type ResolveResult,
  type Transition,
} from './nostr.js';
