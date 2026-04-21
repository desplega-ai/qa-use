/**
 * CLI re-exec resolver.
 *
 * The detached `browser create` path spawns the CLI binary as a child
 * process and runs it with the hidden `__browser-detach` subcommand. The
 * parent process needs to deterministically figure out the right
 * `(command, args)` to invoke, regardless of HOW the parent was invoked:
 *
 *   1. Installed binary  — e.g. `qa-use` on PATH (maps to node or bun
 *      executing the compiled entry under `dist/` or a shim script).
 *   2. `bun run cli ...` — `process.argv[1]` is a `.ts` file under the
 *      repo and `process.execPath` is the `bun` binary, which handles
 *      `.ts` natively.
 *   3. Symlinked binary — `process.argv[1]` is a symlink; `fs.realpathSync`
 *      resolves it to the underlying file, so we don't re-exec through a
 *      broken symlink.
 *
 * In every case we return `{ command: process.execPath, args: [realPath, ...] }`
 * so the child inherits the same runtime (node OR bun) as the parent.
 */

import fs from 'node:fs';

export interface CliEntry {
  /** Executable to spawn (typically `process.execPath`). */
  command: string;
  /** Argv to pass (first element is the real script path). */
  args: string[];
}

export interface ResolveCliEntryDeps {
  argv?: string[];
  execPath?: string;
  realpathSync?: (p: string) => string;
}

/**
 * Resolve the `(command, args)` needed to re-exec the CLI binary.
 *
 * When `extraArgs` is provided, they are appended after the resolved
 * script path — callers use this to inject `__browser-detach <session-id>`
 * and related flags.
 */
export function resolveCliEntry(
  extraArgs: string[] = [],
  deps: ResolveCliEntryDeps = {}
): CliEntry {
  const argv = deps.argv ?? process.argv;
  const execPath = deps.execPath ?? process.execPath;
  const realpathSync = deps.realpathSync ?? fs.realpathSync;

  const rawEntry = argv[1];
  if (!rawEntry) {
    throw new Error('resolveCliEntry: process.argv[1] is empty — cannot re-exec the CLI');
  }

  let resolvedEntry: string;
  try {
    resolvedEntry = realpathSync(rawEntry);
  } catch {
    // Fallback to the raw path if realpath fails (e.g. rare sandboxed
    // environments). We still want the spawn to attempt with what we have
    // rather than bubble an unrelated error.
    resolvedEntry = rawEntry;
  }

  // If the entry is a TypeScript source file and the runtime is Node.js
  // (not Bun), raw `node` can't execute it — we need the tsx loader. This
  // happens in dev (`bun run cli` / `npm run cli` → `tsx src/cli/index.ts`).
  // Under Bun, .ts is native. In production (installed binary), the entry
  // is a compiled .js under dist/.
  const isTsEntry = /\.(ts|tsx|mts|cts)$/.test(resolvedEntry);
  const isBun = typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined';
  if (isTsEntry && !isBun) {
    return {
      command: execPath,
      args: ['--import', 'tsx', resolvedEntry, ...extraArgs],
    };
  }

  return {
    command: execPath,
    args: [resolvedEntry, ...extraArgs],
  };
}
