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
