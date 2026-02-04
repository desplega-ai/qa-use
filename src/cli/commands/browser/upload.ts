/**
 * qa-use browser upload - Upload files to input[type=file] elements
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Command } from 'commander';
import { BrowserApiClient } from '../../../../lib/api/browser.js';
import { resolveSessionId, touchSession } from '../../lib/browser-sessions.js';
import { normalizeRef } from '../../lib/browser-utils.js';
import { loadConfig } from '../../lib/config.js';
import { error, success } from '../../lib/output.js';
import { formatSnapshotDiff } from '../../lib/snapshot-diff.js';

interface UploadOptions {
  sessionId?: string;
  text?: string;
  diff?: boolean;
}

export const uploadCommand = new Command('upload')
  .description('Upload file(s) to a file input element')
  .argument('[ref]', 'Element ref from snapshot (e.g., "e3" or "@e3")')
  .argument('[files...]', 'File path(s) to upload')
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .option('-t, --text <description>', 'Semantic element description (AI-based)')
  .option('--no-diff', 'Disable snapshot diff output')
  .action(async (ref: string | undefined, files: string[], options: UploadOptions) => {
    try {
      // Handle the case where ref is actually a file path (when using -t)
      let actualRef = ref;
      let actualFiles = files;

      if (options.text && ref) {
        // When using -t, the ref is actually the first file
        actualRef = undefined;
        actualFiles = [ref, ...files];
      }

      // Validate source (ref or --text)
      if (!actualRef && !options.text) {
        console.log(error('Either <ref> argument or --text option is required'));
        process.exit(1);
      }

      // Validate files
      if (!actualFiles || actualFiles.length === 0) {
        console.log(error('At least one file path is required'));
        process.exit(1);
      }

      // Resolve and validate file paths
      const resolvedFiles: string[] = [];
      for (const filePath of actualFiles) {
        const resolved = path.resolve(filePath);
        if (!fs.existsSync(resolved)) {
          console.log(error(`File not found: ${filePath}`));
          process.exit(1);
        }
        resolvedFiles.push(resolved);
      }

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

      // Build action
      const action: {
        type: 'set_input_files';
        ref?: string;
        text?: string;
        files: string[];
        include_snapshot_diff?: boolean;
      } = {
        type: 'set_input_files',
        files: resolvedFiles,
      };

      if (actualRef) {
        action.ref = normalizeRef(actualRef);
      }
      if (options.text) {
        action.text = options.text;
      }
      if (options.diff !== false) {
        action.include_snapshot_diff = true;
      }

      const result = await client.executeAction(resolved.id, action);

      if (result.success) {
        const target = actualRef ? `element ${normalizeRef(actualRef)}` : `"${options.text}"`;
        const fileNames = resolvedFiles.map((f) => path.basename(f)).join(', ');
        console.log(success(`Uploaded ${fileNames} to ${target}`));

        if (result.snapshot_diff) {
          console.log('');
          console.log(formatSnapshotDiff(result.snapshot_diff));
        }

        await touchSession(resolved.id);
      } else {
        const hint = result.error || 'Upload failed';
        console.log(error(`${hint}. Use 'qa-use browser snapshot' to see available elements.`));
        process.exit(1);
      }
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to upload file(s)'));
      process.exit(1);
    }
  });
