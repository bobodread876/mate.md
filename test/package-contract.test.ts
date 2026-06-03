import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('npm package contract', () => {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
    bin: Record<string, string>;
    exports: Record<string, Record<string, string>>;
  };

  it('publishes the CLI at dist/cli.js', () => {
    expect(packageJson.bin.mate).toBe('./dist/cli.js');
  });

  it('publishes the library entrypoint from dist/index.js', () => {
    expect(packageJson.exports['.']).toMatchObject({
      types: './dist/index.d.ts',
      import: './dist/index.js',
      require: './dist/index.js',
    });
  });
});
