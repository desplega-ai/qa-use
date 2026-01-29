/**
 * qa-use browser screenshot - Capture screenshot
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Command } from 'commander';
import { BrowserApiClient } from '../../../../lib/api/browser.js';
import { resolveSessionId, touchSession } from '../../lib/browser-sessions.js';
import { loadConfig } from '../../lib/config.js';
import { error, success } from '../../lib/output.js';

interface ScreenshotOptions {
  sessionId?: string;
  base64?: boolean;
  stdout?: boolean;
  url?: boolean;
}

export const screenshotCommand = new Command('screenshot')
  .description('Capture a screenshot of the current page')
  .argument('[file]', 'Output file path (default: screenshot-{timestamp}.png)')
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .option('--base64', 'Output as base64 to stdout')
  .option('--stdout', 'Output raw PNG bytes to stdout (for piping)')
  .option('--url', 'Return pre-signed URL instead of image data')
  .action(async (file: string | undefined, options: ScreenshotOptions) => {
    try {
      // Load configuration
      const config = await loadConfig();
      if (!config.api_key) {
        console.log(error('API key not configured. Run `qa-use setup` first.'));
        process.exit(1);
      }

      // Create client and set API key
      const client = new BrowserApiClient(config.api_url);
      client.setApiKey(config.api_key);

      // Resolve session ID
      const resolved = await resolveSessionId({
        explicitId: options.sessionId,
        client,
      });

      // Handle URL mode first (returns string, not buffer)
      if (options.url) {
        const url = await client.getScreenshot(resolved.id, { returnUrl: true });
        await touchSession(resolved.id);
        console.log(url);
        return;
      }

      // Get screenshot as buffer for other modes
      const imageBuffer = (await client.getScreenshot(resolved.id)) as Buffer;

      // Update session timestamp
      await touchSession(resolved.id);

      // Handle output based on options
      if (options.stdout) {
        // Output raw PNG bytes to stdout
        process.stdout.write(imageBuffer);
        return;
      }

      if (options.base64) {
        // Output base64 to stdout
        const base64 = imageBuffer.toString('base64');
        console.log(base64);
        return;
      }

      // Write to file
      const outputPath = file || generateFilename();
      const absolutePath = path.resolve(outputPath);

      // Ensure directory exists
      const dir = path.dirname(absolutePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(absolutePath, imageBuffer);
      console.log(success(`Screenshot saved to ${absolutePath}`));
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to capture screenshot'));
      process.exit(1);
    }
  });

/**
 * Generate a default filename with timestamp
 */
function generateFilename(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `screenshot-${timestamp}.png`;
}
