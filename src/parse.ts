import matter from 'gray-matter';
import * as yaml from 'js-yaml';

import type { MateDocument } from './types.js';

const YAML_ALIAS_OR_ANCHOR = /(^|[\s[{,])(?:&|\*)[A-Za-z0-9_-]+/m;
const YAML_TAG = /(^|[\s[{,])![!<A-Za-z]/m;
const YAML_DOCUMENT_SEPARATOR = /^---\s*$/m;

export interface ParseMateDocumentResult {
  data: MateDocument;
  body: string | null;
}

export function parseMateDocument(input: string): ParseMateDocumentResult {
  if (!input.startsWith('---\n') && !input.startsWith('---\r\n')) {
    throw new Error('MATE.md document must begin with YAML frontmatter');
  }

  const parsed = matter(input);
  const frontmatter = parsed.matter;

  if (!frontmatter || frontmatter.trim().length === 0) {
    throw new Error('MATE.md document must contain non-empty YAML frontmatter');
  }

  rejectRestrictedYaml(frontmatter);

  let data: unknown;
  try {
    data = yaml.load(frontmatter, {
      schema: yaml.JSON_SCHEMA,
      json: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to parse MATE.md YAML frontmatter: ${message}`);
  }

  if (!isPlainRecord(data)) {
    throw new Error('MATE.md frontmatter must parse to a YAML mapping');
  }

  assertStringKeys(data);

  const body = parsed.content.replace(/^\r?\n/, '');

  return {
    data: data as unknown as MateDocument,
    body: body.length > 0 ? body : null,
  };
}

function rejectRestrictedYaml(frontmatter: string): void {
  if (YAML_ALIAS_OR_ANCHOR.test(frontmatter)) {
    throw new Error('MATE.md frontmatter must not use YAML aliases or anchors');
  }

  if (YAML_TAG.test(frontmatter)) {
    throw new Error('MATE.md frontmatter must not use YAML tags');
  }

  const innerLines = frontmatter.split(/\r?\n/).slice(1);
  if (innerLines.some((line) => YAML_DOCUMENT_SEPARATOR.test(line))) {
    throw new Error('MATE.md frontmatter must not contain multi-document YAML streams');
  }
}

function assertStringKeys(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      assertStringKeys(item);
    }
    return;
  }

  if (!isPlainRecord(value)) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (typeof key !== 'string') {
      throw new Error('MATE.md frontmatter map keys must be strings');
    }
    assertStringKeys(child);
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}
