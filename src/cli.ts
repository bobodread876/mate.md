#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

import { Command } from 'commander';
import yaml from 'js-yaml';

import { generateEd25519Keypair, signMateDocument } from './keys.js';
import { normalizeMateDocument } from './normalize.js';
import { parseMateDocument } from './parse.js';
import { validateMateDocument, verifyProof } from './validate.js';
import type { MateDocument } from './types.js';

const moduleDir = new URL('.', import.meta.url).pathname;
const repoRoot = moduleDir.replace(/(dist\/)?src\/$/, '');
const packageJson = JSON.parse(
  readFileSync(repoRoot + 'package.json', 'utf8'),
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
  .description('Generate an Ed25519 agent identity (did:key + secret)')
  .option('-o, --out <file>', 'write the secret keyfile JSON to <file> instead of stdout')
  .action((options: { out?: string }) => {
    const keypair = generateEd25519Keypair();

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
