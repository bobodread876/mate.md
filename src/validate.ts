import { readFileSync } from 'node:fs';

import * as ed25519 from '@noble/ed25519';
import { sha256, sha512 } from '@noble/hashes/sha2.js';
import * as secp256k1 from '@noble/secp256k1';
import * as Ajv2020Module from 'ajv/dist/2020.js';
import * as addFormatsModule from 'ajv-formats';
import type { ErrorObject, Options, ValidateFunction } from 'ajv';

import { resolveDid } from './did.js';
import { normalizeMateDocument } from './normalize.js';
import {
  MateState,
  ProofAlgorithm,
  ValidationLevel,
  type MateDocument,
  type Proof,
  type ValidationResult,
} from './types.js';

ed25519.hashes.sha512 = sha512;
secp256k1.hashes.sha256 = sha256;

type AjvLike = {
  compile: (schema: object) => ValidateFunction;
};

const Ajv2020 = Ajv2020Module.default as unknown as new (opts?: Options) => AjvLike;
const addFormats = addFormatsModule.default as unknown as (ajv: AjvLike) => AjvLike;

let schemaValidator: ValidateFunction | null = null;

export function validateMateSchema(data: unknown): { valid: boolean; errors: string[] } {
  const validator = getSchemaValidator();
  const valid = validator(data);

  return {
    valid,
    errors: valid ? [] : formatAjvErrors(validator.errors ?? []),
  };
}

export function validateMateDocument(doc: MateDocument): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const schema = validateMateSchema(doc);
  errors.push(...schema.errors);

  if (schema.valid) {
    errors.push(...validateSemantics(doc, warnings));
  }

  return {
    valid: errors.length === 0,
    level: ValidationLevel.SingleDocument,
    errors,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

export function verifyProof(doc: MateDocument, proof: Proof): boolean {
  return verifyProofWithErrors(doc, proof).valid;
}

function validateSemantics(doc: MateDocument, warnings: string[]): string[] {
  const errors: string[] = [];

  try {
    normalizeMateDocument(doc);
  } catch (error) {
    errors.push(`canonicalization: ${error instanceof Error ? error.message : String(error)}`);
  }

  errors.push(...validateStateInvariants(doc, warnings));
  errors.push(...validateTimestampOrdering(doc));
  errors.push(...validateExtensionNamespaces(doc));

  for (const [index, proof] of (doc.proofs ?? []).entries()) {
    const result = verifyProofWithErrors(doc, proof);
    if (!result.valid) {
      errors.push(...result.errors.map((error) => `proofs[${index}]: ${error}`));
    }
  }

  return errors;
}

function validateStateInvariants(doc: MateDocument, warnings: string[]): string[] {
  const errors: string[] = [];
  const state = doc.bond.state;

  if (
    [MateState.Accepted, MateState.Active, MateState.Paused, MateState.Revoked].includes(
      state as MateState,
    ) &&
    !doc.consent.accepted_at
  ) {
    errors.push(`${state} state requires consent.accepted_at`);
  }

  if (state === MateState.Revoked && !doc.consent.revoked_at) {
    errors.push('revoked state requires consent.revoked_at');
  }

  if (state === MateState.Withdrawn && !doc.consent.withdrawn_at) {
    errors.push('withdrawn state requires consent.withdrawn_at');
  }

  if (state === MateState.Rejected && !doc.consent.rejected_at) {
    errors.push('rejected state requires consent.rejected_at');
  }

  if (state === MateState.Expired && !doc.consent.expired_at) {
    errors.push('expired state requires consent.expired_at');
  }

  if (state === MateState.Archived && !hasTerminalTimestamp(doc)) {
    errors.push('archived state requires a terminal consent timestamp');
  }

  if (state === MateState.Archived && hasOpenLifecycleTimestampOnly(doc)) {
    errors.push('archived state cannot be asserted without a prior terminal state');
  }

  if (
    [MateState.Withdrawn, MateState.Rejected, MateState.Expired, MateState.Revoked].includes(
      state as MateState,
    ) &&
    (!doc.proofs || doc.proofs.length === 0)
  ) {
    warnings.push(`${state} terminal state has no proof from the authorized actor`);
  }

  return errors;
}

function validateTimestampOrdering(doc: MateDocument): string[] {
  const errors: string[] = [];

  compareTimestampPair(errors, 'bond.created_at', doc.bond.created_at, 'bond.updated_at', doc.bond.updated_at);
  compareTimestampPair(
    errors,
    'consent.accepted_at',
    doc.consent.accepted_at,
    'consent.revoked_at',
    doc.consent.revoked_at,
  );
  compareTimestampPair(
    errors,
    'consent.accepted_at',
    doc.consent.accepted_at,
    'consent.withdrawn_at',
    doc.consent.withdrawn_at,
  );
  compareTimestampPair(
    errors,
    'consent.accepted_at',
    doc.consent.accepted_at,
    'consent.rejected_at',
    doc.consent.rejected_at,
  );
  compareTimestampPair(
    errors,
    'consent.accepted_at',
    doc.consent.accepted_at,
    'consent.expired_at',
    doc.consent.expired_at,
  );

  return errors;
}

function compareTimestampPair(
  errors: string[],
  leftName: string,
  left: string | null | undefined,
  rightName: string,
  right: string | null | undefined,
): void {
  if (!left || !right) {
    return;
  }

  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
    return;
  }

  if (leftTime > rightTime) {
    errors.push(`${leftName} must be earlier than or equal to ${rightName}`);
  }
}

function validateExtensionNamespaces(doc: MateDocument): string[] {
  const errors: string[] = [];

  for (const key of Object.keys(doc.extensions ?? {})) {
    if (key.startsWith('mate.')) {
      errors.push(`extensions.${key} uses reserved mate.* namespace`);
      continue;
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/.test(key)) {
      errors.push(`extensions.${key} must be reverse-DNS namespaced`);
    }
  }

  return errors;
}

function verifyProofWithErrors(
  doc: MateDocument,
  proof: Proof,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    if (!Object.values(ProofAlgorithm).includes(proof.algorithm as ProofAlgorithm)) {
      errors.push(`unsupported proof algorithm ${String(proof.algorithm)}`);
      return { valid: false, errors };
    }

    const resolved = resolveDid(proof.verificationMethod);
    if (resolved.algorithm !== proof.algorithm) {
      errors.push(
        `verificationMethod resolves to ${resolved.algorithm}, not ${String(proof.algorithm)}`,
      );
      return { valid: false, errors };
    }

    const signature = decodeBase64Signature(proof.value);
    const canonicalBytes = new TextEncoder().encode(normalizeMateDocument(doc));
    const verified =
      proof.algorithm === ProofAlgorithm.Ed25519
        ? ed25519.verify(signature, canonicalBytes, resolved.publicKey)
        : secp256k1.schnorr.verify(signature, sha256(canonicalBytes), resolved.publicKey);

    if (!verified) {
      errors.push('signature verification failed');
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  return { valid: errors.length === 0, errors };
}

function decodeBase64Signature(value: string): Uint8Array {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error('proof value must be base64');
  }

  const signature = Buffer.from(value, 'base64');
  if (signature.length !== 64) {
    throw new Error(`proof signature must be 64 bytes, got ${signature.length}`);
  }

  const normalizedInput = value.replace(/=+$/, '');
  const normalizedOutput = signature.toString('base64').replace(/=+$/, '');
  if (normalizedInput !== normalizedOutput) {
    throw new Error('proof value must be canonical base64');
  }

  return signature;
}

function hasTerminalTimestamp(doc: MateDocument): boolean {
  return Boolean(
    doc.consent.revoked_at ??
      doc.consent.withdrawn_at ??
      doc.consent.rejected_at ??
      doc.consent.expired_at,
  );
}

function hasOpenLifecycleTimestampOnly(doc: MateDocument): boolean {
  return Boolean(doc.consent.accepted_at && !hasTerminalTimestamp(doc));
}

function getSchemaValidator(): ValidateFunction {
  if (!schemaValidator) {
    const schema = JSON.parse(
      readFileSync(new URL('../schema/mate.schema.json', import.meta.url), 'utf8'),
    ) as object;
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    schemaValidator = ajv.compile(schema);
  }

  return schemaValidator as ValidateFunction;
}

function formatAjvErrors(errors: ErrorObject[]): string[] {
  return errors.map((error) => {
    const path = error.instancePath || '/';
    if (error.keyword === 'required' && typeof error.params.missingProperty === 'string') {
      return `${path} missing required property ${error.params.missingProperty}`;
    }

    return `${path} ${error.message ?? 'schema validation failed'}`;
  });
}
