#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseMateDocument, validateMateDocument } from '../dist/src/index.js';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const manifest = JSON.parse(readFileSync(join(root, 'fixtures/manifest.json'), 'utf8'));

const results = [];
for (const entry of manifest) {
  const file = join(root, 'fixtures', entry.file);
  try {
    const source = readFileSync(file, 'utf8');
    const { data } = parseMateDocument(source);
    const result = validateMateDocument(data);
    const actual = result.valid ? 'pass' : 'fail';
    results.push({ file: entry.file, expect: entry.expect, actual, result });
  } catch (error) {
    results.push({
      file: entry.file,
      expect: entry.expect,
      actual: 'fail',
      result: { valid: false, errors: [error instanceof Error ? error.message : String(error)] },
    });
  }
}

const failures = results.filter((result) => result.expect !== result.actual);
console.log(
  JSON.stringify(
    {
      valid: failures.length === 0,
      total: results.length,
      failures: failures.map((failure) => ({
        file: failure.file,
        expect: failure.expect,
        actual: failure.actual,
        errors: failure.result.errors,
      })),
    },
    null,
    2,
  ),
);

if (failures.length > 0) {
  process.exitCode = 1;
}
