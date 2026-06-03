#!/usr/bin/env node
import { readFileSync } from 'node:fs';

import { Command } from 'commander';

import { normalizeMateDocument } from './normalize.js';
import { parseMateDocument } from './parse.js';
import { validateMateDocument } from './validate.js';

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

program.parse();
