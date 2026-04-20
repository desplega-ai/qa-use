/**
 * qa-use tunnel start - Acquire (or reuse) a tunnel for a localhost URL.
 *
 * Without `--hold`: acquires and immediately releases. That's useful for
 * a quick "give me a public URL" probe — the tunnel stays alive while
 * any other consumer (e.g. a detached `browser create`) holds it, else
 * it tears down after the registry grace window.
 *
 * With `--hold`: the process keeps holding the handle until it's killed
 * (Ctrl-C, SIGTERM). This is the primary "give me a public URL for this
 * localhost and keep it up" mode.
 */

import { Command } from 'commander';
import { tunnelRegistry } from '../../../../lib/tunnel/registry.js';
import { error, formatError, info, success } from '../../lib/output.js';

export const startCommand = new Command('start')
  .description('Start (or reuse) a tunnel for a localhost URL')
  .argument('<url>', 'Target URL to tunnel (e.g. http://localhost:3000)')
  .option('--hold', 'Keep the tunnel alive until this process is killed (Ctrl-C / SIGTERM)')
  .option('--json', 'Output as JSON')
  .action(async (url: string, options: { hold?: boolean; json?: boolean }) => {
    try {
      const handle = await tunnelRegistry.acquire(url);

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              id: handle.id,
              target: handle.target,
              publicUrl: handle.publicUrl,
              refcount: handle.refcount,
              hold: Boolean(options.hold),
            },
            null,
            2
          )
        );
      } else {
        console.log(success(`Tunnel ready: ${handle.target} → ${handle.publicUrl}`));
      }

      if (!options.hold) {
        // Release immediately. The registry keeps the tunnel alive for
        // the grace window; another consumer joining in that window
        // reuses it.
        await tunnelRegistry.release(handle);
        return;
      }

      if (!options.json) {
        console.log(info('Holding tunnel. Press Ctrl-C to release.'));
      }

      const cleanup = async (signal: string) => {
        if (!options.json) {
          console.error(`\nReceived ${signal}, releasing tunnel...`);
        }
        await tunnelRegistry.release(handle);
        process.exit(0);
      };
      process.on('SIGINT', () => void cleanup('SIGINT'));
      process.on('SIGTERM', () => void cleanup('SIGTERM'));

      // Keep the event loop alive.
      await new Promise<void>(() => {
        /* never resolves; process exits via signal */
      });
    } catch (err) {
      console.log(error(`Failed to start tunnel: ${formatError(err)}`));
      process.exit(1);
    }
  });
