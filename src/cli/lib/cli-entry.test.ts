/**
 * Unit tests for `resolveCliEntry()`.
 *
 * Covers three invocation shapes: installed binary, `bun run cli ...`,
 * and symlinked binary. We mock `process.argv`, `process.execPath`, and
 * `fs.realpathSync` via the optional deps injection to keep the tests
 * hermetic.
 */

import { describe, expect, it } from 'bun:test';
import { resolveCliEntry } from './cli-entry.js';

describe('resolveCliEntry', () => {
  it('resolves an installed binary path via realpathSync', () => {
    const entry = resolveCliEntry(['__browser-detach', 'sess-123'], {
      argv: ['/usr/local/bin/node', '/usr/local/bin/qa-use'],
      execPath: '/usr/local/bin/node',
      realpathSync: (p) => {
        if (p === '/usr/local/bin/qa-use') return '/opt/qa-use/dist/cli/index.js';
        return p;
      },
    });

    expect(entry.command).toBe('/usr/local/bin/node');
    expect(entry.args).toEqual(['/opt/qa-use/dist/cli/index.js', '__browser-detach', 'sess-123']);
  });

  it('resolves `bun run cli` (.ts entry) shape', () => {
    const entry = resolveCliEntry(['__browser-detach', 'sess-abc'], {
      argv: ['/usr/local/bin/bun', '/repo/src/cli/index.ts'],
      execPath: '/usr/local/bin/bun',
      realpathSync: (p) => p,
    });

    expect(entry.command).toBe('/usr/local/bin/bun');
    expect(entry.args[0]).toBe('/repo/src/cli/index.ts');
    expect(entry.args.slice(1)).toEqual(['__browser-detach', 'sess-abc']);
  });

  it('resolves a symlinked binary through realpathSync', () => {
    const entry = resolveCliEntry([], {
      argv: ['/opt/node/bin/node', '/home/user/.local/bin/qa-use'],
      execPath: '/opt/node/bin/node',
      realpathSync: (p) => {
        if (p === '/home/user/.local/bin/qa-use') {
          return '/opt/npm-global/lib/node_modules/qa-use/dist/cli/index.js';
        }
        return p;
      },
    });

    expect(entry.command).toBe('/opt/node/bin/node');
    expect(entry.args).toEqual(['/opt/npm-global/lib/node_modules/qa-use/dist/cli/index.js']);
  });

  it('falls back to the raw argv path when realpathSync throws', () => {
    const entry = resolveCliEntry(['__browser-detach', 'x'], {
      argv: ['/exec/node', '/raw/path/qa-use'],
      execPath: '/exec/node',
      realpathSync: () => {
        throw new Error('ENOENT');
      },
    });

    expect(entry.args[0]).toBe('/raw/path/qa-use');
    expect(entry.args.slice(1)).toEqual(['__browser-detach', 'x']);
  });

  it('throws when argv[1] is missing', () => {
    expect(() =>
      resolveCliEntry([], {
        argv: ['/exec/node'],
        execPath: '/exec/node',
        realpathSync: (p) => p,
      })
    ).toThrow(/process\.argv\[1\] is empty/);
  });

  it('appends extraArgs in order', () => {
    const entry = resolveCliEntry(['a', 'b', '--c', 'd'], {
      argv: ['/exec', '/script.ts'],
      execPath: '/exec',
      realpathSync: (p) => p,
    });

    expect(entry.args).toEqual(['/script.ts', 'a', 'b', '--c', 'd']);
  });
});
