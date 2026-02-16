/**
 * qa-use browser downloads - List and save downloaded files from a session
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Command } from 'commander';
import { BrowserApiClient } from '../../../../lib/api/browser.js';
import type { DownloadInfo } from '../../../../lib/api/browser-types.js';
import { resolveSessionId } from '../../lib/browser-sessions.js';
import { loadConfig } from '../../lib/config.js';
import { downloadFile } from '../../lib/download.js';
import { error, success } from '../../lib/output.js';

interface DownloadsOptions {
  sessionId?: string;
  json?: boolean;
  save?: string;
}

/**
 * Format human-readable file size
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const downloadsCommand = new Command('downloads')
  .description('List or save downloaded files from a session')
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .option('--json', 'Output as JSON')
  .option('--save <dir>', 'Download files to local directory')
  .action(async (options: DownloadsOptions) => {
    try {
      const config = await loadConfig();
      if (!config.api_key) {
        console.log(error('API key not configured. Run `qa-use setup` first.'));
        process.exit(1);
      }

      const client = new BrowserApiClient(config.api_url);
      client.setApiKey(config.api_key);

      const resolved = await resolveSessionId({
        explicitId: options.sessionId,
        client,
      });

      // Get downloads - try action endpoint first (works for active sessions),
      // fall back to GET endpoint (works for closed sessions)
      let downloads: DownloadInfo[];
      let total: number;

      try {
        const actionResult = await client.executeAction(resolved.id, {
          type: 'downloads' as const,
        });
        const data = actionResult.data as
          | { downloads?: DownloadInfo[]; count?: number }
          | undefined;
        downloads = data?.downloads || [];
        total = data?.count || downloads.length;
      } catch {
        // If action fails (e.g. closed session), fall back to GET endpoint
        const result = await client.getDownloads(resolved.id);
        downloads = result.downloads;
        total = result.total;
      }

      if (options.json) {
        console.log(JSON.stringify({ downloads, total }, null, 2));
        return;
      }

      if (downloads.length === 0) {
        console.log('No downloads.');
        return;
      }

      if (options.save) {
        // Download files to local directory
        const saveDir = path.resolve(options.save);
        fs.mkdirSync(saveDir, { recursive: true });

        console.log(`Downloads (${total}):`);
        for (let i = 0; i < downloads.length; i++) {
          const dl = downloads[i];
          const destPath = path.join(saveDir, dl.filename);
          try {
            await downloadFile(dl.url, destPath);
            console.log(`  ${i + 1}. ${dl.filename}  ${formatSize(dl.size)}  → ${destPath}`);
          } catch (dlErr) {
            console.log(
              error(
                `  ${i + 1}. ${dl.filename}  Failed: ${dlErr instanceof Error ? dlErr.message : 'download error'}`
              )
            );
          }
        }
        console.log('');
        console.log(success(`Saved to ${saveDir}`));
      } else {
        // List downloads
        console.log(`Downloads (${total}):`);
        for (let i = 0; i < downloads.length; i++) {
          const dl = downloads[i];
          console.log(`  ${i + 1}. ${dl.filename}  ${formatSize(dl.size)}  ${dl.url}`);
        }
      }
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to get downloads'));
      process.exit(1);
    }
  });
