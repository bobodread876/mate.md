export enum MateState {
  None = 'none',
  Proposed = 'proposed',
  Accepted = 'accepted',
  Active = 'active',
  Paused = 'paused',
  Revoked = 'revoked',
  Archived = 'archived',
  Withdrawn = 'withdrawn',
  Rejected = 'rejected',
  Expired = 'expired',
}

export enum ProofAlgorithm {
  Ed25519 = 'ed25519',
  Bip340Schnorr = 'bip340-schnorr',
}

export enum ValidationLevel {
  Schema = 'schema',
  SingleDocument = 'single-doc',
  HistoryAware = 'history-aware',
  MutualBond = 'mutual-bond',
}

export interface ProfileReference {
  uri: string;
  type: string;
}

export interface Subject {
  id: string;
  profile?: ProfileReference | null;
}

export interface MateObject {
  id: string;
  profile?: ProfileReference | null;
}

export interface Bond {
  id: string;
  state: MateState | `${MateState}`;
  kind?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface Consent {
  required?: boolean;
  mutual?: boolean;
  revocable: boolean;
  unilateral_exit_allowed?: boolean;
  accepted_at?: string | null;
  revoked_at?: string | null;
  withdrawn_at?: string | null;
  rejected_at?: string | null;
  expired_at?: string | null;
}

export interface Policies {
  [name: string]: string | null;
}

export interface Events {
  uri?: string | null;
  type?: string | null;
  latest_hash?: string | null;
}

export interface Runtime {
  current_model?: string | null;
  current_harness?: string | null;
  runtime_is_authoritative?: boolean;
}

export interface Proof {
  type: string;
  verificationMethod: string;
  algorithm: ProofAlgorithm | `${ProofAlgorithm}`;
  created: string;
  value: string;
  [extensionField: string]: unknown;
}

export interface MateDocument {
  mate_version: string;
  subject: Subject;
  object: MateObject;
  bond: Bond;
  consent: Consent;
  policies?: Policies | null;
  events?: Events | null;
  proofs?: Proof[];
  runtime?: Runtime | null;
  extensions?: Record<string, unknown> | null;
}

export interface ValidationResult {
  valid: boolean;
  level: ValidationLevel;
  errors: string[];
  warnings?: string[];
}
