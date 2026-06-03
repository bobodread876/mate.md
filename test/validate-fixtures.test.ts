import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import { parseMateDocument, validateMateDocument, validateMateSchema } from '../src/index.js';

interface ManifestEntry {
  file: string;
  expect: 'pass' | 'fail';
  category: string;
  rationale: string;
}

const root = new URL('..', import.meta.url).pathname;
const manifest = JSON.parse(
  readFileSync(join(root, 'fixtures/manifest.json'), 'utf8'),
) as ManifestEntry[];

describe('fixture manifest', () => {
  test('contains at least 20 conformance entries across required categories', () => {
    expect(manifest.length).toBeGreaterThanOrEqual(20);
    const categories = new Set(manifest.map((entry) => entry.category));
    for (const cat of ['schema', 'semantic']) {
      expect(categories.has(cat)).toBe(true);
    }
  });

  test.each(manifest)('$file $expect: $rationale', (entry) => {
    const source = readFileSync(join(root, 'fixtures', entry.file), 'utf8');

    let data;
    try {
      const parsed = parseMateDocument(source);
      data = parsed.data;
    } catch (error) {
      expect(entry.expect).toBe('fail');
      return;
    }

    const result = validateMateDocument(data);
    expect(result.valid).toBe(entry.expect === 'pass');
  }, 15000);
});

describe('validateMateSchema', () => {
  test('performs schema-only validation', () => {
    const result = validateMateSchema({
      mate_version: '0.2',
      subject: { id: 'did:key:z6MkSubject' },
      object: { id: 'did:key:z6MkObject' },
      bond: { id: 'urn:mate:schema-only', state: 'proposed' },
      consent: { revocable: true },
    });

    expect(result).toEqual({ valid: true, errors: [] });
  });
});
