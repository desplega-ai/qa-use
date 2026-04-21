/**
 * Filesystem paths used by qa-use for CLI-side state.
 *
 * All paths are relative to `os.homedir()` and created lazily on first
 * write. Reading these directories does not create them — that's important
 * for commands like `tunnel ls` that report an empty state cleanly when
 * nothing has ever been written.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Base dir for all qa-use CLI-side state. Defaults to `~/.qa-use` but may
 * be overridden via `QA_USE_HOME` (test-friendly).
 */
export function qaUseDir(): string {
  const override = process.env.QA_USE_HOME;
  if (override && override.length > 0) {
    return override;
  }
  return path.join(os.homedir(), '.qa-use');
}

/**
 * Where persisted tunnel registry entries live. Each active tunnel is a
 * single JSON file named `<sha256(target)[0..10]>.json`.
 */
export function tunnelsDir(): string {
  return path.join(qaUseDir(), 'tunnels');
}

/**
 * Where detached browser-session PID files live (used by Phase 4 onward).
 */
export function sessionsDir(): string {
  return path.join(qaUseDir(), 'sessions');
}

/**
 * Ensure a directory exists (recursively). No-op if it already does.
 */
export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}
