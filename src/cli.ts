#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

import { Command } from 'commander';
import yaml from 'js-yaml';

import { generateEd25519Keypair, signMateDocument } from './keys.js';
import { normalizeMateDocument } from './normalize.js';
import {
  BOND_TAG,
  DEFAULT_RELAYS,
  buildBondHistoryEvent,
  buildBondStateEvent,
  generateNostrKeypair,
  keypairFromSecret,
  pubkeyHexFromIdentity,
  publishEvent,
  resolveEvents,
  secretFromNsec,
  verifyEvent,
  type NostrEvent,
  type RelayFilter,
} from './nostr.js';
import { parseMateDocument } from './parse.js';
import { validateMateDocument, verifyProof } from './validate.js';
import type { MateDocument } from './types.js';

const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { version: string };

const program = new Command();

program
  .name('mate')
  .description('MATE.md reference implementation CLI')
  .version(packageJson.version);

program
  .command('validate')
  .description('Validate one or more MATE.md files')
  .argument('<files...>', 'MATE.md files to validate')
  .action((files: string[]) => {
    let failed = false;

    for (const file of files) {
      try {
        const source = readFileSync(file, 'utf8');
        const { data } = parseMateDocument(source);
        const result = validateMateDocument(data);
        failed ||= !result.valid;
        console.log(JSON.stringify({ file, ...result }));
      } catch (error) {
        failed = true;
        console.log(
          JSON.stringify({
            file,
            valid: false,
            level: 'schema',
            errors: [error instanceof Error ? error.message : String(error)],
          }),
        );
      }
    }

    if (failed) {
      process.exitCode = 1;
    }
  });

program
  .command('inspect')
  .description('Parse and output canonical MATE.md JSON')
  .argument('<file>', 'MATE.md file to inspect')
  .action((file: string) => {
    const source = readFileSync(file, 'utf8');
    const { data } = parseMateDocument(source);
    console.log(normalizeMateDocument(data));
  });

program
  .command('keygen')
  .description('Generate an agent identity (did:key Ed25519, or did:nostr with --nostr)')
  .option('-o, --out <file>', 'write the secret keyfile JSON to <file> instead of stdout')
  .option('--nostr', 'generate a Nostr secp256k1 identity (npub/nsec/did:nostr)')
  .action((options: { out?: string; nostr?: boolean }) => {
    const keypair = options.nostr ? generateNostrKeypair() : generateEd25519Keypair();

    if (options.out) {
      writeFileSync(options.out, JSON.stringify(keypair, null, 2) + '\n', { mode: 0o600 });
      console.log(JSON.stringify({ did: keypair.did, keyfile: options.out }));
    } else {
      console.log(JSON.stringify(keypair, null, 2));
    }
  });

program
  .command('sign')
  .description('Sign a MATE.md file with an Ed25519 keyfile and append the proof')
  .argument('<file>', 'MATE.md file to sign in place')
  .requiredOption('-k, --key <keyfile>', 'keyfile JSON produced by `mate keygen`')
  .action((file: string, options: { key: string }) => {
    const keyfile = JSON.parse(readFileSync(options.key, 'utf8')) as { secretKey: string };
    const source = readFileSync(file, 'utf8');
    const { data, body } = parseMateDocument(source);

    const proof = signMateDocument(data, keyfile.secretKey);
    const signed: MateDocument = { ...data, proofs: [...(data.proofs ?? []), proof] };

    writeFileSync(file, renderMateDocument(signed, body));
    console.log(JSON.stringify({ file, signedBy: proof.verificationMethod }));
  });

program
  .command('verify')
  .description('Verify every proof in one or more MATE.md files')
  .argument('<files...>', 'MATE.md files to verify')
  .action((files: string[]) => {
    let failed = false;

    for (const file of files) {
      try {
        const { data } = parseMateDocument(readFileSync(file, 'utf8'));
        const proofs = data.proofs ?? [];
        const results = proofs.map((proof) => ({
          verificationMethod: proof.verificationMethod,
          valid: verifyProof(data, proof),
        }));
        const valid = proofs.length > 0 && results.every((result) => result.valid);
        failed ||= !valid;
        console.log(JSON.stringify({ file, valid, proofs: results }));
      } catch (error) {
        failed = true;
        console.log(
          JSON.stringify({
            file,
            valid: false,
            errors: [error instanceof Error ? error.message : String(error)],
          }),
        );
      }
    }

    if (failed) {
      process.exitCode = 1;
    }
  });

const collectRelay = (value: string, previous: string[]): string[] => previous.concat([value]);

program
  .command('nostr-publish')
  .description('Publish a MATE.md bond as Nostr events (kind 30317, optionally 1317)')
  .argument('<file>', 'MATE.md file to publish')
  .requiredOption('-k, --key <keyfile>', 'Nostr keyfile JSON (from `mate keygen --nostr`)')
  .option('-r, --relay <url>', 'relay URL (repeatable; defaults to public relays)', collectRelay, [])
  .option('--history', 'also publish a kind 1317 history event for the current state')
  .action(async (file: string, options: { key: string; relay: string[]; history?: boolean }) => {
    const keyfile = JSON.parse(readFileSync(options.key, 'utf8')) as { nsec: string };
    const secret = secretFromNsec(keyfile.nsec);
    const { data } = parseMateDocument(readFileSync(file, 'utf8'));
    const relays = options.relay.length > 0 ? options.relay : DEFAULT_RELAYS;
    const createdAt = Math.floor(Date.now() / 1000);

    warnIfSubjectMismatch(data, secret);

    const stateEvent = buildBondStateEvent(data, secret, { createdAt });
    const stateResults = await publishEvent(relays, stateEvent);
    console.log(
      JSON.stringify({ kind: stateEvent.kind, id: stateEvent.id, state: data.bond.state, relays: stateResults }),
    );

    if (options.history) {
      const historyEvent = buildBondHistoryEvent(
        data,
        secret,
        { from: null, to: String(data.bond.state), at: data.bond.updated_at ?? new Date().toISOString() },
        { createdAt },
      );
      const historyResults = await publishEvent(relays, historyEvent);
      console.log(JSON.stringify({ kind: historyEvent.kind, id: historyEvent.id, relays: historyResults }));
    }
  });

program
  .command('nostr-resolve')
  .description('Resolve bond events from relays (kind 30317, or 1317 with --history)')
  .option('-a, --author <id>', 'author identity (did:nostr / npub / hex)')
  .option('-c, --counterparty <id>', 'counterparty identity to match on the p tag')
  .option('-b, --bond <bond_id>', 'bond id to match on the d tag')
  .option('-r, --relay <url>', 'relay URL (repeatable; defaults to public relays)', collectRelay, [])
  .option('--history', 'query kind 1317 history instead of current state')
  .action(
    async (options: {
      author?: string;
      counterparty?: string;
      bond?: string;
      relay: string[];
      history?: boolean;
    }) => {
      const relays = options.relay.length > 0 ? options.relay : DEFAULT_RELAYS;
      const filter: RelayFilter = { kinds: [options.history ? 1317 : 30317], '#t': [BOND_TAG], limit: 50 };
      if (options.author) filter.authors = [pubkeyHexFromIdentity(options.author)];
      if (options.counterparty) filter['#p'] = [pubkeyHexFromIdentity(options.counterparty)];
      if (options.bond) filter['#d'] = [options.bond];

      const { events, relaysReached } = await resolveEvents(relays, filter);
      const rows = events
        .sort((a, b) => b.created_at - a.created_at)
        .map((event) => ({
          id: event.id,
          author: event.pubkey,
          bond: tag(event, 'd'),
          counterparty: tag(event, 'p'),
          state: tag(event, 'state'),
          created_at: event.created_at,
          signature_valid: verifyEvent(event),
        }));

      console.log(JSON.stringify({ relaysReached, count: rows.length, events: rows }, null, 2));
    },
  );

program
  .command('nostr-bond')
  .description('Assemble, sign, and publish a bond from flags + key (no .md file needed)')
  .requiredOption('-k, --key <keyfile>', 'Nostr keyfile (subject is derived from it)')
  .requiredOption('-c, --counterparty <id>', 'object identity (did:nostr / npub / hex)')
  .requiredOption('-b, --bond-id <id>', 'bond id (the d tag)')
  .requiredOption('-s, --state <state>', 'bond state (proposed, accepted, active, paused, revoked, …)')
  .option('--kind <kind>', 'bond kind', 'companion')
  .option('--created-at <ts>', 'bond.created_at ISO 8601 (defaults to now)')
  .option('-r, --relay <url>', 'relay URL (repeatable; defaults to public relays)', collectRelay, [])
  .option('--history', 'also publish a kind 1317 history event')
  .option('--out <file>', 'also write the assembled MATE.md document to <file>')
  .option('--dry-run', 'assemble + validate + print the canonical doc, do not publish')
  .action(
    async (options: {
      key: string;
      counterparty: string;
      bondId: string;
      state: string;
      kind: string;
      createdAt?: string;
      relay: string[];
      history?: boolean;
      out?: string;
      dryRun?: boolean;
    }) => {
      const keyfile = JSON.parse(readFileSync(options.key, 'utf8')) as { nsec: string };
      const secret = secretFromNsec(keyfile.nsec);
      const subjectDid = keypairFromSecret(secret).did;
      // Fail fast with a clear message if the counterparty isn't a Nostr identity.
      pubkeyHexFromIdentity(options.counterparty);

      const doc = makeBondDoc(subjectDid, options.counterparty, options);

      const result = validateMateDocument(doc);
      if (!result.valid) {
        console.error(JSON.stringify({ valid: false, errors: result.errors }));
        process.exitCode = 1;
        return;
      }

      if (options.out) {
        writeFileSync(options.out, renderMateDocument(doc, 'This bond document was assembled by `mate nostr-bond`.'));
      }

      if (options.dryRun) {
        console.log(normalizeMateDocument(doc));
        return;
      }

      const relays = options.relay.length > 0 ? options.relay : DEFAULT_RELAYS;
      const createdAt = Math.floor(Date.now() / 1000);

      const stateEvent = buildBondStateEvent(doc, secret, { createdAt });
      const stateResults = await publishEvent(relays, stateEvent);
      console.log(
        JSON.stringify({ kind: stateEvent.kind, id: stateEvent.id, state: doc.bond.state, relays: stateResults }),
      );

      if (options.history) {
        const historyEvent = buildBondHistoryEvent(
          doc,
          secret,
          { from: null, to: doc.bond.state as string, at: doc.bond.updated_at ?? new Date().toISOString() },
          { createdAt },
        );
        const historyResults = await publishEvent(relays, historyEvent);
        console.log(JSON.stringify({ kind: historyEvent.kind, id: historyEvent.id, relays: historyResults }));
      }
    },
  );

/** Assemble a MATE.md document from bond parameters, filling the consent timestamp the state requires. */
function makeBondDoc(
  subjectId: string,
  objectId: string,
  options: { bondId: string; state: string; kind: string; createdAt?: string },
): MateDocument {
  const now = new Date().toISOString();
  const consent: Record<string, unknown> = {
    required: true,
    mutual: true,
    revocable: true,
    unilateral_exit_allowed: true,
  };

  const terminalAt: Record<string, string> = {
    revoked: 'revoked_at',
    withdrawn: 'withdrawn_at',
    rejected: 'rejected_at',
    expired: 'expired_at',
  };
  if (['accepted', 'active', 'paused', 'revoked'].includes(options.state)) {
    consent.accepted_at = now;
  }
  if (terminalAt[options.state]) {
    consent[terminalAt[options.state]] = now;
  }

  return {
    mate_version: '0.2',
    subject: { id: subjectId },
    object: { id: objectId },
    bond: {
      id: options.bondId,
      state: options.state as MateDocument['bond']['state'],
      kind: options.kind,
      created_at: options.createdAt ?? now,
      updated_at: now,
    },
    consent: consent as unknown as MateDocument['consent'],
    proofs: [],
  };
}

function warnIfSubjectMismatch(doc: MateDocument, secret: Uint8Array): void {
  try {
    const subjectHex = pubkeyHexFromIdentity(doc.subject.id);
    if (subjectHex !== keypairFromSecret(secret).pubkeyHex) {
      console.error('warning: subject.id does not match the signing key; publishing anyway');
    }
  } catch {
    // subject is not a Nostr identity (e.g. did:key) — skip the check
  }
}

function tag(event: NostrEvent, name: string): string | null {
  return event.tags.find((entry) => entry[0] === name)?.[1] ?? null;
}

function renderMateDocument(doc: MateDocument, body: string | null): string {
  const frontmatter = yaml.dump(doc, {
    noRefs: true,
    lineWidth: -1,
    quotingType: '"',
    forceQuotes: true,
  });
  return `---\n${frontmatter}---\n${body ? `\n${body}\n` : ''}`;
}

program.parse();
